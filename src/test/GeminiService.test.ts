import { GeminiService, QuestionGenerationRequest, AnswerGenerationRequest, ExplanationGenerationRequest } from '../services/GeminiService';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock the Google Generative AI module
jest.mock('@google/generative-ai');

describe('GeminiService', () => {
  let geminiService: GeminiService;
  let mockModel: any;
  let mockGenAI: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock model
    mockModel = {
      generateContent: jest.fn()
    };

    // Create mock GoogleGenerativeAI
    mockGenAI = {
      getGenerativeModel: jest.fn().mockReturnValue(mockModel)
    };

    // Mock the GoogleGenerativeAI constructor
    (GoogleGenerativeAI as jest.MockedClass<typeof GoogleGenerativeAI>).mockImplementation(() => mockGenAI);

    geminiService = new GeminiService('test-api-key');
  });

  describe('constructor', () => {
    it('should create instance with provided API key', () => {
      expect(GoogleGenerativeAI).toHaveBeenCalledWith('test-api-key');
      expect(mockGenAI.getGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      });
    });

    it('should use environment variable when no API key provided', () => {
      process.env['GEMINI_API_KEY'] = 'env-api-key';
      new GeminiService();
      expect(GoogleGenerativeAI).toHaveBeenCalledWith('env-api-key');
    });

    it('should throw error when no API key available', () => {
      delete process.env['GEMINI_API_KEY'];
      expect(() => new GeminiService()).toThrow('Gemini API key is required');
    });
  });

  describe('generateQuestions', () => {
    const mockRequest: QuestionGenerationRequest = {
      topic: 'Securities Regulations',
      context: 'Test context about securities regulations',
      questionCount: 2
    };

    const mockValidResponse = JSON.stringify({
      questions: [
        {
          questionText: 'What is the primary purpose of the Securities Act of 1933?',
          options: {
            A: 'To regulate secondary markets',
            B: 'To require disclosure of material information',
            C: 'To establish the SEC',
            D: 'To regulate investment advisers'
          },
          correctAnswer: 'B'
        },
        {
          questionText: 'Which entity enforces federal securities laws?',
          options: {
            A: 'Federal Reserve',
            B: 'Treasury Department', 
            C: 'Securities and Exchange Commission',
            D: 'Department of Justice'
          },
          correctAnswer: 'C'
        }
      ]
    });

    it('should generate questions successfully', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: { text: () => mockValidResponse }
      });

      const result = await geminiService.generateQuestions(mockRequest);

      expect(result).toHaveLength(2);
      expect(result[0]?.questionText).toBe('What is the primary purpose of the Securities Act of 1933?');
      expect(result[0]?.correctAnswer).toBe('B');
      expect(result[0]?.options.A).toBe('To regulate secondary markets');
    });

    it('should validate question count matches request', async () => {
      const invalidResponse = JSON.stringify({
        questions: [
          {
            questionText: 'Test question?',
            options: { A: 'A', B: 'B', C: 'C', D: 'D' },
            correctAnswer: 'A'
          }
        ]
      });

      mockModel.generateContent.mockResolvedValue({
        response: { text: () => invalidResponse }
      });

      await expect(geminiService.generateQuestions(mockRequest))
        .rejects.toThrow('Expected 2 questions, got 1');
    });

    it('should validate question format', async () => {
      const invalidResponse = JSON.stringify({
        questions: [
          {
            questionText: 'Test question?',
            options: { A: 'A', B: 'B', C: 'C' }, // Missing D option
            correctAnswer: 'A'
          },
          {
            questionText: 'Test question 2?',
            options: { A: 'A', B: 'B', C: 'C', D: 'D' },
            correctAnswer: 'A'
          }
        ]
      });

      mockModel.generateContent.mockResolvedValue({
        response: { text: () => invalidResponse }
      });

      await expect(geminiService.generateQuestions(mockRequest))
        .rejects.toThrow('Question must have valid option D');
    });

    it('should retry on API failures', async () => {
      mockModel.generateContent
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue({
          response: { text: () => mockValidResponse }
        });

      const result = await geminiService.generateQuestions(mockRequest);

      expect(mockModel.generateContent).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(2);
    });

    it('should not retry on authentication errors', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('API_KEY invalid'));

      await expect(geminiService.generateQuestions(mockRequest))
        .rejects.toThrow('API_KEY invalid');

      expect(mockModel.generateContent).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('Persistent error'));

      await expect(geminiService.generateQuestions(mockRequest))
        .rejects.toThrow('Failed after 3 attempts');

      expect(mockModel.generateContent).toHaveBeenCalledTimes(3);
    });
  });

  describe('generateAnswers', () => {
    const mockRequest: AnswerGenerationRequest = {
      question: 'What is the primary purpose of the Securities Act of 1933?',
      context: 'The Securities Act of 1933 requires disclosure...',
      options: ['Option A', 'Option B', 'Option C', 'Option D']
    };

    const mockValidResponse = JSON.stringify({
      correctAnswer: 'B',
      options: {
        A: 'To regulate secondary markets',
        B: 'To require disclosure of material information',
        C: 'To establish the SEC',
        D: 'To regulate investment advisers'
      }
    });

    it('should generate answers successfully', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: { text: () => mockValidResponse }
      });

      const result = await geminiService.generateAnswers(mockRequest);

      expect(result.correctAnswer).toBe('B');
      expect(result.options.B).toBe('To require disclosure of material information');
    });

    it('should validate correct answer format', async () => {
      const invalidResponse = JSON.stringify({
        correctAnswer: 'E', // Invalid option
        options: {
          A: 'Option A',
          B: 'Option B',
          C: 'Option C',
          D: 'Option D'
        }
      });

      mockModel.generateContent.mockResolvedValue({
        response: { text: () => invalidResponse }
      });

      await expect(geminiService.generateAnswers(mockRequest))
        .rejects.toThrow('Response must contain valid correctAnswer (A, B, C, or D)');
    });
  });

  describe('generateExplanation', () => {
    const mockRequest: ExplanationGenerationRequest = {
      question: 'What is the primary purpose of the Securities Act of 1933?',
      correctAnswer: 'B',
      context: 'The Securities Act of 1933 requires disclosure...'
    };

    const mockValidResponse = JSON.stringify({
      explanation: 'The Securities Act of 1933 was enacted to ensure that investors receive material information about securities being offered for public sale.',
      sourceReferences: ['Securities Act of 1933, Section 5', 'SEC Release 33-8591']
    });

    it('should generate explanations successfully', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: { text: () => mockValidResponse }
      });

      const result = await geminiService.generateExplanation(mockRequest);

      expect(result.explanation).toContain('Securities Act of 1933');
      expect(result.sourceReferences).toHaveLength(2);
      expect(result.sourceReferences[0]).toBe('Securities Act of 1933, Section 5');
    });

    it('should validate explanation format', async () => {
      const invalidResponse = JSON.stringify({
        explanation: '', // Empty explanation
        sourceReferences: ['Reference 1']
      });

      mockModel.generateContent.mockResolvedValue({
        response: { text: () => invalidResponse }
      });

      await expect(geminiService.generateExplanation(mockRequest))
        .rejects.toThrow('Response must contain valid explanation string');
    });

    it('should validate source references format', async () => {
      const invalidResponse = JSON.stringify({
        explanation: 'Valid explanation',
        sourceReferences: 'Not an array' // Should be array
      });

      mockModel.generateContent.mockResolvedValue({
        response: { text: () => invalidResponse }
      });

      await expect(geminiService.generateExplanation(mockRequest))
        .rejects.toThrow('Response must contain sourceReferences array');
    });
  });

  describe('error handling', () => {
    it('should handle JSON parse errors', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: { text: () => 'Invalid JSON response' }
      });

      const request: QuestionGenerationRequest = {
        topic: 'Test',
        context: 'Test context',
        questionCount: 1
      };

      await expect(geminiService.generateQuestions(request))
        .rejects.toThrow('Failed to parse question response');
    });

    it('should handle missing questions array', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: { text: () => JSON.stringify({ notQuestions: [] }) }
      });

      const request: QuestionGenerationRequest = {
        topic: 'Test',
        context: 'Test context',
        questionCount: 1
      };

      await expect(geminiService.generateQuestions(request))
        .rejects.toThrow('Response must contain a questions array');
    });
  });

  describe('prompt building', () => {
    it('should include all required elements in question prompt', async () => {
      const request: QuestionGenerationRequest = {
        topic: 'Securities Regulations',
        context: 'Test context',
        questionCount: 2
      };

      mockModel.generateContent.mockResolvedValue({
        response: { text: () => JSON.stringify({ questions: [] }) }
      });

      try {
        await geminiService.generateQuestions(request);
      } catch (error) {
        // Expected to fail due to empty questions array
      }

      const callArgs = mockModel.generateContent.mock.calls[0][0];
      expect(callArgs).toContain('Securities Regulations');
      expect(callArgs).toContain('Test context');
      expect(callArgs).toContain('2 multiple-choice questions');
      expect(callArgs).toContain('exactly 4 answer options');
    });
  });
});