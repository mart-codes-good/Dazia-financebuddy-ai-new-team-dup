import { QuizExportService } from '../services/QuizExportService';
import { Question } from '../models/Question';
import { QuizExportOptions } from '../models/FinanceMate';

/**
 * Example demonstrating the QuizExportService functionality
 */
async function demonstrateQuizExport() {
  console.log('🚀 QuizExportService Demonstration\n');

  const exportService = new QuizExportService();

  // Sample questions
  const sampleQuestions: Question[] = [
    {
      id: '1',
      topic: 'Securities',
      questionText: 'What is a stock?',
      options: {
        A: 'A debt instrument',
        B: 'An equity instrument representing ownership',
        C: 'A commodity',
        D: 'A currency'
      },
      correctAnswer: 'B',
      explanation: 'A stock represents ownership shares in a corporation, giving shareholders voting rights and potential dividends.',
      sourceReferences: ['Securities Act 1933', 'Investment Company Act 1940'],
      difficulty: 'beginner',
      createdAt: new Date('2024-01-01')
    },
    {
      id: '2',
      topic: 'Securities',
      questionText: 'What is the primary purpose of the Securities Act of 1933?',
      options: {
        A: 'To regulate stock exchanges',
        B: 'To provide full disclosure of material information',
        C: 'To prevent insider trading',
        D: 'To establish the SEC'
      },
      correctAnswer: 'B',
      explanation: 'The Securities Act of 1933 requires companies to provide full and fair disclosure of material information to investors.',
      sourceReferences: ['Securities Act 1933 Section 5'],
      difficulty: 'intermediate',
      createdAt: new Date('2024-01-02')
    },
    {
      id: '3',
      topic: 'Securities',
      questionText: 'Which of the following is NOT a characteristic of preferred stock?',
      options: {
        A: 'Fixed dividend payments',
        B: 'Priority over common stock in liquidation',
        C: 'Voting rights in corporate governance',
        D: 'Convertible to common stock (sometimes)'
      },
      correctAnswer: 'C',
      explanation: 'Preferred stock typically does not carry voting rights, unlike common stock.',
      sourceReferences: ['Corporate Finance Textbook Ch. 8'],
      difficulty: 'advanced',
      createdAt: new Date('2024-01-03')
    }
  ];

  // Example 1: Basic export
  console.log('📋 Example 1: Basic Export');
  const basicQuiz = exportService.convertToFinanceMateFormat(sampleQuestions, 'Securities Fundamentals');
  console.log(`Title: ${basicQuiz.title}`);
  console.log(`Questions: ${basicQuiz.questions.length}`);
  console.log(`First question: ${basicQuiz.questions[0]?.question}`);
  console.log(`Correct answer index: ${basicQuiz.questions[0]?.correct} (${['A', 'B', 'C', 'D'][basicQuiz.questions[0]?.correct || 0]})\n`);

  // Example 2: Export with explanations
  console.log('📚 Example 2: Export with Explanations');
  const optionsWithExplanations: QuizExportOptions = {
    format: 'finance-mate',
    includeExplanations: true
  };
  const quizWithExplanations = exportService.convertToFinanceMateFormat(sampleQuestions, 'Securities with Explanations', optionsWithExplanations);
  console.log(`Has explanations: ${!!quizWithExplanations.metadata?.explanations}`);
  console.log(`Explanation for Q1: ${quizWithExplanations.metadata?.explanations?.['0']?.substring(0, 50)}...\n`);

  // Example 3: Filtered by difficulty
  console.log('🎯 Example 3: Filtered by Difficulty (Beginner only)');
  const beginnerOptions: QuizExportOptions = {
    format: 'finance-mate',
    difficultyFilter: ['beginner']
  };
  const beginnerQuiz = exportService.convertToFinanceMateFormat(sampleQuestions, 'Beginner Securities', beginnerOptions);
  console.log(`Questions after filtering: ${beginnerQuiz.questions.length}`);
  console.log(`Difficulty levels: ${beginnerQuiz.metadata?.difficulty?.join(', ')}\n`);

  // Example 4: Limited questions with randomization
  console.log('🎲 Example 4: Limited Questions (Max 2) with Randomization');
  const limitedOptions: QuizExportOptions = {
    format: 'finance-mate',
    maxQuestions: 2,
    randomizeOrder: true,
    includeExplanations: true
  };
  const limitedQuiz = exportService.convertToFinanceMateFormat(sampleQuestions, 'Quick Securities Quiz', limitedOptions);
  console.log(`Questions after limiting: ${limitedQuiz.questions.length}`);
  console.log(`Questions: ${limitedQuiz.questions.map(q => q.question.substring(0, 30) + '...').join(', ')}\n`);

  // Example 5: Full JSON output
  console.log('📄 Example 5: Complete Quiz JSON Structure');
  const fullQuiz = exportService.convertToFinanceMateFormat(sampleQuestions.slice(0, 1), 'Sample Quiz', {
    format: 'finance-mate',
    includeExplanations: true
  });
  console.log(JSON.stringify(fullQuiz, null, 2));

  console.log('\n✅ QuizExportService demonstration completed successfully!');
}

// Run the demonstration
if (require.main === module) {
  demonstrateQuizExport().catch(console.error);
}

export { demonstrateQuizExport };