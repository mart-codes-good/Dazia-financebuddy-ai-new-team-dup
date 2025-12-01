import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiting configuration for different endpoints
 */
export const rateLimitConfig = {
  // General API rate limit
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests',
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes',
      timestamp: new Date().toISOString()
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: 'Too many requests',
        message: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes',
        timestamp: new Date().toISOString()
      });
    }
  }),

  // Session creation rate limit (more restrictive)
  sessionCreation: rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10, // Limit each IP to 10 session creations per 10 minutes
    message: {
      error: 'Too many session creation requests',
      message: 'Too many session creation attempts. Please wait before creating a new session.',
      retryAfter: '10 minutes',
      timestamp: new Date().toISOString()
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: 'Too many session creation requests',
        message: 'Too many session creation attempts. Please wait before creating a new session.',
        retryAfter: '10 minutes',
        timestamp: new Date().toISOString()
      });
    }
  }),

  // Question generation rate limit (most restrictive due to AI API costs)
  questionGeneration: rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // Limit each IP to 5 question generation requests per 5 minutes
    message: {
      error: 'Too many question generation requests',
      message: 'Question generation is resource-intensive. Please wait before generating more questions.',
      retryAfter: '5 minutes',
      timestamp: new Date().toISOString()
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: 'Too many question generation requests',
        message: 'Question generation is resource-intensive. Please wait before generating more questions.',
        retryAfter: '5 minutes',
        timestamp: new Date().toISOString()
      });
    }
  }),

  // Follow-up questions rate limit
  followupQuestions: rateLimit({
    windowMs: 2 * 60 * 1000, // 2 minutes
    max: 20, // Limit each IP to 20 follow-up questions per 2 minutes
    message: {
      error: 'Too many follow-up requests',
      message: 'Too many follow-up questions. Please wait before asking more questions.',
      retryAfter: '2 minutes',
      timestamp: new Date().toISOString()
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: 'Too many follow-up requests',
        message: 'Too many follow-up questions. Please wait before asking more questions.',
        retryAfter: '2 minutes',
        timestamp: new Date().toISOString()
      });
    }
  }),

  // Explanation requests rate limit
  explanations: rateLimit({
    windowMs: 3 * 60 * 1000, // 3 minutes
    max: 15, // Limit each IP to 15 explanation requests per 3 minutes
    message: {
      error: 'Too many explanation requests',
      message: 'Too many explanation requests. Please wait before requesting more explanations.',
      retryAfter: '3 minutes',
      timestamp: new Date().toISOString()
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: 'Too many explanation requests',
        message: 'Too many explanation requests. Please wait before requesting more explanations.',
        retryAfter: '3 minutes',
        timestamp: new Date().toISOString()
      });
    }
  })
};

/**
 * Create a custom rate limiter with specific configuration
 */
export function createRateLimit(options: {
  windowMs: number;
  max: number;
  message: string;
  retryAfter?: string;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      error: 'Rate limit exceeded',
      message: options.message,
      retryAfter: options.retryAfter || `${Math.ceil(options.windowMs / 60000)} minutes`,
      timestamp: new Date().toISOString()
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: options.message,
        retryAfter: options.retryAfter || `${Math.ceil(options.windowMs / 60000)} minutes`,
        timestamp: new Date().toISOString()
      });
    }
  });
}

/**
 * Rate limiter for development/testing (more permissive)
 */
export const developmentRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // Very high limit for development
  message: {
    error: 'Development rate limit exceeded',
    message: 'Even in development, please don\'t spam the API.',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Get appropriate rate limiter based on environment
 */
export function getRateLimiter(type: keyof typeof rateLimitConfig) {
  if (process.env['NODE_ENV'] === 'development') {
    return developmentRateLimit;
  }
  
  return rateLimitConfig[type] || rateLimitConfig.general;
}

