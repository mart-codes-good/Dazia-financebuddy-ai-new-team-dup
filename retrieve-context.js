/**
 * Context Retrieval Module
 * 
 * Retrieves relevant context from ChromaDB for quiz generation.
 * Simple interface: topic in, context out.
 */

require('dotenv').config();

const { ChromaClient } = require('chromadb');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configuration
const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR-GEMINI-API-KEY-HERE';
const COLLECTION_NAME = 'finance_textbooks';
const DEFAULT_CONTEXT_CHUNKS = 5;

// Initialize Gemini for embeddings
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Get relevant context from ChromaDB for a given topic
 * @param {string} topic - The topic to search for
 * @param {number} limit - Number of chunks to retrieve (default: 5)
 * @returns {Promise<string>} - Combined context text
 */
async function getContext(topic, limit = DEFAULT_CONTEXT_CHUNKS) {
  try {
    // Connect to ChromaDB
    const client = new ChromaClient({ path: CHROMA_URL });
    
    // Get or create collection
    let collection;
    try {
      collection = await client.getCollection({ name: COLLECTION_NAME });
    } catch (error) {
      // Collection doesn't exist - no RAG files processed yet
      console.log('ℹ️  No RAG files have been processed yet. Run: node process-rag-files.js');
      return '';
    }

    // Generate embedding for the search query
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const embeddingResult = await model.embedContent(topic);
    const queryEmbedding = embeddingResult.embedding.values;

    // Search for similar chunks
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: limit
    });

    // Check if we got any results
    if (!results.documents || results.documents.length === 0 || results.documents[0].length === 0) {
      console.log('ℹ️  No relevant context found for topic:', topic);
      return '';
    }

    // Combine the retrieved chunks into a single context string
    const chunks = results.documents[0];
    const distances = results.distances[0];
    
    // Filter by similarity threshold (lower distance = more similar)
    const relevantChunks = chunks.filter((chunk, index) => {
      const similarity = 1 - distances[index]; // Convert distance to similarity
      return similarity > 0.5; // Only include chunks with >50% similarity
    });

    if (relevantChunks.length === 0) {
      console.log('ℹ️  No sufficiently relevant context found for topic:', topic);
      return '';
    }

    // Format the context with separators
    const contextText = relevantChunks
      .map((chunk, index) => `[Context ${index + 1}]\n${chunk}`)
      .join('\n\n---\n\n');

    return contextText;

  } catch (error) {
    // Handle errors gracefully - don't break quiz generation
    if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
      console.warn('⚠️  ChromaDB is not running. Start it with: docker run -p 8000:8000 chromadb/chroma');
    } else if (error.message.includes('Collection') && error.message.includes('not found')) {
      console.log('ℹ️  No RAG files processed yet. Run: node process-rag-files.js');
    } else {
      console.warn('⚠️  Error retrieving context:', error.message);
    }
    return ''; // Return empty string to allow quiz generation to continue
  }
}

/**
 * Check if ChromaDB is running and accessible
 * @returns {Promise<boolean>}
 */
async function isChromaDBRunning() {
  try {
    const client = new ChromaClient({ path: CHROMA_URL });
    await client.heartbeat();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get statistics about the RAG collection
 * @returns {Promise<Object>} - Collection stats
 */
async function getCollectionStats() {
  try {
    const client = new ChromaClient({ path: CHROMA_URL });
    const collection = await client.getCollection({ name: COLLECTION_NAME });
    const count = await collection.count();
    
    return {
      exists: true,
      documentCount: count,
      collectionName: COLLECTION_NAME
    };
  } catch (error) {
    return {
      exists: false,
      documentCount: 0,
      collectionName: COLLECTION_NAME,
      error: error.message
    };
  }
}

// Export functions
module.exports = {
  getContext,
  isChromaDBRunning,
  getCollectionStats
};

// CLI usage for testing
if (require.main === module) {
  const topic = process.argv[2] || 'options trading';
  
  console.log('🔍 Testing context retrieval...');
  console.log(`Topic: "${topic}"\n`);
  
  (async () => {
    // Check if ChromaDB is running
    const isRunning = await isChromaDBRunning();
    if (!isRunning) {
      console.error('❌ ChromaDB is not running!');
      console.log('Start it with: docker run -p 8000:8000 chromadb/chroma');
      process.exit(1);
    }
    
    console.log('✅ ChromaDB is running\n');
    
    // Get collection stats
    const stats = await getCollectionStats();
    if (stats.exists) {
      console.log(`📊 Collection: ${stats.collectionName}`);
      console.log(`📄 Documents: ${stats.documentCount}\n`);
    } else {
      console.log('ℹ️  No collection found. Process some files first.\n');
    }
    
    // Retrieve context
    const context = await getContext(topic);
    
    if (context) {
      console.log('✅ Context retrieved successfully!\n');
      console.log('Context preview:');
      console.log('─'.repeat(60));
      console.log(context.substring(0, 500) + (context.length > 500 ? '...' : ''));
      console.log('─'.repeat(60));
      console.log(`\nTotal length: ${context.length} characters`);
    } else {
      console.log('❌ No context found for this topic');
    }
  })();
}
