import { FlowController } from '../services/FlowController';
import { SessionManager, InMemorySessionStorage } from '../services/SessionManager';
import { Question } from '../models/Question';

describe('FlowController', () => {
  let flowController: FlowController;
  let sessionManager: SessionManager;

  beforeEach(() => {
    const storage = new InMemorySessionStorage();
    sessionManager = new SessionManager(storage, 60);
    flowController = new FlowController(sessionManager);
  });

  describe('validateTransition', () => {
    it('should validate correct transitions', () => {
      const result = flowController.validateTransition('input', 'questions', 'generate_questions');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid transitions', () => {
      const result = flowController.validateTransition('input', 'answers', 'reveal_answers');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid transition');
      expect(result.allowedActions).toContain('generate_questions');
    });

    it('should allow restart from any step', () => {
      const steps = ['questions', 'answers', 'explanations', 'followup'];
      
      steps.forEach(step => {
        const result = flowController.validateTransition(step as any, 'input', 'restart');
        expect(result.isValid).toBe(true);
      });
    });

    it('should allow continuing followup from followup step', () => {
      const result = flowController.validateTransition('followup', 'followup', 'continue_followup');
      expect(result.isValid).toBe(true);
    });
  });

  describe('getAllowedActions', () => {
    it('should return correct actions for input step', () => {
      const actions = flowController.getAllowedActions('input');
      expect(actions).toContain('generate_questions');
      expect(actions).toHaveLength(1);
    });

    it('should return correct actions for questions step', () => {
      const actions = flowController.getAllowedActions('questions');
      expect(actions).toContain('reveal_answers');
      expect(actions).toContain('restart');
      expect(actions).toHaveLength(2);
    });

    it('should return correct actions for followup step', () => {
      const actions = flowController.getAllowedActions('followup');
      expect(actions).toContain('continue_followup');
      expect(actions).toContain('restart');
      expect(actions).toHaveLength(2);
    });
  });

  describe('getNextStep', () => {
    it('should return correct next steps', () => {
      expect(flowController.getNextStep('input')).toBe('questions');
      expect(flowController.getNextStep('questions')).toBe('answers');
      expect(flowController.getNextStep('answers')).toBe('explanations');
      expect(flowController.getNextStep('explanations')).toBe('followup');
      expect(flowController.getNextStep('followup')).toBeNull();
    });
  });

  describe('validateSessionAction', () => {
    it('should validate action for existing session', async () => {
      const session = await sessionManager.createSession('Test Topic', 3);
      
      const result = await flowController.validateSessionAction(session.id, 'generate_questions');
      
      expect(result.isValid).toBe(true);
    });

    it('should reject action for non-existent session', async () => {
      const result = await flowController.validateSessionAction('invalid-id', 'generate_questions');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Session not found');
    });

    it('should reject invalid action for session step', async () => {
      const session = await sessionManager.createSession('Test Topic', 3);
      
      const result = await flowController.validateSessionAction(session.id, 'reveal_answers');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not allowed in step');
      expect(result.allowedActions).toContain('generate_questions');
    });
  });

  describe('executeTransition', () => {
    let sampleQuestions: Question[];

    beforeEach(() => {
      sampleQuestions = [
        {
          id: 'q1',
          topic: 'Test Topic',
          questionText: 'What is a security?',
          options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
          correctAnswer: 'A',
          explanation: 'Test explanation',
          sourceReferences: ['source1'],
          difficulty: 'beginner',
          createdAt: new Date()
        }
      ];
    });

    it('should execute generate_questions transition', async () => {
      const session = await sessionManager.createSession('Test Topic', 3);
      
      const updatedSession = await flowController.executeTransition(session.id, 'generate_questions', {
        questions: sampleQuestions
      });
      
      expect(updatedSession.currentStep).toBe('questions');
      expect(updatedSession.questions).toEqual(sampleQuestions);
    });

    it('should execute reveal_answers transition', async () => {
      const session = await sessionManager.createSession('Test Topic', 3);
      await flowController.executeTransition(session.id, 'generate_questions', {
        questions: sampleQuestions
      });
      
      const userAnswers = { 'q1': 'B' };
      const updatedSession = await flowController.executeTransition(session.id, 'reveal_answers', {
        userAnswers
      });
      
      expect(updatedSession.currentStep).toBe('answers');
      expect(updatedSession.userAnswers).toEqual(userAnswers);
    });

    it('should execute show_explanations transition', async () => {
      const session = await sessionManager.createSession('Test Topic', 3);
      await flowController.executeTransition(session.id, 'generate_questions', {
        questions: sampleQuestions
      });
      await flowController.executeTransition(session.id, 'reveal_answers', {
        userAnswers: { 'q1': 'B' }
      });
      
      const updatedSession = await flowController.executeTransition(session.id, 'show_explanations');
      
      expect(updatedSession.currentStep).toBe('explanations');
    });

    it('should execute ask_followup transition', async () => {
      const session = await sessionManager.createSession('Test Topic', 3);
      await flowController.executeTransition(session.id, 'generate_questions', {
        questions: sampleQuestions
      });
      await flowController.executeTransition(session.id, 'reveal_answers', {
        userAnswers: { 'q1': 'B' }
      });
      await flowController.executeTransition(session.id, 'show_explanations');
      
      const followupData = {
        question: 'Can you explain more?',
        answer: 'Sure, here is more detail...'
      };
      const updatedSession = await flowController.executeTransition(session.id, 'ask_followup', followupData);
      
      expect(updatedSession.currentStep).toBe('followup');
      expect(updatedSession.followupHistory).toHaveLength(1);
      expect(updatedSession.followupHistory[0]?.question).toBe(followupData.question);
      expect(updatedSession.followupHistory[0]?.answer).toBe(followupData.answer);
    });

    it('should execute continue_followup transition', async () => {
      const session = await sessionManager.createSession('Test Topic', 3);
      await flowController.executeTransition(session.id, 'generate_questions', {
        questions: sampleQuestions
      });
      await flowController.executeTransition(session.id, 'reveal_answers', {
        userAnswers: { 'q1': 'B' }
      });
      await flowController.executeTransition(session.id, 'show_explanations');
      await flowController.executeTransition(session.id, 'ask_followup', {
        question: 'First question',
        answer: 'First answer'
      });
      
      const secondFollowup = {
        question: 'Second question',
        answer: 'Second answer'
      };
      const updatedSession = await flowController.executeTransition(session.id, 'continue_followup', secondFollowup);
      
      expect(updatedSession.currentStep).toBe('followup');
      expect(updatedSession.followupHistory).toHaveLength(2);
      expect(updatedSession.followupHistory[1]?.question).toBe(secondFollowup.question);
    });

    it('should execute restart transition', async () => {
      const session = await sessionManager.createSession('Test Topic', 3, 'user123');
      await flowController.executeTransition(session.id, 'generate_questions', {
        questions: sampleQuestions
      });
      
      const newSession = await flowController.executeTransition(session.id, 'restart');
      
      expect(newSession.id).not.toBe(session.id);
      expect(newSession.currentStep).toBe('input');
      expect(newSession.topic).toBe(session.topic);
      expect(newSession.questionCount).toBe(session.questionCount);
      expect(newSession.userId).toBe(session.userId);
      expect(newSession.questions).toEqual([]);
      
      // Original session should be deleted
      const originalSession = await sessionManager.getSession(session.id);
      expect(originalSession).toBeNull();
    });

    it('should throw error for invalid transition', async () => {
      const session = await sessionManager.createSession('Test Topic', 3);
      
      await expect(
        flowController.executeTransition(session.id, 'reveal_answers')
      ).rejects.toThrow('Invalid transition');
    });

    it('should throw error for missing required data', async () => {
      const session = await sessionManager.createSession('Test Topic', 3);
      
      await expect(
        flowController.executeTransition(session.id, 'generate_questions')
      ).rejects.toThrow('Questions data required');
    });

    it('should throw error for unknown action', async () => {
      const session = await sessionManager.createSession('Test Topic', 3);
      
      await expect(
        flowController.executeTransition(session.id, 'unknown_action')
      ).rejects.toThrow('Unknown action');
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        flowController.executeTransition('invalid-id', 'generate_questions', {
          questions: sampleQuestions
        })
      ).rejects.toThrow('Session not found');
    });
  });

  describe('getFlowProgress', () => {
    it('should return correct progress percentages', () => {
      expect(flowController.getFlowProgress('input')).toBe(20);
      expect(flowController.getFlowProgress('questions')).toBe(40);
      expect(flowController.getFlowProgress('answers')).toBe(60);
      expect(flowController.getFlowProgress('explanations')).toBe(80);
      expect(flowController.getFlowProgress('followup')).toBe(100);
    });

    it('should return 0 for invalid step', () => {
      expect(flowController.getFlowProgress('invalid' as any)).toBe(0);
    });
  });

  describe('getStepDescription', () => {
    it('should return correct descriptions for all steps', () => {
      expect(flowController.getStepDescription('input')).toContain('Waiting for topic');
      expect(flowController.getStepDescription('questions')).toContain('Questions generated');
      expect(flowController.getStepDescription('answers')).toContain('Answers revealed');
      expect(flowController.getStepDescription('explanations')).toContain('Explanations provided');
      expect(flowController.getStepDescription('followup')).toContain('Follow-up dialogue');
    });
  });
});