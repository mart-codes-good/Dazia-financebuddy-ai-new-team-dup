import { Request, Response, NextFunction } from 'express';
import * as Joi from 'joi';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Validation schemas
export const sessionCreationSchema = Joi.object({
  topic: Joi.string()
    .min(3)
    .max(200)
    .trim()
    .required()
    .pattern(/^[a-zA-Z0-9\s\-_.,()&]+$/)
    .messages({
      'string.min': 'Topic must be at least 3 characters long',
      'string.max': 'Topic cannot exceed 200 characters',
      'string.pattern.base': 'Topic contains invalid characters. Use only letters, numbers, spaces, and basic punctuation.',
      'any.required': 'Topic is required'
    }),
  questionCount: Joi.number()
    .integer()
    .min(1)
    .max(20)
    .required()
    .messages({
      'number.base': 'Question count must be a number',
      'number.integer': 'Question count must be an integer',
      'number.min': 'Question count must be at least 1',
      'number.max': 'Question count cannot exceed 20 questions per session',
      'any.required': 'Question count is required'
    }),
  userId: Joi.string()
    .optional()
    .allow('')
    .max(100)
    .trim()
    .alphanum()
    .messages({
      'string.max': 'User ID cannot exceed 100 characters',
      'string.alphanum': 'User ID must contain only letters and numbers'
    })
});

export const userAnswersSchema = Joi.object({
  userAnswers: Joi.object()
    .pattern(
      Joi.string(),
      Joi.string().valid('A', 'B', 'C', 'D')
    )
    .optional()
    .messages({
      'object.pattern.match': 'User answers must be A, B, C, or D'
    })
});

