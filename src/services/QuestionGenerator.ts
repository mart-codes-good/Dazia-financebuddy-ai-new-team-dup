import { Question } from '../models/Question';
import { RetrievedContext } from '../models/Context';
import { ContextRetriever, RetrievalOptions } from './ContextRetriever';
import { GeminiService, QuestionGenerationRequest, GeneratedQuestion } from './GeminiService';
import { PromptManager, QuestionGenerationContext } from './PromptManager';
import { TopicProcessor, TopicValidationResult, SemanticQuery } from './TopicProcessor';

export interface QuestionGenerationOptions {
  questionCount: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  documentTypes?: ('textbook' | 'qa_pair' | 'regulation')[];
  minRelevanceScore?: number;
  maxContextLength?: number;
  enableReranking?: boolean;
}

export interface QuestionGenerationResult {
  questions: Question[];
  context: RetrievedContext;
  topicValidation: TopicValidationResult;
  semanticQuery: SemanticQuery;
  generationMetadata: {
    totalAttempts: number;
    successfulGenerations: number;
    failedValidations: number;
    processingTimeMs: number;
  };
}

export interface QuestionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class QuestionGenerator {
  private contextRetriever: ContextRetriever;
  private geminiService: GeminiService;
  private promptManager: PromptManager;
  private topicProcessor: TopicProcessor;
  private readonly maxRetries: number = 3;
  private readonly maxContextLength: number = 8000;

  constructor(
    contextRetriever: ContextRetriever,
    geminiService: GeminiService,
    promptManager: PromptManager,
    topicProcessor: TopicProcessor
  ) {
    this.contextRetriever = contextRetriever;
    this.geminiService = geminiService;
    this.promptManager = promptManager;
    this.topicProcessor = topicProcessor;
  }

