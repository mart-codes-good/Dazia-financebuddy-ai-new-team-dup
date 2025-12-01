import { AnswerGenerator, AnswerGenerationOptions } from '../services/AnswerGenerator';
import { GeminiService } from '../services/GeminiService';
import { PromptManager } from '../services/PromptManager';
import { RetrievedContext } from '../models/Context';

describe('AnswerGenerator', () => {
  let answerGenerator: AnswerGenerator;
  let mockGeminiService: jest.Mocked<GeminiService>;
  let mockPromptManager: jest.Mocked<PromptManager>;

  beforeEach(() => {
    mockGeminiService = {
      generateQuestions: jest.fn(),
      generateAnswer: jest.fn(),
      generateExplanation: jest.fn()
    } as unknown as jest.Mocked<GeminiService>;

    mockPromptManager = {
      generateQuestionPrompt: jest.fn(),
      generateAnswerPrompt: jest.fn(),
      generateExplanationPrompt: jest.fn()
    } as unknown as jest.Mocked<PromptManager>;

    answerGenerator = new AnswerGenerator(mockGeminiService, mockPromptManager);
  });

  const mockContext: RetrievedContext = {
    documents: [
      {
        id: 'doc1',
        title: 'Stock Market Basics',
        content: 'Stocks represent ownership shares in a company. When you buy stock, you become a shareholder.',
        type: 'textbook' as const,
        source: 'Investment Guide',
        tags: ['stocks', 'ownership'],
        embedding: [0.1, 0.2, 0.3],
        metadata: { type: 'textbook' },
        lastUpdated: new Date()
      }
    ],
    relevanceScores: [0.9],
    totalResults: 1,
    query: 'what is a stock',
    retrievedAt: new Date()
  };

  describe('generateAnswer', () => {
    it('should generate correct answer with plausible distractors', async () => {
      const mockResponse = {
        correctAnswer: 'Ownership shares in a company',
        explanation: 'Stocks represent fractional ownership in a corporation, giving shareholders voting rights and potential dividends.',
        distractors: [
          'A loan to a company',
          'A government bond',
          'A commodity futures contract'
        ]
      };

      mockGeminiService.generateAnswer.mockResolvedValue(mockResponse);
      mockPromptManager.generateAnswerPrompt.mockReturnValue('Generated prompt');

      const result = await answerGenerator.generateAnswer(
        'What does a stock represent?',
        mockContext
      );

      expect(result.correctAnswer).toBe('Ownership shares in a company');
      expect(result.distractors).toHaveLength(3);
      expect(result.distractors).toContain('A loan to a company');
      expect(result.explanation).toContain('ownership');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should validate answer uniqueness', async () => {
      const mockResponse = {
        correctAnswer: 'Ownership shares',
        explanation: 'Valid explanation',
        distractors: [
          'Ownership shares', // Duplicate of correct answer
          'A loan to company',
          'A government bond'
        ]
      };

      mockGeminiService.generateAnswer.mockResolvedValue(mockResponse);

      await expect(
        answerGenerator.generateAnswer('What is a stock?', mockContext)
      ).rejects.toThrow('Answer validation failed');
    });

    it('should retry on validation failures', async () => {
      const invalidResponse = {
        correctAnswer: '',
        explanation: 'Valid explanation',
        distractors: ['A', 'B', 'C']
      };

      const validResponse = {
        correctAnswer: 'Valid answer',
        explanation: 'Valid explanation',
        distractors: ['Option A', 'Option B', 'Option C']
      };

      mockGeminiService.generateAnswer
        .mockResolvedValueOnce(invalidResponse)
        .mockResolvedValueOnce(validResponse);

      const result = await answerGenerator.generateAnswer(
        'Test question?',
        mockContext
      );

      expect(result.correctAnswer).toBe('Valid answer');
      expect(mockGeminiService.generateAnswer).toHaveBeenCalledTimes(2);
    });

    it('should handle different difficulty levels', async () => {
      const mockResponse = {
        correctAnswer: 'Advanced concept',
        explanation: 'Detailed technical explanation',
        distractors: ['Beginner concept', 'Intermediate concept', 'Wrong concept']
      };

      mockGeminiService.generateAnswer.mockResolvedValue(mockResponse);

      const options: AnswerGenerationOptions = {
        difficulty: 'advanced',
        distractorCount: 3
      };

      const result = await answerGenerator.generateAnswer(
        'Advanced question?',
        mockContext,
        options
      );

      expect(result.correctAnswer).toBe('Advanced concept');
      expect(mockGeminiService.generateAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          difficulty: 'advanced'
        })
      );
    });
  });

  describe('generateMultipleChoiceOptions', () => {
    it('should create properly formatted multiple choice options', () => {
      const correctAnswer = 'Correct option';
      const distractors = ['Wrong A', 'Wrong B', 'Wrong C'];

      const result = answerGenerator.generateMultipleChoiceOptions(correctAnswer, distractors);

      expect(Object.keys(result.options)).toEqual(['A', 'B', 'C', 'D']);
      expect(Object.values(result.options)).toContain(correctAnswer);
      expect(Object.values(result.options)).toContain('Wrong A');
      expect(Object.values(result.options)).toContain('Wrong B');
      expect(Object.values(result.options)).toContain('Wrong C');
      expect(['A', 'B', 'C', 'D']).toContain(result.correctOption);
    });

    it('should randomize option positions', () => {
      const correctAnswer = 'Correct';
      const distractors = ['Wrong 1', 'Wrong 2', 'Wrong 3'];

      // Generate multiple times to check randomization
      const results = Array.from({ length: 10 }, () =>
        answerGenerator.generateMultipleChoiceOptions(correctAnswer, distractors)
      );

      const correctPositions = results.map(r => r.correctOption);
      const uniquePositions = new Set(correctPositions);

      // Should have some variation in positions (not always the same)
      expect(uniquePositions.size).toBeGreaterThan(1);
    });

    it('should throw error for incorrect distractor count', () => {
      const correctAnswer = 'Correct';
      const distractors = ['Wrong 1', 'Wrong 2']; // Only 2 distractors instead of 3

      expect(() => {
        answerGenerator.generateMultipleChoiceOptions(correctAnswer, distractors);
      }).toThrow('Exactly 3 distractors are required');
    });
  });

  describe('generateContextualDistractors', () => {
    it('should generate contextually relevant distractors', async () => {
      const mockResponse = {
        correctAnswer: 'Ownership in company',
        explanation: 'Explanation',
        distractors: [
          'Debt obligation to company',
          'Government treasury security',
          'Commodity trading contract'
        ]
      };

      mockGeminiService.generateAnswer.mockResolvedValue(mockResponse);

      const distractors = await answerGenerator.generateContextualDistractors(
        'What is a stock?',
        'Ownership in company',
        mockContext,
        3
      );

      expect(distractors).toHaveLength(3);
      expect(distractors).toContain('Debt obligation to company');
      expect(mockGeminiService.generateAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          focusOnMisconceptions: true
        })
      );
    });

    it('should fallback to generic distractors on API failure', async () => {
      mockGeminiService.generateAnswer.mockRejectedValue(new Error('API Error'));

      const distractors = await answerGenerator.generateContextualDistractors(
        'What is a stock?',
        'Ownership shares',
        mockContext,
        3
      );

      expect(distractors).toHaveLength(3);
      expect(distractors[0]).toContain('ownership shares'); // Generic distractor pattern
    });
  });

  describe('validation methods', () => {
    it('should validate answer length constraints', () => {
      const generator = answerGenerator as any; // Access private method for testing

      // Test very short answer
      const shortResponse = {
        correctAnswer: 'A',
        explanation: 'Valid explanation text here',
        distractors: ['B', 'C', 'D']
      };

      const shortValidation = generator.validateAnswer(shortResponse, 'Question?', {});
      expect(shortValidation.warnings).toContain('Correct answer is very short');

      // Test very long answer
      const longAnswer = 'A'.repeat(250);
      const longResponse = {
        correctAnswer: longAnswer,
        explanation: 'Valid explanation text here',
        distractors: ['B', 'C', 'D']
      };

      const longValidation = generator.validateAnswer(longResponse, 'Question?', {});
      expect(longValidation.warnings).toContain('Correct answer is very long');
    });

    it('should detect duplicate options', () => {
      const generator = answerGenerator as any;

      const duplicateResponse = {
        correctAnswer: 'Same answer',
        explanation: 'Valid explanation',
        distractors: ['Same answer', 'Different', 'Another'] // Duplicate
      };

      const validation = generator.validateAnswer(duplicateResponse, 'Question?', { ensureUniqueness: true });
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('All answer options must be unique');
    });

    it('should calculate string similarity correctly', () => {
      const generator = answerGenerator as any;

      expect(generator.calculateStringSimilarity('hello', 'hello')).toBe(1);
      expect(generator.calculateStringSimilarity('hello', 'world')).toBeLessThan(0.5);
      expect(generator.calculateStringSimilarity('stock', 'stocks')).toBeGreaterThan(0.8);
      expect(generator.calculateStringSimilarity('', '')).toBe(1);
    });
  });

  describe('context preparation', () => {
    it('should prepare context text within length limits', () => {
      const generator = answerGenerator as any;
      
      const largeContext: RetrievedContext = {
        documents: [
          {
            id: 'doc1',
            title: 'Long Document',
            content: 'A'.repeat(5000),
            type: 'textbook' as const,
            source: 'Source 1',
            tags: [],
            embedding: [0.1, 0.2],
            metadata: {},
            lastUpdated: new Date()
          },
          {
            id: 'doc2',
            title: 'Another Document',
            content: 'B'.repeat(3000),
            type: 'textbook' as const,
            source: 'Source 2',
            tags: [],
            embedding: [0.3, 0.4],
            metadata: {},
            lastUpdated: new Date()
          }
        ],
        relevanceScores: [0.9, 0.8],
        totalResults: 2,
        query: 'test',
        retrievedAt: new Date()
      };

      const contextText = generator.prepareContextForAnswer(largeContext);
      expect(contextText.length).toBeLessThan(6500); // Should respect max length
      expect(contextText).toContain('Long Document'); // Should include highest scored document
    });
  });
});