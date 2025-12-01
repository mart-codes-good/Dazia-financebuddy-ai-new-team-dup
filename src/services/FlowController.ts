import { Session } from '../models/Session';
import { SessionManager } from './SessionManager';

export type FlowStep = 'input' | 'questions' | 'answers' | 'explanations' | 'followup';

export interface FlowTransition {
  from: FlowStep;
  to: FlowStep;
  action: string;
}

export interface FlowValidationResult {
  isValid: boolean;
  error?: string;
  allowedActions?: string[];
}

export class FlowController {
  private sessionManager: SessionManager;
  
  // Define valid state transitions
  private readonly validTransitions: FlowTransition[] = [
    { from: 'input', to: 'questions', action: 'generate_questions' },
    { from: 'questions', to: 'answers', action: 'reveal_answers' },
    { from: 'answers', to: 'explanations', action: 'show_explanations' },
    { from: 'explanations', to: 'followup', action: 'ask_followup' },
    { from: 'followup', to: 'followup', action: 'continue_followup' },
    // Allow restarting from any step
    { from: 'questions', to: 'input', action: 'restart' },
    { from: 'answers', to: 'input', action: 'restart' },
    { from: 'explanations', to: 'input', action: 'restart' },
    { from: 'followup', to: 'input', action: 'restart' }
  ];

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  /**
   * Validates if a transition from current step to target step is allowed
   */
  validateTransition(currentStep: FlowStep, targetStep: FlowStep, action: string): FlowValidationResult {
    const transition = this.validTransitions.find(
      t => t.from === currentStep && t.to === targetStep && t.action === action
    );

    if (!transition) {
      const allowedActions = this.getAllowedActions(currentStep);
      return {
        isValid: false,
        error: `Invalid transition from '${currentStep}' to '${targetStep}' with action '${action}'`,
        allowedActions
      };
    }

    return { isValid: true };
  }

  /**
   * Gets all allowed actions from the current step
   */
  getAllowedActions(currentStep: FlowStep): string[] {
    return this.validTransitions
      .filter(t => t.from === currentStep)
      .map(t => t.action);
  }

  /**
   * Gets the next expected step in the normal flow
   */
  getNextStep(currentStep: FlowStep): FlowStep | null {
    const normalFlow: Record<FlowStep, FlowStep | null> = {
      'input': 'questions',
      'questions': 'answers',
      'answers': 'explanations',
      'explanations': 'followup',
      'followup': null // Can continue with more follow-ups or restart
    };

    return normalFlow[currentStep];
  }

  /**
   * Validates if the session is in the correct state for the requested action
   */
  async validateSessionAction(sessionId: string, action: string): Promise<FlowValidationResult> {
    const session = await this.sessionManager.getSession(sessionId);
    
    if (!session) {
      return {
        isValid: false,
        error: 'Session not found or expired'
      };
    }

    const allowedActions = this.getAllowedActions(session.currentStep);
    
    if (!allowedActions.includes(action)) {
      return {
        isValid: false,
        error: `Action '${action}' not allowed in step '${session.currentStep}'`,
        allowedActions
      };
    }

    return { isValid: true };
  }

  /**
   * Executes a state transition with validation
   */
  async executeTransition(sessionId: string, action: string, data?: any): Promise<Session> {
    const session = await this.sessionManager.getSession(sessionId);
    
    if (!session) {
      throw new Error('Session not found or expired');
    }

    const currentStep = session.currentStep;
    let targetStep: FlowStep;
    let updatedSession: Session;

    switch (action) {
      case 'generate_questions':
        targetStep = 'questions';
        if (!data?.questions || !Array.isArray(data.questions)) {
          throw new Error('Questions data required for generate_questions action');
        }
        this.validateTransitionOrThrow(currentStep, targetStep, action);
        updatedSession = await this.sessionManager.setQuestions(sessionId, data.questions);
        break;

      case 'reveal_answers':
        targetStep = 'answers';
        const userAnswers = data?.userAnswers || {};
        this.validateTransitionOrThrow(currentStep, targetStep, action);
        updatedSession = await this.sessionManager.setUserAnswers(sessionId, userAnswers);
        break;

      case 'show_explanations':
        targetStep = 'explanations';
        this.validateTransitionOrThrow(currentStep, targetStep, action);
        updatedSession = await this.sessionManager.showExplanations(sessionId);
        break;

      case 'ask_followup':
      case 'continue_followup':
        targetStep = 'followup';
        if (!data?.question || !data?.answer) {
          throw new Error('Question and answer required for follow-up actions');
        }
        this.validateTransitionOrThrow(currentStep, targetStep, action);
        updatedSession = await this.sessionManager.addFollowupExchange(sessionId, data.question, data.answer);
        break;

      case 'restart':
        targetStep = 'input';
        this.validateTransitionOrThrow(currentStep, targetStep, action);
        // Create a new session with the same topic and question count
        updatedSession = await this.sessionManager.createSession(
          session.topic, 
          session.questionCount, 
          session.userId
        );
        // Delete the old session
        await this.sessionManager.deleteSession(sessionId);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return updatedSession;
  }

  /**
   * Gets the current progress through the flow as a percentage
   */
  getFlowProgress(currentStep: FlowStep): number {
    const stepOrder: FlowStep[] = ['input', 'questions', 'answers', 'explanations', 'followup'];
    const currentIndex = stepOrder.indexOf(currentStep);
    
    if (currentIndex === -1) {
      return 0;
    }

    return Math.round(((currentIndex + 1) / stepOrder.length) * 100);
  }

  /**
   * Gets a human-readable description of the current step
   */
  getStepDescription(step: FlowStep): string {
    const descriptions: Record<FlowStep, string> = {
      'input': 'Waiting for topic and question count',
      'questions': 'Questions generated - ready for user to attempt',
      'answers': 'Answers revealed - ready to show explanations',
      'explanations': 'Explanations provided - ready for follow-up questions',
      'followup': 'Follow-up dialogue in progress'
    };

    return descriptions[step];
  }

  /**
   * Validates a transition and throws an error if invalid
   */
  private validateTransitionOrThrow(currentStep: FlowStep, targetStep: FlowStep, action: string): void {
    const validation = this.validateTransition(currentStep, targetStep, action);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }
  }
}