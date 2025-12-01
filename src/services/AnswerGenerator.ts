import { Question } from '../models/Question';
import { RetrievedContext } from '../models/Context';
import { GeminiService, AnswerGenerationRequest } from './GeminiService';
import { PromptManager, AnswerGenerationContext } from './PromptManager';

export interface AnswerGenerationOptions {
  includeDistractors?: boolean;
  distractorCount?: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  ensureUniqueness?: boolean;
}

export interface GeneratedAnswer {
  correctAnswer: string;
  explanation: string;
  distractors: string[];
  confidence: number;
}

export interface AnswerValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  confidence: number;
}

export class AnswerGenerator {
  private geminiService: GeminiService;
  private promptManager: PromptManager;
  private readonly maxRetries: number = 3;

  constructor(geminiService: GeminiService, promptManager: PromptManager) {
    this.geminiService = geminiService;
    this.promptManager = promptManager;
  }

  /**
   * Generate correct answer and plausible distractors for a question
   */
  async generateAnswer(
    questionText: string,
    context: RetrievedContext,
    options: AnswerGenerationOptions = {}
  ): Promise<GeneratedAnswer> {
    try {
      const distractorCount = options.distractorCount || 3;
      let attempts = 0;

      while (attempts < this.maxRetries) {
        attempts++;

        try {
          // Prepare context for answer generation
          const contextText = this.prepareContextForAnswer(context);

          // Generate prompt using PromptManager
          const promptContext: AnswerGenerationContext = {
            questionText,
            context: contextText,
            documents: context.documents,
            difficulty: options.difficulty || 'intermediate',
            distractorCount
          };

          const prompt = this.promptManager.generateAnswerPrompt(promptContext);

          // Call Gemini API for answer generation
          const request: AnswerGenerationRequest = {
            questionText,
            context: contextText,
            distractorCount,
            ...(options.difficulty && { difficulty: options.difficulty })
          };

          const response = await this.geminiService.generateAnswer(request);

          // Validate the generated answer
          const validation = this.validateAnswer(response, questionText, options);
          
          if (validation.isValid) {
            return {
              correctAnswer: response.correctAnswer,
              explanation: response.explanation,
              distractors: response.distractors,
              confidence: validation.confidence
            };
          } else {
            console.warn(`Answer validation failed (attempt ${attempts}):`, validation.errors);
            if (attempts === this.maxRetries) {
              throw new Error(`Answer validation failed: ${validation.errors.join(', ')}`);
            }
          }
        } catch (error) {
          console.warn(`Answer generation attempt ${attempts} failed:`, error);
          if (attempts === this.maxRetries) {
            throw error;
          }
        }
      }

      throw new Error('Failed to generate valid answer after maximum retries');
    } catch (error) {
      throw new Error(`Answer generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate multiple choice options from correct answer and distractors
   */
  generateMultipleChoiceOptions(
    correctAnswer: string,
    distractors: string[]
  ): { options: Record<'A' | 'B' | 'C' | 'D', string>; correctOption: 'A' | 'B' | 'C' | 'D' } {
    if (distractors.length !== 3) {
      throw new Error('Exactly 3 distractors are required for multiple choice questions');
    }

    // Combine correct answer with distractors
    const allOptions = [correctAnswer, ...distractors];

    // Shuffle options to randomize correct answer position
    const shuffledOptions = this.shuffleArray([...allOptions]);
    
    // Find position of correct answer after shuffling
    const correctIndex = shuffledOptions.indexOf(correctAnswer);
    const optionLabels: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
    
    const options: Record<'A' | 'B' | 'C' | 'D', string> = {
      A: shuffledOptions[0]!,
      B: shuffledOptions[1]!,
      C: shuffledOptions[2]!,
      D: shuffledOptions[3]!
    };

    return {
      options,
      correctOption: optionLabels[correctIndex]!
    };
  }

  /**
   * Validate generated answer and distractors
   */
  private validateAnswer(
    response: any,
    questionText: string,
    options: AnswerGenerationOptions
  ): AnswerValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let confidence = 1.0;

    // Validate correct answer
    if (!response.correctAnswer || typeof response.correctAnswer !== 'string') {
      errors.push('Correct answer is required and must be a string');
    } else {
      if (response.correctAnswer.trim().length === 0) {
        errors.push('Correct answer cannot be empty');
      }
      if (response.correctAnswer.length > 200) {
        warnings.push('Correct answer is very long');
        confidence -= 0.1;
      }
      if (response.correctAnswer.length < 3) {
        warnings.push('Correct answer is very short');
        confidence -= 0.1;
      }
    }

    // Validate distractors
    if (!Array.isArray(response.distractors)) {
      errors.push('Distractors must be an array');
    } else {
      const expectedCount = options.distractorCount || 3;
      if (response.distractors.length !== expectedCount) {
        errors.push(`Expected ${expectedCount} distractors, got ${response.distractors.length}`);
      }

      // Check each distractor
      response.distractors.forEach((distractor: any, index: number) => {
        if (!distractor || typeof distractor !== 'string') {
          errors.push(`Distractor ${index + 1} must be a string`);
        } else {
          if (distractor.trim().length === 0) {
            errors.push(`Distractor ${index + 1} cannot be empty`);
          }
          if (distractor.length > 200) {
            warnings.push(`Distractor ${index + 1} is very long`);
            confidence -= 0.05;
          }
          if (distractor.length < 3) {
            warnings.push(`Distractor ${index + 1} is very short`);
            confidence -= 0.05;
          }
        }
      });

      // Check for uniqueness
      if (options.ensureUniqueness !== false) {
        const allAnswers = [response.correctAnswer, ...response.distractors];
        const uniqueAnswers = new Set(allAnswers.map(a => a.trim().toLowerCase()));
        
        if (uniqueAnswers.size !== allAnswers.length) {
          errors.push('All answer options must be unique');
        }
      }

      // Check if distractors are plausible but incorrect
      const correctLower = response.correctAnswer.toLowerCase().trim();
      response.distractors.forEach((distractor: string, index: number) => {
        const distractorLower = distractor.toLowerCase().trim();
        
        if (distractorLower === correctLower) {
          errors.push(`Distractor ${index + 1} is identical to correct answer`);
        }
        
        // Check if distractor is too similar to correct answer
        const similarity = this.calculateStringSimilarity(correctLower, distractorLower);
        if (similarity > 0.8) {
          warnings.push(`Distractor ${index + 1} is very similar to correct answer`);
          confidence -= 0.1;
        }
      });
    }

    // Validate explanation
    if (!response.explanation || typeof response.explanation !== 'string') {
      errors.push('Explanation is required and must be a string');
    } else {
      if (response.explanation.trim().length === 0) {
        errors.push('Explanation cannot be empty');
      }
      if (response.explanation.length < 20) {
        warnings.push('Explanation is very short');
        confidence -= 0.1;
      }
      if (response.explanation.length > 1000) {
        warnings.push('Explanation is very long');
        confidence -= 0.05;
      }
    }

    // Check relevance to question
    const questionLower = questionText.toLowerCase();
    const answerLower = response.correctAnswer?.toLowerCase() || '';
    
    if (questionLower.length > 10 && answerLower.length > 3) {
      const questionWords = questionLower.split(/\s+/).filter(w => w.length > 3);
      const answerWords = answerLower.split(/\s+/).filter((w: string) => w.length > 3);
      
      const commonWords = questionWords.filter(word => 
        answerWords.some((answerWord: string) => answerWord.includes(word) || word.includes(answerWord))
      );
      
      if (commonWords.length === 0) {
        warnings.push('Answer may not be relevant to the question');
        confidence -= 0.2;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      confidence: Math.max(0, Math.min(1, confidence))
    };
  }

  /**
   * Prepare context text for answer generation
   */
  private prepareContextForAnswer(context: RetrievedContext): string {
    // Sort documents by relevance score
    const sortedDocs = context.documents
      .map((doc, index) => ({ doc, score: context.relevanceScores[index] || 0 }))
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    let contextText = '';
    const maxLength = 6000; // Shorter context for answer generation
    let currentLength = 0;

    for (const { doc } of sortedDocs) {
      const docText = `${doc.title}: ${doc.content}\n\n`;
      
      if (currentLength + docText.length > maxLength) {
        break;
      }

      contextText += docText;
      currentLength += docText.length;
    }

    return contextText.trim();
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const matrix: number[][] = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(0));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0]![i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j]![0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j]![i] = Math.min(
          matrix[j]![i - 1]! + 1, // deletion
          matrix[j - 1]![i]! + 1, // insertion
          matrix[j - 1]![i - 1]! + indicator // substitution
        );
      }
    }

    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : 1 - (matrix[str2.length]![str1.length]! / maxLength);
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled;
  }

  /**
   * Generate plausible distractors based on common misconceptions
   */
  async generateContextualDistractors(
    questionText: string,
    correctAnswer: string,
    context: RetrievedContext,
    count: number = 3
  ): Promise<string[]> {
    try {
      const contextText = this.prepareContextForAnswer(context);
      
      const request = {
        questionText,
        correctAnswer,
        context: contextText,
        distractorCount: count,
        focusOnMisconceptions: true
      };

      const response = await this.geminiService.generateAnswer(request);
      return response.distractors || [];
    } catch (error) {
      console.warn('Failed to generate contextual distractors:', error);
      return this.generateGenericDistractors(correctAnswer, count);
    }
  }

  /**
   * Generate generic distractors as fallback
   */
  private generateGenericDistractors(correctAnswer: string, count: number): string[] {
    const distractors: string[] = [];
    
    // Simple distractor generation strategies
    const strategies = [
      () => `Not ${correctAnswer.toLowerCase()}`,
      () => `${correctAnswer} (incorrect)`,
      () => `Alternative to ${correctAnswer}`,
      () => `Similar to ${correctAnswer} but different`
    ];

    for (let i = 0; i < count && i < strategies.length; i++) {
      try {
        const strategy = strategies[i];
        if (strategy) {
          distractors.push(strategy());
        } else {
          distractors.push(`Option ${String.fromCharCode(66 + i)}`); // B, C, D
        }
      } catch (error) {
        distractors.push(`Option ${String.fromCharCode(66 + i)}`); // B, C, D
      }
    }

    return distractors;
  }
}