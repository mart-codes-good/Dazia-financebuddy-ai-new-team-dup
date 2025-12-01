import React, { useState } from 'react';
import { FollowupExchange } from '../../models/Session';

export interface FollowupDialogProps {
  followupHistory: FollowupExchange[];
  onAskQuestion: (question: string) => void;
  onEndSession: () => void;
  onStartNewSession: () => void;
  isLoading?: boolean;
  error?: string;
}

export const FollowupDialog: React.FC<FollowupDialogProps> = ({
  followupHistory,
  onAskQuestion,
  onEndSession,
  onStartNewSession,
  isLoading = false,
  error
}) => {
  const [currentQuestion, setCurrentQuestion] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentQuestion.trim()) {
      onAskQuestion(currentQuestion.trim());
      setCurrentQuestion('');
    }
  };

  return (
    <div className="followup-dialog">
      <div className="header">
        <h2>Follow-up Discussion</h2>
        <p className="instructions">
          Ask any questions about the topics we've covered. I'll provide detailed explanations based on the course materials.
        </p>
      </div>

      {followupHistory.length > 0 && (
        <div className="conversation-history">
          <h3>Conversation History</h3>
          <div className="exchanges">
            {followupHistory.map((exchange, index) => (
              <div key={index} className="exchange">
                <div className="user-question">
                  <div className="message-header">
                    <span className="sender">You</span>
                    <span className="timestamp">
                      {exchange.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="message-content">
                    {exchange.question}
                  </div>
                </div>
                
                <div className="ai-response">
                  <div className="message-header">
                    <span className="sender">Tutor</span>
                    <span className="timestamp">
                      {exchange.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="message-content">
                    {exchange.answer}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="question-input-section">
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="followup-question" className="sr-only">
              Ask a follow-up question
            </label>
            <textarea
              id="followup-question"
              value={currentQuestion}
              onChange={(e) => setCurrentQuestion(e.target.value)}
              placeholder="Ask a follow-up question about the topics we've covered..."
              rows={3}
              disabled={isLoading}
              required
            />
          </div>

          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}

          <div className="button-group">
            <button 
              type="submit" 
              disabled={isLoading || !currentQuestion.trim()}
              className="ask-button primary"
            >
              {isLoading ? 'Getting Answer...' : 'Ask Question'}
            </button>
          </div>
        </form>
      </div>

      <div className="session-actions">
        <div className="action-buttons">
          <button 
            onClick={onEndSession}
            className="end-session-button secondary"
            disabled={isLoading}
          >
            End Session
          </button>
          <button 
            onClick={onStartNewSession}
            className="new-session-button secondary"
            disabled={isLoading}
          >
            Start New Topic
          </button>
        </div>
      </div>
    </div>
  );
};