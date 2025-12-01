import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from '@google/generative-ai';

export interface QuestionGenerationRequest {
  topic: string;
  context: string;
  questionCount: number;
}

export interface AnswerGenerationRequest {
  questionText: string;
  context: string;
  distractorCount: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  focusOnMisconceptions?: boolean;
}

export interface ExplanationGenerationRequest {
  questionText: string;
  correctAnswer: string;
  incorrectOptions?: Record<string, string>;
  context: string;
  pedagogicalStyle?: 'concise' | 'detailed' | 'step-by-step';
  targetAudience?: 'beginner' | 'intermediate' | 'advanced';
  maxLength?: number;
}

export interface GeneratedQuestion {
  questionText: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
}

export interface GeneratedAnswer {
  correctAnswer: string;
  explanation: string;
  distractors: string[];
}

export interface GeneratedExplanation {
  explanation: string;
  sourceReferences?: string[];
  keyPoints?: string[];
  commonMistakes?: string[];
  mnemonics?: string[];
  examples?: string[];
}

export interface FollowupQuestionRequest {
  question: string;
  context: string;
  topic: string;
  previousExchanges?: Array<{
    question: string;
    answer: string;
    timestamp: Date;
  }>;
}

export interface GeneratedFollowupResponse {
  answer: string;
  confidence?: number;
  sourceReferences?: string[];
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private readonly maxRetries: number = 3;
  private readonly baseDelay: number = 1000; // 1 second

