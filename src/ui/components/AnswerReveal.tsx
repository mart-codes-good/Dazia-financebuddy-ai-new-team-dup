import React from 'react';
import { Question } from '../../models/Question';

export interface AnswerRevealProps {
  questions: Question[];
  onReadyForExplanations: () => void;
  userAnswers?: Record<string, string>;
}

export const AnswerReveal: React.FC<AnswerRevealProps> = ({
  questions,
  onReadyForExplanations,
  userAnswers = {}
}) => {
  const getOptionClass = (questionId: string, optionLetter: string, correctAnswer: string) => {
    const isCorrect = optionLetter === correctAnswer;
    const isUserAnswer = userAnswers[questionId] === optionLetter;
    
    let classes = ['option'];
    
    if (isCorrect) {
      classes.push('correct-answer');
    }
    
    if (isUserAnswer && !isCorrect) {
      classes.push('user-incorrect');
    }
    
    return classes.join(' ');
  };

  const calculateScore = () => {
    if (Object.keys(userAnswers).length === 0) return null;
    
    const correct = questions.filter(q => userAnswers[q.id] === q.correctAnswer).length;
    return { correct, total: questions.length, percentage: Math.round((correct / questions.length) * 100) };
  };

  const score = calculateScore();

  return (
    <div className="answer-reveal">
      <div className="header">
        <h2>Correct Answers</h2>
        {score && (
          <div className="score-summary">
            <span className="score">
              Score: {score.correct}/{score.total} ({score.percentage}%)
            </span>
          </div>
        )}
        <p className="instructions">
          The correct answers are highlighted in green below. 
          {score && " Your incorrect answers are marked in red."}
        </p>
      </div>

      <div className="answers-list">
        {questions.map((question, index) => (
          <div key={question.id} className="answer-item">
            <div className="question-header">
              <h3>Question {index + 1}</h3>
              <div className="answer-indicator">
                <span className="correct-answer-label">
                  Correct Answer: <strong>{question.correctAnswer}</strong>
                </span>
                {userAnswers[question.id] && (
                  <span className={`user-answer ${userAnswers[question.id] === question.correctAnswer ? 'correct' : 'incorrect'}`}>
                    Your Answer: {userAnswers[question.id]}
                    {userAnswers[question.id] === question.correctAnswer ? ' ✓' : ' ✗'}
                  </span>
                )}
              </div>
            </div>
            
            <div className="question-text">
              {question.questionText}
            </div>
            
            <div className="options">
              {Object.entries(question.options).map(([letter, text]) => (
                <div 
                  key={letter} 
                  className={getOptionClass(question.id, letter, question.correctAnswer)}
                >
                  <span className="option-letter">{letter}.</span>
                  <span className="option-text">{text}</span>
                  {letter === question.correctAnswer && (
                    <span className="correct-indicator">✓ Correct</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="action-section">
        <button 
          onClick={onReadyForExplanations}
          className="show-explanations-button"
        >
          Show Detailed Explanations
        </button>
      </div>
    </div>
  );
};