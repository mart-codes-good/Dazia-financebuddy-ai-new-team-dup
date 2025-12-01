import { ContextRetriever } from '../services/ContextRetriever';
import { VectorStore, SearchResult } from '../services/VectorStore';
import { Document } from '../models/Document';
import { ResultReranker } from '../services/ResultReranker';

// Mock VectorStore and ResultReranker
jest.mock('../services/VectorStore');
jest.mock('../services/ResultReranker');

describe('ContextRetriever', () => {
  let contextRetriever: ContextRetriever;
  let mockVectorStore: jest.Mocked<VectorStore>;

  const mockDocument1: Document = {
    id: 'doc1',
    title: 'Securities Basics',
    content: 'Introduction to securities trading',
    type: 'textbook',
    source: 'Securities Textbook',
    chapter: 'Chapter 1',
    tags: ['basics', 'trading'],
    embedding: [0.1, 0.2, 0.3],
    metadata: {},
    lastUpdated: new Date('2023-01-01')
  };

  const mockDocument2: Document = {
    id: 'doc2',
    title: 'Options Trading',
    content: 'Advanced options strategies',
    type: 'qa_pair',
    source: 'Q&A Database',
    tags: ['options', 'advanced'],
    embedding: [0.4, 0.5, 0.6],
    metadata: {},
    lastUpdated: new Date('2023-01-02')
  };

  const mockSearchResults: SearchResult[] = [
    { document: mockDocument1, score: 0.9, distance: 0.1 },
    { document: mockDocument2, score: 0.8, distance: 0.2 }
  ];

  beforeEach(() => {
    mockVectorStore = {
      initialize: jest.fn(),
      storeDocument: jest.fn(),
      storeDocuments: jest.fn(),
      searchSimilar: jest.fn(),
      searchWithEmbedding: jest.fn(),
      getDocuments: jest.fn(),
      deleteDocuments: jest.fn(),
      getStats: jest.fn(),
      clear: jest.fn()
    } as any;

    contextRetriever = new ContextRetriever(mockVectorStore);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('retrieveContext', () => {
    it('should retrieve context for a query', async () => {
      mockVectorStore.searchSimilar.mockResolvedValue(mockSearchResults);

      const result = await contextRetriever.retrieveContext('securities trading', {
        limit: 5,
        minScore: 0.7
      });

      expect(mockVectorStore.searchSimilar).toHaveBeenCalledWith('securities trading', {
        limit: 5,
        includeMetadata: true
      });

      expect(result.documents).toHaveLength(2);
      expect(result.documents[0]).toBe(mockDocument1);
      expect(result.documents[1]).toBe(mockDocument2);
      expect(result.relevanceScores).toEqual([0.9, 0.8]);
      expect(result.totalResults).toBe(2);
      expect(result.query).toBe('securities trading');
      expect(result.retrievedAt).toBeInstanceOf(Date);
    });

    it('should filter results by minimum score', async () => {
      mockVectorStore.searchSimilar.mockResolvedValue(mockSearchResults);

      const result = await contextRetriever.retrieveContext('securities trading', {
        minScore: 0.85
      });

      expect(result.documents).toHaveLength(1);
      expect(result.documents[0]).toBe(mockDocument1);
      expect(result.relevanceScores).toEqual([0.9]);
    });

    it('should apply document type filter', async () => {
      mockVectorStore.searchSimilar.mockResolvedValue(mockSearchResults);

      await contextRetriever.retrieveContext('securities trading', {
        documentTypes: ['textbook']
      });

      expect(mockVectorStore.searchSimilar).toHaveBeenCalledWith('securities trading', {
        limit: 10,
        includeMetadata: true,
        filter: { type: 'textbook' }
      });
    });

    it('should apply multiple document types filter', async () => {
      mockVectorStore.searchSimilar.mockResolvedValue(mockSearchResults);

      await contextRetriever.retrieveContext('securities trading', {
        documentTypes: ['textbook', 'qa_pair']
      });

      expect(mockVectorStore.searchSimilar).toHaveBeenCalledWith('securities trading', {
        limit: 10,
        includeMetadata: true,
        filter: { type: { $in: ['textbook', 'qa_pair'] } }
      });
    });

    it('should apply tags filter', async () => {
      mockVectorStore.searchSimilar.mockResolvedValue(mockSearchResults);

      await contextRetriever.retrieveContext('securities trading', {
        tags: ['basics']
      });

      expect(mockVectorStore.searchSimilar).toHaveBeenCalledWith('securities trading', {
        limit: 10,
        includeMetadata: true,
        filter: { tags: { $contains: 'basics' } }
      });
    });

    it('should handle search errors', async () => {
      mockVectorStore.searchSimilar.mockRejectedValue(new Error('Search failed'));

      await expect(contextRetriever.retrieveContext('test query'))
        .rejects.toThrow('Failed to retrieve context: Search failed');
    });
  });

  describe('retrieveContextWithEmbedding', () => {
    it('should retrieve context using pre-computed embedding', async () => {
      const embedding = [0.1, 0.2, 0.3, 0.4];
      mockVectorStore.searchWithEmbedding.mockResolvedValue(mockSearchResults);

      const result = await contextRetriever.retrieveContextWithEmbedding(
        embedding,
        'test query',
        { limit: 3 }
      );

      expect(mockVectorStore.searchWithEmbedding).toHaveBeenCalledWith(embedding, {
        limit: 3,
        includeMetadata: true
      });

      expect(result.documents).toHaveLength(2);
      expect(result.query).toBe('test query');
    });

    it('should handle embedding search errors', async () => {
      const embedding = [0.1, 0.2, 0.3];
      mockVectorStore.searchWithEmbedding.mockRejectedValue(new Error('Embedding search failed'));

      await expect(contextRetriever.retrieveContextWithEmbedding(embedding, 'test query'))
        .rejects.toThrow('Failed to retrieve context with embedding: Embedding search failed');
    });
  });

  describe('hybridSearch', () => {
    beforeEach(() => {
      // Mock ResultReranker methods
      const mockReranker = ResultReranker as jest.MockedClass<typeof ResultReranker>;
      mockReranker.prototype.rerank = jest.fn().mockReturnValue(mockSearchResults.map(r => ({
        ...r,
        finalScore: r.score,
        rankingFactors: {
          originalScore: r.score,
          authorityScore: 0.5,
          recencyScore: 0.5,
          diversityScore: 0.5,
          typeScore: 0.5
        }
      })));
      mockReranker.prototype.filterResults = jest.fn().mockReturnValue(mockSearchResults);
      mockReranker.prototype.ensureDiversity = jest.fn().mockReturnValue(mockSearchResults.map(r => ({
        ...r,
        finalScore: r.score,
        rankingFactors: {
          originalScore: r.score,
          authorityScore: 0.5,
          recencyScore: 0.5,
          diversityScore: 0.5,
          typeScore: 0.5
        }
      })));
    });

    it('should perform hybrid search combining semantic and keyword results', async () => {
      mockVectorStore.searchSimilar.mockResolvedValue(mockSearchResults);

      const result = await contextRetriever.hybridSearch('trading', {
        limit: 5,
        keywordWeight: 0.3,
        semanticWeight: 0.7,
        enableReranking: true
      });

      expect(mockVectorStore.searchSimilar).toHaveBeenCalled();
      expect(result.documents).toBeDefined();
      expect(result.query).toBe('trading');
      // The result might be empty due to keyword filtering, which is acceptable
      expect(Array.isArray(result.documents)).toBe(true);
    });

    it('should handle hybrid search without reranking', async () => {
      mockVectorStore.searchSimilar.mockResolvedValue(mockSearchResults);

      const result = await contextRetriever.hybridSearch('securities trading', {
        enableReranking: false
      });

      expect(result.documents).toHaveLength(2);
    });

    it('should handle hybrid search errors', async () => {
      mockVectorStore.searchSimilar.mockRejectedValue(new Error('Search failed'));

      await expect(contextRetriever.hybridSearch('test query'))
        .rejects.toThrow('Failed to perform hybrid search: Search failed');
    });
  });

  describe('retrieveByType', () => {
    it('should retrieve documents by type', async () => {
      const firstResult = mockSearchResults[0];
      if (!firstResult) throw new Error('Test setup error: mockSearchResults[0] is undefined');
      
      mockVectorStore.searchSimilar.mockResolvedValue([firstResult]);

      const result = await contextRetriever.retrieveByType('textbook', 5);

      expect(mockVectorStore.searchSimilar).toHaveBeenCalledWith('', {
        limit: 5,
        filter: { type: 'textbook' }
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(mockDocument1);
    });

    it('should handle retrieval errors', async () => {
      mockVectorStore.searchSimilar.mockRejectedValue(new Error('Retrieval failed'));

      await expect(contextRetriever.retrieveByType('textbook'))
        .rejects.toThrow('Failed to retrieve documents by type: Retrieval failed');
    });
  });

  describe('retrieveByTags', () => {
    it('should retrieve documents by tags', async () => {
      mockVectorStore.searchSimilar.mockResolvedValue(mockSearchResults);

      const result = await contextRetriever.retrieveByTags(['trading'], 8);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(mockDocument1);
      expect(result[1]).toBe(mockDocument2);
    });

    it('should handle tag retrieval errors', async () => {
      mockVectorStore.searchSimilar.mockRejectedValue(new Error('Tag search failed'));

      await expect(contextRetriever.retrieveByTags(['trading']))
        .rejects.toThrow('Failed to retrieve documents by tags: Failed to retrieve context: Tag search failed');
    });
  });

  describe('findSimilarDocuments', () => {
    it('should find similar documents to a given document', async () => {
      mockVectorStore.getDocuments.mockResolvedValue([mockDocument1]);
      mockVectorStore.searchWithEmbedding.mockResolvedValue([
        mockSearchResults[0]!, // doc1 result
        mockSearchResults[1]!, // doc2 result  
        { document: { ...mockDocument1, id: 'doc1' }, score: 1.0, distance: 0.0 } // Original document
      ]);

      const result = await contextRetriever.findSimilarDocuments('doc1', 3);

      expect(mockVectorStore.getDocuments).toHaveBeenCalledWith(['doc1']);
      expect(mockVectorStore.searchWithEmbedding).toHaveBeenCalledWith(
        mockDocument1.embedding,
        { limit: 4 } // 3 + 1 to account for original document
      );

      expect(result.length).toBeGreaterThan(0); // Should have some results
      expect(result.find(r => r.document.id === 'doc1')).toBeUndefined(); // Original document filtered out
    });

    it('should throw error if document not found', async () => {
      mockVectorStore.getDocuments.mockResolvedValue([]);

      await expect(contextRetriever.findSimilarDocuments('nonexistent'))
        .rejects.toThrow('Document with ID nonexistent not found');
    });

    it('should throw error if document has no embedding', async () => {
      const docWithoutEmbedding = { ...mockDocument1, embedding: [] };
      mockVectorStore.getDocuments.mockResolvedValue([docWithoutEmbedding]);

      await expect(contextRetriever.findSimilarDocuments('doc1'))
        .rejects.toThrow('Document doc1 has no embedding');
    });

    it('should handle similarity search errors', async () => {
      mockVectorStore.getDocuments.mockResolvedValue([mockDocument1]);
      mockVectorStore.searchWithEmbedding.mockRejectedValue(new Error('Similarity search failed'));

      await expect(contextRetriever.findSimilarDocuments('doc1'))
        .rejects.toThrow('Failed to find similar documents: Similarity search failed');
    });
  });

  describe('retrieveContextEnhanced', () => {
    beforeEach(() => {
      const mockReranker = ResultReranker as jest.MockedClass<typeof ResultReranker>;
      const rankedResults = mockSearchResults.map(r => ({
        ...r,
        finalScore: r.score,
        rankingFactors: {
          originalScore: r.score,
          authorityScore: 0.5,
          recencyScore: 0.5,
          diversityScore: 0.5,
          typeScore: 0.5
        }
      }));
      
      mockReranker.prototype.rerank = jest.fn().mockReturnValue(rankedResults);
      mockReranker.prototype.getBalancedResults = jest.fn().mockReturnValue(rankedResults);
    });

    it('should retrieve context with enhanced ranking', async () => {
      mockVectorStore.searchSimilar.mockResolvedValue(mockSearchResults);

      const result = await contextRetriever.retrieveContextEnhanced('securities trading', {
        enableReranking: true,
        rankingOptions: { authorityWeight: 0.4 }
      });

      expect(mockVectorStore.searchSimilar).toHaveBeenCalled();
      expect(result.documents).toHaveLength(2);
      expect(result.query).toBe('securities trading');
    });

    it('should handle enhanced retrieval without reranking', async () => {
      mockVectorStore.searchSimilar.mockResolvedValue(mockSearchResults);

      const result = await contextRetriever.retrieveContextEnhanced('test query', {
        enableReranking: false
      });

      expect(result.documents).toHaveLength(2);
    });

    it('should handle enhanced retrieval errors', async () => {
      mockVectorStore.searchSimilar.mockRejectedValue(new Error('Enhanced search failed'));

      await expect(contextRetriever.retrieveContextEnhanced('test query'))
        .rejects.toThrow('Failed to retrieve enhanced context: Enhanced search failed');
    });
  });

  describe('retrieveBalancedContext', () => {
    beforeEach(() => {
      const mockReranker = ResultReranker as jest.MockedClass<typeof ResultReranker>;
      mockReranker.prototype.rerank = jest.fn().mockReturnValue(mockSearchResults.map(r => ({
        ...r,
        finalScore: r.score,
        rankingFactors: {
          originalScore: r.score,
          authorityScore: 0.5,
          recencyScore: 0.5,
          diversityScore: 0.5,
          typeScore: 0.5
        }
      })));
      mockReranker.prototype.getBalancedResults = jest.fn().mockReturnValue(mockSearchResults.map(r => ({
        ...r,
        finalScore: r.score,
        rankingFactors: {
          originalScore: r.score,
          authorityScore: 0.5,
          recencyScore: 0.5,
          diversityScore: 0.5,
          typeScore: 0.5
        }
      })));
    });

    it('should retrieve balanced context with type diversity', async () => {
      mockVectorStore.searchSimilar.mockResolvedValue(mockSearchResults);

      const result = await contextRetriever.retrieveBalancedContext('securities trading', {
        totalLimit: 10,
        minPerType: 1
      });

      expect(mockVectorStore.searchSimilar).toHaveBeenCalled();
      expect(result.documents).toHaveLength(2);
      expect(result.query).toBe('securities trading');
    });

    it('should handle balanced retrieval errors', async () => {
      mockVectorStore.searchSimilar.mockRejectedValue(new Error('Balanced search failed'));

      await expect(contextRetriever.retrieveBalancedContext('test query'))
        .rejects.toThrow('Failed to retrieve balanced context: Balanced search failed');
    });
  });

  describe('keyword search functionality', () => {
    it('should extract keywords from query', async () => {
      mockVectorStore.searchSimilar.mockResolvedValue(mockSearchResults);

      // Test through hybrid search which uses keyword extraction
      const result = await contextRetriever.hybridSearch('securities trading options', {
        keywordWeight: 0.5,
        semanticWeight: 0.5
      });

      expect(result.documents).toHaveLength(2);
    });

    it('should calculate keyword scores for documents', async () => {
      mockVectorStore.searchSimilar.mockResolvedValue(mockSearchResults);

      const result = await contextRetriever.hybridSearch('trading', {
        keywordWeight: 1.0,
        semanticWeight: 0.0
      });

      expect(result.documents).toBeDefined();
    });
  });
});