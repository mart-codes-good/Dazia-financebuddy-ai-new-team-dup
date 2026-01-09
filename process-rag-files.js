/**
 * RAG File Processing Script
 * 
 * Processes all files in RAG_FILES/ directory:
 * - Parses PDFs and text files
 * - Chunks content into manageable pieces
 * - Generates embeddings
 * - Stores in ChromaDB for retrieval
 * 
 * Usage: node process-rag-files.js
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { ChromaClient } = require('chromadb');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configuration
const RAG_FILES_DIR = './RAG_FILES';
const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR-GEMINI-API-KEY-HERE';
const COLLECTION_NAME = 'finance_textbooks';
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE) || 800;
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP) || 150;
const BATCH_SIZE = 10; // Process embeddings in batches

// Initialize Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Recursively get all supported files from RAG_FILES directory (including subfolders)
 * @param {string} dir - Directory to scan (defaults to RAG_FILES_DIR)
 * @returns {string[]} Array of file paths
 */
function getFilesFromDirectory(dir = RAG_FILES_DIR) {
  let files = [];

  if (!fs.existsSync(dir)) {
    // Only print the "does not exist" error for the root folder to avoid noise
    if (dir === RAG_FILES_DIR) {
      console.error(`❌ Directory ${RAG_FILES_DIR} does not exist!`);
    }
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Recurse into subfolders
      files = files.concat(getFilesFromDirectory(fullPath));
      continue;
    }

    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      // Support PDF, TXT, and MD files
      if (['.pdf', '.txt', '.md'].includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Parse a PDF file and extract text
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<string>} Extracted text
 */
async function parsePDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

/**
 * Read a text file
 * @param {string} filePath - Path to text file
 * @returns {string} File content
 */
function readTextFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read text file: ${error.message}`);
  }
}

/**
 * Extract text from a file based on its type
 * @param {string} filePath - Path to file
 * @returns {Promise<string>} Extracted text
 */
async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    return await parsePDF(filePath);
  } else if (ext === '.txt' || ext === '.md') {
    return readTextFile(filePath);
  } else {
    throw new Error(`Unsupported file type: ${ext}`);
  }
}

/**
 * Clean and normalize text
 * @param {string} text - Raw text
 * @returns {string} Cleaned text
 */
function cleanText(text) {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove special characters that might cause issues
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize line breaks
    .replace(/\r\n/g, '\n')
    // Remove multiple consecutive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Trim
    .trim();
}

/**
 * Split text into chunks with overlap
 * @param {string} text - Text to chunk
 * @param {number} chunkSize - Size of each chunk
 * @param {number} overlap - Overlap between chunks
 * @returns {string[]} Array of text chunks
 */
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize;

    // If this is not the last chunk, try to break at a sentence boundary
    if (endIndex < text.length) {
      // Look for sentence endings near the chunk boundary
      const searchStart = Math.max(startIndex, endIndex - 100);
      const searchText = text.substring(searchStart, endIndex + 100);
      const sentenceEndings = ['. ', '.\n', '! ', '!\n', '? ', '?\n'];

      let bestBreak = -1;
      for (const ending of sentenceEndings) {
        const index = searchText.lastIndexOf(ending);
        if (index > 0) {
          bestBreak = Math.max(bestBreak, searchStart + index + ending.length);
        }
      }

      if (bestBreak > startIndex) {
        endIndex = bestBreak;
      }
    }

    const chunk = text.substring(startIndex, endIndex).trim();

    // Only add non-empty chunks
    if (chunk.length > 50) { // Minimum chunk size
      chunks.push(chunk);
    }

    // Move to next chunk with overlap
    startIndex = endIndex - overlap;

    // Prevent infinite loop
    if (startIndex >= text.length - overlap) {
      break;
    }
  }

  return chunks;
}

/**
 * Generate embedding for text using Gemini
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Embedding vector
 */
async function generateEmbedding(text) {
  try {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

/**
 * Generate embeddings for multiple texts in batches
 * @param {string[]} texts - Array of texts
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
async function generateEmbeddingsBatch(texts) {
  const embeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    console.log(`  Generating embeddings for chunks ${i + 1}-${Math.min(i + BATCH_SIZE, texts.length)}...`);

    const batchEmbeddings = await Promise.all(
      batch.map(text => generateEmbedding(text))
    );

    embeddings.push(...batchEmbeddings);

    // Small delay to avoid rate limiting
    if (i + BATCH_SIZE < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return embeddings;
}

/**
 * Check if a file has already been processed
 * @param {Object} collection - ChromaDB collection
 * @param {string} filename - Name of the file
 * @returns {Promise<boolean>}
 */
async function isFileProcessed(collection, filename) {
  try {
    const results = await collection.get({
      where: { filename: filename }
    });
    return results.ids.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Process a single file
 * @param {string} filePath - Path to file
 * @param {Object} collection - ChromaDB collection
 * @returns {Promise<Object>} Processing result
 */
async function processFile(filePath, collection) {
  const filename = path.basename(filePath);
  const fileType = path.extname(filePath).toLowerCase();

  // ✅ NEW: determine course tag based on subfolder name (unify CSC volumes)
  const folderName = path.basename(path.dirname(filePath)).toLowerCase();
  let course;
  if (folderName.includes('csc')) {
    course = 'CSC';
  } else if (folderName.includes('ific')) {
    course = 'IFIC';
  } else {
    course = folderName.replace(/\s+/g, '_').toUpperCase();
  }

  console.log(`\n📄 Processing: ${filename} (course: ${course})`);

  const result = {
    filename,
    success: false,
    chunks: 0,
    error: null
  };

  try {
    // Check if already processed
    const alreadyProcessed = await isFileProcessed(collection, filename);
    if (alreadyProcessed) {
      console.log(`  ⏭️  Already processed, skipping...`);
      result.success = true;
      result.skipped = true;
      return result;
    }

    // Extract text
    console.log(`  📖 Extracting text...`);
    const rawText = await extractText(filePath);

    if (!rawText || rawText.length < 100) {
      throw new Error('Extracted text is too short or empty');
    }

    console.log(`  ✅ Extracted ${rawText.length} characters`);

    // Clean text
    const cleanedText = cleanText(rawText);
    console.log(`  🧹 Cleaned to ${cleanedText.length} characters`);

    // Chunk text
    console.log(`  ✂️  Chunking text (size: ${CHUNK_SIZE}, overlap: ${CHUNK_OVERLAP})...`);
    const chunks = chunkText(cleanedText);
    console.log(`  ✅ Created ${chunks.length} chunks`);

    if (chunks.length === 0) {
      throw new Error('No chunks created from text');
    }

    // Generate embeddings
    console.log(`  🧮 Generating embeddings...`);
    const embeddings = await generateEmbeddingsBatch(chunks);
    console.log(`  ✅ Generated ${embeddings.length} embeddings`);

    // Prepare data for ChromaDB
    const ids = chunks.map((_, index) => `${filename}_chunk_${index}`);
    const metadatas = chunks.map((chunk, index) => ({
      filename,
      course, // ✅ NEW: add course tag for filtering (CSC vs IFIC)
      file_type: fileType,
      chunk_index: index,
      total_chunks: chunks.length,
      chunk_length: chunk.length,
      processed_at: new Date().toISOString()
    }));

    // Store in ChromaDB
    console.log(`  💾 Storing in ChromaDB...`);
    await collection.add({
      ids,
      embeddings,
      documents: chunks,
      metadatas
    });

    console.log(`  ✅ Successfully stored ${chunks.length} chunks`);

    result.success = true;
    result.chunks = chunks.length;

  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    result.error = error.message;
  }

  return result;
}

/**
 * Main processing function
 */
async function main() {
  console.log('🚀 RAG File Processing Script\n');
  console.log('═'.repeat(60));

  // Check if RAG_FILES directory exists
  if (!fs.existsSync(RAG_FILES_DIR)) {
    console.error(`❌ Directory ${RAG_FILES_DIR} does not exist!`);
    console.log(`Create it with: mkdir ${RAG_FILES_DIR}`);
    process.exit(1);
  }

  // Get files to process (now recursive)
  const files = getFilesFromDirectory();

  if (files.length === 0) {
    console.log(`\nℹ️  No files found in ${RAG_FILES_DIR}/`);
    console.log('\nSupported formats: .pdf, .txt, .md');
    console.log(`\nAdd files to ${RAG_FILES_DIR}/ (or subfolders) and run this script again.`);
    process.exit(0);
  }

  console.log(`\n📁 Found ${files.length} file(s) in ${RAG_FILES_DIR}/ (including subfolders):`);
  files.forEach(file => console.log(`   - ${path.relative(RAG_FILES_DIR, file)}`));

  // Connect to ChromaDB
  console.log(`\n🔌 Connecting to ChromaDB at ${CHROMA_URL}...`);
  let client;
  try {
    client = new ChromaClient({ path: CHROMA_URL });
    await client.heartbeat();
    console.log('✅ Connected to ChromaDB');
  } catch (error) {
    console.error('❌ Failed to connect to ChromaDB!');
    console.error(`Error: ${error.message}`);
    console.log('\nMake sure ChromaDB is running:');
    console.log('  docker run -p 8000:8000 chromadb/chroma');
    process.exit(1);
  }

  // Get or create collection
  console.log(`\n📚 Setting up collection: ${COLLECTION_NAME}...`);
  let collection;
  try {
    collection = await client.getOrCreateCollection({
      name: COLLECTION_NAME,
      metadata: { description: 'Finance textbooks and educational materials' }
    });
    console.log('✅ Collection ready');
  } catch (error) {
    console.error('❌ Failed to create collection!');
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }

  // Process each file
  console.log('\n' + '═'.repeat(60));
  console.log('Processing Files');
  console.log('═'.repeat(60));

  const results = [];
  for (const file of files) {
    const result = await processFile(file, collection);
    results.push(result);
  }

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('Summary');
  console.log('═'.repeat(60));

  const successful = results.filter(r => r.success && !r.skipped);
  const skipped = results.filter(r => r.skipped);
  const failed = results.filter(r => !r.success);
  const totalChunks = results.reduce((sum, r) => sum + (r.chunks || 0), 0);

  console.log(`\n✅ Successfully processed: ${successful.length} file(s)`);
  if (skipped.length > 0) {
    console.log(`⏭️  Skipped (already processed): ${skipped.length} file(s)`);
  }
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length} file(s)`);
    failed.forEach(r => {
      console.log(`   - ${r.filename}: ${r.error}`);
    });
  }
  console.log(`\n📊 Total chunks created: ${totalChunks}`);

  // Get collection stats
  try {
    const count = await collection.count();
    console.log(`📚 Total documents in collection: ${count}`);
  } catch (error) {
    // Ignore error
  }

  console.log('\n🎉 Processing complete!');
  console.log('\nNext steps:');
  console.log('  1. Generate a quiz: node FinanceBuddy.js "Your Topic" 10');
  console.log('  2. Test context retrieval: node retrieve-context.js "Your Topic"');
  console.log('\n' + '═'.repeat(60));
}

// Run main function
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = {
  processFile,
  chunkText,
  cleanText,
  extractText
};
