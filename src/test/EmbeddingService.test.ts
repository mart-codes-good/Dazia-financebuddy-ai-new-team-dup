import { EmbeddingService } from '../services/EmbeddingService';

// Mock the Google Generative AI
const mockEmbedContent = jest.fn();
const mockGetGenerativeModel = jest.fn().mockReturnValue({
  embedContent: mockEmbedContent
});

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel
  }))
}));

describe('EmbeddingService', () => {
  let embeddingService: EmbeddingService;

  beforeEach(() => {
    embeddingService = new EmbeddingService({
      apiKey: 'test-api-key',
      model: 'text-embedding-004',
      batchSize: 2
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for a single text', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      mockEmbedContent.mockResolvedValue({
        embedding: { values: mockEmbedding }
      });

      const result = await embeddingService.generateEmbedding('test text');

      expect(result).toEqual(mockEmbedding);
      expect(mockEmbedContent).toHaveBeenCalledWith('test text');
    });

    it('should throw error when embedding generation fails', async () => {
      mockEmbedContent.mockRejectedValue(new Error('API Error'));

      await expect(embeddingService.generateEmbedding('test text'))
        .rejects.toThrow('Failed to generate embedding: API Error');
    });

    it('should throw error when no embedding values returned', async () => {
      mockEmbedContent.mockResolvedValue({
        embedding: null
      });

      await expect(embeddingService.generateEmbedding('test text'))
        .rejects.toThrow('Failed to generate embedding: No embedding values returned');
    });
  });

  describe('generateEmbeddings', () => {
    it('should generate embeddings for multiple texts in batches', async () => {
      const mockEmbedding1 = [0.1, 0.2, 0.3];
      const mockEmbedding2 = [0.4, 0.5, 0.6];
      const mockEmbedding3 = [0.7, 0.8, 0.9];

      mockEmbedContent
        .mockResolvedValueOnce({ embedding: { values: mockEmbedding1 } })
        .mockResolvedValueOnce({ embedding: { values: mockEmbedding2 } })
        .mockResolvedValueOnce({ embedding: { values: mockEmbedding3 } });

      const texts = ['text1', 'text2', 'text3'];
      const results = await embeddingService.generateEmbeddings(texts);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ embedding: mockEmbedding1, text: 'text1' });
      expect(results[1]).toEqual({ embedding: mockEmbedding2, text: 'text2' });
      expect(results[2]).toEqual({ embedding: mockEmbedding3, text: 'text3' });
      expect(mockEmbedContent).toHaveBeenCalledTimes(3);
    });

    it('should handle errors in batch processing', async () => {
      const mockEmbedding1 = [0.1, 0.2, 0.3];
      
      mockEmbedContent
        .mockResolvedValueOnce({ embedding: { values: mockEmbedding1 } })
        .mockRejectedValueOnce(new Error('API Error'));

      const texts = ['text1', 'text2'];
      const results = await embeddingService.generateEmbeddings(texts);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ embedding: mockEmbedding1, text: 'text1' });
      expect(results[1]).toEqual({ 
        embedding: [], 
        text: 'text2', 
        error: 'Failed to generate embedding: API Error' 
      });
    });

    it('should process empty array', async () => {
      const results = await embeddingService.generateEmbeddings([]);
      expect(results).toEqual([]);
      expect(mockEmbedContent).not.toHaveBeenCalled();
    });
  });

  describe('generateQueryEmbedding', () => {
    it('should generate query embedding', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      mockEmbedContent.mockResolvedValue({
        embedding: { values: mockEmbedding }
      });

      const result = await embeddingService.generateQueryEmbedding('query text');

      expect(result).toEqual(mockEmbedding);
      expect(mockEmbedContent).toHaveBeenCalledWith('query text');
    });
  });

  describe('validateEmbedding', () => {
    it('should validate correct embedding', () => {
      const validEmbedding = [0.1, 0.2, 0.3, 0.4];
      expect(embeddingService.validateEmbedding(validEmbedding)).toBe(true);
    });

    it('should reject invalid embeddings', () => {
      expect(embeddingService.validateEmbedding([])).toBe(false);
      expect(embeddingService.validateEmbedding(['invalid'] as any)).toBe(false);
      expect(embeddingService.validateEmbedding(null as any)).toBe(false);
      expect(embeddingService.validateEmbedding(undefined as any)).toBe(false);
    });
  });
});