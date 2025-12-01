import { Session, FollowupExchange } from '../models/Session';
import { Question } from '../models/Question';

export interface SessionStorage {
  save(session: Session): Promise<void>;
  load(sessionId: string): Promise<Session | null>;
  delete(sessionId: string): Promise<void>;
  cleanup(): Promise<void>;
}

export class InMemorySessionStorage implements SessionStorage {
  private sessions: Map<string, Session> = new Map();

  async save(session: Session): Promise<void> {
    this.sessions.set(session.id, { ...session });
  }

  async load(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : null;
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async cleanup(): Promise<void> {
    const now = new Date();
    for (const [id, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(id);
      }
    }
  }
}

export class SessionManager {
  private storage: SessionStorage;
  private defaultExpirationMinutes: number;

  constructor(storage?: SessionStorage, expirationMinutes: number = 60) {
    this.storage = storage || new InMemorySessionStorage();
    this.defaultExpirationMinutes = expirationMinutes;
  }

  /**
   * Creates a new session with the specified topic and question count
   */
  async createSession(topic: string, questionCount: number, userId?: string): Promise<Session> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.defaultExpirationMinutes * 60 * 1000);
    
    const session: Session = {
      id: this.generateSessionId(),
      ...(userId && { userId }),
      topic,
      questionCount,
      questions: [],
      currentStep: 'input',
      userAnswers: {},
      followupHistory: [],
      createdAt: now,
      expiresAt
    };

    await this.storage.save(session);
    return session;
  }

  /**
   * Retrieves a session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const session = await this.storage.load(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if session has expired
    if (session.expiresAt < new Date()) {
      await this.storage.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Updates an existing session
   */
  async updateSession(session: Session): Promise<void> {
    // Verify session hasn't expired
    if (session.expiresAt < new Date()) {
      throw new Error('Cannot update expired session');
    }

    await this.storage.save(session);
  }

  /**
   * Sets the questions for a session and transitions to 'questions' step
   */
  async setQuestions(sessionId: string, questions: Question[]): Promise<Session> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.currentStep !== 'input') {
      throw new Error(`Cannot set questions in step: ${session.currentStep}`);
    }

    session.questions = questions;
    session.currentStep = 'questions';
    
    await this.updateSession(session);
    return session;
  }

  /**
   * Records user answers and transitions to 'answers' step
   */
  async setUserAnswers(sessionId: string, answers: Record<string, string>): Promise<Session> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.currentStep !== 'questions') {
      throw new Error(`Cannot set answers in step: ${session.currentStep}`);
    }

    session.userAnswers = answers;
    session.currentStep = 'answers';
    
    await this.updateSession(session);
    return session;
  }

  /**
   * Transitions session to 'explanations' step
   */
  async showExplanations(sessionId: string): Promise<Session> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.currentStep !== 'answers') {
      throw new Error(`Cannot show explanations in step: ${session.currentStep}`);
    }

    session.currentStep = 'explanations';
    
    await this.updateSession(session);
    return session;
  }

  /**
   * Adds a follow-up exchange and transitions to 'followup' step
   */
  async addFollowupExchange(sessionId: string, question: string, answer: string): Promise<Session> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.currentStep !== 'explanations' && session.currentStep !== 'followup') {
      throw new Error(`Cannot add follow-up in step: ${session.currentStep}`);
    }

    const exchange: FollowupExchange = {
      question,
      answer,
      timestamp: new Date()
    };

    session.followupHistory.push(exchange);
    session.currentStep = 'followup';
    
    await this.updateSession(session);
    return session;
  }

  /**
   * Extends the session expiration time
   */
  async extendSession(sessionId: string, additionalMinutes: number = 60): Promise<Session> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.expiresAt = new Date(session.expiresAt.getTime() + additionalMinutes * 60 * 1000);
    
    await this.updateSession(session);
    return session;
  }

  /**
   * Deletes a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.storage.delete(sessionId);
  }

  /**
   * Cleans up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    await this.storage.cleanup();
  }

  /**
   * Generates a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}