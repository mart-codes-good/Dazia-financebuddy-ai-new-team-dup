import { Document } from './Document';

export interface RetrievedContext {
  documents: Document[];
  relevanceScores: number[];
  totalResults: number;
  query: string;
  retrievedAt: Date;
}