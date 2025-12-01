import { useState, useEffect, useCallback } from 'react';
import { FlowManager, FlowState } from '../../services/FlowManager';

export interface UseFlowManagerResult {
  flowState: FlowState;
  actions: {
    startSession: (topic: string, questionCount: number, userId?: string) => Promise<void>;
    generateQuestions: () => Promise<void>;
    revealAnswers: (userAnswers?: Record<string, string>) => Promise<void>;
    showExplanations: () => Promise<void>;
    askFollowupQuestion: (question: string) => Promise<void>;
    restartSession: (newTopic?: string, newQuestionCount?: number) => Promise<void>;
    loadSession: (sessionId: string) => Promise<void>;
    clearSession: () => Promise<void>;
  };
  helpers: {
    canPerformAction: (action: string) => boolean;
    getNextStep: () => string | null;
    isLoading: boolean;
    hasError: boolean;
    hasSession: boolean;
  };
}

export function useFlowManager(flowManager: FlowManager): UseFlowManagerResult {
  const [flowState, setFlowState] = useState<FlowState>(flowManager.getState());

  // Subscribe to flow state changes
  useEffect(() => {
    const unsubscribe = flowManager.subscribe(setFlowState);
    return unsubscribe;
  }, [flowManager]);

  // Action handlers
  const startSession = useCallback(async (topic: string, questionCount: number, userId?: string) => {
    await flowManager.startSession(topic, questionCount, userId);
  }, [flowManager]);

  const generateQuestions = useCallback(async () => {
    await flowManager.generateQuestions();
  }, [flowManager]);

  const revealAnswers = useCallback(async (userAnswers: Record<string, string> = {}) => {
    await flowManager.revealAnswers(userAnswers);
  }, [flowManager]);

  const showExplanations = useCallback(async () => {
    await flowManager.showExplanations();
  }, [flowManager]);

  const askFollowupQuestion = useCallback(async (question: string) => {
    await flowManager.askFollowupQuestion(question);
  }, [flowManager]);

  const restartSession = useCallback(async (newTopic?: string, newQuestionCount?: number) => {
    await flowManager.restartSession(newTopic, newQuestionCount);
  }, [flowManager]);

  const loadSession = useCallback(async (sessionId: string) => {
    await flowManager.loadSession(sessionId);
  }, [flowManager]);

  const clearSession = useCallback(async () => {
    await flowManager.clearSession();
  }, [flowManager]);

  // Helper functions
  const canPerformAction = useCallback((action: string) => {
    return flowManager.canPerformAction(action);
  }, [flowManager, flowState.allowedActions]);

  const getNextStep = useCallback(() => {
    return flowManager.getNextStep();
  }, [flowManager, flowState.currentStep]);

  return {
    flowState,
    actions: {
      startSession,
      generateQuestions,
      revealAnswers,
      showExplanations,
      askFollowupQuestion,
      restartSession,
      loadSession,
      clearSession
    },
    helpers: {
      canPerformAction,
      getNextStep,
      isLoading: flowState.isLoading,
      hasError: !!flowState.error,
      hasSession: !!flowState.session
    }
  };
}