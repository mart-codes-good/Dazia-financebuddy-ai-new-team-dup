import { Question } from '../models/Question';
import { RetrievedContext } from '../models/Context';
import { GeminiService, ExplanationGenerationRequest } from './GeminiService';
import { PromptManager, ExplanationGenerationContext } from './PromptManager';

export interface ExplanationGenerationOptions {
  includeSourceReferences?: boolean;
  pedagogicalStyle?: 'concise' | 'detailed' | 'step-by-step';
  targetAudience?: 'beginner' | 'intermediate' | 'advanced';
  maxLength?: number;
  includeRelatedConcepts?: boolean;
}

export interface GeneratedExplanation {
  explanation: string;
  sourceReferences: string[];
  relatedConcepts: string[];
  confidence: number;
  pedagogicalElements: {
    keyPoints: string[];
    commonMistakes?: string[];
    mnemonics?: string[];
    examples?: string[];
  };
}

export interface ExplanationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  qualityScore: number;
}

export class ExplanationGenerator {
  private geminiService: GeminiService;
  private promptManager: PromptManager;
  private readonly maxRetries: number = 3;
  private readonly defaultMaxLength: number = 800;

  constructor(geminiService: GeminiService, promptManager: PromptManager) {
    this.geminiService = geminiService;
    this.promptManager = promptManager;
  }

