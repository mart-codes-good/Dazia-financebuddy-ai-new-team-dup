/**
 * Data models for Finance-mate quiz format integration
 * These interfaces define the structure for exporting FinanceBuddy questions
 * to Finance-mate's real-time quiz format.
 */

/**
 * Finance-mate question format
 * Represents a single question in Finance-mate's expected structure
 */
export interface FinanceMateQuestion {
  /** The question text */
  question: string;
  
  /** Optional image URL (not currently supported by FinanceBuddy) */
  image?: string;
  
  /** Array of answer options in order [A, B, C, D] */
  answers: string[];
  
  /** Index of the correct answer (0-3, where 0=A, 1=B, 2=C, 3=D) */
  correct: number;
}

/**
 * Finance-mate quiz format
 * Represents a complete quiz with metadata for Finance-mate
 */
export interface FinanceMateQuiz {
  /** Quiz title generated from topic and timestamp */
  title: string;
  
  /** Array of questions in Finance-mate format */
  questions: FinanceMateQuestion[];
  
  /** Optional metadata for traceability and context */
  metadata?: {
    /** Original topic from FinanceBuddy */
    topic: string;
    
    /** Difficulty levels present in the quiz */
    difficulty: string[];
    
    /** Source system identifier */
    sourceSystem: 'FinanceBuddy';
    
    /** ISO timestamp of when the quiz was exported */
    exportedAt: string;
    
    /** Optional explanations mapped by question index */
    explanations?: Record<string, string>;
  };
}

/**
 * Options for customizing quiz export behavior
 */
export interface QuizExportOptions {
  /** Export format (currently only 'finance-mate' supported) */
  format: 'finance-mate' | 'json';
  
  /** Whether to include explanations in metadata */
  includeExplanations?: boolean;
  
  /** Filter questions by difficulty level */
  difficultyFilter?: ('beginner' | 'intermediate' | 'advanced')[];
  
  /** Maximum number of questions to include */
  maxQuestions?: number;
  
  /** Whether to randomize question order */
  randomizeOrder?: boolean;
  
  /** Whether to remove duplicate questions */
  deduplicate?: boolean;
}

/**
 * Request payload for quiz export API
 */
export interface ExportRequest {
  /** Session ID containing the questions to export */
  sessionId: string;
  
  /** Export format (defaults to 'finance-mate') */
  format?: 'finance-mate' | 'json';
  
  /** Whether to include explanations (defaults to false) */
  includeExplanations?: boolean;
  
  /** Filter by difficulty levels */
  difficultyFilter?: string[];
  
  /** Maximum number of questions to export */
  maxQuestions?: number;
  
  /** Whether to randomize question order */
  randomizeOrder?: boolean;
  
  /** Whether to deduplicate questions */
  deduplicate?: boolean;
}

/**
 * Successful export response
 */
export interface ExportSuccessResponse {
  success: true;
  data: {
    /** The exported quiz in Finance-mate format */
    quiz: FinanceMateQuiz;
    
    /** ISO timestamp of export */
    exportedAt: string;
    
    /** Number of questions in the exported quiz */
    questionCount: number;
    
    /** Original session ID that was exported */
    originalSessionId: string;
  };
}

/**
 * Error response for failed exports
 */
export interface ExportErrorResponse {
  success: false;
  error: {
    /** Error code for programmatic handling */
    code: string;
    
    /** Human-readable error message */
    message: string;
    
    /** Additional error details */
    details?: any;
  };
}

/**
 * Union type for all possible export responses
 */
export type ExportResponse = ExportSuccessResponse | ExportErrorResponse;