export const followupQuestionSchema = Joi.object({
  question: Joi.string()
    .min(5)
    .max(500)
    .trim()
    .required()
    .pattern(/^[a-zA-Z0-9\s\-_.,()&?!'"]+$/)
    .messages({
      'string.min': 'Follow-up question must be at least 5 characters long',
      'string.max': 'Follow-up question cannot exceed 500 characters',
      'string.pattern.base': 'Question contains invalid characters. Use only letters, numbers, spaces, and basic punctuation.',
      'any.required': 'Follow-up question is required'
    })
});

export const sessionIdSchema = Joi.object({
  id: Joi.string()
    .required()
    .pattern(/^session_\d+_[a-z0-9]+$/)
    .messages({
      'string.pattern.base': 'Invalid session ID format',
      'any.required': 'Session ID is required'
    })
});

/**
 * Middleware to validate request body against a Joi schema
 */
export function validateBody(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors: ValidationError[] = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      res.status(400).json({
        error: 'Validation failed',
        details: validationErrors,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
}

/**
 * Middleware to validate request parameters against a Joi schema
 */
export function validateParams(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors: ValidationError[] = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      res.status(400).json({
        error: 'Invalid parameters',
        details: validationErrors,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Replace req.params with validated data
    req.params = value;
    next();
  };
}

/**
 * Middleware to validate query parameters
 */
export function validateQuery(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors: ValidationError[] = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      res.status(400).json({
        error: 'Invalid query parameters',
        details: validationErrors,
        timestamp: new Date().toISOString()
      });
      return;
    }

    req.query = value;
    next();
  };
}

/**
 * Custom validation function for topic relevance
 */
export function validateTopicRelevance(topic: string): ValidationResult {
  const errors: ValidationError[] = [];
  
  // Check for securities-related keywords
  const securitiesKeywords = [
    'stock', 'bond', 'option', 'derivative', 'portfolio', 'investment',
    'equity', 'debt', 'market', 'trading', 'finance', 'security',
    'mutual fund', 'etf', 'dividend', 'yield', 'risk', 'return',
    'valuation', 'analysis', 'regulation', 'compliance', 'securities',
    'broker', 'dealer', 'exchange', 'nasdaq', 'nyse', 'sec', 'finra',
    'capital', 'asset', 'liability', 'cash flow', 'earnings', 'revenue',
    'profit', 'loss', 'margin', 'leverage', 'hedge', 'arbitrage',
    'futures', 'commodity', 'currency', 'forex', 'swap', 'credit',
    'insurance', 'annuity', 'pension', 'retirement', '401k', 'ira',
    'tax', 'municipal', 'corporate', 'treasury', 'government'
  ];

  const topicLower = topic.toLowerCase();
  const hasRelevantKeywords = securitiesKeywords.some(keyword => 
    topicLower.includes(keyword)
  );

  if (!hasRelevantKeywords) {
    errors.push({
      field: 'topic',
      message: 'Topic should be related to securities, finance, or investments. Examples: "stock options", "bond valuation", "portfolio management"'
    });
  }

  // Check for inappropriate content
  const inappropriatePatterns = [
    /\b(hack|crack|illegal|fraud|scam|cheat|steal)\b/i,
    /\b(personal|private|confidential|secret)\b/i,
    /\b(violence|weapon|drug|adult|explicit)\b/i
  ];

  const hasInappropriateContent = inappropriatePatterns.some(pattern => 
    pattern.test(topic)
  );

  if (hasInappropriateContent) {
    errors.push({
      field: 'topic',
      message: 'Topic contains inappropriate content. Please use professional financial terminology.'
    });
  }

  // Check for overly broad topics
  const tooGenericPatterns = [
    /^(finance|investment|money|business)$/i,
    /^(help|test|example|sample)$/i
  ];

  const isTooGeneric = tooGenericPatterns.some(pattern => 
    pattern.test(topic.trim())
  );

  if (isTooGeneric) {
    errors.push({
      field: 'topic',
      message: 'Topic is too generic. Please be more specific, e.g., "equity valuation methods" instead of "finance"'
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Middleware to validate topic relevance
 */
export function validateTopicMiddleware(req: Request, res: Response, next: NextFunction) {
  const { topic } = req.body;
  
  if (!topic) {
    return next(); // Let Joi validation handle missing topic
  }

  const validation = validateTopicRelevance(topic);
  
  if (!validation.isValid) {
    res.status(400).json({
      error: 'Topic validation failed',
      details: validation.errors,
      timestamp: new Date().toISOString()
    });
    return;
  }

  next();
}

/**
 * Abuse prevention middleware
 */
export function abusePreventionMiddleware(req: Request, res: Response, next: NextFunction) {
  const userAgent = req.get('User-Agent') || '';
  const contentLength = parseInt(req.get('Content-Length') || '0', 10);
  
  // Block requests with suspicious user agents
  const suspiciousAgents = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /curl/i, /wget/i, /python/i, /java/i
  ];
  
  const isSuspiciousAgent = suspiciousAgents.some(pattern => pattern.test(userAgent));
  
  if (isSuspiciousAgent && !userAgent.includes('legitimate')) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Automated requests are not allowed. Please use the web interface.',
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  // Block excessively large requests
  if (contentLength > 10000) { // 10KB limit
    res.status(413).json({
      error: 'Request too large',
      message: 'Request body exceeds maximum allowed size.',
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  // Check for rapid repeated requests (basic protection)
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const requestKey = `${clientIP}:${req.path}`;
  
  // This would typically use Redis or similar for production
  // For now, we'll use a simple in-memory store with cleanup
  const globalTracker = (global as any);
  if (!globalTracker.requestTracker) {
    globalTracker.requestTracker = new Map();
  }
  
  const now = Date.now();
  const requestHistory = globalTracker.requestTracker.get(requestKey) || [];
  
  // Clean old requests (older than 1 minute)
  const recentRequests = requestHistory.filter((timestamp: number) => now - timestamp < 60000);
  
  // Check if too many requests in the last minute
  if (recentRequests.length >= 30) {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Too many requests from this client. Please slow down.',
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  // Add current request
  recentRequests.push(now);
  globalTracker.requestTracker.set(requestKey, recentRequests);
  
  // Cleanup old entries periodically
  if (Math.random() < 0.01) { // 1% chance
    for (const [key, timestamps] of globalTracker.requestTracker.entries()) {
      const validTimestamps = (timestamps as number[]).filter((ts: number) => now - ts < 300000); // 5 minutes
      if (validTimestamps.length === 0) {
        globalTracker.requestTracker.delete(key);
      } else {
        globalTracker.requestTracker.set(key, validTimestamps);
      }
    }
  }
  
  next();
}

/**
 * Content security middleware
 */
export function contentSecurityMiddleware(req: Request, res: Response, next: NextFunction) {
  // Add security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  
  // Validate request content type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type') || '';
    
    if (!contentType.includes('application/json')) {
      res.status(415).json({
        error: 'Unsupported Media Type',
        message: 'Content-Type must be application/json',
        timestamp: new Date().toISOString()
      });
      return;
    }
  }
  
  next();
}