  /**
   * Generate comprehensive explanation for a question and its correct answer
   */
  async generateExplanation(
    question: Question,
    context: RetrievedContext,
    options: ExplanationGenerationOptions = {}
  ): Promise<GeneratedExplanation> {
    try {
      let attempts = 0;

      while (attempts < this.maxRetries) {
        attempts++;

        try {
          // Prepare context and generate explanation
          const explanation = await this.generateExplanationContent(question, context, options);
          
          // Validate the generated explanation
          const validation = this.validateExplanation(explanation, question, options);
          
          if (validation.isValid) {
            return explanation;
          } else {
            console.warn(`Explanation validation failed (attempt ${attempts}):`, validation.errors);
            if (attempts === this.maxRetries) {
              throw new Error(`Explanation validation failed: ${validation.errors.join(', ')}`);
            }
          }
        } catch (error) {
          console.warn(`Explanation generation attempt ${attempts} failed:`, error);
          if (attempts === this.maxRetries) {
            throw error;
          }
        }
      }

      throw new Error('Failed to generate valid explanation after maximum retries');
    } catch (error) {
      throw new Error(`Explanation generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate explanation content using AI service
   */
  private async generateExplanationContent(
    question: Question,
    context: RetrievedContext,
    options: ExplanationGenerationOptions
  ): Promise<GeneratedExplanation> {
    // Prepare context for explanation generation
    const contextText = this.prepareContextForExplanation(context, options.maxLength);
    const sourceReferences = this.extractSourceReferences(context);

    // Generate prompt using PromptManager
    const promptContext: ExplanationGenerationContext = {
      question: question.questionText,
      correctAnswer: question.options[question.correctAnswer],
      incorrectOptions: this.getIncorrectOptions(question),
      context: contextText,
      documents: context.documents,
      pedagogicalStyle: options.pedagogicalStyle || 'detailed',
      targetAudience: options.targetAudience || question.difficulty || 'intermediate'
    };

    const prompt = this.promptManager.generateExplanationPrompt(promptContext);

    // Call Gemini API for explanation generation
    const request: ExplanationGenerationRequest = {
      questionText: question.questionText,
      correctAnswer: question.options[question.correctAnswer],
      incorrectOptions: this.getIncorrectOptions(question),
      context: contextText,
      maxLength: options.maxLength || this.defaultMaxLength,
      ...(options.pedagogicalStyle && { pedagogicalStyle: options.pedagogicalStyle }),
      ...(options.targetAudience && { targetAudience: options.targetAudience })
    };

    const response = await this.geminiService.generateExplanation(request);

    // Process and enhance the response
    return {
      explanation: response.explanation,
      sourceReferences: options.includeSourceReferences !== false ? sourceReferences : [],
      relatedConcepts: options.includeRelatedConcepts !== false ? 
        this.extractRelatedConcepts(response.explanation, question.topic) : [],
      confidence: this.calculateExplanationConfidence(response, question, context),
      pedagogicalElements: {
        keyPoints: this.extractKeyPoints(response.explanation),
        commonMistakes: response.commonMistakes || this.identifyCommonMistakes(question),
        mnemonics: response.mnemonics || [],
        examples: response.examples || []
      }
    };
  }

  /**
   * Generate explanation for why incorrect options are wrong
   */
  async generateIncorrectOptionExplanations(
    question: Question,
    context: RetrievedContext,
    options: ExplanationGenerationOptions = {}
  ): Promise<Record<string, string>> {
    const incorrectOptions = this.getIncorrectOptions(question);
    const explanations: Record<string, string> = {};

    for (const [option, text] of Object.entries(incorrectOptions)) {
      try {
        const contextText = this.prepareContextForExplanation(context, 400); // Shorter context for individual options

        const request: ExplanationGenerationRequest = {
          questionText: question.questionText,
          correctAnswer: question.options[question.correctAnswer],
          context: contextText,
          pedagogicalStyle: 'concise'
        };

        const response = await this.geminiService.generateExplanation(request);
        explanations[option] = response.explanation;
      } catch (error) {
        console.warn(`Failed to generate explanation for option ${option}:`, error);
        explanations[option] = `This option is incorrect. The correct answer is ${question.correctAnswer}.`;
      }
    }

    return explanations;
  }

  /**
   * Validate generated explanation quality and content
   */
  private validateExplanation(
    explanation: GeneratedExplanation,
    question: Question,
    options: ExplanationGenerationOptions
  ): ExplanationValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let qualityScore = 1.0;

    // Validate explanation text
    if (!explanation.explanation || typeof explanation.explanation !== 'string') {
      errors.push('Explanation text is required and must be a string');
    } else {
      const explanationText = explanation.explanation.trim();
      
      if (explanationText.length === 0) {
        errors.push('Explanation cannot be empty');
      }
      
      if (explanationText.length < 50) {
        warnings.push('Explanation is very short and may lack detail');
        qualityScore -= 0.2;
      }
      
      const maxLength = options.maxLength || this.defaultMaxLength;
      if (explanationText.length > maxLength) {
        warnings.push(`Explanation exceeds maximum length of ${maxLength} characters`);
        qualityScore -= 0.1;
      }

      // Check for pedagogical quality
      const hasKeyTerms = this.checkForKeyTerms(explanationText, question.topic);
      if (!hasKeyTerms) {
        warnings.push('Explanation may lack key terminology for the topic');
        qualityScore -= 0.15;
      }

      const hasStructure = this.checkExplanationStructure(explanationText);
      if (!hasStructure) {
        warnings.push('Explanation may lack clear structure');
        qualityScore -= 0.1;
      }
    }

    // Validate pedagogical elements
    if (!explanation.pedagogicalElements.keyPoints || explanation.pedagogicalElements.keyPoints.length === 0) {
      warnings.push('No key points identified in explanation');
      qualityScore -= 0.1;
    }

    // Validate source references if required
    if (options.includeSourceReferences !== false) {
      if (!explanation.sourceReferences || explanation.sourceReferences.length === 0) {
        warnings.push('No source references provided');
        qualityScore -= 0.05;
      }
    }

    // Check relevance to question and correct answer
    const correctAnswerText = question.options[question.correctAnswer];
    const relevanceScore = this.checkRelevanceToAnswer(explanation.explanation, correctAnswerText);
    if (relevanceScore < 0.5) {
      warnings.push('Explanation may not be sufficiently relevant to the correct answer');
      qualityScore -= 0.2;
    }

    // Validate confidence score
    if (explanation.confidence < 0 || explanation.confidence > 1) {
      errors.push('Confidence score must be between 0 and 1');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      qualityScore: Math.max(0, Math.min(1, qualityScore))
    };
  }

  /**
   * Prepare context text for explanation generation
   */
  private prepareContextForExplanation(context: RetrievedContext, maxLength?: number): string {
    const limit = maxLength || 4000;
    
    // Sort documents by relevance score
    const sortedDocs = context.documents
      .map((doc, index) => ({ doc, score: context.relevanceScores[index] || 0 }))
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    let contextText = '';
    let currentLength = 0;

    for (const { doc } of sortedDocs) {
      const docText = `Source: ${doc.title}\n${doc.content}\n\n`;
      
      if (currentLength + docText.length > limit) {
        // Try to fit a truncated version
        const remainingLength = limit - currentLength - 100;
        if (remainingLength > 200) {
          const truncatedContent = doc.content.substring(0, remainingLength - doc.title.length - 20);
          contextText += `Source: ${doc.title}\n${truncatedContent}...\n\n`;
        }
        break;
      }

      contextText += docText;
      currentLength += docText.length;
    }

    return contextText.trim();
  }

  /**
   * Extract source references from context
   */
  private extractSourceReferences(context: RetrievedContext): string[] {
    return context.documents.map(doc => {
      const source = doc.source || 'Unknown Source';
      const title = doc.title || 'Untitled';
      return `${title} (${source})`;
    });
  }

  /**
   * Get incorrect options from question
   */
  private getIncorrectOptions(question: Question): Record<string, string> {
    const incorrectOptions: Record<string, string> = {};
    
    for (const [option, text] of Object.entries(question.options)) {
      if (option !== question.correctAnswer) {
        incorrectOptions[option] = text;
      }
    }
    
    return incorrectOptions;
  }

  /**
   * Extract related concepts from explanation text
   */
  private extractRelatedConcepts(explanationText: string, topic: string): string[] {
    const concepts: string[] = [];
    
    // Define concept patterns for securities topics
    const conceptPatterns = {
      'stock': ['equity', 'dividend', 'market cap', 'p/e ratio', 'earnings'],
      'bond': ['yield', 'maturity', 'coupon', 'credit rating', 'duration'],
      'option': ['strike price', 'expiration', 'premium', 'volatility', 'time decay'],
      'portfolio': ['diversification', 'correlation', 'beta', 'alpha', 'sharpe ratio'],
      'risk': ['volatility', 'standard deviation', 'var', 'correlation', 'beta'],
      'market': ['liquidity', 'efficiency', 'arbitrage', 'spread', 'volume']
    };

    const topicLower = topic.toLowerCase();
    const explanationLower = explanationText.toLowerCase();

    // Find relevant concept patterns
    for (const [key, relatedTerms] of Object.entries(conceptPatterns)) {
      if (topicLower.includes(key)) {
        relatedTerms.forEach(term => {
          if (explanationLower.includes(term.toLowerCase())) {
            concepts.push(term);
          }
        });
      }
    }

    return Array.from(new Set(concepts));
  }

  /**
   * Calculate confidence score for explanation
   */
  private calculateExplanationConfidence(
    response: any,
    question: Question,
    context: RetrievedContext
  ): number {
    let confidence = 0.8; // Base confidence

    // Adjust based on context quality
    const avgRelevanceScore = context.relevanceScores.reduce((a, b) => a + b, 0) / context.relevanceScores.length;
    confidence += (avgRelevanceScore - 0.7) * 0.3;

    // Adjust based on explanation length and structure
    const explanationLength = response.explanation?.length || 0;
    if (explanationLength > 100 && explanationLength < 600) {
      confidence += 0.1;
    }

    // Adjust based on presence of pedagogical elements
    if (response.keyPoints && response.keyPoints.length > 0) {
      confidence += 0.05;
    }
    if (response.examples && response.examples.length > 0) {
      confidence += 0.05;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Extract key points from explanation text
   */
  private extractKeyPoints(explanationText: string): string[] {
    const keyPoints: string[] = [];
    
    // Split by sentences and identify key points
    const sentences = explanationText.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      
      // Identify sentences that likely contain key points
      if (trimmed.includes('because') || 
          trimmed.includes('therefore') || 
          trimmed.includes('this means') ||
          trimmed.includes('important') ||
          trimmed.includes('key') ||
          trimmed.includes('main')) {
        keyPoints.push(trimmed);
      }
    });

    // Limit to top 3 key points
    return keyPoints.slice(0, 3);
  }

  /**
   * Identify common mistakes for the question type
   */
  private identifyCommonMistakes(question: Question): string[] {
    const mistakes: string[] = [];
    const topic = question.topic.toLowerCase();
    
    // Common mistakes by topic
    const commonMistakesByTopic: Record<string, string[]> = {
      'stock': [
        'Confusing stock price with company value',
        'Ignoring dividend yield in total return calculations',
        'Mixing up market cap and enterprise value'
      ],
      'bond': [
        'Confusing yield with coupon rate',
        'Not understanding inverse relationship between price and yield',
        'Ignoring credit risk in bond valuation'
      ],
      'option': [
        'Confusing call and put options',
        'Not understanding time decay effects',
        'Mixing up intrinsic and time value'
      ],
      'portfolio': [
        'Assuming diversification eliminates all risk',
        'Confusing correlation with causation',
        'Ignoring transaction costs in portfolio optimization'
      ]
    };

    for (const [key, topicMistakes] of Object.entries(commonMistakesByTopic)) {
      if (topic.includes(key)) {
        mistakes.push(...topicMistakes);
        break;
      }
    }

    return mistakes.slice(0, 2); // Limit to 2 common mistakes
  }

  /**
   * Check if explanation contains key terms for the topic
   */
  private checkForKeyTerms(explanationText: string, topic: string): boolean {
    const topicKeywords = {
      'stock': ['equity', 'share', 'dividend', 'market'],
      'bond': ['debt', 'yield', 'coupon', 'maturity'],
      'option': ['derivative', 'strike', 'expiration', 'premium'],
      'portfolio': ['diversification', 'allocation', 'risk', 'return'],
      'market': ['trading', 'liquidity', 'price', 'volume']
    };

    const topicLower = topic.toLowerCase();
    const explanationLower = explanationText.toLowerCase();

    for (const [key, keywords] of Object.entries(topicKeywords)) {
      if (topicLower.includes(key)) {
        return keywords.some(keyword => explanationLower.includes(keyword));
      }
    }

    return true; // Default to true if no specific keywords defined
  }

  /**
   * Check if explanation has good structure
   */
  private checkExplanationStructure(explanationText: string): boolean {
    // Check for basic structure indicators
    const hasMultipleSentences = explanationText.split(/[.!?]+/).length > 2;
    const hasConnectors = /\b(because|therefore|however|additionally|furthermore|moreover)\b/i.test(explanationText);
    const hasLogicalFlow = explanationText.length > 100; // Minimum length for structured explanation

    return hasMultipleSentences && (hasConnectors || hasLogicalFlow);
  }

  /**
   * Check relevance of explanation to the correct answer
   */
  private checkRelevanceToAnswer(explanationText: string, correctAnswer: string): number {
    const explanationWords = explanationText.toLowerCase().split(/\s+/);
    const answerWords = correctAnswer.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    if (answerWords.length === 0) return 0.5; // Default relevance if no meaningful words

    const matchingWords = answerWords.filter(word => 
      explanationWords.some(expWord => expWord.includes(word) || word.includes(expWord))
    );

    return matchingWords.length / answerWords.length;
  }

  /**
   * Generate step-by-step explanation for complex topics
   */
  async generateStepByStepExplanation(
    question: Question,
    context: RetrievedContext,
    options: ExplanationGenerationOptions = {}
  ): Promise<GeneratedExplanation> {
    const stepByStepOptions = {
      ...options,
      pedagogicalStyle: 'step-by-step' as const,
      includeRelatedConcepts: true
    };

    return this.generateExplanation(question, context, stepByStepOptions);
  }
}