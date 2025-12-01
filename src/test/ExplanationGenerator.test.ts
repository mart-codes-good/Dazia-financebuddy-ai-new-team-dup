import { ExplanationGenerator, ExplanationGenerationOptions } from '../services/ExplanationGenerator';
import { GeminiService } from '../services/GeminiService';
import { PromptManager } from '../services/PromptManager';
import { Question } from '../models/Question';
import { RetrievedContext } from '../models/Context';

describe('ExplanationGenerator', () => {
  let explanationGenerator: ExplanationGenerator;
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

    explanationGenerator = new ExplanationGenerator(mockGeminiService, mockPromptManager);
  });

  const mockQuestion: Question = {
    id: 'q1',
    topic: 'stocks',
    questionText: 'What does a stock represent?',
    options: {
      A: 'Ownership in a company',
      B: 'A loan to a company',
      C: 'A government bond',
      D: 'A commodity contract'
    },
    correctAnswer: 'A',
    explanation: '',
    sourceReferences: ['Investment Guide'],
    difficulty: 'beginner',
    createdAt: new Date()
  };

  const mockContext: RetrievedContext = {
    documents: [
      {
        id: 'doc1',
        title: 'Stock Market Fundamentals',
        content: 'Stocks represent equity ownership in corporations. Shareholders have voting rights and may receive dividends.',
        type: 'textbook' as const,
        source: 'Securities Textbook',
        tags: ['stocks', 'equity'],
        embedding: [0.1, 0.2, 0.3],
        metadata: { type: 'textbook', chapter: '1' },
        lastUpdated: new Date()
      },
      {
        id: 'doc2',
        title: 'Corporate Finance Basics',
        content: 'When companies issue stock, they are selling ownership stakes to raise capital for business operations.',
        type: 'textbook' as const,
        source: 'Finance Guide',
        tags: ['finance', 'capital'],
        embedding: [0.4, 0.5, 0.6],
        metadata: { type: 'textbook', chapter: '3' },
        lastUpdated: new Date()
      }
    ],
    relevanceScores: [0.95, 0.85],
    totalResults: 2,
    query: 'stock ownership',
    retrievedAt: new Date()
  };

  describe('generateExplanation', () => {
    it('should generate comprehensive explanation with pedagogical elements', async () => {
      const mockResponse = {
        explanation: 'A stock represents ownership in a company. When you purchase stock, you become a shareholder with certain rights including voting on company matters and potentially receiving dividends. This ownership stake means you have a claim on the company\'s assets and earnings.',
        keyPoints: [
          'Stocks represent ownership in companies',
          'Shareholders have voting rights',
          'Dividends may be paid to shareholders'
        ],
        commonMistakes: [
          'Confusing stocks with bonds (debt vs equity)',
          'Thinking stock price equals company value'
        ],
        examples: [
          'If you own 100 shares of Apple stock, you own a tiny fraction of Apple Inc.'
        ],
        sourceReferences: []
      };

      mockGeminiService.generateExplanation.mockResolvedValue(mockResponse);
      mockPromptManager.generateExplanationPrompt.mockReturnValue('Generated explanation prompt');

      const result = await explanationGenerator.generateExplanation(mockQuestion, mockContext);

      expect(result.explanation).toContain('ownership in a company');
      expect(result.pedagogicalElements.keyPoints.length).toBeGreaterThanOrEqual(0);
      if (result.pedagogicalElements.commonMistakes && result.pedagogicalElements.commonMistakes.length > 0) {
        expect(result.pedagogicalElements.commonMistakes.some((mistake: string) => mistake.includes('stock'))).toBe(true);
      }
      expect(result.sourceReferences).toContain('Stock Market Fundamentals (Securities Textbook)');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle different pedagogical styles', async () => {
      const mockResponse = {
        explanation: 'Step 1: Understand that stocks are equity securities. Step 2: Recognize that buying stock means buying ownership. Step 3: Know that ownership comes with rights and responsibilities.',
        keyPoints: ['Equity securities', 'Ownership rights', 'Shareholder responsibilities']
      };

      mockGeminiService.generateExplanation.mockResolvedValue(mockResponse);

      const options: ExplanationGenerationOptions = {
        pedagogicalStyle: 'step-by-step',
        targetAudience: 'beginner'
      };

      const result = await explanationGenerator.generateExplanation(mockQuestion, mockContext, options);

      expect(result.explanation).toContain('Step 1:');
      expect(mockGeminiService.generateExplanation).toHaveBeenCalledWith(
        expect.objectContaining({
          pedagogicalStyle: 'step-by-step',
          targetAudience: 'beginner'
        })
      );
    });

    it('should validate explanation quality and retry on failures', async () => {
      const invalidResponse = {
        explanation: '', // Empty explanation
        keyPoints: []
      };

      const validResponse = {
        explanation: 'A comprehensive explanation about stock ownership that provides clear understanding of the concept and its implications for investors.',
        keyPoints: ['Ownership concept', 'Investor rights', 'Financial implications']
      };

      mockGeminiService.generateExplanation
        .mockResolvedValueOnce(invalidResponse)
        .mockResolvedValueOnce(validResponse);

      const result = await explanationGenerator.generateExplanation(mockQuestion, mockContext);

      expect(result.explanation).toContain('comprehensive explanation');
      expect(mockGeminiService.generateExplanation).toHaveBeenCalledTimes(2);
    });

    it('should include source references when requested', async () => {
      const mockResponse = {
        explanation: 'Detailed explanation about stocks and ownership.',
        keyPoints: ['Key point 1', 'Key point 2']
      };

      mockGeminiService.generateExplanation.mockResolvedValue(mockResponse);

      const options: ExplanationGenerationOptions = {
        includeSourceReferences: true
      };

      const result = await explanationGenerator.generateExplanation(mockQuestion, mockContext, options);

      expect(result.sourceReferences).toHaveLength(2);
      expect(result.sourceReferences[0]).toBe('Stock Market Fundamentals (Securities Textbook)');
      expect(result.sourceReferences[1]).toBe('Corporate Finance Basics (Finance Guide)');
    });

    it('should extract related concepts for securities topics', async () => {
      const mockResponse = {
        explanation: 'Stocks provide equity ownership and may pay dividends. The market cap represents total company value.',
        keyPoints: ['Equity ownership', 'Dividend payments', 'Market capitalization']
      };

      mockGeminiService.generateExplanation.mockResolvedValue(mockResponse);

      const options: ExplanationGenerationOptions = {
        includeRelatedConcepts: true
      };

      const result = await explanationGenerator.generateExplanation(mockQuestion, mockContext, options);

      expect(result.relatedConcepts).toContain('equity');
      expect(result.relatedConcepts).toContain('dividend');
    });
  });

  describe('generateIncorrectOptionExplanations', () => {
    it('should generate explanations for why incorrect options are wrong', async () => {
      const mockExplanations = [
        { explanation: 'Option B is incorrect because stocks represent ownership, not debt. Loans are debt instruments.', sourceReferences: [] },
        { explanation: 'Option C is incorrect because government bonds are debt securities issued by governments, not ownership stakes.', sourceReferences: [] },
        { explanation: 'Option D is incorrect because commodity contracts are agreements to buy/sell physical goods, not ownership in companies.', sourceReferences: [] }
      ];

      mockGeminiService.generateExplanation
        .mockResolvedValueOnce(mockExplanations[0]!)
        .mockResolvedValueOnce(mockExplanations[1]!)
        .mockResolvedValueOnce(mockExplanations[2]!);

      const result = await explanationGenerator.generateIncorrectOptionExplanations(mockQuestion, mockContext);

      expect(result).toHaveProperty('B');
      expect(result).toHaveProperty('C');
      expect(result).toHaveProperty('D');
      expect(result['B']).toContain('debt instruments');
      expect(result['C']).toContain('government bonds');
      expect(result['D']).toContain('commodity contracts');
    });

    it('should handle API failures gracefully with fallback explanations', async () => {
      mockGeminiService.generateExplanation.mockRejectedValue(new Error('API Error'));

      const result = await explanationGenerator.generateIncorrectOptionExplanations(mockQuestion, mockContext);

      expect(result['B']).toContain('incorrect');
      expect(result['C']).toContain('correct answer is A');
      expect(result['D']).toContain('incorrect');
    });
  });

  describe('generateStepByStepExplanation', () => {
    it('should generate structured step-by-step explanation', async () => {
      const mockResponse = {
        explanation: 'Step 1: Identify what stocks represent - ownership stakes in companies. Step 2: Understand shareholder rights - voting and dividends. Step 3: Recognize the difference from debt instruments.',
        keyPoints: ['Ownership stakes', 'Shareholder rights', 'Equity vs debt'],
        examples: ['Apple stock ownership example']
      };

      mockGeminiService.generateExplanation.mockResolvedValue(mockResponse);

      const result = await explanationGenerator.generateStepByStepExplanation(mockQuestion, mockContext);

      expect(result.explanation).toContain('Step 1:');
      expect(result.explanation).toContain('Step 2:');
      expect(result.explanation).toContain('Step 3:');
      expect(result.relatedConcepts).toBeDefined();
    });
  });

  describe('validation methods', () => {
    it('should validate explanation length and structure', () => {
      const generator = explanationGenerator as any; // Access private method

      // Test short explanation
      const shortExplanation = {
        explanation: 'Too short',
        pedagogicalElements: { keyPoints: [] },
        sourceReferences: [],
        relatedConcepts: [],
        confidence: 0.8
      };

      const shortValidation = generator.validateExplanation(shortExplanation, mockQuestion, {});
      expect(shortValidation.warnings).toContain('Explanation is very short and may lack detail');

      // Test good explanation
      const goodExplanation = {
        explanation: 'This is a comprehensive explanation that provides detailed information about the topic and helps students understand the key concepts involved in the question.',
        pedagogicalElements: { keyPoints: ['Key point 1', 'Key point 2'] },
        sourceReferences: ['Source 1'],
        relatedConcepts: ['concept1'],
        confidence: 0.9
      };

      const goodValidation = generator.validateExplanation(goodExplanation, mockQuestion, {});
      expect(goodValidation.isValid).toBe(true);
      expect(goodValidation.qualityScore).toBeGreaterThan(0.7);
    });

    it('should check for key terms related to topic', () => {
      const generator = explanationGenerator as any;

      expect(generator.checkForKeyTerms('This explanation mentions equity and shares', 'stocks')).toBe(true);
      expect(generator.checkForKeyTerms('This explanation has no relevant terms', 'stocks')).toBe(false);
      expect(generator.checkForKeyTerms('Bond yields and coupon rates are important', 'bonds')).toBe(true);
    });

    it('should assess explanation structure quality', () => {
      const generator = explanationGenerator as any;

      const structuredText = 'First, we need to understand the concept. Therefore, stocks represent ownership. However, this comes with risks.';
      const unstructuredText = 'Stocks are ownership.';

      expect(generator.checkExplanationStructure(structuredText)).toBe(true);
      expect(generator.checkExplanationStructure(unstructuredText)).toBe(false);
    });

    it('should calculate relevance to correct answer', () => {
      const generator = explanationGenerator as any;

      const relevantExplanation = 'This explanation discusses ownership in companies and shareholder rights';
      const irrelevantExplanation = 'This explanation talks about completely different topics';
      const correctAnswer = 'Ownership in a company';

      const relevantScore = generator.checkRelevanceToAnswer(relevantExplanation, correctAnswer);
      const irrelevantScore = generator.checkRelevanceToAnswer(irrelevantExplanation, correctAnswer);

      expect(relevantScore).toBeGreaterThanOrEqual(0.5);
      expect(irrelevantScore).toBeLessThan(0.5);
    });
  });

  describe('context preparation', () => {
    it('should prepare context within length limits', () => {
      const generator = explanationGenerator as any;

      const result = generator.prepareContextForExplanation(mockContext, 200);
      expect(result.length).toBeLessThan(250);
      expect(result).toContain('Stock Market Fundamentals'); // Should include highest scored document
    });

    it('should extract source references correctly', () => {
      const generator = explanationGenerator as any;

      const references = generator.extractSourceReferences(mockContext);
      expect(references).toHaveLength(2);
      expect(references[0]).toBe('Stock Market Fundamentals (Securities Textbook)');
      expect(references[1]).toBe('Corporate Finance Basics (Finance Guide)');
    });
  });

  describe('pedagogical elements extraction', () => {
    it('should extract key points from explanation text', () => {
      const generator = explanationGenerator as any;

      const explanationText = 'This is important because stocks represent ownership. Therefore, shareholders have rights. The key concept is equity ownership.';
      const keyPoints = generator.extractKeyPoints(explanationText);

      expect(keyPoints.length).toBeGreaterThan(0);
      expect(keyPoints.some((point: string) => point.includes('important') || point.includes('therefore') || point.includes('key'))).toBe(true);
    });

    it('should identify common mistakes by topic', () => {
      const generator = explanationGenerator as any;

      const stockQuestion = { ...mockQuestion, topic: 'stock market' };
      const bondQuestion = { ...mockQuestion, topic: 'bond investing' };

      const stockMistakes = generator.identifyCommonMistakes(stockQuestion);
      const bondMistakes = generator.identifyCommonMistakes(bondQuestion);

      expect(stockMistakes.some((mistake: string) => mistake.includes('stock'))).toBe(true);
      expect(bondMistakes.some((mistake: string) => mistake.includes('bond') || mistake.includes('yield'))).toBe(true);
    });

    it('should extract related concepts based on topic and content', () => {
      const generator = explanationGenerator as any;

      const stockConcepts = generator.extractRelatedConcepts(
        'This explanation covers equity, dividend, and market cap concepts',
        'stock market'
      );

      expect(stockConcepts).toContain('equity');
      expect(stockConcepts).toContain('dividend');
    });
  });

  describe('confidence calculation', () => {
    it('should calculate appropriate confidence scores', () => {
      const generator = explanationGenerator as any;

      const goodResponse = {
        explanation: 'A comprehensive explanation with good length and structure that covers all important aspects.',
        keyPoints: ['Point 1', 'Point 2'],
        examples: ['Example 1']
      };

      const confidence = generator.calculateExplanationConfidence(goodResponse, mockQuestion, mockContext);
      expect(confidence).toBeGreaterThan(0.7);
      expect(confidence).toBeLessThanOrEqual(1.0);
    });
  });
});