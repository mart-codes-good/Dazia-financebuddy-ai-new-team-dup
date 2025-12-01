export interface Question {
  id: string;
  topic: string;
  questionText: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  sourceReferences: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  createdAt: Date;
}