export interface Document {
  id: string;
  title: string;
  content: string;
  type: 'textbook' | 'qa_pair' | 'regulation';
  source: string;
  chapter?: string;
  section?: string;
  tags: string[];
  embedding: number[];
  metadata: Record<string, any>;
  lastUpdated: Date;
}