  constructor(apiKey?: string) {
    const key = apiKey || process.env['GEMINI_API_KEY'];
    if (!key) {
      throw new Error('Gemini API key is required. Set GEMINI_API_KEY environment variable or pass it to constructor.');
    }

    this.genAI = new GoogleGenerativeAI(key);
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      } as GenerationConfig
    });
  }

  /**
   * Generate multiple-choice questions based on topic and context
   */
  async generateQuestions(request: QuestionGenerationRequest): Promise<GeneratedQuestion[]> {
    const prompt = this.buildQuestionGenerationPrompt(request);
    
    const response = await this.executeWithRetry(async () => {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    });

    return this.validateAndParseQuestions(response, request.questionCount);
  }

  /**
   * Generate answer and distractors for a given question
   */
  async generateAnswer(request: AnswerGenerationRequest): Promise<GeneratedAnswer> {
    const prompt = this.buildAnswerGenerationPrompt(request);
    
    const response = await this.executeWithRetry(async () => {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    });

    return this.validateAndParseAnswer(response);
  }

  /**
   * Generate explanations for correct answers
   */
  async generateExplanation(request: ExplanationGenerationRequest): Promise<GeneratedExplanation> {
    const prompt = this.buildExplanationPrompt(request);
    
    const response = await this.executeWithRetry(async () => {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    });

    return this.validateAndParseExplanation(response);
  }

  /**
   * Generate response to follow-up questions
   */
  async generateFollowupResponse(request: FollowupQuestionRequest): Promise<GeneratedFollowupResponse> {
    const prompt = this.buildFollowupPrompt(request);
    
    const response = await this.executeWithRetry(async () => {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    });

    return this.validateAndParseFollowupResponse(response);
  }

  /**
   * Execute a function with exponential backoff retry logic
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on authentication errors
        if (error instanceof Error && error.message.includes('API_KEY')) {
          throw error;
        }

        if (attempt < this.maxRetries - 1) {
          const delay = this.baseDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }
    
    throw new Error(`Failed after ${this.maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Build prompt for question generation
   */
  private buildQuestionGenerationPrompt(request: QuestionGenerationRequest): string {
    return `You are an expert securities education tutor. Generate ${request.questionCount} multiple-choice questions about "${request.topic}" based on the following context.

Context:
${request.context}

Requirements:
- Each question must have exactly 4 answer options (A, B, C, D)
- Exactly one option must be correct
- Incorrect options should be plausible distractors based on common misconceptions
- Questions should match the pedagogical style of professional securities examinations
- Use terminology consistent with securities course materials

Format your response as JSON:
{
  "questions": [
    {
      "questionText": "Question text here?",
      "options": {
        "A": "Option A text",
        "B": "Option B text", 
        "C": "Option C text",
        "D": "Option D text"
      },
      "correctAnswer": "A"
    }
  ]
}`;
  }

  /**
   * Build prompt for answer generation
   */
  private buildAnswerGenerationPrompt(request: AnswerGenerationRequest): string {
    const difficultyGuidance = request.difficulty ? 
      `Target difficulty level: ${request.difficulty}` : '';
    
    const misconceptionFocus = request.focusOnMisconceptions ? 
      'Focus on creating distractors based on common student misconceptions.' : '';

    return `You are an expert securities education tutor. For the given question and context, provide the correct answer and create ${request.distractorCount} plausible distractors.

Question: ${request.questionText}

Context:
${request.context}

${difficultyGuidance}
${misconceptionFocus}

Requirements:
- Provide one correct answer based on the context
- Create exactly ${request.distractorCount} plausible but incorrect distractors
- Distractors should be based on common misconceptions or similar concepts
- All options should be roughly the same length and style
- Provide a brief explanation for why the correct answer is right

Format your response as JSON:
{
  "correctAnswer": "The correct answer text here",
  "explanation": "Brief explanation of why this is correct",
  "distractors": [
    "Distractor 1 text",
    "Distractor 2 text",
    "Distractor 3 text"
  ]
}`;
  }

  /**
   * Build prompt for follow-up question response
   */
  private buildFollowupPrompt(request: FollowupQuestionRequest): string {
    const previousExchangesText = request.previousExchanges && request.previousExchanges.length > 0 ? 
      `\nPrevious Follow-up Exchanges:\n${request.previousExchanges.map((exchange, index) => 
        `Q${index + 1}: ${exchange.question}\nA${index + 1}: ${exchange.answer}`
      ).join('\n\n')}` : '';

    return `You are an expert securities education tutor. A student has asked a follow-up question about "${request.topic}". Provide a comprehensive, pedagogically appropriate answer.

Student's Follow-up Question: ${request.question}

Context from Previous Session:
${request.context}
${previousExchangesText}

Requirements:
- Provide a clear, accurate answer grounded in the context
- Use pedagogically appropriate language for securities education
- Build upon previous questions and answers when relevant
- Include examples or clarifications if helpful
- Maintain consistency with established facts from the context
- If the question is outside the scope of securities education, politely redirect

Format your response as JSON:
{
  "answer": "Comprehensive answer to the follow-up question",
  "confidence": 0.95,
  "sourceReferences": ["Reference 1", "Reference 2"]
}`;
  }

  /**
   * Build prompt for explanation generation
   */
  private buildExplanationPrompt(request: ExplanationGenerationRequest): string {
    const styleGuidance = request.pedagogicalStyle ? 
      `Use ${request.pedagogicalStyle} pedagogical style.` : '';
    
    const audienceGuidance = request.targetAudience ? 
      `Target audience: ${request.targetAudience} level students.` : '';
    
    const lengthGuidance = request.maxLength ? 
      `Keep explanation under ${request.maxLength} characters.` : '';

    const incorrectOptionsText = request.incorrectOptions ? 
      `\nIncorrect Options: ${Object.entries(request.incorrectOptions).map(([key, value]) => `${key}: ${value}`).join(', ')}` : '';

    return `You are an expert securities education tutor. Provide a comprehensive explanation for the correct answer and why other options are incorrect.

Question: ${request.questionText}
Correct Answer: ${request.correctAnswer}
${incorrectOptionsText}

Context:
${request.context}

${styleGuidance}
${audienceGuidance}
${lengthGuidance}

Requirements:
- Explain why the correct answer is right using the provided context
- If incorrect options are provided, briefly explain why they are wrong
- Use pedagogically appropriate language and structure
- Include key points that students should remember
- Identify common mistakes students make on this topic
- Provide examples or mnemonics if helpful
- Reference source materials when applicable

Format your response as JSON:
{
  "explanation": "Comprehensive explanation text here",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
  "commonMistakes": ["Common mistake 1", "Common mistake 2"],
  "examples": ["Example 1", "Example 2"],
  "mnemonics": ["Mnemonic 1"],
  "sourceReferences": ["Reference 1", "Reference 2"]
}`;
  }

  /**
   * Validate and parse question generation response
   */
  private validateAndParseQuestions(response: string, expectedCount: number): GeneratedQuestion[] {
    try {
      const parsed = JSON.parse(response);
      
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error('Response must contain a questions array');
      }

      if (parsed.questions.length !== expectedCount) {
        throw new Error(`Expected ${expectedCount} questions, got ${parsed.questions.length}`);
      }

      const validatedQuestions: GeneratedQuestion[] = [];

      for (const question of parsed.questions) {
        this.validateQuestionFormat(question);
        validatedQuestions.push(question);
      }

      return validatedQuestions;
    } catch (error) {
      throw new Error(`Failed to parse question response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate individual question format
   */
  private validateQuestionFormat(question: any): void {
    if (!question.questionText || typeof question.questionText !== 'string') {
      throw new Error('Question must have valid questionText');
    }

    if (!question.options || typeof question.options !== 'object') {
      throw new Error('Question must have options object');
    }

    const requiredOptions = ['A', 'B', 'C', 'D'];
    for (const option of requiredOptions) {
      if (!question.options[option] || typeof question.options[option] !== 'string') {
        throw new Error(`Question must have valid option ${option}`);
      }
    }

    if (!question.correctAnswer || !requiredOptions.includes(question.correctAnswer)) {
      throw new Error('Question must have valid correctAnswer (A, B, C, or D)');
    }
  }

  /**
   * Validate and parse answer generation response
   */
  private validateAndParseAnswer(response: string): GeneratedAnswer {
    try {
      const parsed = JSON.parse(response);
      
      if (!parsed.correctAnswer || typeof parsed.correctAnswer !== 'string') {
        throw new Error('Response must contain valid correctAnswer string');
      }

      if (!parsed.explanation || typeof parsed.explanation !== 'string') {
        throw new Error('Response must contain valid explanation string');
      }

      if (!parsed.distractors || !Array.isArray(parsed.distractors)) {
        throw new Error('Response must contain distractors array');
      }

      if (parsed.distractors.length === 0) {
        throw new Error('Response must contain at least one distractor');
      }

      return parsed as GeneratedAnswer;
    } catch (error) {
      throw new Error(`Failed to parse answer response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate and parse explanation generation response
   */
  private validateAndParseExplanation(response: string): GeneratedExplanation {
    try {
      const parsed = JSON.parse(response);
      
      if (!parsed.explanation || typeof parsed.explanation !== 'string') {
        throw new Error('Response must contain valid explanation string');
      }

      if (!parsed.sourceReferences || !Array.isArray(parsed.sourceReferences)) {
        throw new Error('Response must contain sourceReferences array');
      }

      return parsed as GeneratedExplanation;
    } catch (error) {
      throw new Error(`Failed to parse explanation response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate and parse follow-up response
   */
  private validateAndParseFollowupResponse(response: string): GeneratedFollowupResponse {
    try {
      const parsed = JSON.parse(response);
      
      if (!parsed.answer || typeof parsed.answer !== 'string') {
        throw new Error('Response must contain valid answer string');
      }

      // Confidence and sourceReferences are optional
      if (parsed.confidence !== undefined && (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1)) {
        throw new Error('Confidence must be a number between 0 and 1');
      }

      if (parsed.sourceReferences !== undefined && !Array.isArray(parsed.sourceReferences)) {
        throw new Error('Source references must be an array');
      }

      return {
        answer: parsed.answer,
        confidence: parsed.confidence || 0.8,
        sourceReferences: parsed.sourceReferences || []
      };
    } catch (error) {
      throw new Error(`Failed to parse follow-up response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}