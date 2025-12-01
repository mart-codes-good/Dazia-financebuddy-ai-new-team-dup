import PromptManager from '../services/PromptManagerService';

describe('PromptManager Basic Tests', () => {
  let promptManager: PromptManager;

  beforeEach(() => {
    promptManager = new PromptManager();
  });

  it('should create PromptManager instance', () => {
    expect(promptManager).toBeDefined();
  });

  it('should have default templates', () => {
    const templates = promptManager.listTemplates();
    expect(templates).toHaveLength(3);
    expect(templates[0]?.id).toBe('question-generation');
  });

  it('should generate basic prompt', () => {
    const context = {
      topic: 'Securities',
      questionCount: 3,
      context: 'Test context'
    };
    
    const prompt = promptManager.generateQuestionPrompt(context);
    expect(prompt).toContain('Securities');
    expect(prompt).toContain('3');
    expect(prompt).toContain('Test context');
  });
});