  /**
   * Generate questions for a given topic
   */
  async generateQuestions(
    topic: string,
    options: QuestionGenerationOptions
  ): Promise<QuestionGenerationResult> {
    const startTime = Date.now();
    let totalAttempts = 0;
    let successfulGenerations = 0;
    let failedValidations = 0;

    try {
      // Step 1: Validate topic
      const topicValidation = await this.topicProcessor.validateTopic(topic);
      if (!topicValidation.isValid) {
        throw new Error(`Invalid topic: ${topicValidation.validationMessage}`);
      }

      // Step 2: Generate semantic queries
      const semanticQuery = await this.topicProcessor.generateSemanticQueries(
        topicValidation.normalizedTopic
      );

      // Step 3: Retrieve relevant context
      const context = await this.retrieveContext(semanticQuery, options);

      // Step 4: Generate questions with retry logic
      const questions: Question[] = [];
      const targetCount = options.questionCount;

      while (questions.length < targetCount && totalAttempts < this.maxRetries * targetCount) {
        totalAttempts++;
        
        try {
          const remainingCount = targetCount - questions.length;
          const batchQuestions = await this.generateQuestionBatch(
            topicValidation.normalizedTopic,
            context,
            remainingCount,
            options
          );

          // Validate each generated question
          for (const question of batchQuestions) {
            const validation = this.validateQuestion(question);
            if (validation.isValid) {
              questions.push(question);
              successfulGenerations++;
            } else {
              failedValidations++;
              console.warn(`Question validation failed: ${validation.errors.join(', ')}`);
            }
          }
        } catch (error) {
          console.warn(`Question generation attempt ${totalAttempts} failed:`, error);
          failedValidations++;
        }
      }

      if (questions.length === 0) {
        throw new Error('Failed to generate any valid questions after multiple attempts');
      }

      if (questions.length < targetCount) {
        console.warn(`Generated ${questions.length} questions instead of requested ${targetCount}`);
      }

      const processingTimeMs = Date.now() - startTime;

      return {
        questions,
        context,
        topicValidation,
        semanticQuery,
        generationMetadata: {
          totalAttempts,
          successfulGenerations,
          failedValidations,
          processingTimeMs
        }
      };
    } catch (error) {
      throw new Error(`Question generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve relevant context for question generation
   */
  private async retrieveContext(
    semanticQuery: SemanticQuery,
    options: QuestionGenerationOptions
  ): Promise<RetrievedContext> {
    try {
      const retrievalOptions: RetrievalOptions = {
        limit: 20, // Get more documents for better context
        minScore: options.minRelevanceScore || 0.6,
        includeMetadata: true
      };

      if (options.documentTypes) {
        retrievalOptions.documentTypes = options.documentTypes;
      }

      // Try multiple query variations to get comprehensive context
      const contexts: RetrievedContext[] = [];

      // Primary query with original topic
      const primaryContext = await this.contextRetriever.retrieveContextEnhanced(
        semanticQuery.originalTopic,
        { ...retrievalOptions, enableReranking: options.enableReranking !== false }
      );
      contexts.push(primaryContext);

      // Additional queries with expanded terms
      for (const expandedQuery of semanticQuery.expandedQueries.slice(0, 3)) {
        try {
          const expandedContext = await this.contextRetriever.retrieveContext(
            expandedQuery,
            { ...retrievalOptions, limit: 10 }
          );
          contexts.push(expandedContext);
        } catch (error) {
          console.warn(`Failed to retrieve context for expanded query "${expandedQuery}":`, error);
        }
      }

      // Merge and deduplicate contexts
      return this.mergeContexts(contexts, options.maxContextLength || this.maxContextLength);
    } catch (error) {
      throw new Error(`Context retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a batch of questions
   */
  private async generateQuestionBatch(
    topic: string,
    context: RetrievedContext,
    questionCount: number,
    options: QuestionGenerationOptions
  ): Promise<Question[]> {
    try {
      // Prepare context for prompt
      const contextText = this.prepareContextText(context, options.maxContextLength || this.maxContextLength);

      // Generate prompt using PromptManager
      const promptContext: QuestionGenerationContext = {
        topic,
        questionCount,
        context: contextText,
        documents: context.documents
      };

      const prompt = this.promptManager.generateQuestionPrompt(promptContext);

      // Call Gemini API
      const request: QuestionGenerationRequest = {
        topic,
        context: contextText,
        questionCount
      };

      const generatedQuestions = await this.geminiService.generateQuestions(request);

      // Convert to Question objects
      return generatedQuestions.map(gq => this.convertToQuestion(gq, topic, context, options));
    } catch (error) {
      throw new Error(`Question batch generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert GeneratedQuestion to Question model
   */
  private convertToQuestion(
    generatedQuestion: GeneratedQuestion,
    topic: string,
    context: RetrievedContext,
    options: QuestionGenerationOptions
  ): Question {
    return {
      id: this.generateQuestionId(),
      topic,
      questionText: generatedQuestion.questionText,
      options: generatedQuestion.options,
      correctAnswer: generatedQuestion.correctAnswer,
      explanation: '', // Will be generated separately
      sourceReferences: context.documents.map(doc => `${doc.title} (${doc.source})`),
      difficulty: options.difficulty || 'intermediate',
      createdAt: new Date()
    };
  }

  /**
   * Validate question format and content
   */
  private validateQuestion(question: Question): QuestionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!question.questionText || question.questionText.trim().length === 0) {
      errors.push('Question text is required');
    }

    if (question.questionText && question.questionText.length < 10) {
      warnings.push('Question text is very short');
    }

    if (question.questionText && question.questionText.length > 500) {
      warnings.push('Question text is very long');
    }

    // Validate options
    const requiredOptions = ['A', 'B', 'C', 'D'] as const;
    for (const option of requiredOptions) {
      if (!question.options[option] || question.options[option].trim().length === 0) {
        errors.push(`Option ${option} is required`);
      }
    }

    // Check for duplicate options
    const optionValues = Object.values(question.options);
    const uniqueOptions = new Set(optionValues.map(opt => opt.trim().toLowerCase()));
    if (uniqueOptions.size !== optionValues.length) {
      errors.push('All options must be unique');
    }

    // Validate correct answer
    if (!requiredOptions.includes(question.correctAnswer)) {
      errors.push('Correct answer must be A, B, C, or D');
    }

    // Check option lengths
    for (const [key, value] of Object.entries(question.options)) {
      if (value.length > 200) {
        warnings.push(`Option ${key} is very long`);
      }
      if (value.length < 3) {
        warnings.push(`Option ${key} is very short`);
      }
    }

    // Validate topic relevance (basic check)
    const questionLower = question.questionText.toLowerCase();
    const topicLower = question.topic.toLowerCase();
    const topicWords = topicLower.split(/\s+/);
    const hasTopicRelevance = topicWords.some(word => 
      word.length > 2 && questionLower.includes(word)
    );

    if (!hasTopicRelevance) {
      warnings.push('Question may not be relevant to the specified topic');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Prepare context text for prompt generation
   */
  private prepareContextText(context: RetrievedContext, maxLength: number): string {
    let contextText = '';
    let currentLength = 0;

    // Sort documents by relevance score
    const sortedDocs = context.documents
      .map((doc, index) => ({ doc, score: context.relevanceScores[index] || 0 }))
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    for (const { doc } of sortedDocs) {
      const docText = `Title: ${doc.title}\nContent: ${doc.content}\nSource: ${doc.source}\n\n`;
      
      if (currentLength + docText.length > maxLength) {
        // Try to fit a truncated version
        const remainingLength = maxLength - currentLength - 100; // Leave some buffer
        if (remainingLength > 200) {
          const truncatedContent = doc.content.substring(0, remainingLength - doc.title.length - 50);
          contextText += `Title: ${doc.title}\nContent: ${truncatedContent}...\nSource: ${doc.source}\n\n`;
        }
        break;
      }

      contextText += docText;
      currentLength += docText.length;
    }

    return contextText.trim();
  }

  /**
   * Merge multiple contexts into a single context
   */
  private mergeContexts(contexts: RetrievedContext[], maxLength: number): RetrievedContext {
    const allDocuments = new Map<string, { doc: any; score: number }>();
    let totalResults = 0;

    // Collect all unique documents with their best scores
    for (const context of contexts) {
      totalResults += context.totalResults;
      
      context.documents.forEach((doc, index) => {
        const score = context.relevanceScores[index] || 0;
        const existing = allDocuments.get(doc.id);
        
        if (!existing || score > existing.score) {
          allDocuments.set(doc.id, { doc, score });
        }
      });
    }

    // Sort by score and take top documents
    const sortedEntries = Array.from(allDocuments.values())
      .sort((a, b) => b.score - a.score);

    // Limit by content length
    const finalDocuments = [];
    const finalScores = [];
    let currentLength = 0;

    for (const { doc, score } of sortedEntries) {
      const docLength = doc.title.length + doc.content.length;
      
      if (currentLength + docLength > maxLength && finalDocuments.length > 0) {
        break;
      }

      finalDocuments.push(doc);
      finalScores.push(score);
      currentLength += docLength;
    }

    return {
      documents: finalDocuments,
      relevanceScores: finalScores,
      totalResults,
      query: contexts[0]?.query || '',
      retrievedAt: new Date()
    };
  }

  /**
   * Generate unique question ID
   */
  private generateQuestionId(): string {
    return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate question count parameter
   */
  validateQuestionCount(count: number): { isValid: boolean; message?: string } {
    if (!Number.isInteger(count)) {
      return { isValid: false, message: 'Question count must be an integer' };
    }

    if (count < 1) {
      return { isValid: false, message: 'Question count must be at least 1' };
    }

    if (count > 20) {
      return { isValid: false, message: 'Question count cannot exceed 20' };
    }

    return { isValid: true };
  }

  /**
   * Get generation statistics
   */
  getGenerationStats(result: QuestionGenerationResult): Record<string, any> {
    const metadata = result.generationMetadata;
    
    return {
      questionsGenerated: result.questions.length,
      totalAttempts: metadata.totalAttempts,
      successRate: metadata.totalAttempts > 0 ? metadata.successfulGenerations / metadata.totalAttempts : 0,
      failureRate: metadata.totalAttempts > 0 ? metadata.failedValidations / metadata.totalAttempts : 0,
      processingTimeMs: metadata.processingTimeMs,
      averageTimePerQuestion: result.questions.length > 0 ? metadata.processingTimeMs / result.questions.length : 0,
      contextDocuments: result.context.documents.length,
      averageRelevanceScore: result.context.relevanceScores.length > 0 
        ? result.context.relevanceScores.reduce((a, b) => a + b, 0) / result.context.relevanceScores.length 
        : 0
    };
  }
}