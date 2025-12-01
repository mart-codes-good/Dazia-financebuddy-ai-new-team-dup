import { EmbeddingService } from '../services/EmbeddingService';
import { VectorStore } from '../services/VectorStore';
import { ContextRetriever } from '../services/ContextRetriever';
import { Document } from '../models/Document';

/**
 * Example demonstrating how to use the vector embedding and storage system
 * 
 * This example shows:
 * 1. Setting up the embedding service and vector store
 * 2. Creating and storing documents with embeddings
 * 3. Performing semantic search and context retrieval
 * 4. Batch processing of documents
 */
export class VectorEmbeddingExample {
  private embeddingService: EmbeddingService;
  private vectorStore: VectorStore;
  private contextRetriever: ContextRetriever;

  constructor(apiKey: string, chromaUrl?: string) {
    // Initialize embedding service
    this.embeddingService = new EmbeddingService({
      apiKey,
      model: 'text-embedding-004',
      batchSize: 50
    });

    // Initialize vector store
    this.vectorStore = new VectorStore({
      chromaUrl: chromaUrl || 'http://localhost:8000',
      collectionName: 'securities_example',
      embeddingService: this.embeddingService
    });

    // Initialize context retriever
    this.contextRetriever = new ContextRetriever(this.vectorStore);
  }

  /**
   * Initialize the vector store
   */
  async initialize(): Promise<void> {
    await this.vectorStore.initialize();
    console.log('Vector store initialized successfully');
  }

  /**
   * Example: Store sample securities documents
   */
  async storeSampleDocuments(): Promise<void> {
    const sampleDocuments: Document[] = [
      {
        id: 'securities-basics-1',
        title: 'Introduction to Securities',
        content: 'Securities are financial instruments that represent ownership or debt. The most common types of securities include stocks, bonds, and derivatives. Stocks represent equity ownership in a company, while bonds represent debt obligations.',
        type: 'textbook',
        source: 'Securities Fundamentals Textbook',
        chapter: 'Chapter 1',
        section: 'Section 1.1',
        tags: ['securities', 'basics', 'stocks', 'bonds', 'fundamentals'],
        embedding: [], // Will be generated automatically
        metadata: { 
          difficulty: 'beginner',
          author: 'Securities Institute',
          year: 2023
        },
        lastUpdated: new Date()
      },
      {
        id: 'options-trading-1',
        title: 'Options Trading Strategies',
        content: 'Options are derivative securities that give the holder the right, but not the obligation, to buy or sell an underlying asset at a specific price within a certain time period. Popular strategies include covered calls, protective puts, and iron condors.',
        type: 'textbook',
        source: 'Advanced Trading Strategies',
        chapter: 'Chapter 5',
        section: 'Section 5.2',
        tags: ['options', 'derivatives', 'strategies', 'advanced', 'trading'],
        embedding: [],
        metadata: { 
          difficulty: 'advanced',
          author: 'Trading Academy',
          year: 2023
        },
        lastUpdated: new Date()
      },
      {
        id: 'stock-definition-qa',
        title: 'What is a Stock?',
        content: 'Q: What is a stock? A: A stock represents a share of ownership in a corporation. When you purchase stock, you become a shareholder and own a piece of the company. Stocks can appreciate in value and may pay dividends to shareholders.',
        type: 'qa_pair',
        source: 'Securities Q&A Database',
        tags: ['stocks', 'ownership', 'dividends', 'basics', 'definition'],
        embedding: [],
        metadata: { 
          difficulty: 'beginner',
          questionType: 'definition',
          verified: true
        },
        lastUpdated: new Date()
      },
      {
        id: 'bond-basics-1',
        title: 'Understanding Bonds',
        content: 'Bonds are debt securities issued by corporations, municipalities, or governments to raise capital. When you buy a bond, you are lending money to the issuer in exchange for periodic interest payments and the return of principal at maturity.',
        type: 'textbook',
        source: 'Fixed Income Securities Guide',
        chapter: 'Chapter 2',
        tags: ['bonds', 'debt', 'fixed-income', 'interest', 'maturity'],
        embedding: [],
        metadata: { 
          difficulty: 'intermediate',
          author: 'Bond Institute',
          year: 2023
        },
        lastUpdated: new Date()
      }
    ];

    console.log('Storing sample documents...');
    await this.vectorStore.storeDocuments(sampleDocuments);
    
    const stats = await this.vectorStore.getStats();
    console.log(`Successfully stored ${stats.count} documents in collection: ${stats.name}`);
  }

