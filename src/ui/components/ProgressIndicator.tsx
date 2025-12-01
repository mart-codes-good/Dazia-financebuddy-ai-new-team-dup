import React from 'react';
import { FlowStep } from '../../services/FlowController';

export interface ProgressIndicatorProps {
  currentStep: FlowStep;
  progress: number;
  stepDescription: string;
  className?: string;
}

interface StepInfo {
  label: string;
  icon: string;
  description: string;
}

const STEP_INFO: Record<FlowStep, StepInfo> = {
  input: {
    label: 'Setup',
    icon: '⚙️',
    description: 'Choose topic and question count'
  },
  questions: {
    label: 'Questions',
    icon: '❓',
    description: 'Review practice questions'
  },
  answers: {
    label: 'Answers',
    icon: '✅',
    description: 'See correct answers'
  },
  explanations: {
    label: 'Explanations',
    icon: '💡',
    description: 'Learn from detailed explanations'
  },
  followup: {
    label: 'Discussion',
    icon: '💬',
    description: 'Ask follow-up questions'
  }
};

const STEP_ORDER: FlowStep[] = ['input', 'questions', 'answers', 'explanations', 'followup'];

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  progress,
  stepDescription,
  className = ''
}) => {
  const currentStepIndex = STEP_ORDER.indexOf(currentStep);

  const getStepStatus = (stepIndex: number): 'completed' | 'current' | 'upcoming' => {
    if (stepIndex < currentStepIndex) return 'completed';
    if (stepIndex === currentStepIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className={`progress-indicator ${className}`}>
      {/* Progress Bar */}
      <div className="progress-bar-container">
        <div className="progress-bar-background">
          <div 
            className="progress-bar-fill"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Learning progress: ${progress}% complete`}
          />
        </div>
        <div className="progress-percentage">
          {progress}%
        </div>
      </div>

      {/* Step Indicators */}
      <div className="steps-container">
        {STEP_ORDER.map((step, index) => {
          const stepInfo = STEP_INFO[step];
          const status = getStepStatus(index);
          
          return (
            <div 
              key={step}
              className={`step-item ${status}`}
              title={stepInfo.description}
            >
              <div className="step-icon">
                {status === 'completed' ? '✓' : stepInfo.icon}
              </div>
              <div className="step-label">
                {stepInfo.label}
              </div>
              {index < STEP_ORDER.length - 1 && (
                <div className={`step-connector ${status === 'completed' ? 'completed' : ''}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Current Step Description */}
      <div className="current-step-info">
        <div className="current-step-label">
          Current Step: <strong>{STEP_INFO[currentStep].label}</strong>
        </div>
        <div className="current-step-description">
          {stepDescription}
        </div>
      </div>
    </div>
  );
};