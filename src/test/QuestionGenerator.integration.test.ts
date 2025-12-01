import { QuestionGenerator, QuestionGenerationOptions } from '../services/QuestionGenerator';
import { TopicProcessor } from '../services/TopicProcessor';
import { ContextRetriever } from '../services/ContextRetriever';
import { GeminiService } from '../services/GeminiService';
import { PromptManager } from '../services/PromptManager';
import { EmbeddingService } from '../services/EmbeddingService';
import { VectorStore } from '../services/VectorStore';
import { ResultReranker } from '../services/ResultReranker';

describe('QuestionGenerator Integration Tests', () => {
  let questionGenerator: QuestionGenerator;
  let mockEmbeddingService: jest.Mocked<EmbeddingService>;
  let mockVectorStore: jest.Mocked<VectorStore>;
  let mockGeminiService: jest.Mocked<GeminiService>;
  let mockResultReranker: jest.Mocked<ResultReranker>;
  let contextRetriever: ContextRetriever;
  let promptManager: PromptManager;
  let topicProcessor: TopicProcessor;

  beforeEach(() => {
    // Mock EmbeddingService
    mockEmbeddingService = {
      generateEmbedding: jest.fn(),
      generateBatchEmbeddings: jest.fn(),
      calculateSimilarity: jest.fn()
    } as jest.Mocked<EmbeddingService>;

    // Mock VectorStore
    mockVectorStore = {
      addDocument: jest.fn(),
      addDocuments: jest.fn(),
      search: jest.fn(),
      searchWithMetadata: jest.fn(),
      deleteDocument: jest.fn(),
      getDocumentCount: jest.fn(),
      clearCollection: jest.fn()
    } as jest.Mocked<VectorStore>;

    // Mock GeminiService
    mockGeminiService = {
      generateQuestions: jest.fn(),
      generateAnswer: jest.fn(),
      generateExplanation: jest.fn()
    } as jest.Mocked<GeminiService>;

    // Mock ResultReranker
    mockResultReranker = {
      rerank: jest.fn()
    } as jest.Mocked<ResultReranker>;

    // Create real instances
    contextRetriever = new ContextRetriever(mockVectorStore, mockEmbeddingService, mockResultReranker);
    promptManager = new PromptManager();
    topicProcessor = new TopicProcessor(mockEmbeddingService);
    questionGenerator = new QuestionGenerator(contextRetriever, mockGeminiService, promptManager, topicProcessor);
  });

  describe('generateQuestions', () => {
    it('should generate questions for a valid securities topic', async () => {
      // Setup mocks
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      
      mockVectorStore.searchWithMetadata.mockResolvedValue({
        documents: [
          {
            id: 'doc1',
            title: 'Stock Market Basics',
            content: 'Stocks represent ownership in a company...',
            source: 'Securities Textbook',
            metadata: { type: 'textbook', chapter: '1' }
          }
        ],
        scores: [0.85],
        metadatas: [{ type: 'textbook', chapter: '1' }]
      });

      mockGeminiService.generateQuestions.mockResolvedValue([
        {
          questionText: 'What does a stock represent?',
          options: {
            A: 'Ownership in a company',
            B: 'A loan to a company',
            C: 'A government bond',
            D: 'A commodity futures contract'
          },
          correctAnswer: 'A'
        }
      ]);

      const options: QuestionGenerationOptions = {
        questionCount: 1,
        difficulty: 'beginner'
      };

      // Execute
      const result = await questionGenerator.generateQuestions('stocks', options);

      // Verify
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].questionText).toBe('What does a stock represent?');
      expect(result.questions[0].correctAnswer).toBe('A');
      expect(result.questions[0].topic).toBe('stocks');
      expect(result.topicValidation.isValid).toBe(true);
      expect(result.context.documents).toHaveLength(1);
    });

    it('should handle multiple question generation', async () => {
      // Setup mocks for multiple questions
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      
      mockVectorStore.searchWithMetadata.mockResolvedValue({
        documents: [
          {
            id: 'doc1',
            title: 'Bond Fundamentals',
            content: 'Bonds are debt securities issued by corporations...',
            source: 'Fixed Income Guide',
            metadata: { type: 'textbook', chapter: '3' }
          },
          {
            id: 'doc2',
            title: 'Bond Pricing',
            content: 'Bond prices move inversely to interest rates...',
            source: 'Investment Analysis',
            metadata: { type: 'textbook', chapter: '4' }
          }
        ],
        scores: [0.9, 0.8],
        metadatas: [{ type: 'textbook', chapter: '3' }, { type: 'textbook', chapter: '4' }]
      });

      mockGeminiService.generateQuestions.mockResolvedValue([
        {
          questionText: 'What is a bond?',
          options: {
            A: 'A debt security',
            B: 'An equity security',
            C: 'A derivative contract',
            D: 'A commodity'
          },
          correctAnswer: 'A'
        },
        {
          questionText: 'How do bond prices relate to interest rates?',
          options: {
            A: 'They move in the same direction',
            B: 'They move in opposite directions',
            C: 'They are unrelated',
            D: 'They only change quarterly'
          },
          correctAnswer: 'B'
        }
      ]);

      const options: QuestionGenerationOptions = {
        questionCount: 2,
        difficulty: 'intermediate'
      };

      // Execute
      const result = await questionGenerator.generateQuestions('bonds', options);

      // Verify
      expect(result.questions).toHaveLength(2);
      expect(result.questions[0].questionText).toBe('What is a bond?');
      expect(result.questions[1].questionText).toBe('How do bond prices relate to interest rates?');
      expect(result.generationMetadata.successfulGenerations).toBe(2);
    });

    it('should reject invalid topics', async () => {
      // Setup mock for invalid topic
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

      const options: QuestionGenerationOptions = {
        questionCount: 1
      };

      // Execute and verify error
      await expect(
        questionGenerator.generateQuestions('cooking recipes', options)
      ).rejects.toThrow('Invalid topic');
    });

    it('should handle API failures with retry logic', async () => {
      // Setup mocks
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      
      mockVectorStore.searchWithMetadata.mockResolvedValue({
        documents: [
          {
            id: 'doc1',
            title: 'Options Trading',
            content: 'Options give the right but not obligation...',
            source: 'Derivatives Guide',
            metadata: { type: 'textbook', chapter: '5' }
          }
        ],
        scores: [0.85],
        metadatas: [{ type: 'textbook', chapter: '5' }]
      });

      // First call fails, second succeeds
      mockGeminiService.generateQuestions
        .mockRejectedValueOnce(new Error('API rate limit'))
        .mockResolvedValueOnce([
          {
            questionText: 'What is an option?',
            options: {
              A: 'A right to buy or sell',
              B: 'An obligation to buy',
              C: 'A type of bond',
              D: 'A stock dividend'
            },
            correctAnswer: 'A'
          }
        ]);

      const options: QuestionGenerationOptions = {
        questionCount: 1
      };

      // Execute
      const result = await questionGenerator.generateQuestions('options', options);

      // Verify retry worked
      expect(result.questions).toHaveLength(1);
      expect(result.generationMetadata.totalAttempts).toBeGreaterThan(1);
      expect(mockGeminiService.generateQuestions).toHaveBeenCalledTimes(2);
    });

    it('should validate question format and content', async () => {
      // Setup mocks with invalid question format
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      
      mockVectorStore.searchWithMetadata.mockResolvedValue({
        documents: [
          {
            id: 'doc1',
            title: 'Market Analysis',
            content: 'Technical analysis uses charts and patterns...',
            source: 'Trading Guide',
            metadata: { type: 'textbook', chapter: '7' }
          }
        ],
        scores: [0.8],
        metadatas: [{ type: 'textbook', chapter: '7' }]
      });

      // Return invalid question (missing option)
      mockGeminiService.generateQuestions.mockResolvedValue([
        {
          questionText: 'What is technical analysis?',
          options: {
            A: 'Chart analysis',
            B: 'Financial statement analysis',
            C: 'Economic analysis'
            // Missing option D
          },
          correctAnswer: 'A'
        }
      ]);

      const options: QuestionGenerationOptions = {
        questionCount: 1
      };

      // Execute - should fail due to validation
      await expect(
        questionGenerator.generateQuestions('technical analysis', options)
      ).rejects.toThrow('Failed to generate any valid questions');
    });

    it('should handle context retrieval with multiple document types', async () => {
      // Setup mocks
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      
      mockVectorStore.searchWithMetadata.mockResolvedValue({
        documents: [
          {
            id: 'doc1',
            title: 'SEC Rule 10b-5',
            content: 'Rule 10b-5 prohibits securities fraud...',
            source: 'SEC Regulations',
            metadata: { type: 'regulation', section: '10b-5' }
          },
          {
            id: 'doc2',
            title: 'Insider Trading Case Study',
            content: 'This case demonstrates violations of Rule 10b-5...',
            source: 'Legal Cases',
            metadata: { type: 'qa_pair', difficulty: 'advanced' }
          }
        ],
        scores: [0.95, 0.85],
        metadatas: [
          { type: 'regulation', section: '10b-5' },
          { type: 'qa_pair', difficulty: 'advanced' }
        ]
      });

      mockGeminiService.generateQuestions.mockResolvedValue([
        {
          questionText: 'What does SEC Rule 10b-5 prohibit?',
          options: {
            A: 'Securities fraud',
            B: 'Excessive trading',
            C: 'High fees',
            D: 'Market volatility'
          },
          correctAnswer: 'A'
        }
      ]);

      const options: QuestionGenerationOptions = {
        questionCount: 1,
        documentTypes: ['regulation', 'qa_pair'],
        difficulty: 'advanced'
      };

      // Execute
      const result = await questionGenerator.generateQuestions('securities fraud', options);

      // Verify
      expect(result.questions).toHaveLength(1);
      expect(result.context.documents).toHaveLength(2);
      expect(result.questions[0].difficulty).toBe('advanced');
    });
  });

  describe('validateQuestionCount', () => {
    it('should validate question count parameters', () => {
      expect(questionGenerator.validateQuestionCount(1)).toEqual({ isValid: true });
      expect(questionGenerator.validateQuestionCount(10)).toEqual({ isValid: true });
      expect(questionGenerator.validateQuestionCount(20)).toEqual({ isValid: true });
      
      expect(questionGenerator.validateQuestionCount(0)).toEqual({
        isValid: false,
        message: 'Question count must be at least 1'
      });
      
      expect(questionGenerator.validateQuestionCount(21)).toEqual({
        isValid: false,
        message: 'Question count cannot exceed 20'
      });
      
      expect(questionGenerator.validateQuestionCount(1.5)).toEqual({
        isValid: false,
        message: 'Question count must be an integer'
      });
    });
  });

  describe('getGenerationStats', () => {
    it('should calculate generation statistics correctly', () => {
      const mockResult = {
        questions: [
          { id: 'q1', topic: 'stocks' },
          { id: 'q2', topic: 'stocks' }
        ],
        context: {
          documents: [{ id: 'doc1' }, { id: 'doc2' }],
          relevanceScores: [0.9, 0.8]
        },
        generationMetadata: {
          totalAttempts: 3,
          successfulGenerations: 2,
          failedValidations: 1,
          processingTimeMs: 1500
        }
      } as any;

      const stats = questionGenerator.getGenerationStats(mockResult);

      expect(stats.questionsGenerated).toBe(2);
      expect(stats.totalAttempts).toBe(3);
      expect(stats.successRate).toBeCloseTo(0.67, 2);
      expect(stats.failureRate).toBeCloseTo(0.33, 2);
      expect(stats.processingTimeMs).toBe(1500);
      expect(stats.averageTimePerQuestion).toBe(750);
      expect(stats.contextDocuments).toBe(2);
      expect(stats.averageRelevanceScore).toBe(0.85);
    });
  });
});