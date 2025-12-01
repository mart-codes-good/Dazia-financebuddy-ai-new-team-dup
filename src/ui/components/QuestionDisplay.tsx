import React from 'react';
import { Question } from '../../models/Question';

export interface QuestionDisplayProps {
  questions: Question[];
  onReadyForAnswers: () => void;
  isLoading?: boolean;
}

export const QuestionDisplay: React.FC<QuestionDisplayProps> = ({
  questions,
  onReadyForAnswers,
  isLoading = false
}) => {
  if (questions.length === 0) {
    return (
      <div className="question-display">
        <div className="loading-message">
          {isLoading ? 'Generating questions...' : 'No questions available'}
        </div>
      </div>
    );
  }

  return (
    <div className="question-display">
      <div className="header">
        <h2>Practice Questions</h2>
        <p className="instructions">
          Review all {questions.length} questions below. When you're ready to see the answers, click the button at the bottom.
        </p>
      </div>

      <div className="questions-list">
        {questions.map((question, index) => (
          <div key={question.id} className="question-item">
            <div className="question-header">
              <h3>Question {index + 1}</h3>
              <span className={`difficulty-badge difficulty-${question.difficulty}`}>
                {question.difficulty}
              </span>
            </div>
            
            <div className="question-text">
              {question.questionText}
            </div>
            
            <div className="options">
              {Object.entries(question.options).map(([letter, text]) => (
                <div key={letter} className="option">
                  <span className="option-letter">{letter}.</span>
                  <span className="option-text">{text}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="action-section">
        <button 
          onClick={onReadyForAnswers}
          className="reveal-answers-button"
          disabled={isLoading}
        >
          I'm Ready to See the Answers
        </button>
      </div>
    </div>
  );
};