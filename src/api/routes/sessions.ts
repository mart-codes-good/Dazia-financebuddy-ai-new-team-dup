import { Router, Request, Response } from 'express';
import { SessionManager } from '../../services/SessionManager';
import { QuestionGenerator, QuestionGenerationOptions } from '../../services/QuestionGenerator';
import { FlowController } from '../../services/FlowController';
import { ExplanationGenerator } from '../../services/ExplanationGenerator';
import { GeminiService } from '../../services/GeminiService';
import { ContextRetriever } from '../../services/ContextRetriever';
import { PromptManager } from '../../services/PromptManager';
import { 
  validateBody, 
  validateParams, 
  sessionCreationSchema, 
  userAnswersSchema, 
  followupQuestionSchema,
  sessionIdSchema,
  validateTopicMiddleware,
  abusePreventionMiddleware,
  contentSecurityMiddleware
} from '../middleware/validation';
import { 
  asyncHandler, 
  createApiError, 
  handleServiceError, 
  ApiErrorClass,
  createFallbackError,
  validateServicesMiddleware,
  FallbackConfig
} from '../middleware/errorHandler';
import { rateLimitConfig } from '../middleware/rateLimit';

const router = Router();

// Service instances - will be injected during initialization
let sessionManager: SessionManager;
let flowController: FlowController;
let questionGenerator: QuestionGenerator;
let explanationGenerator: ExplanationGenerator;
let geminiService: GeminiService;
let contextRetriever: ContextRetriever;
let promptManager: PromptManager;

// Service initialization function (to be called during app startup)
export function initializeServices(services: {
  sessionManager: SessionManager;
  flowController: FlowController;
  questionGenerator: QuestionGenerator;
  explanationGenerator: ExplanationGenerator;
  geminiService: GeminiService;
  contextRetriever: ContextRetriever;
  promptManager: PromptManager;
}) {
  sessionManager = services.sessionManager;
  flowController = services.flowController;
  questionGenerator = services.questionGenerator;
  explanationGenerator = services.explanationGenerator;
  geminiService = services.geminiService;
  contextRetriever = services.contextRetriever;
  promptManager = services.promptManager;
}

// Initialize with default services for non-test environments
if (process.env['NODE_ENV'] !== 'test') {
  const defaultSessionManager = new SessionManager();
  const defaultFlowController = new FlowController(defaultSessionManager);
  
  initializeServices({
    sessionManager: defaultSessionManager,
    flowController: defaultFlowController,
    questionGenerator: {} as QuestionGenerator, // Will be properly initialized in production
    explanationGenerator: {} as ExplanationGenerator,
    geminiService: {} as GeminiService,
    contextRetriever: {} as ContextRetriever,
    promptManager: {} as PromptManager
  });
}

/**
 * POST /api/sessions
 * Create a new learning session
 */
