import { SessionManager, InMemorySessionStorage } from '../services/SessionManager';
import { Session } from '../models/Session';
import { Question } from '../models/Question';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockStorage: InMemorySessionStorage;

  beforeEach(() => {
    mockStorage = new InMemorySessionStorage();
    sessionManager = new SessionManager(mockStorage, 60); // 60 minutes expiration
  });

  describe('createSession', () => {
    it('should create a new session with correct properties', async () => {
      const topic = 'Securities Regulations';
      const questionCount = 5;
      const userId = 'user123';

      const session = await sessionManager.createSession(topic, questionCount, userId);

      expect(session.id).toBeDefined();
      expect(session.topic).toBe(topic);
      expect(session.questionCount).toBe(questionCount);
      expect(session.userId).toBe(userId);
      expect(session.currentStep).toBe('input');
      expect(session.questions).toEqual([]);
      expect(session.userAnswers).toEqual({});
      expect(session.followupHistory).toEqual([]);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.expiresAt.getTime()).toBeGreaterThan(session.createdAt.getTime());
    });

    it('should create session without userId', async () => {
      const session = await sessionManager.createSession('Test Topic', 3);
      
      expect(session.userId).toBeUndefined();
      expect(session.topic).toBe('Test Topic');
      expect(session.questionCount).toBe(3);
    });

    it('should set expiration time correctly', async () => {
      const session = await sessionManager.createSession('Test Topic', 3);
      const expectedExpiration = new Date(session.createdAt.getTime() + 60 * 60 * 1000);
      
      expect(Math.abs(session.expiresAt.getTime() - expectedExpiration.getTime())).toBeLessThan(1000);
    });
  });

  describe('getSession', () => {
    it('should retrieve an existing session', async () => {
      const originalSession = await sessionManager.createSession('Test Topic', 3);
      
      const retrievedSession = await sessionManager.getSession(originalSession.id);
      
      expect(retrievedSession).toEqual(originalSession);
    });

    it('should return null for non-existent session', async () => {
      const session = await sessionManager.getSession('non-existent-id');
      
      expect(session).toBeNull();
    });

    it('should return null and delete expired session', async () => {
      // Create session manager with very short expiration
      const shortExpirationManager = new SessionManager(mockStorage, 0.001); // ~0.06 seconds
      const session = await shortExpirationManager.createSession('Test Topic', 3);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const retrievedSession = await shortExpirationManager.getSession(session.id);
      
      expect(retrievedSession).toBeNull();
    });
  });

  describe('updateSession', () => {
    it('should update an existing session', async () => {
      const session = await sessionManager.createSession('Test Topic', 3);
      session.currentStep = 'questions';
      
      await sessionManager.updateSession(session);
      
      const retrievedSession = await sessionManager.getSession(session.id);
      expect(retrievedSession?.currentStep).toBe('questions');
    });

    it('should throw error when updating expired session', async () => {
      const session = await sessionManager.createSession('Test Topic', 3);
      session.expiresAt = new Date(Date.now() - 1000); // Set to past
      
      await expect(sessionManager.updateSession(session)).rejects.toThrow('Cannot update expired session');
    });
  });

  describe('setQuestions', () => {
    it('should set questions and transition to questions step', async () => {
      const session = await sessionManager.createSession('Test Topic', 2);
      const questions: Question[] = [
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

      const updatedSession = await sessionManager.setQuestions(session.id, questions);

      expect(updatedSession.questions).toEqual(questions);
      expect(updatedSession.currentStep).toBe('questions');
    });

    it('should throw error if session not found', async () => {
      await expect(sessionManager.setQuestions('invalid-id', [])).rejects.toThrow('Session not found');
    });

    it('should throw error if not in input step', async () => {
      const session = await sessionManager.createSession('Test Topic', 2);
      session.currentStep = 'questions';
      await sessionManager.updateSession(session);

      await expect(sessionManager.setQuestions(session.id, [])).rejects.toThrow('Cannot set questions in step: questions');
    });
  });

  describe('setUserAnswers', () => {
    it('should set user answers and transition to answers step', async () => {
      const session = await sessionManager.createSession('Test Topic', 2);
      const questions: Question[] = [
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
      await sessionManager.setQuestions(session.id, questions);

      const userAnswers = { 'q1': 'B' };
      const updatedSession = await sessionManager.setUserAnswers(session.id, userAnswers);

      expect(updatedSession.userAnswers).toEqual(userAnswers);
      expect(updatedSession.currentStep).toBe('answers');
    });

    it('should throw error if not in questions step', async () => {
      const session = await sessionManager.createSession('Test Topic', 2);

      await expect(sessionManager.setUserAnswers(session.id, {})).rejects.toThrow('Cannot set answers in step: input');
    });
  });

  describe('showExplanations', () => {
    it('should transition to explanations step', async () => {
      const session = await sessionManager.createSession('Test Topic', 2);
      const questions: Question[] = [
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
      await sessionManager.setQuestions(session.id, questions);
      await sessionManager.setUserAnswers(session.id, { 'q1': 'B' });

      const updatedSession = await sessionManager.showExplanations(session.id);

      expect(updatedSession.currentStep).toBe('explanations');
    });

    it('should throw error if not in answers step', async () => {
      const session = await sessionManager.createSession('Test Topic', 2);

      await expect(sessionManager.showExplanations(session.id)).rejects.toThrow('Cannot show explanations in step: input');
    });
  });

  describe('addFollowupExchange', () => {
    it('should add followup exchange and transition to followup step', async () => {
      const session = await sessionManager.createSession('Test Topic', 2);
      // Progress through the flow
      const questions: Question[] = [
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
      await sessionManager.setQuestions(session.id, questions);
      await sessionManager.setUserAnswers(session.id, { 'q1': 'B' });
      await sessionManager.showExplanations(session.id);

      const question = 'Can you explain more about securities?';
      const answer = 'Securities are financial instruments...';
      const updatedSession = await sessionManager.addFollowupExchange(session.id, question, answer);

      expect(updatedSession.followupHistory).toHaveLength(1);
      expect(updatedSession.followupHistory[0]?.question).toBe(question);
      expect(updatedSession.followupHistory[0]?.answer).toBe(answer);
      expect(updatedSession.followupHistory[0]?.timestamp).toBeInstanceOf(Date);
      expect(updatedSession.currentStep).toBe('followup');
    });

    it('should allow multiple followup exchanges', async () => {
      const session = await sessionManager.createSession('Test Topic', 2);
      // Progress through the flow
      const questions: Question[] = [
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
      await sessionManager.setQuestions(session.id, questions);
      await sessionManager.setUserAnswers(session.id, { 'q1': 'B' });
      await sessionManager.showExplanations(session.id);

      await sessionManager.addFollowupExchange(session.id, 'Question 1', 'Answer 1');
      const updatedSession = await sessionManager.addFollowupExchange(session.id, 'Question 2', 'Answer 2');

      expect(updatedSession.followupHistory).toHaveLength(2);
      expect(updatedSession.followupHistory[1]?.question).toBe('Question 2');
    });

    it('should throw error if not in explanations or followup step', async () => {
      const session = await sessionManager.createSession('Test Topic', 2);

      await expect(sessionManager.addFollowupExchange(session.id, 'Q', 'A')).rejects.toThrow('Cannot add follow-up in step: input');
    });
  });

  describe('extendSession', () => {
    it('should extend session expiration time', async () => {
      const session = await sessionManager.createSession('Test Topic', 2);
      const originalExpiration = session.expiresAt.getTime();

      const updatedSession = await sessionManager.extendSession(session.id, 30);

      expect(updatedSession.expiresAt.getTime()).toBe(originalExpiration + 30 * 60 * 1000);
    });

    it('should use default extension time', async () => {
      const session = await sessionManager.createSession('Test Topic', 2);
      const originalExpiration = session.expiresAt.getTime();

      const updatedSession = await sessionManager.extendSession(session.id);

      expect(updatedSession.expiresAt.getTime()).toBe(originalExpiration + 60 * 60 * 1000);
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      const session = await sessionManager.createSession('Test Topic', 2);

      await sessionManager.deleteSession(session.id);

      const retrievedSession = await sessionManager.getSession(session.id);
      expect(retrievedSession).toBeNull();
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should remove expired sessions', async () => {
      const shortExpirationManager = new SessionManager(mockStorage, 0.001);
      const session = await shortExpirationManager.createSession('Test Topic', 2);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      await shortExpirationManager.cleanupExpiredSessions();

      const retrievedSession = await mockStorage.load(session.id);
      expect(retrievedSession).toBeNull();
    });
  });
});

describe('InMemorySessionStorage', () => {
  let storage: InMemorySessionStorage;

  beforeEach(() => {
    storage = new InMemorySessionStorage();
  });

  it('should save and load sessions', async () => {
    const session: Session = {
      id: 'test-id',
      topic: 'Test Topic',
      questionCount: 3,
      questions: [],
      currentStep: 'input',
      userAnswers: {},
      followupHistory: [],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60000)
    };

    await storage.save(session);
    const loaded = await storage.load('test-id');

    expect(loaded).toEqual(session);
  });

  it('should return null for non-existent session', async () => {
    const loaded = await storage.load('non-existent');
    expect(loaded).toBeNull();
  });

  it('should delete sessions', async () => {
    const session: Session = {
      id: 'test-id',
      topic: 'Test Topic',
      questionCount: 3,
      questions: [],
      currentStep: 'input',
      userAnswers: {},
      followupHistory: [],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60000)
    };

    await storage.save(session);
    await storage.delete('test-id');
    const loaded = await storage.load('test-id');

    expect(loaded).toBeNull();
  });

  it('should cleanup expired sessions', async () => {
    const expiredSession: Session = {
      id: 'expired-id',
      topic: 'Test Topic',
      questionCount: 3,
      questions: [],
      currentStep: 'input',
      userAnswers: {},
      followupHistory: [],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() - 1000) // Expired
    };

    const validSession: Session = {
      id: 'valid-id',
      topic: 'Test Topic',
      questionCount: 3,
      questions: [],
      currentStep: 'input',
      userAnswers: {},
      followupHistory: [],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60000) // Valid
    };

    await storage.save(expiredSession);
    await storage.save(validSession);

    await storage.cleanup();

    const expiredLoaded = await storage.load('expired-id');
    const validLoaded = await storage.load('valid-id');

    expect(expiredLoaded).toBeNull();
    expect(validLoaded).toEqual(validSession);
  });
});