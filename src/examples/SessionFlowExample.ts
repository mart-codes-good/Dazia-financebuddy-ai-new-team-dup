import { SessionManager, InMemorySessionStorage } from '../services/SessionManager';
import { FlowController } from '../services/FlowController';
import { Question } from '../models/Question';

/**
 * Example demonstrating the complete session management and flow control workflow
 */
export async function demonstrateSessionFlow(): Promise<void> {
  console.log('=== Securities RAG Tutor - Session Flow Example ===\n');

  // Initialize session management components
  const storage = new InMemorySessionStorage();
  const sessionManager = new SessionManager(storage, 60); // 60 minutes expiration
  const flowController = new FlowController(sessionManager);

  try {
    // Step 1: Create a new session
    console.log('1. Creating new session...');
    const session = await sessionManager.createSession('Securities Regulations', 2, 'user123');
    console.log(`   Session created: ${session.id}`);
    console.log(`   Topic: ${session.topic}`);
    console.log(`   Question Count: ${session.questionCount}`);
    console.log(`   Current Step: ${session.currentStep}`);
    console.log(`   Progress: ${flowController.getFlowProgress(session.currentStep)}%`);
    console.log(`   Description: ${flowController.getStepDescription(session.currentStep)}\n`);

    // Step 2: Generate questions
    console.log('2. Generating questions...');
    const sampleQuestions: Question[] = [
      {
        id: 'q1',
        topic: 'Securities Regulations',
        questionText: 'What is the primary purpose of the Securities Act of 1933?',
        options: {
          A: 'To regulate secondary market trading',
          B: 'To require disclosure of material information for new securities offerings',
          C: 'To establish the Federal Reserve System',
          D: 'To create investment company regulations'
        },
        correctAnswer: 'B',
        explanation: 'The Securities Act of 1933 primarily focuses on requiring companies to provide material information to investors when offering securities to the public for the first time.',
        sourceReferences: ['Securities Act of 1933, Section 5'],
        difficulty: 'intermediate',
        createdAt: new Date()
      },
      {
        id: 'q2',
        topic: 'Securities Regulations',
        questionText: 'Which regulatory body enforces federal securities laws?',
        options: {
          A: 'Federal Reserve Board',
          B: 'Office of the Comptroller of the Currency',
          C: 'Securities and Exchange Commission',
          D: 'Financial Industry Regulatory Authority'
        },
        correctAnswer: 'C',
        explanation: 'The Securities and Exchange Commission (SEC) is the federal agency responsible for enforcing securities laws and regulating the securities markets.',
        sourceReferences: ['Securities Exchange Act of 1934'],
        difficulty: 'beginner',
        createdAt: new Date()
      }
    ];

    const updatedSession1 = await flowController.executeTransition(session.id, 'generate_questions', {
      questions: sampleQuestions
    });
    console.log(`   Questions set successfully`);
    console.log(`   Current Step: ${updatedSession1.currentStep}`);
    console.log(`   Progress: ${flowController.getFlowProgress(updatedSession1.currentStep)}%`);
    console.log(`   Questions generated: ${updatedSession1.questions.length}\n`);

    // Display questions
    console.log('   Generated Questions:');
    updatedSession1.questions.forEach((q, index) => {
      console.log(`   Q${index + 1}: ${q.questionText}`);
      Object.entries(q.options).forEach(([key, value]) => {
        console.log(`      ${key}. ${value}`);
      });
      console.log('');
    });

    // Step 3: Simulate user answers and reveal correct answers
    console.log('3. Recording user answers and revealing correct answers...');
    const userAnswers = { 'q1': 'A', 'q2': 'C' }; // User got q1 wrong, q2 correct
    const updatedSession2 = await flowController.executeTransition(updatedSession1.id, 'reveal_answers', {
      userAnswers
    });
    console.log(`   User answers recorded`);
    console.log(`   Current Step: ${updatedSession2.currentStep}`);
    console.log(`   Progress: ${flowController.getFlowProgress(updatedSession2.currentStep)}%\n`);

    // Display results
    console.log('   Results:');
    updatedSession2.questions.forEach((q, index) => {
      const userAnswer = updatedSession2.userAnswers?.[q.id];
      const isCorrect = userAnswer === q.correctAnswer;
      console.log(`   Q${index + 1}: User answered ${userAnswer}, Correct answer: ${q.correctAnswer} ${isCorrect ? '✓' : '✗'}`);
    });
    console.log('');

    // Step 4: Show explanations
    console.log('4. Showing explanations...');
    const updatedSession3 = await flowController.executeTransition(updatedSession2.id, 'show_explanations');
    console.log(`   Current Step: ${updatedSession3.currentStep}`);
    console.log(`   Progress: ${flowController.getFlowProgress(updatedSession3.currentStep)}%\n`);

    // Display explanations
    console.log('   Explanations:');
    updatedSession3.questions.forEach((q, index) => {
      console.log(`   Q${index + 1} Explanation: ${q.explanation}`);
      console.log(`   Sources: ${q.sourceReferences.join(', ')}\n`);
    });

    // Step 5: Add follow-up questions
    console.log('5. Adding follow-up questions...');
    const followupQuestion = 'Can you explain the difference between the Securities Act of 1933 and the Securities Exchange Act of 1934?';
    const followupAnswer = 'The Securities Act of 1933 regulates the initial offering of securities (primary market), requiring registration and disclosure. The Securities Exchange Act of 1934 regulates ongoing trading of securities (secondary market) and created the SEC to enforce securities laws.';
    
    const updatedSession4 = await flowController.executeTransition(updatedSession3.id, 'ask_followup', {
      question: followupQuestion,
      answer: followupAnswer
    });
    console.log(`   Follow-up exchange added`);
    console.log(`   Current Step: ${updatedSession4.currentStep}`);
    console.log(`   Progress: ${flowController.getFlowProgress(updatedSession4.currentStep)}%`);
    console.log(`   Follow-up history length: ${updatedSession4.followupHistory.length}\n`);

    // Display follow-up
    console.log('   Follow-up Exchange:');
    console.log(`   Q: ${followupQuestion}`);
    console.log(`   A: ${followupAnswer}\n`);

    // Step 6: Continue follow-up
    console.log('6. Continuing follow-up dialogue...');
    const secondFollowup = {
      question: 'What are the penalties for violating securities laws?',
      answer: 'Penalties can include civil monetary penalties, disgorgement of profits, injunctive relief, and in severe cases, criminal prosecution with fines and imprisonment.'
    };
    
    const updatedSession5 = await flowController.executeTransition(updatedSession4.id, 'continue_followup', secondFollowup);
    console.log(`   Additional follow-up added`);
    console.log(`   Follow-up history length: ${updatedSession5.followupHistory.length}\n`);

    // Step 7: Demonstrate session extension
    console.log('7. Extending session...');
    const extendedSession = await sessionManager.extendSession(updatedSession5.id, 30);
    console.log(`   Session extended by 30 minutes`);
    console.log(`   New expiration: ${extendedSession.expiresAt.toISOString()}\n`);

    // Step 8: Demonstrate flow validation
    console.log('8. Demonstrating flow validation...');
    const validationResult = await flowController.validateSessionAction(extendedSession.id, 'generate_questions');
    console.log(`   Can generate questions from followup step: ${validationResult.isValid}`);
    if (!validationResult.isValid) {
      console.log(`   Error: ${validationResult.error}`);
      console.log(`   Allowed actions: ${validationResult.allowedActions?.join(', ')}`);
    }
    console.log('');

    // Step 9: Demonstrate restart capability
    console.log('9. Restarting session...');
    const restartedSession = await flowController.executeTransition(extendedSession.id, 'restart');
    console.log(`   Session restarted with new ID: ${restartedSession.id}`);
    console.log(`   Current Step: ${restartedSession.currentStep}`);
    console.log(`   Topic preserved: ${restartedSession.topic}`);
    console.log(`   Question count preserved: ${restartedSession.questionCount}`);
    console.log(`   Questions reset: ${restartedSession.questions.length === 0}`);
    console.log(`   Progress: ${flowController.getFlowProgress(restartedSession.currentStep)}%\n`);

    // Step 10: Cleanup
    console.log('10. Cleaning up...');
    await sessionManager.deleteSession(restartedSession.id);
    await sessionManager.cleanupExpiredSessions();
    console.log('   Cleanup completed\n');

    console.log('=== Session Flow Example Completed Successfully ===');

  } catch (error) {
    console.error('Error during session flow demonstration:', error);
    throw error;
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  demonstrateSessionFlow()
    .then(() => {
      console.log('\nExample completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nExample failed:', error);
      process.exit(1);
    });
}