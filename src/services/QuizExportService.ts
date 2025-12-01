import { Question } from '../models/Question';
import { FinanceMateQuiz, FinanceMateQuestion, QuizExportOptions } from '../models/FinanceMate';

/**
 * Service for exporting FinanceBuddy questions to Finance-mate format
 * Handles data transformation, validation, and formatting
 */
export class QuizExportService {
  /**
   * Converts FinanceBuddy questions to Finance-mate quiz format
   * @param questions Array of FinanceBuddy questions to convert
   * @param topic Topic name for the quiz
   * @param options Export options for customization
   * @returns Finance-mate compatible quiz object
   */
  convertToFinanceMateFormat(
    questions: Question[], 
    topic: string, 
    options: QuizExportOptions = { format: 'finance-mate' }
  ): FinanceMateQuiz {
    // Validate input questions
    this.validateQuestions(questions);
    
    // Apply filtering and processing options
    let processedQuestions = this.filterQuestions(questions, options);
    
    if (options.deduplicate) {
      processedQuestions = this.deduplicateQuestions(processedQuestions);
    }
    
    if (options.randomizeOrder) {
      processedQuestions = this.shuffleArray([...processedQuestions]);
    }
    
    if (options.maxQuestions && processedQuestions.length > options.maxQuestions) {
      processedQuestions = processedQuestions.slice(0, options.maxQuestions);
    }
    
    // Transform questions to Finance-mate format
    const financeMateQuestions: FinanceMateQuestion[] = processedQuestions.map(question => ({
      question: question.questionText,
      answers: this.mapAnswerOptions(question.options),
      correct: this.mapCorrectAnswer(question.correctAnswer)
    }));
    
    // Build quiz object
    const quiz: FinanceMateQuiz = {
      title: this.generateQuizTitle(topic),
      questions: financeMateQuestions
    };
    
    // Add metadata if requested
    if (options.includeExplanations || processedQuestions.length > 0) {
      quiz.metadata = {
        topic,
        difficulty: Array.from(new Set(processedQuestions.map(q => q.difficulty))),
        sourceSystem: 'FinanceBuddy',
        exportedAt: new Date().toISOString()
      };
      
      if (options.includeExplanations) {
        quiz.metadata.explanations = {};
        processedQuestions.forEach((question, index) => {
          if (question.explanation && quiz.metadata?.explanations) {
            quiz.metadata.explanations[index.toString()] = question.explanation;
          }
        });
      }
    }
    
    return quiz;
  }
  
  /**
   * Maps FinanceBuddy answer options object to Finance-mate array format
   * Converts {A: "text1", B: "text2", C: "text3", D: "text4"} to ["text1", "text2", "text3", "text4"]
   * @param options FinanceBuddy options object
   * @returns Array of answer strings in A,B,C,D order
   */
  private mapAnswerOptions(options: {A: string, B: string, C: string, D: string}): string[] {
    return [options.A, options.B, options.C, options.D];
  }
  
  /**
   * Maps FinanceBuddy correct answer letter to Finance-mate array index
   * Converts A→0, B→1, C→2, D→3
   * @param correctAnswer Letter representing correct answer
   * @returns Zero-based index of correct answer
   */
  private mapCorrectAnswer(correctAnswer: 'A' | 'B' | 'C' | 'D'): number {
    const mapping: Record<'A' | 'B' | 'C' | 'D', number> = {
      'A': 0,
      'B': 1,
      'C': 2,
      'D': 3
    };
    
    return mapping[correctAnswer];
  }
  
  /**
   * Generates a quiz title from topic and current timestamp
   * @param topic Topic name for the quiz
   * @returns Formatted quiz title
   */
  private generateQuizTitle(topic: string): string {
    const timestamp = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const cleanTopic = topic?.trim() || 'Finance Quiz';
    return `${cleanTopic} - ${timestamp}`;
  }
  
  /**
   * Validates that questions array is not empty and contains valid questions
   * @param questions Array of questions to validate
   * @throws Error if validation fails
   */
  private validateQuestions(questions: Question[]): void {
    if (!questions || questions.length === 0) {
      throw new Error('Cannot export quiz: No questions provided');
    }
    
    questions.forEach((question, index) => {
      if (!question.questionText?.trim()) {
        throw new Error(`Question ${index + 1} has empty question text`);
      }
      
      if (!question.options || !question.options.A || !question.options.B || 
          !question.options.C || !question.options.D) {
        throw new Error(`Question ${index + 1} is missing required answer options`);
      }
      
      if (!['A', 'B', 'C', 'D'].includes(question.correctAnswer)) {
        throw new Error(`Question ${index + 1} has invalid correct answer: ${question.correctAnswer}`);
      }
    });
  }
  
  /**
   * Filters questions based on export options
   * @param questions Array of questions to filter
   * @param options Export options containing filter criteria
   * @returns Filtered array of questions
   */
  private filterQuestions(questions: Question[], options: QuizExportOptions): Question[] {
    let filtered = [...questions];
    
    if (options.difficultyFilter && options.difficultyFilter.length > 0) {
      filtered = filtered.filter(question => 
        options.difficultyFilter!.includes(question.difficulty)
      );
    }
    
    return filtered;
  }
  
  /**
   * Removes duplicate questions based on question text
   * @param questions Array of questions to deduplicate
   * @returns Array with duplicate questions removed
   */
  private deduplicateQuestions(questions: Question[]): Question[] {
    const seen = new Set<string>();
    return questions.filter(question => {
      const key = question.questionText.trim().toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
  
  /**
   * Shuffles array elements randomly (Fisher-Yates algorithm)
   * @param array Array to shuffle
   * @returns New shuffled array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = temp;
    }
    return shuffled;
  }
}