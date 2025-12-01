import { DataIngestionPipeline } from '../services/DataIngestionPipeline';
import { EmbeddingService } from '../services/EmbeddingService';
import { VectorStore } from '../services/VectorStore';
import * as path from 'path';

/**
 * Example demonstrating how to use the data ingestion pipeline
 * to process and store securities education documents
 */
async function runDataIngestionExample() {
  console.log('🚀 Starting Data Ingestion Pipeline Example');

  try {
    // Initialize services
    const embeddingService = new EmbeddingService({
      apiKey: process.env.GEMINI_API_KEY || 'your-api-key-here',
      model: 'text-embedding-004',
      batchSize: 10
    });

    const vectorStore = new VectorStore({
      chromaUrl: process.env.CHROMA_URL || 'http://localhost:8000',
      collectionName: 'securities_documents_example',
      embeddingService
    });

    // Initialize vector store
    await vectorStore.initialize();
    console.log('✅ Vector store initialized');

    // Create data ingestion pipeline
    const pipeline = new DataIngestionPipeline(embeddingService, vectorStore, {
      inputDirectory: './data',
      chunkSize: 800,
      chunkOverlap: 150,
      batchSize: 5,
      validateBeforeProcessing: true
    });

    // Create sample data if it doesn't exist
    console.log('📁 Creating sample data structure...');
    await pipeline.createSampleDataStructure('./data');

    // Ingest documents from directory
    console.log('📚 Starting document ingestion...');
    const result = await pipeline.ingestFromDirectory();

    // Display results
    console.log('\n📊 Ingestion Results:');
    console.log(`Total files processed: ${result.inputFiles.length}`);
    console.log(`Documents created: ${result.processedDocuments.length}`);
    console.log(`Successful documents: ${result.stats.successfulDocuments}`);
    console.log(`Failed documents: ${result.stats.failedDocuments}`);
    console.log(`Total chunks: ${result.stats.totalChunks}`);
    console.log(`Processing time: ${result.stats.processingTimeMs}ms`);

    if (result.skippedFiles.length > 0) {
      console.log(`\n⚠️  Skipped files: ${result.skippedFiles.length}`);
      result.skippedFiles.forEach(file => console.log(`  - ${file}`));
    }

    if (result.errors.length > 0) {
      console.log(`\n❌ Errors encountered: ${result.errors.length}`);
      result.errors.forEach(error => {
        console.log(`  - ${error.severity.toUpperCase()}: ${error.error} (${error.source})`);
      });
    }

    // Display sample processed documents
    console.log('\n📄 Sample processed documents:');
    result.processedDocuments.slice(0, 3).forEach((doc, index) => {
      console.log(`\n${index + 1}. ${doc.title}`);
      console.log(`   Type: ${doc.type}`);
      console.log(`   Source: ${doc.source}`);
      console.log(`   Tags: ${doc.tags.join(', ')}`);
      console.log(`   Content length: ${doc.content.length} characters`);
      console.log(`   Embedding dimensions: ${doc.embedding.length}`);
      if (doc.chapter) console.log(`   Chapter: ${doc.chapter}`);
      if (doc.section) console.log(`   Section: ${doc.section}`);
    });

    // Test vector store functionality
    console.log('\n🔍 Testing vector search...');
    const searchResults = await vectorStore.searchSimilar('What are securities?', { limit: 3 });
    
    console.log(`Found ${searchResults.length} similar documents:`);
    searchResults.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.document.title} (Score: ${result.score.toFixed(3)})`);
      console.log(`   Content preview: ${result.document.content.substring(0, 100)}...`);
    });

    // Get collection statistics
    const stats = await vectorStore.getStats();
    console.log(`\n📈 Vector store statistics:`);
    console.log(`Collection: ${stats.name}`);
    console.log(`Total documents: ${stats.count}`);

    console.log('\n✅ Data ingestion example completed successfully!');

  } catch (error) {
    console.error('❌ Error running data ingestion example:', error);
    process.exit(1);
  }
}

/**
 * Example of ingesting custom raw documents
 */
async function ingestCustomDocuments() {
  console.log('📝 Ingesting custom documents example');

  try {
    const embeddingService = new EmbeddingService({
      apiKey: process.env.GEMINI_API_KEY || 'your-api-key-here'
    });

    const vectorStore = new VectorStore({
      embeddingService
    });

    await vectorStore.initialize();

    const pipeline = new DataIngestionPipeline(embeddingService, vectorStore);

    // Custom documents
    const customDocuments = [
      {
        title: 'Options Trading Basics',
        content: `Options are financial derivatives that give the holder the right, but not the obligation, to buy or sell an underlying asset at a predetermined price within a specific time period. 

Call options give the right to buy, while put options give the right to sell. Options are used for hedging, speculation, and income generation.

Key concepts include:
- Strike price: The predetermined price
- Expiration date: When the option expires
- Premium: The cost to purchase the option
- Intrinsic value: The option's immediate exercise value
- Time value: The additional value due to time remaining`,
        source: 'custom_options_guide.txt',
        type: 'textbook' as const,
        metadata: {
          difficulty: 'intermediate',
          topic: 'derivatives'
        }
      },
      {
        title: 'SEC Regulation Best Execution',
        content: `SEC Rule 11Ac1-5 requires broker-dealers to review the execution quality of customer orders and to identify the venues that provide the most favorable terms of execution.

Best execution means seeking the most favorable terms for a customer's order under the circumstances. Factors to consider include:
- Price improvement opportunities
- Speed of execution
- Likelihood of execution
- Size of the order
- Nature of the market for the security

Broker-dealers must conduct regular and rigorous reviews of execution quality and make quarterly reports available to customers.`,
        source: 'sec_best_execution.txt',
        type: 'regulation' as const,
        metadata: {
          regulation: 'Rule 11Ac1-5',
          authority: 'SEC'
        }
      }
    ];

    const result = await pipeline.ingestFromRawDocuments(customDocuments);

    console.log('Custom document ingestion results:');
    console.log(`Documents processed: ${result.processedDocuments.length}`);
    console.log(`Processing time: ${result.stats.processingTimeMs}ms`);

    result.processedDocuments.forEach(doc => {
      console.log(`\n- ${doc.title}`);
      console.log(`  Type: ${doc.type}, Tags: ${doc.tags.join(', ')}`);
    });

  } catch (error) {
    console.error('Error ingesting custom documents:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'custom':
      ingestCustomDocuments();
      break;
    case 'directory':
    default:
      runDataIngestionExample();
      break;
  }
}

export { runDataIngestionExample, ingestCustomDocuments };