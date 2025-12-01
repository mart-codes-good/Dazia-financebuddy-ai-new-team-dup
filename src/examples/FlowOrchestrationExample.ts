import { FlowManager } from '../services/FlowManager';
import { SessionManager, InMemorySessionStorage } from '../services/SessionManager';
import { FlowController } from '../services/FlowController';
import { QuestionGenerator } from '../services/QuestionGenerator';
import { ExplanationGenerator } from '../services/ExplanationGenerator';
import { GeminiService } from '../services/GeminiService';
import { PromptManager } from '../services/PromptManager';
import { ContextRetriever } from '../services/ContextRetriever';

/**
 * Example demonstrating the complete flow orchestration system
 */
async function demonstrateFlowOrchestration() {
  console.log('=== Flow Orchestration Example ===\n');

  // Set up services (in a real app, these would be dependency injected)
  const storage = new InMemorySessionStorage();
  const sessionManager = new SessionManager(storage, 60);
  const flowController = new FlowController(sessionManager);
  
  // Mock services for this example
  const geminiService = {} as GeminiService;
  const promptManager = {} as PromptManager;
  const contextRetriever = {} as ContextRetriever;
  
  const questionGenerator = new QuestionGenerator(
    geminiService,
    promptManager,
    contextRetriever
  );
  
  const explanationGenerator = new ExplanationGenerator(
    geminiService,
    promptManager,
    contextRetriever
  );

  // Create FlowManager
  const flowManager = new FlowManager({
    sessionManager,
    flowController,
    questionGenerator,
    explanationGenerator
  });

  // Subscribe to state changes
  let stateChangeCount = 0;
  const unsubscribe = flowManager.subscribe((state) => {
    stateChangeCount++;
    console.log(`State Change #${stateChangeCount}:`);
    console.log(`  Step: ${state.currentStep}`);
    console.log(`  Progress: ${state.progress}%`);
    console.log(`  Description: ${state.stepDescription}`);
    console.log(`  Loading: ${state.isLoading}`);
    console.log(`  Error: ${state.error || 'None'}`);
    console.log(`  Allowed Actions: [${state.allowedActions.join(', ')}]`);
    if (state.session) {
      console.log(`  Session ID: ${state.session.id}`);
      console.log(`  Topic: ${state.session.topic}`);
    }
    console.log('');
  });

  try {
    // Step 1: Start a new session
    console.log('1. Starting new learning session...');
    await flowManager.startSession('Options Trading', 3);
    
    // Simulate question generation (normally would call AI service)
    console.log('2. Generating questions...');
    // Mock the question generator for this example
    const mockQuestions = [
      {
        id: 'q1',
        topic: 'Options Trading',
        questionText: 'What is a call option?',
        options: {
          A: 'A contract to sell',
          B: 'A contract to buy',
          C: 'A type of bond',
          D: 'A dividend payment'
        },
        correctAnswer: 'B' as const,
        explanation: 'A call option gives the holder the right to buy.',
        sourceReferences: ['Options Handbook Chapter 3'],
        difficulty: 'beginner' as const,
        createdAt: new Date()
      }
    ];

    // Override the question generator method for this example
    (questionGenerator as any).generateQuestions = async () => mockQuestions;
    
    await flowManager.generateQuestions();

    // Step 3: Simulate user reviewing questions and being ready for answers
    console.log('3. User ready to see answers...');
    const userAnswers = { 'q1': 'A' }; // User got it wrong
    await flowManager.revealAnswers(userAnswers);

    // Step 4: Show explanations
    console.log('4. Showing explanations...');
    await flowManager.showExplanations();

    // Step 5: Ask follow-up question
    console.log('5. Asking follow-up question...');
    
    // Mock the explanation generator for follow-up
    (explanationGenerator as any).generateFollowupAnswer = async (question: string) => {
      return `This is a generated answer for: "${question}"`;
    };
    
    await flowManager.askFollowupQuestion('Can you explain the difference between call and put options?');

    // Step 6: Continue follow-up
    console.log('6. Continuing follow-up discussion...');
    await flowManager.askFollowupQuestion('What factors affect option pricing?');

    // Step 7: Demonstrate validation
    console.log('7. Testing action validation...');
    console.log(`Can generate questions now: ${flowManager.canPerformAction('generate_questions')}`);
    console.log(`Can ask followup now: ${flowManager.canPerformAction('ask_followup')}`);
    console.log(`Next expected step: ${flowManager.getNextStep()}`);

    // Step 8: Restart session
    console.log('8. Restarting session...');
    await flowManager.restartSession();

    // Step 9: Start new session with different topic
    console.log('9. Starting new session with different topic...');
    await flowManager.restartSession('Bond Valuation', 5);

    // Step 10: Clear session
    console.log('10. Clearing session...');
    await flowManager.clearSession();

    console.log('Flow orchestration example completed successfully!');

  } catch (error) {
    console.error('Error in flow orchestration:', error);
  } finally {
    unsubscribe();
  }
}

/**
 * Example of using FlowManager with error handling
 */
async function demonstrateErrorHandling() {
  console.log('\n=== Error Handling Example ===\n');

  const storage = new InMemorySessionStorage();
  const sessionManager = new SessionManager(storage, 60);
  const flowController = new FlowController(sessionManager);
  
  // Create FlowManager with mock services that will fail
  const flowManager = new FlowManager({
    sessionManager,
    flowController,
    questionGenerator: {
      generateQuestions: async () => {
        throw new Error('AI service unavailable');
      }
    } as any,
    explanationGenerator: {} as any
  });

  // Subscribe to state changes to see error handling
  const unsubscribe = flowManager.subscribe((state) => {
    if (state.error) {
      console.log(`Error occurred: ${state.error}`);
      console.log(`Loading state: ${state.isLoading}`);
    }
  });

  try {
    console.log('Starting session that will fail...');
    await flowManager.startSession('Test Topic', 1);
    
    console.log('Attempting to generate questions (will fail)...');
    await flowManager.generateQuestions();
    
  } catch (error) {
    console.log('Caught error in example:', error);
  } finally {
    unsubscribe();
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  demonstrateFlowOrchestration()
    .then(() => demonstrateErrorHandling())
    .catch(console.error);
}

export { demonstrateFlowOrchestration, demonstrateErrorHandling };