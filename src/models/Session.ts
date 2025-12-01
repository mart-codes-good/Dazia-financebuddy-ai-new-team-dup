import { Question } from './Question';

export interface FollowupExchange {
  question: string;
  answer: string;
  timestamp: Date;
}

export interface Session {
  id: string;
  userId?: string;
  topic: string;
  questionCount: number;
  questions: Question[];
  currentStep: 'input' | 'questions' | 'answers' | 'explanations' | 'followup';
  userAnswers?: Record<string, string>;
  followupHistory: FollowupExchange[];
  createdAt: Date;
  expiresAt: Date;
}