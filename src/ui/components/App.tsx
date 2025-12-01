import React, { useState, useEffect, useCallback } from 'react';
import { FlowManager, FlowState } from '../../services/FlowManager';
import { ProgressIndicator } from './ProgressIndicator';
import { StepTransition } from './StepTransition';
import { TopicInput } from './TopicInput';
import { QuestionDisplay } from './QuestionDisplay';
import { AnswerReveal } from './AnswerReveal';
import { ExplanationDisplay } from './ExplanationDisplay';
import { FollowupDialog } from './FollowupDialog';

export interface AppProps {
  flowManager: FlowManager;
  className?: string;
}

export const App: React.FC<AppProps> = ({ flowManager, className = '' }) => {
  const [flowState, setFlowState] = useState<FlowState>(flowManager.getState());
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});

  // Subscribe to flow state changes
  useEffect(() => {
    const unsubscribe = flowManager.subscribe(setFlowState);
    return unsubscribe;
  }, [flowManager]);

  // Handle topic submission
  const handleTopicSubmit = useCallback(async (topic: string, questionCount: number) => {
    await flowManager.startSession(topic, questionCount);
    await flowManager.generateQuestions();
  }, [flowManager]);

  // Handle ready for answers
  const handleReadyForAnswers = useCallback(async () => {
    await flowManager.revealAnswers(userAnswers);
  }, [flowManager, userAnswers]);

  // Handle ready for explanations
  const handleReadyForExplanations = useCallback(async () => {
    await flowManager.showExplanations();
  }, [flowManager]);

  // Handle follow-up question
  const handleFollowupQuestion = useCallback(async (question: string) => {
    await flowManager.askFollowupQuestion(question);
  }, [flowManager]);

  // Handle starting new session
  const handleStartNewSession = useCallback(async () => {
    await flowManager.clearSession();
    setUserAnswers({});
  }, [flowManager]);

  // Handle ending session
  const handleEndSession = useCallback(async () => {
    await flowManager.clearSession();
    setUserAnswers({});
  }, [flowManager]);

  // Handle restart with same topic
  const handleRestart = useCallback(async () => {
    await flowManager.restartSession();
    setUserAnswers({});
  }, [flowManager]);

  // Update user answers (for tracking purposes)
  const handleAnswerChange = useCallback((questionId: string, answer: string) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  }, []);

  // Render error state
  if (flowState.error) {
    return (
      <div className={`app error-state ${className}`}>
        <div className="error-container">
          <h2>Something went wrong</h2>
          <p className="error-message">{flowState.error}</p>
          <div className="error-actions">
            <button 
              onClick={handleStartNewSession}
              className="retry-button"
            >
              Start Over
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render loading overlay
  const renderLoadingOverlay = () => {
    if (!flowState.isLoading) return null;

    return (
      <div className="loading-overlay">
        <div className="loading-spinner">
          <div className="spinner" />
          <p>Processing...</p>
        </div>
      </div>
    );
  };

  // Render current step content
  const renderStepContent = () => {
    const { session, currentStep } = flowState;

    switch (currentStep) {
      case 'input':
        return (
          <TopicInput
            onSubmit={handleTopicSubmit}
            isLoading={flowState.isLoading}
            error={flowState.error}
          />
        );

      case 'questions':
        if (!session?.questions) return null;
        return (
          <QuestionDisplay
            questions={session.questions}
            onReadyForAnswers={handleReadyForAnswers}
            isLoading={flowState.isLoading}
          />
        );

      case 'answers':
        if (!session?.questions) return null;
        return (
          <AnswerReveal
            questions={session.questions}
            onReadyForExplanations={handleReadyForExplanations}
            userAnswers={session.userAnswers}
          />
        );

      case 'explanations':
        if (!session?.questions) return null;
        return (
          <ExplanationDisplay
            questions={session.questions}
            onStartFollowup={handleReadyForExplanations}
            onStartNewSession={handleStartNewSession}
          />
        );

      case 'followup':
        if (!session) return null;
        return (
          <FollowupDialog
            followupHistory={session.followupHistory}
            onAskQuestion={handleFollowupQuestion}
            onEndSession={handleEndSession}
            onStartNewSession={handleStartNewSession}
            isLoading={flowState.isLoading}
            error={flowState.error}
          />
        );

      default:
        return (
          <div className="unknown-step">
            <p>Unknown step: {currentStep}</p>
            <button onClick={handleStartNewSession}>
              Start New Session
            </button>
          </div>
        );
    }
  };

  return (
    <div className={`app ${className}`}>
      {/* Header with Progress */}
      <header className="app-header">
        <h1>Securities Learning Tutor</h1>
        {flowState.session && (
          <div className="session-info">
            <span className="topic">Topic: {flowState.session.topic}</span>
            <span className="question-count">
              Questions: {flowState.session.questionCount}
            </span>
          </div>
        )}
      </header>

      {/* Progress Indicator */}
      {flowState.session && (
        <ProgressIndicator
          currentStep={flowState.currentStep}
          progress={flowState.progress}
          stepDescription={flowState.stepDescription}
          className="main-progress"
        />
      )}

      {/* Main Content */}
      <main className="app-main">
        <StepTransition 
          currentStep={flowState.currentStep}
          className="step-content"
        >
          {renderStepContent()}
        </StepTransition>
      </main>

      {/* Action Bar */}
      {flowState.session && flowState.currentStep !== 'input' && (
        <footer className="app-footer">
          <div className="action-bar">
            <button 
              onClick={handleRestart}
              className="restart-button secondary"
              disabled={flowState.isLoading}
            >
              Restart Session
            </button>
            <button 
              onClick={handleStartNewSession}
              className="new-session-button secondary"
              disabled={flowState.isLoading}
            >
              New Topic
            </button>
          </div>
        </footer>
      )}

      {/* Loading Overlay */}
      {renderLoadingOverlay()}
    </div>
  );
};