router.post('/', 
  contentSecurityMiddleware,
  abusePreventionMiddleware,
  rateLimitConfig.sessionCreation,
  validateServicesMiddleware,
  validateBody(sessionCreationSchema),
  validateTopicMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { topic, questionCount, userId } = req.body;

    try {
      // Create new session
      const session = await sessionManager.createSession(topic, questionCount, userId);

      // Generate questions immediately
      if (!questionGenerator) {
        throw createApiError.serviceUnavailable('Question generation service not available');
      }

      const generationOptions: QuestionGenerationOptions = {
        questionCount,
        difficulty: 'intermediate',
        enableReranking: true,
        minRelevanceScore: 0.6
      };

      const generationResult = await questionGenerator.generateQuestions(topic, generationOptions);

      // Update session with generated questions
      const updatedSession = await flowController.executeTransition(
        session.id, 
        'generate_questions', 
        { questions: generationResult.questions }
      );

      // Return session with questions
      res.status(201).json({
        success: true,
        data: {
          session: {
            id: updatedSession.id,
            topic: updatedSession.topic,
            questionCount: updatedSession.questionCount,
            currentStep: updatedSession.currentStep,
            createdAt: updatedSession.createdAt,
            expiresAt: updatedSession.expiresAt
          },
          questions: updatedSession.questions.map(q => ({
            id: q.id,
            questionText: q.questionText,
            options: q.options,
            difficulty: q.difficulty
          })),
          metadata: {
            generationStats: questionGenerator.getGenerationStats(generationResult),
            contextDocuments: generationResult.context.documents.length
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Session creation error:', error);
      
      if (error instanceof Error) {
        // Check if fallback is enabled for AI service failures
        const fallbackConfig: FallbackConfig = {
          enableFallback: process.env['ENABLE_AI_FALLBACK'] === 'true',
          maxRetries: 3,
          fallbackMessage: 'Using simplified question generation due to AI service issues'
        };

        if (error.message.includes('AI service') || error.message.includes('generation') || error.message.includes('gemini')) {
          if (fallbackConfig.enableFallback) {
            throw createFallbackError(error, 'ai', fallbackConfig);
          } else {
            throw handleServiceError(error, 'ai');
          }
        }
        if (error.message.includes('vector') || error.message.includes('embedding')) {
          throw handleServiceError(error, 'vector');
        }
        if (error.message.includes('session')) {
          throw handleServiceError(error, 'session');
        }
      }
      
      throw createApiError.internalServer('Failed to create session and generate questions');
    }
  })
);

/**
 * GET /api/sessions/:id/questions
 * Retrieve questions for a session
 */
router.get('/:id/questions',
  rateLimitConfig.general,
  validateParams(sessionIdSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      throw createApiError.badRequest('Session ID is required');
    }

    try {
      const session = await sessionManager.getSession(id);
      
      if (!session) {
        throw createApiError.notFound('Session not found or expired');
      }

      if (session.currentStep === 'input') {
        throw createApiError.conflict('Questions not yet generated for this session');
      }

      // Return questions without correct answers or explanations
      const questions = session.questions.map(q => ({
        id: q.id,
        questionText: q.questionText,
        options: q.options,
        difficulty: q.difficulty
      }));

      res.json({
        success: true,
        data: {
          sessionId: session.id,
          topic: session.topic,
          currentStep: session.currentStep,
          questions,
          progress: flowController.getFlowProgress(session.currentStep),
          stepDescription: flowController.getStepDescription(session.currentStep)
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      // Re-throw ApiErrors directly (they're already properly formatted)
      if (error instanceof ApiErrorClass) {
        throw error;
      }
      
      if (error instanceof Error && error.message.includes('session')) {
        throw handleServiceError(error, 'session');
      }
      throw error;
    }
  })
);

/**
 * POST /api/sessions/:id/reveal-answers
 * Reveal correct answers for session questions
 */
router.post('/:id/reveal-answers',
  rateLimitConfig.general,
  validateParams(sessionIdSchema),
  validateBody(userAnswersSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { userAnswers } = req.body;
    if (!id) {
      throw createApiError.badRequest('Session ID is required');
    }

    try {
      const session = await sessionManager.getSession(id);
      
      if (!session) {
        throw createApiError.notFound('Session not found or expired');
      }

      if (session.currentStep !== 'questions') {
        const allowedActions = flowController.getAllowedActions(session.currentStep);
        throw createApiError.conflict(
          `Cannot reveal answers in current step: ${session.currentStep}`,
          { 
            currentStep: session.currentStep,
            allowedActions
          }
        );
      }

      // Update session with user answers and transition to answers step
      const updatedSession = await flowController.executeTransition(
        id, 
        'reveal_answers', 
        { userAnswers: userAnswers || {} }
      );

      // Calculate score
      const totalQuestions = updatedSession.questions.length;
      let correctAnswers = 0;

      const questionsWithAnswers = updatedSession.questions.map(q => {
        const userAnswer = updatedSession.userAnswers?.[q.id];
        const isCorrect = userAnswer === q.correctAnswer;
        
        if (isCorrect) {
          correctAnswers++;
        }

        return {
          id: q.id,
          questionText: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer,
          userAnswer: userAnswer || null,
          isCorrect,
          difficulty: q.difficulty
        };
      });

      const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

      res.json({
        success: true,
        data: {
          sessionId: updatedSession.id,
          currentStep: updatedSession.currentStep,
          questions: questionsWithAnswers,
          score: {
            correct: correctAnswers,
            total: totalQuestions,
            percentage: score
          },
          progress: flowController.getFlowProgress(updatedSession.currentStep),
          nextAction: 'show_explanations'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      if (error instanceof Error && error.message.includes('session')) {
        throw handleServiceError(error, 'session');
      }
      throw error;
    }
  })
);

/**
 * GET /api/sessions/:id/explanations
 * Get explanations for correct answers
 */
router.get('/:id/explanations',
  rateLimitConfig.explanations,
  validateParams(sessionIdSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      throw createApiError.badRequest('Session ID is required');
    }

    try {
      const session = await sessionManager.getSession(id);
      
      if (!session) {
        throw createApiError.notFound('Session not found or expired');
      }

      if (session.currentStep !== 'answers') {
        throw createApiError.conflict(
          `Cannot show explanations in current step: ${session.currentStep}`,
          { 
            currentStep: session.currentStep,
            allowedActions: flowController.getAllowedActions(session.currentStep)
          }
        );
      }

      // Generate explanations if not already present
      const questionsWithExplanations = [];

      for (const question of session.questions) {
        let explanation = question.explanation;

        // Generate explanation if empty
        if (!explanation && explanationGenerator && contextRetriever) {
          try {
            // Retrieve context for this specific question
            const context = await contextRetriever.retrieveContext(
              `${question.topic} ${question.questionText}`,
              { limit: 5, minScore: 0.5 }
            );

            const generatedExplanation = await explanationGenerator.generateExplanation(
              question,
              context,
              {
                pedagogicalStyle: 'detailed',
                targetAudience: question.difficulty,
                includeSourceReferences: true,
                maxLength: 600
              }
            );

            explanation = generatedExplanation.explanation;
          } catch (explanationError) {
            console.warn(`Failed to generate explanation for question ${question.id}:`, explanationError);
            explanation = `The correct answer is ${question.correctAnswer}: ${question.options[question.correctAnswer]}`;
          }
        }

        const userAnswer = session.userAnswers?.[question.id];
        const isCorrect = userAnswer === question.correctAnswer;

        questionsWithExplanations.push({
          id: question.id,
          questionText: question.questionText,
          options: question.options,
          correctAnswer: question.correctAnswer,
          userAnswer: userAnswer || null,
          isCorrect,
          explanation,
          sourceReferences: question.sourceReferences,
          difficulty: question.difficulty
        });
      }

      // Transition session to explanations step
      const updatedSession = await flowController.executeTransition(id, 'show_explanations');

      res.json({
        success: true,
        data: {
          sessionId: updatedSession.id,
          currentStep: updatedSession.currentStep,
          questions: questionsWithExplanations,
          progress: flowController.getFlowProgress(updatedSession.currentStep),
          nextAction: 'ask_followup'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('session')) {
          throw handleServiceError(error, 'session');
        }
        if (error.message.includes('AI service') || error.message.includes('explanation')) {
          throw handleServiceError(error, 'ai');
        }
      }
      throw error;
    }
  })
);

/**
 * POST /api/sessions/:id/followup
 * Ask follow-up questions
 */
router.post('/:id/followup',
  contentSecurityMiddleware,
  abusePreventionMiddleware,
  rateLimitConfig.followupQuestions,
  validateParams(sessionIdSchema),
  validateBody(followupQuestionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { question } = req.body;
    if (!id) {
      throw createApiError.badRequest('Session ID is required');
    }

    try {
      const session = await sessionManager.getSession(id);
      
      if (!session) {
        throw createApiError.notFound('Session not found or expired');
      }

      if (session.currentStep !== 'explanations' && session.currentStep !== 'followup') {
        throw createApiError.conflict(
          `Cannot ask follow-up questions in current step: ${session.currentStep}`,
          { 
            currentStep: session.currentStep,
            allowedActions: flowController.getAllowedActions(session.currentStep)
          }
        );
      }

      if (!geminiService) {
        throw createApiError.serviceUnavailable('AI service not available for follow-up questions');
      }

      // Generate follow-up answer using context from the session
      let answer: string;
      
      try {
        // Prepare context from session questions and previous follow-ups
        const contextText = prepareFollowupContext(session);
        
        const followupResponse = await geminiService.generateFollowupResponse({
          question,
          context: contextText,
          topic: session.topic,
          previousExchanges: session.followupHistory
        });

        answer = followupResponse.answer;
      } catch (aiError) {
        console.error('AI service error for follow-up:', aiError);
        
        // Apply fallback mechanism for follow-up questions
        const fallbackConfig: FallbackConfig = {
          enableFallback: process.env['ENABLE_AI_FALLBACK'] === 'true',
          maxRetries: 2,
          fallbackMessage: 'Using simplified response generation due to AI service issues'
        };

        if (fallbackConfig.enableFallback) {
          throw createFallbackError(aiError as Error, 'ai', fallbackConfig);
        } else {
          throw handleServiceError(aiError as Error, 'ai');
        }
      }

      // Update session with follow-up exchange
      const action = session.currentStep === 'explanations' ? 'ask_followup' : 'continue_followup';
      const updatedSession = await flowController.executeTransition(id, action, { question, answer });

      res.json({
        success: true,
        data: {
          sessionId: updatedSession.id,
          currentStep: updatedSession.currentStep,
          followupExchange: {
            question,
            answer,
            timestamp: new Date().toISOString()
          },
          followupHistory: updatedSession.followupHistory,
          progress: flowController.getFlowProgress(updatedSession.currentStep)
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('session')) {
          throw handleServiceError(error, 'session');
        }
        if (error.message.includes('AI service')) {
          throw handleServiceError(error, 'ai');
        }
      }
      throw error;
    }
  })
);

/**
 * GET /api/sessions/:id
 * Get session status and information
 */
router.get('/:id',
  rateLimitConfig.general,
  validateParams(sessionIdSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      throw createApiError.badRequest('Session ID is required');
    }

    try {
      const session = await sessionManager.getSession(id);
      
      if (!session) {
        throw createApiError.notFound('Session not found or expired');
      }

      res.json({
        success: true,
        data: {
          session: {
            id: session.id,
            topic: session.topic,
            questionCount: session.questionCount,
            currentStep: session.currentStep,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            questionsGenerated: session.questions.length,
            followupCount: session.followupHistory.length
          },
          progress: flowController.getFlowProgress(session.currentStep),
          stepDescription: flowController.getStepDescription(session.currentStep),
          allowedActions: flowController.getAllowedActions(session.currentStep)
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      if (error instanceof Error && error.message.includes('session')) {
        throw handleServiceError(error, 'session');
      }
      throw error;
    }
  })
);

/**
 * DELETE /api/sessions/:id
 * Delete a session
 */
router.delete('/:id',
  rateLimitConfig.general,
  validateParams(sessionIdSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      throw createApiError.badRequest('Session ID is required');
    }

    try {
      await sessionManager.deleteSession(id);

      res.json({
        success: true,
        message: 'Session deleted successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      if (error instanceof Error && error.message.includes('session')) {
        throw handleServiceError(error, 'session');
      }
      throw error;
    }
  })
);

/**
 * Helper function to prepare context for follow-up questions
 */
function prepareFollowupContext(session: any): string {
  let context = `Topic: ${session.topic}\n\n`;
  
  // Add questions and correct answers as context
  context += 'Previous Questions and Answers:\n';
  session.questions.forEach((q: any, index: number) => {
    context += `${index + 1}. ${q.questionText}\n`;
    context += `   Correct Answer: ${q.correctAnswer} - ${q.options[q.correctAnswer]}\n`;
    if (q.explanation) {
      context += `   Explanation: ${q.explanation}\n`;
    }
    context += '\n';
  });

  // Add previous follow-up exchanges
  if (session.followupHistory.length > 0) {
    context += 'Previous Follow-up Questions:\n';
    session.followupHistory.forEach((exchange: any, index: number) => {
      context += `Q${index + 1}: ${exchange.question}\n`;
      context += `A${index + 1}: ${exchange.answer}\n\n`;
    });
  }

  return context;
}

export default router;