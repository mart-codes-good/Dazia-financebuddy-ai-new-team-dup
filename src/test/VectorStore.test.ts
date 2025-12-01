import { VectorStore } from '../services/VectorStore';
import { EmbeddingService } from '../services/EmbeddingService';
import { Document } from '../models/Document';

// Mock ChromaDB
jest.mock('chromadb', () => ({
  ChromaApi: jest.fn().mockImplementation(() => ({
    getCollection: jest.fn(),
    createCollection: jest.fn(),
    deleteCollection: jest.fn()
  }))
}));

describe('VectorStore', () => {
  let vectorStore: VectorStore;
  let mockEmbeddingService: jest.Mocked<EmbeddingService>;
  let mockCollection: any;
  let mockClient: any;

  beforeEach(() => {
    // Mock embedding service
    mockEmbeddingService = {
      generateEmbedding: jest.fn(),
      generateEmbeddings: jest.fn(),
      generateQueryEmbedding: jest.fn(),
      validateEmbedding: jest.fn()
    } as any;

    // Mock collection
    mockCollection = {
      add: jest.fn(),
      query: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    };

    // Mock ChromaDB client
    const ChromaApi = require('chromadb').ChromaApi;
    mockClient = new ChromaApi();
    mockClient.getCollection.mockResolvedValue(mockCollection);
    mockClient.createCollection.mockResolvedValue(mockCollection);

    vectorStore = new VectorStore({
      chromaUrl: 'http://localhost:8000',
      collectionName: 'test_collection',
      embeddingService: mockEmbeddingService
    });

    // Replace the client with our mock
    (vectorStore as any).client = mockClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize and get existing collection', async () => {
      await vectorStore.initialize();

      expect(mockClient.getCollection).toHaveBeenCalledWith({
        name: 'test_collection'
      });
      expect((vectorStore as any).isInitialized).toBe(true);
    });

    it('should create collection if it does not exist', async () => {
      mockClient.getCollection.mockRejectedValue(new Error('Collection not found'));

      await vectorStore.initialize();

      expect(mockClient.createCollection).toHaveBeenCalledWith({
        name: 'test_collection',
        metadata: { description: 'Securities education documents' }
      });
    });

    it('should throw error if initialization fails', async () => {
      mockClient.getCollection.mockRejectedValue(new Error('Connection failed'));
      mockClient.createCollection.mockRejectedValue(new Error('Connection failed'));

      await expect(vectorStore.initialize()).rejects.toThrow('Failed to initialize vector store');
    });
  });

  describe('storeDocument', () => {
    const mockDocument: Document = {
      id: 'doc1',
      title: 'Test Document',
      content: 'This is test content',
      type: 'textbook',
      source: 'Test Source',
      chapter: 'Chapter 1',
      section: 'Section 1.1',
      tags: ['test', 'document'],
      embedding: [0.1, 0.2, 0.3],
      metadata: { custom: 'value' },
      lastUpdated: new Date('2023-01-01')
    };

    beforeEach(async () => {
      await vectorStore.initialize();
    });

    it('should store document with existing embedding', async () => {
      await vectorStore.storeDocument(mockDocument);

      expect(mockCollection.add).toHaveBeenCalledWith({
        ids: ['doc1'],
        embeddings: [[0.1, 0.2, 0.3]],
        documents: ['This is test content'],
        metadatas: [{
          title: 'Test Document',
          type: 'textbook',
          source: 'Test Source',
          chapter: 'Chapter 1',
          section: 'Section 1.1',
          tags: JSON.stringify(['test', 'document']),
          lastUpdated: '2023-01-01T00:00:00.000Z',
          custom: 'value'
        }]
      });
    });

    it('should generate embedding if not provided', async () => {
      const docWithoutEmbedding = { ...mockDocument, embedding: [] };
      const generatedEmbedding = [0.4, 0.5, 0.6];
      mockEmbeddingService.generateEmbedding.mockResolvedValue(generatedEmbedding);

      await vectorStore.storeDocument(docWithoutEmbedding);

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('This is test content');
      expect(mockCollection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          embeddings: [generatedEmbedding]
        })
      );
    });

    it('should throw error if storage fails', async () => {
      mockCollection.add.mockRejectedValue(new Error('Storage failed'));

      await expect(vectorStore.storeDocument(mockDocument))
        .rejects.toThrow('Failed to store document doc1');
    });
  });

  describe('storeDocuments', () => {
    const mockDocuments: Document[] = [
      {
        id: 'doc1',
        title: 'Document 1',
        content: 'Content 1',
        type: 'textbook',
        source: 'Source 1',
        tags: ['tag1'],
        embedding: [0.1, 0.2],
        metadata: {},
        lastUpdated: new Date('2023-01-01')
      },
      {
        id: 'doc2',
        title: 'Document 2',
        content: 'Content 2',
        type: 'qa_pair',
        source: 'Source 2',
        tags: ['tag2'],
        embedding: [],
        metadata: {},
        lastUpdated: new Date('2023-01-02')
      }
    ];

    beforeEach(async () => {
      await vectorStore.initialize();
    });

    it('should store multiple documents', async () => {
      const generatedEmbedding = [0.3, 0.4];
      mockEmbeddingService.generateEmbedding.mockResolvedValue(generatedEmbedding);

      await vectorStore.storeDocuments(mockDocuments);

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('Content 2');
      expect(mockCollection.add).toHaveBeenCalledWith({
        ids: ['doc1', 'doc2'],
        embeddings: [[0.1, 0.2], generatedEmbedding],
        documents: ['Content 1', 'Content 2'],
        metadatas: [
          expect.objectContaining({ title: 'Document 1', type: 'textbook' }),
          expect.objectContaining({ title: 'Document 2', type: 'qa_pair' })
        ]
      });
    });

    it('should handle empty documents array', async () => {
      await vectorStore.storeDocuments([]);
      expect(mockCollection.add).not.toHaveBeenCalled();
    });
  });

  describe('searchSimilar', () => {
    beforeEach(async () => {
      await vectorStore.initialize();
    });

    it('should search for similar documents', async () => {
      const queryEmbedding = [0.1, 0.2, 0.3];
      const mockResults = {
        ids: [['doc1', 'doc2']],
        documents: [['Content 1', 'Content 2']],
        metadatas: [[
          { title: 'Document 1', type: 'textbook', source: 'Source 1', tags: '["tag1"]', lastUpdated: '2023-01-01T00:00:00.000Z' },
          { title: 'Document 2', type: 'qa_pair', source: 'Source 2', tags: '["tag2"]', lastUpdated: '2023-01-02T00:00:00.000Z' }
        ]],
        distances: [[0.1, 0.2]]
      };

      mockEmbeddingService.generateQueryEmbedding.mockResolvedValue(queryEmbedding);
      mockCollection.query.mockResolvedValue(mockResults);

      const results = await vectorStore.searchSimilar('test query', { limit: 5 });

      expect(mockEmbeddingService.generateQueryEmbedding).toHaveBeenCalledWith('test query');
      expect(mockCollection.query).toHaveBeenCalledWith({
        queryEmbeddings: [queryEmbedding],
        nResults: 5,
        include: ['documents', 'metadatas', 'distances']
      });

      expect(results).toHaveLength(2);
      expect(results[0]?.document.id).toBe('doc1');
      expect(results[0]?.score).toBe(0.9); // 1 - 0.1
      expect(results[1]?.document.id).toBe('doc2');
      expect(results[1]?.score).toBe(0.8); // 1 - 0.2
    });

    it('should handle search with filters', async () => {
      const queryEmbedding = [0.1, 0.2, 0.3];
      mockEmbeddingService.generateQueryEmbedding.mockResolvedValue(queryEmbedding);
      mockCollection.query.mockResolvedValue({ ids: [[]], documents: [[]], metadatas: [[]], distances: [[]] });

      await vectorStore.searchSimilar('test query', { 
        limit: 5, 
        filter: { type: 'textbook' } 
      });

      expect(mockCollection.query).toHaveBeenCalledWith({
        queryEmbeddings: [queryEmbedding],
        nResults: 5,
        where: { type: 'textbook' },
        include: ['documents', 'metadatas', 'distances']
      });
    });
  });

  describe('getDocuments', () => {
    beforeEach(async () => {
      await vectorStore.initialize();
    });

    it('should retrieve documents by IDs', async () => {
      const mockResults = {
        ids: ['doc1', 'doc2'],
        documents: ['Content 1', 'Content 2'],
        metadatas: [
          { title: 'Document 1', type: 'textbook', source: 'Source 1', tags: '["tag1"]', lastUpdated: '2023-01-01T00:00:00.000Z' },
          { title: 'Document 2', type: 'qa_pair', source: 'Source 2', tags: '["tag2"]', lastUpdated: '2023-01-02T00:00:00.000Z' }
        ]
      };

      mockCollection.get.mockResolvedValue(mockResults);

      const results = await vectorStore.getDocuments(['doc1', 'doc2']);

      expect(mockCollection.get).toHaveBeenCalledWith({
        ids: ['doc1', 'doc2'],
        include: ['documents', 'metadatas']
      });

      expect(results).toHaveLength(2);
      expect(results[0]?.id).toBe('doc1');
      expect(results[0]?.title).toBe('Document 1');
      expect(results[1]?.id).toBe('doc2');
      expect(results[1]?.title).toBe('Document 2');
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await vectorStore.initialize();
    });

    it('should return collection statistics', async () => {
      mockCollection.count.mockResolvedValue(42);

      const stats = await vectorStore.getStats();

      expect(stats).toEqual({
        count: 42,
        name: 'test_collection'
      });
    });
  });

  describe('clear', () => {
    beforeEach(async () => {
      await vectorStore.initialize();
    });

    it('should clear all documents from collection', async () => {
      await vectorStore.clear();

      expect(mockClient.deleteCollection).toHaveBeenCalledWith({ name: 'test_collection' });
      expect(mockClient.createCollection).toHaveBeenCalledWith({
        name: 'test_collection',
        metadata: { description: 'Securities education documents' }
      });
    });
  });
});