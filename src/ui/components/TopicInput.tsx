import React, { useState } from 'react';

export interface TopicInputProps {
  onSubmit: (topic: string, questionCount: number) => void;
  isLoading?: boolean;
  error?: string;
}

export const TopicInput: React.FC<TopicInputProps> = ({
  onSubmit,
  isLoading = false,
  error
}) => {
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim()) {
      onSubmit(topic.trim(), questionCount);
    }
  };

  return (
    <div className="topic-input">
      <h2>Securities Learning Session</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="topic">
            Topic:
          </label>
          <input
            id="topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter a securities topic (e.g., Options Trading, Bond Valuation)"
            required
            disabled={isLoading}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="questionCount">
            Number of Questions:
          </label>
          <select
            id="questionCount"
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            disabled={isLoading}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20].map(num => (
              <option key={num} value={num}>{num}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        <button 
          type="submit" 
          disabled={isLoading || !topic.trim()}
          className="submit-button"
        >
          {isLoading ? 'Generating Questions...' : 'Generate Questions'}
        </button>
      </form>
    </div>
  );
};