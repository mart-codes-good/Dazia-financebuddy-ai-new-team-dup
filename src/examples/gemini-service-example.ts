/**
 * Example usage of the GeminiService
 * This file demonstrates how to use the GeminiService for generating questions, answers, and explanations
 */

import { GeminiService, QuestionGenerationRequest, AnswerGenerationRequest, ExplanationGenerationRequest } from '../services/GeminiService';

async function demonstrateGeminiService() {
  try {
    // Initialize the service (requires GEMINI_API_KEY environment variable)
    const geminiService = new GeminiService();

    // Example 1: Generate questions
    console.log('=== Generating Questions ===');
    const questionRequest: QuestionGenerationRequest = {
      topic: 'Securities Act of 1933',
      context: `The Securities Act of 1933 was the first major federal securities law enacted in the United States. 
                It requires that investors receive financial and other significant information concerning securities being offered for public sale. 
                It also prohibits deceit, misrepresentations, and other fraud in the sale of securities.`,
      questionCount: 2
    };

    const questions = await geminiService.generateQuestions(questionRequest);
    console.log('Generated Questions:', JSON.stringify(questions, null, 2));

    // Example 2: Generate answers for a specific question
    console.log('\n=== Generating Answers ===');
    const answerRequest: AnswerGenerationRequest = {
      question: 'What is the primary purpose of the Securities Act of 1933?',
      context: `The Securities Act of 1933 requires disclosure of material information about securities being offered for public sale.`,
      options: ['Regulate secondary markets', 'Require disclosure', 'Establish the SEC', 'Regulate advisers']
    };

    const answer = await geminiService.generateAnswers(answerRequest);
    console.log('Generated Answer:', JSON.stringify(answer, null, 2));

    // Example 3: Generate explanation
    console.log('\n=== Generating Explanation ===');
    const explanationRequest: ExplanationGenerationRequest = {
      question: 'What is the primary purpose of the Securities Act of 1933?',
      correctAnswer: 'B',
      context: `The Securities Act of 1933 was enacted to ensure that investors receive material information about securities being offered for public sale. This was a response to the stock market crash of 1929.`
    };

    const explanation = await geminiService.generateExplanation(explanationRequest);
    console.log('Generated Explanation:', JSON.stringify(explanation, null, 2));

  } catch (error) {
    console.error('Error demonstrating GeminiService:', error);
  }
}

// Run the demonstration if this file is executed directly
if (require.main === module) {
  demonstrateGeminiService();
}

export { demonstrateGeminiService };