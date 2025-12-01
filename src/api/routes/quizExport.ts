import { Router, Request, Response } from 'express';
import { SessionManager } from '../../services/SessionManager';
import { QuizExportService } from '../../services/QuizExportService';
import { ExportRequest, ExportResponse } from '../../models/FinanceMate';
import { 
  validateBody, 
  validateParams,
  sessionIdSchema
} from '../middleware/validation';
import { 
  asyncHandler, 
  createApiError, 
  handleServiceError, 
  ApiErrorClass
} from '../middleware/errorHandler';
import { rateLimitConfig } from '../middleware/rateLimit';
import * as Joi from 'joi';

const router = Router();

// Service instances - will be injected during initialization
let sessionManager: SessionManager;
let quizExportService: QuizExportService;

// Service initialization function (to be called during app startup)
export function initializeQuizExportServices(services: {
  sessionManager: SessionManager;
  quizExportService: QuizExportService;
}) {
  sessionManager = services.sessionManager;
  quizExportService = services.quizExportService;
}

// Initialize with default services for non-test environments
if (process.env['NODE_ENV'] !== 'test') {
  const defaultSessionManager = new SessionManager();
  const defaultQuizExportService = new QuizExportService();
  
  initializeQuizExportServices({
    sessionManager: defaultSessionManager,
    quizExportService: defaultQuizExportService
  });
}

// Validation schema for quiz export request
export const quizExportSchema = Joi.object({
  sessionId: Joi.string()
    .required()
    .trim()
    .min(1)
    .messages({
      'string.empty': 'Session ID cannot be empty',
      'any.required': 'Session ID is required'
    }),
  format: Joi.string()
    .valid('finance-mate', 'json')
    .default('finance-mate')
    .messages({
      'any.only': 'Format must be either "finance-mate" or "json"'
    }),
  includeExplanations: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'includeExplanations must be a boolean value'
    }),
  difficultyFilter: Joi.array()
    .items(Joi.string().valid('beginner', 'intermediate', 'advanced'))
    .optional()
    .messages({
      'array.base': 'difficultyFilter must be an array',
      'any.only': 'Difficulty levels must be "beginner", "intermediate", or "advanced"'
    }),
  maxQuestions: Joi.number()
    .integer()
    .min(1)
    .max(50)
    .optional()
    .messages({
      'number.base': 'maxQuestions must be a number',
      'number.integer': 'maxQuestions must be an integer',
      'number.min': 'maxQuestions must be at least 1',
      'number.max': 'maxQuestions cannot exceed 50'
    }),
  randomizeOrder: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'randomizeOrder must be a boolean value'
    }),
  deduplicate: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'deduplicate must be a boolean value'
    })
});

/**
 * POST /api/quiz/export
 * Export quiz from FinanceBuddy session to Finance-mate format
 */
router.post('/export', 
  rateLimitConfig.general,
  validateBody(quizExportSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const exportRequest: ExportRequest = req.body;
    const { sessionId } = exportRequest;

    try {
      // Fetch session data using SessionManager
      const session = await sessionManager.getSession(sessionId);
      
      if (!session) {
        throw createApiError.notFound('Session not found or expired');
      }

      // Check if session has questions
      if (!session.questions || session.questions.length === 0) {
        throw createApiError.badRequest('Session has no questions to export', {
          sessionId,
          currentStep: session.currentStep,
          questionCount: 0
        });
      }

      // Use QuizExportService to transform questions
      const exportOptions: any = {
        format: exportRequest.format || 'finance-mate',
        includeExplanations: exportRequest.includeExplanations || false,
        randomizeOrder: exportRequest.randomizeOrder || false,
        deduplicate: exportRequest.deduplicate || false
      };

      if (exportRequest.difficultyFilter) {
        exportOptions.difficultyFilter = exportRequest.difficultyFilter as ('beginner' | 'intermediate' | 'advanced')[];
      }

      if (exportRequest.maxQuestions) {
        exportOptions.maxQuestions = exportRequest.maxQuestions;
      }

      const quiz = quizExportService.convertToFinanceMateFormat(
        session.questions,
        session.topic,
        exportOptions
      );

      // Return successful response
      const response: ExportResponse = {
        success: true,
        data: {
          quiz,
          exportedAt: new Date().toISOString(),
          questionCount: quiz.questions.length,
          originalSessionId: sessionId
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('Quiz export error:', error);
      
      // Re-throw ApiErrors directly (they're already properly formatted)
      if (error instanceof ApiErrorClass) {
        throw error;
      }
      
      if (error instanceof Error) {
        if (error.message.includes('session')) {
          throw handleServiceError(error, 'session');
        }
        if (error.message.includes('Cannot export quiz')) {
          throw createApiError.badRequest(error.message);
        }
        if (error.message.includes('validation') || error.message.includes('invalid')) {
          throw createApiError.badRequest(`Data validation failed: ${error.message}`);
        }
      }
      
      throw createApiError.internalServer('Failed to export quiz');
    }
  })
);

/**
 * GET /api/quiz/export/:sessionId
 * Convenience endpoint for exporting quiz with default options
 */
router.get('/export/:sessionId',
  rateLimitConfig.general,
  validateParams(sessionIdSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      throw createApiError.badRequest('Session ID is required');
    }

    try {
      // Fetch session data using SessionManager
      const session = await sessionManager.getSession(sessionId);
      
      if (!session) {
        throw createApiError.notFound('Session not found or expired');
      }

      // Check if session has questions
      if (!session.questions || session.questions.length === 0) {
        throw createApiError.badRequest('Session has no questions to export', {
          sessionId,
          currentStep: session.currentStep,
          questionCount: 0
        });
      }

      // Use QuizExportService with default options
      const quiz = quizExportService.convertToFinanceMateFormat(
        session.questions,
        session.topic,
        { format: 'finance-mate' }
      );

      // Return successful response
      const response: ExportResponse = {
        success: true,
        data: {
          quiz,
          exportedAt: new Date().toISOString(),
          questionCount: quiz.questions.length,
          originalSessionId: sessionId
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('Quiz export error:', error);
      
      // Re-throw ApiErrors directly (they're already properly formatted)
      if (error instanceof ApiErrorClass) {
        throw error;
      }
      
      if (error instanceof Error) {
        if (error.message.includes('session')) {
          throw handleServiceError(error, 'session');
        }
        if (error.message.includes('Cannot export quiz')) {
          throw createApiError.badRequest(error.message);
        }
      }
      
      throw createApiError.internalServer('Failed to export quiz');
    }
  })
);

export default router;