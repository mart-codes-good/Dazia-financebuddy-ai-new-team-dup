import React, { useState, useEffect } from 'react';
import { FlowStep } from '../../services/FlowController';

export interface StepTransitionProps {
  currentStep: FlowStep;
  children: React.ReactNode;
  className?: string;
  transitionDuration?: number;
}

export const StepTransition: React.FC<StepTransitionProps> = ({
  currentStep,
  children,
  className = '',
  transitionDuration = 300
}) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayStep, setDisplayStep] = useState(currentStep);

  useEffect(() => {
    if (currentStep !== displayStep) {
      setIsTransitioning(true);
      
      // Start fade out
      const fadeOutTimer = setTimeout(() => {
        setDisplayStep(currentStep);
        
        // Start fade in
        const fadeInTimer = setTimeout(() => {
          setIsTransitioning(false);
        }, 50);

        return () => clearTimeout(fadeInTimer);
      }, transitionDuration / 2);

      return () => clearTimeout(fadeOutTimer);
    }
  }, [currentStep, displayStep, transitionDuration]);

  return (
    <div 
      className={`step-transition ${className} ${isTransitioning ? 'transitioning' : ''}`}
      style={{
        transition: `opacity ${transitionDuration}ms ease-in-out, transform ${transitionDuration}ms ease-in-out`,
        opacity: isTransitioning ? 0.3 : 1,
        transform: isTransitioning ? 'translateY(10px)' : 'translateY(0)'
      }}
    >
      {children}
    </div>
  );
};