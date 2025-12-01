// Export API routes and middleware
export * from './routes';
export * from './middleware';

import { Router } from 'express';
import sessionsRouter from './routes/sessions';
import quizExportRouter from './routes/quizExport';
import { errorHandler, notFoundHandler, addRateLimitHeaders, validateServicesMiddleware } from './middleware/errorHandler';
import { rateLimitConfig } from './middleware/rateLimit';
import { contentSecurityMiddleware } from './middleware/validation';

/**
 * Main API router
 */
export function createApiRouter(): Router {
  const router = Router();

  // Global middleware
  router.use(contentSecurityMiddleware);
  router.use(addRateLimitHeaders);
  router.use(validateServicesMiddleware);
  router.use(rateLimitConfig.general);

  // API routes
  router.use('/sessions', sessionsRouter);
  router.use('/quiz', quizExportRouter);

  // Health check endpoint
  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Securities RAG Tutor API',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // 404 handler for undefined API routes
  router.use(notFoundHandler);

  // Error handling middleware (must be last)
  router.use(errorHandler);

  return router;
}