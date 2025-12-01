import { EmbeddingService } from '../services/EmbeddingService';
import { VectorStore } from '../services/VectorStore';
import { ContextRetriever } from '../services/ContextRetriever';
import { Document } from '../models/Document';

// This is an integration test that requires actual API keys and ChromaDB
// Skip by default and run manually when needed
describe.skip('Vector Embedding Integration Tests', () => {
  let embeddingService: EmbeddingService;
  let vectorStore: VectorStore;
  let contextRetriever: ContextRetriever;

  const testDocuments: Document[] = [
    {
      id: 'test-doc-1',
      title: 'Introduction to Securities',
      content: 'Securities are financial instruments that represent ownership or debt. Common types include stocks, bonds, and derivatives. Stocks represent ownership in a company, while bonds represent debt obligations.',
      type: 'textbook',
      source: 'Securities Fundamentals Textbook',
      chapter: 'Chapter 1',
      section: 'Section 1.1',
      tags: ['securities', 'basics', 'stocks', 'bonds'],
      embedding: [],
      metadata: { difficulty: 'beginner' },
      lastUpdated: new Date()
    },
    {
      id: 'test-doc-2',
      title: 'Options Trading Strategies',
      content: 'Options are derivative securities that give the holder the right, but not the obligation, to buy or sell an underlying asset at a specific price. Common strategies include covered calls, protective puts, and straddles.',
      type: 'textbook',
      source: 'Advanced Trading Strategies',
      chapter: 'Chapter 5',
      section: 'Section 5.2',
      tags: ['options', 'derivatives', 'strategies', 'advanced'],
      embedding: [],
      metadata: { difficulty: 'advanced' },
      lastUpdated: new Date()
    },
    {
      id: 'test-doc-3',
      title: 'What is a Stock?',
      content: 'A stock represents a share of ownership in a corporation. When you buy stock, you become a shareholder and own a piece of the company. Stocks can pay dividends and appreciate in value.',
      type: 'qa_pair',
      source: 'Securities Q&A Database',
      tags: ['stocks', 'ownership', 'dividends', 'basics'],
      embedding: [],
      metadata: { difficulty: 'beginner', questionType: 'definition' },
      lastUpdated: new Date()
    }
  ];

  beforeAll(async () => {
    // Initialize services with test configuration
    // Note: These tests require actual API keys and ChromaDB instance
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required for integration tests');
    }

    embeddingService = new EmbeddingService({
      apiKey,
      model: 'text-embedding-004',
      batchSize: 10
    });

    vectorStore = new VectorStore({
      chromaUrl: process.env.CHROMA_URL || 'http://localhost:8000',
      collectionName: 'test_securities_integration',
      embeddingService
    });

    contextRetriever = new ContextRetriever(vectorStore);

    // Initialize vector store
    await vectorStore.initialize();
    
    // Clear any existing test data
    await vectorStore.clear();
  });

  afterAll(async () => {
    // Clean up test data
    if (vectorStore) {
      await vectorStore.clear();
    }
  });

  describe('End-to-End Embedding and Retrieval', () => {
    it('should store documents with generated embeddings and retrieve them', async () => {
      // Store test documents
      await vectorStore.storeDocuments(testDocuments);

      // Verify documents were stored
      const stats = await vectorStore.getStats();
      expect(stats.count).toBe(3);

      // Test semantic search
      const context = await contextRetriever.retrieveContext('What are stocks and how do they work?', {
        limit: 2
      });

      expect(context.documents).toHaveLength(2);
      expect(context.relevanceScores.length).toBe(2);
      
      // Should find documents about stocks
      const stockRelatedDocs = context.documents.filter(doc => 
        doc.content.toLowerCase().includes('stock') || 
        doc.tags.includes('stocks')
      );
      expect(stockRelatedDocs.length).toBeGreaterThan(0);

      // Scores should be in descending order
      for (let i = 1; i < context.relevanceScores.length; i++) {
        expect(context.relevanceScores[i]).toBeLessThanOrEqual(context.relevanceScores[i - 1]);
      }
    }, 30000); // 30 second timeout for API calls

    it('should retrieve documents by type', async () => {
      const textbookDocs = await contextRetriever.retrieveByType('textbook', 5);
      expect(textbookDocs.length).toBeGreaterThan(0);
      
      textbookDocs.forEach(doc => {
        expect(doc.type).toBe('textbook');
      });

      const qaDocs = await contextRetriever.retrieveByType('qa_pair', 5);
      expect(qaDocs.length).toBeGreaterThan(0);
      
      qaDocs.forEach(doc => {
        expect(doc.type).toBe('qa_pair');
      });
    }, 15000);

    it('should find similar documents', async () => {
      // Find documents similar to the first test document
      const similarDocs = await contextRetriever.findSimilarDocuments('test-doc-1', 2);
      
      expect(similarDocs.length).toBeGreaterThan(0);
      expect(similarDocs.length).toBeLessThanOrEqual(2);
      
      // Should not include the original document
      similarDocs.forEach(result => {
        expect(result.document.id).not.toBe('test-doc-1');
      });

      // Results should be sorted by similarity score
      for (let i = 1; i < similarDocs.length; i++) {
        expect(similarDocs[i].score).toBeLessThanOrEqual(similarDocs[i - 1].score);
      }
    }, 15000);

    it('should handle batch embedding generation', async () => {
      const texts = [
        'What is a bond?',
        'How do derivatives work?',
        'Explain market volatility'
      ];

      const results = await embeddingService.generateEmbeddings(texts);
      
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.text).toBe(texts[index]);
        expect(result.embedding).toHaveLength(768); // Expected dimension for text-embedding-004
        expect(result.error).toBeUndefined();
      });
    }, 20000);

    it('should filter search results by minimum score', async () => {
      const highScoreContext = await contextRetriever.retrieveContext('securities trading basics', {
        limit: 10,
        minScore: 0.8
      });

      const lowScoreContext = await contextRetriever.retrieveContext('securities trading basics', {
        limit: 10,
        minScore: 0.3
      });

      // High score filter should return fewer or equal results
      expect(highScoreContext.documents.length).toBeLessThanOrEqual(lowScoreContext.documents.length);
      
      // All high score results should have scores >= 0.8
      highScoreContext.relevanceScores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0.8);
      });
    }, 15000);

    it('should retrieve specific documents by ID', async () => {
      const retrievedDocs = await vectorStore.getDocuments(['test-doc-1', 'test-doc-3']);
      
      expect(retrievedDocs).toHaveLength(2);
      
      const doc1 = retrievedDocs.find(doc => doc.id === 'test-doc-1');
      const doc3 = retrievedDocs.find(doc => doc.id === 'test-doc-3');
      
      expect(doc1).toBeDefined();
      expect(doc1!.title).toBe('Introduction to Securities');
      
      expect(doc3).toBeDefined();
      expect(doc3!.title).toBe('What is a Stock?');
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle invalid embedding requests gracefully', async () => {
      await expect(embeddingService.generateEmbedding(''))
        .rejects.toThrow();
    }, 10000);

    it('should handle non-existent document retrieval', async () => {
      const docs = await vectorStore.getDocuments(['non-existent-id']);
      expect(docs).toHaveLength(0);
    }, 5000);

    it('should handle search with no results', async () => {
      const context = await contextRetriever.retrieveContext('completely unrelated quantum physics topic', {
        limit: 5,
        minScore: 0.95 // Very high threshold
      });

      expect(context.documents).toHaveLength(0);
      expect(context.relevanceScores).toHaveLength(0);
      expect(context.totalResults).toBe(0);
    }, 15000);
  });
});