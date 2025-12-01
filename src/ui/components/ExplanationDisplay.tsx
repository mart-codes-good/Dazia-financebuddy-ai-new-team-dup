import React from 'react';
import { Question } from '../../models/Question';

export interface ExplanationDisplayProps {
  questions: Question[];
  onStartFollowup: () => void;
  onStartNewSession: () => void;
}

export const ExplanationDisplay: React.FC<ExplanationDisplayProps> = ({
  questions,
  onStartFollowup,
  onStartNewSession
}) => {
  return (
    <div className="explanation-display">
      <div className="header">
        <h2>Answer Explanations</h2>
        <p className="instructions">
          Review the detailed explanations below to understand the reasoning behind each correct answer.
        </p>
      </div>

      <div className="explanations-list">
        {questions.map((question, index) => (
          <div key={question.id} className="explanation-item">
            <div className="question-header">
              <h3>Question {index + 1}</h3>
              <div className="answer-summary">
                <span className="correct-answer">
                  Correct Answer: <strong>{question.correctAnswer}</strong>
                </span>
              </div>
            </div>
            
            <div className="question-text">
              {question.questionText}
            </div>
            
            <div className="correct-option">
              <div className="option correct-answer">
                <span className="option-letter">{question.correctAnswer}.</span>
                <span className="option-text">{question.options[question.correctAnswer]}</span>
                <span className="correct-indicator">✓ Correct</span>
              </div>
            </div>

            <div className="explanation">
              <h4>Explanation:</h4>
              <div className="explanation-text">
                {question.explanation}
              </div>
            </div>

            {question.sourceReferences.length > 0 && (
              <div className="source-references">
                <h5>References:</h5>
                <ul>
                  {question.sourceReferences.map((reference, refIndex) => (
                    <li key={refIndex} className="reference-item">
                      {reference}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="action-section">
        <div className="action-buttons">
          <button 
            onClick={onStartFollowup}
            className="followup-button primary"
          >
            Ask Follow-up Questions
          </button>
          <button 
            onClick={onStartNewSession}
            className="new-session-button secondary"
          >
            Start New Topic
          </button>
        </div>
      </div>
    </div>
  );
};