  /**
   * Example: Perform semantic search
   */
  async performSemanticSearch(): Promise<void> {
    console.log('\n--- Semantic Search Examples ---');

    // Example 1: Search for stock-related content
    console.log('\n1. Searching for "stock ownership and equity"...');
    const stockContext = await this.contextRetriever.retrieveContext(
      'stock ownership and equity',
      { limit: 3, minScore: 0.1 }
    );

    console.log(`Found ${stockContext.documents.length} relevant documents:`);
    stockContext.documents.forEach((doc, index) => {
      console.log(`  ${index + 1}. ${doc.title} (Score: ${stockContext.relevanceScores[index]?.toFixed(3)})`);
      console.log(`     Type: ${doc.type}, Source: ${doc.source}`);
    });

    // Example 2: Search for options content
    console.log('\n2. Searching for "derivative trading strategies"...');
    const optionsContext = await this.contextRetriever.retrieveContext(
      'derivative trading strategies',
      { limit: 2, documentTypes: ['textbook'] }
    );

    console.log(`Found ${optionsContext.documents.length} textbook documents:`);
    optionsContext.documents.forEach((doc, index) => {
      console.log(`  ${index + 1}. ${doc.title} (Score: ${optionsContext.relevanceScores[index]?.toFixed(3)})`);
    });

    // Example 3: Search by document type
    console.log('\n3. Retrieving Q&A documents...');
    const qaDocuments = await this.contextRetriever.retrieveByType('qa_pair', 5);
    console.log(`Found ${qaDocuments.length} Q&A documents:`);
    qaDocuments.forEach((doc, index) => {
      console.log(`  ${index + 1}. ${doc.title}`);
    });
  }

  /**
   * Example: Find similar documents
   */
  async findSimilarDocuments(): Promise<void> {
    console.log('\n--- Similar Document Search ---');

    try {
      const similarDocs = await this.contextRetriever.findSimilarDocuments('securities-basics-1', 3);
      
      console.log(`Documents similar to "Introduction to Securities":`);
      similarDocs.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.document.title} (Score: ${result.score.toFixed(3)})`);
        console.log(`     Content preview: ${result.document.content.substring(0, 100)}...`);
      });
    } catch (error) {
      console.error('Error finding similar documents:', error);
    }
  }

  /**
   * Example: Batch embedding generation
   */
  async demonstrateBatchEmbedding(): Promise<void> {
    console.log('\n--- Batch Embedding Generation ---');

    const texts = [
      'What are the risks of investing in stocks?',
      'How do bond yields affect prices?',
      'Explain the concept of portfolio diversification',
      'What is the difference between call and put options?'
    ];

    console.log('Generating embeddings for multiple queries...');
    const results = await this.embeddingService.generateEmbeddings(texts);
    
    console.log(`Generated ${results.length} embeddings:`);
    results.forEach((result, index) => {
      if (result.error) {
        console.log(`  ${index + 1}. Error: ${result.error}`);
      } else {
        console.log(`  ${index + 1}. "${result.text}" -> ${result.embedding.length} dimensions`);
      }
    });
  }

  /**
   * Example: Advanced filtering
   */
  async demonstrateAdvancedFiltering(): Promise<void> {
    console.log('\n--- Advanced Filtering Examples ---');

    // Filter by difficulty level (using metadata)
    console.log('\n1. Searching for beginner-level content about stocks...');
    const beginnerContext = await this.contextRetriever.retrieveContext(
      'stocks and ownership',
      { 
        limit: 5,
        minScore: 0.1
        // Note: Metadata filtering would require additional implementation in ChromaDB
      }
    );

    console.log(`Found ${beginnerContext.documents.length} documents:`);
    beginnerContext.documents.forEach((doc, index) => {
      const difficulty = doc.metadata.difficulty || 'unknown';
      console.log(`  ${index + 1}. ${doc.title} (Difficulty: ${difficulty})`);
    });

    // Filter by tags
    console.log('\n2. Retrieving documents tagged with "basics"...');
    const basicsDocs = await this.contextRetriever.retrieveByTags(['basics'], 3);
    console.log(`Found ${basicsDocs.length} documents with "basics" tag:`);
    basicsDocs.forEach((doc, index) => {
      console.log(`  ${index + 1}. ${doc.title} - Tags: ${doc.tags.join(', ')}`);
    });
  }

  /**
   * Clean up example data
   */
  async cleanup(): Promise<void> {
    console.log('\n--- Cleanup ---');
    await this.vectorStore.clear();
    console.log('Example collection cleared');
  }

  /**
   * Run the complete example
   */
  async runExample(): Promise<void> {
    try {
      console.log('=== Vector Embedding System Example ===\n');

      await this.initialize();
      await this.storeSampleDocuments();
      await this.performSemanticSearch();
      await this.findSimilarDocuments();
      await this.demonstrateBatchEmbedding();
      await this.demonstrateAdvancedFiltering();
      
      console.log('\n=== Example completed successfully! ===');
      
      // Uncomment the next line to clean up test data
      // await this.cleanup();
      
    } catch (error) {
      console.error('Example failed:', error);
      throw error;
    }
  }
}

/**
 * Usage example:
 * 
 * const example = new VectorEmbeddingExample('your-gemini-api-key');
 * await example.runExample();
 */