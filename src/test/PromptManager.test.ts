import PromptManager, { 
  PromptTemplate, 
  QuestionGenerationContext, 
  AnswerGenerationContext, 
  ExplanationGenerationContext 
} from '../services/PromptManagerService';
import { Document, RetrievedContext } from '../models';

describe('PromptManager', () => {
  let promptManager: PromptManager;

  beforeEach(() => {
    promptManager = new PromptManager();
  });

  describe('Template Management', () => {
    it('should initialize with default templates', () => {
      const templates = promptManager.listTemplates();
      expect(templates).toHaveLength(3);
      
      const templateIds = templates.map((t: PromptTemplate) => t.id);
      expect(templateIds).toContain('question-generation');
      expect(templateIds).toContain('answer-generation');
      expect(templateIds).toContain('explanation-generation');
    });

    it('should add a new template', () => {
      const newTemplate = {
        id: 'test-template',
        name: 'Test Template',
        version: '1.0.0',
        template: 'Hello {{name}}!',
        variables: ['name'],
        description: 'A test template'
      };

      promptManager.addTemplate(newTemplate);
      const retrieved = promptManager.getTemplate('test-template', '1.0.0');
      
      expect(retrieved.id).toBe('test-template');
      expect(retrieved.name).toBe('Test Template');
      expect(retrieved.template).toBe('Hello {{name}}!');
      expect(retrieved.variables).toEqual(['name']);
    });

    it('should update an existing template', () => {
      const template = {
        id: 'update-test',
        name: 'Update Test',
        version: '1.0.0',
        template: 'Original template',
        variables: ['var1']
      };

      promptManager.addTemplate(template);
      
      promptManager.updateTemplate('update-test', '1.0.0', {
        template: 'Updated template',
        variables: ['var1', 'var2']
      });

      const updated = promptManager.getTemplate('update-test', '1.0.0');
      expect(updated.template).toBe('Updated template');
      expect(updated.variables).toEqual(['var1', 'var2']);
    });

    it('should throw error when getting non-existent template', () => {
      expect(() => {
        promptManager.getTemplate('non-existent', '1.0.0');
      }).toThrow('Template non-existent version 1.0.0 not found');
    });

    it('should throw error when updating non-existent template', () => {
      expect(() => {
        promptManager.updateTemplate('non-existent', '1.0.0', { template: 'new' });
      }).toThrow('Template non-existent version 1.0.0 not found');
    });

    it('should list template versions', () => {
      const template1 = {
        id: 'version-test',
        name: 'Version Test',
        version: '1.0.0',
        template: 'Version 1',
        variables: []
      };

      const template2 = {
        id: 'version-test',
        name: 'Version Test',
        version: '2.0.0',
        template: 'Version 2',
        variables: []
      };

      promptManager.addTemplate(template1);
      promptManager.addTemplate(template2);

      const versions = promptManager.listTemplateVersions('version-test');
      expect(versions).toHaveLength(2);
      expect(versions[0]?.version).toBe('2.0.0'); // Should be sorted by update time (newest first)
    });
  });

  describe('Context Injection', () => {
    it('should inject simple variables', () => {
      const template = {
        id: 'simple-test',
        name: 'Simple Test',
        version: '1.0.0',
        template: 'Hello {{name}}, you are {{age}} years old.',
        variables: ['name', 'age']
      };

      promptManager.addTemplate(template);

      const context = { name: 'John', age: 30 };
      const result = promptManager.generatePrompt('simple-test', context);
      
      expect(result).toBe('Hello John, you are 30 years old.');
    });

    it('should handle conditional blocks', () => {
      const template = {
        id: 'conditional-test',
        name: 'Conditional Test',
        version: '1.0.0',
        template: 'Hello{{#if premium}} Premium{{/if}} User!',
        variables: ['premium']
      };

      promptManager.addTemplate(template);

      const contextWithPremium = { premium: true };
      const contextWithoutPremium = { premium: false };

      const resultWithPremium = promptManager.generatePrompt('conditional-test', contextWithPremium);
      const resultWithoutPremium = promptManager.generatePrompt('conditional-test', contextWithoutPremium);

      expect(resultWithPremium).toBe('Hello Premium User!');
      expect(resultWithoutPremium).toBe('Hello User!');
    });

    it('should handle array iteration', () => {
      const template = {
        id: 'array-test',
        name: 'Array Test',
        version: '1.0.0',
        template: 'Items:{{#each items}} - {{name}}{{/each}}',
        variables: ['items']
      };

      promptManager.addTemplate(template);

      const context = {
        items: [
          { name: 'Item 1' },
          { name: 'Item 2' },
          { name: 'Item 3' }
        ]
      };

      const result = promptManager.generatePrompt('array-test', context);
      expect(result).toBe('Items: - Item 1 - Item 2 - Item 3');
    });

    it('should handle missing variables gracefully', () => {
      const template = {
        id: 'missing-test',
        name: 'Missing Test',
        version: '1.0.0',
        template: 'Hello {{name}}, {{missing}} variable.',
        variables: ['name', 'missing']
      };

      promptManager.addTemplate(template);

      const context = { name: 'John' };
      const result = promptManager.generatePrompt('missing-test', context);
      
      expect(result).toBe('Hello John, {{missing}} variable.');
    });
  });

  describe('Question Generation', () => {
    it('should generate question prompt with basic context', () => {
      const context: QuestionGenerationContext = {
        topic: 'Securities Regulation',
        questionCount: 3,
        context: 'Securities are regulated by the SEC...'
      };

      const prompt = promptManager.generateQuestionPrompt(context);
      
      expect(prompt).toContain('Securities Regulation');
      expect(prompt).toContain('3');
      expect(prompt).toContain('Securities are regulated by the SEC...');
      expect(prompt).toContain('Format your response as JSON');
    });

    it('should generate question prompt with documents', () => {
      const documents: Document[] = [
        {
          id: '1',
          title: 'SEC Regulations',
          content: 'The Securities and Exchange Commission...',
          type: 'regulation',
          source: 'SEC.gov',
          tags: ['regulation', 'sec'],
          embedding: [],
          metadata: {},
          lastUpdated: new Date()
        }
      ];

      const context: QuestionGenerationContext = {
        topic: 'Securities Regulation',
        questionCount: 2,
        context: 'Basic context',
        documents
      };

      const prompt = promptManager.generateQuestionPrompt(context);
      
      expect(prompt).toContain('Source Materials:');
      expect(prompt).toContain('SEC Regulations');
      expect(prompt).toContain('The Securities and Exchange Commission...');
    });
  });

  describe('Answer Generation', () => {
    it('should generate answer prompt with options array', () => {
      const context: AnswerGenerationContext = {
        question: 'What is the SEC?',
        context: 'The SEC regulates securities...',
        options: ['Option A', 'Option B', 'Option C', 'Option D']
      };

      const prompt = promptManager.generateAnswerPrompt(context);
      
      expect(prompt).toContain('What is the SEC?');
      expect(prompt).toContain('The SEC regulates securities...');
      expect(prompt).toContain('Option A, Option B, Option C, Option D');
    });

    it('should generate answer prompt with documents', () => {
      const documents: Document[] = [
        {
          id: '1',
          title: 'SEC Overview',
          content: 'The SEC is a federal agency...',
          type: 'textbook',
          source: 'Textbook Chapter 1',
          tags: ['sec', 'overview'],
          embedding: [],
          metadata: {},
          lastUpdated: new Date()
        }
      ];

      const context: AnswerGenerationContext = {
        question: 'What is the SEC?',
        context: 'Basic context',
        options: ['Federal Agency', 'State Agency', 'Private Company', 'Non-profit'],
        documents
      };

      const prompt = promptManager.generateAnswerPrompt(context);
      
      expect(prompt).toContain('Source Materials:');
      expect(prompt).toContain('SEC Overview');
      expect(prompt).toContain('The SEC is a federal agency...');
    });
  });

  describe('Explanation Generation', () => {
    it('should generate explanation prompt', () => {
      const context: ExplanationGenerationContext = {
        question: 'What is the SEC?',
        correctAnswer: 'A',
        context: 'The SEC is a federal regulatory agency...'
      };

      const prompt = promptManager.generateExplanationPrompt(context);
      
      expect(prompt).toContain('What is the SEC?');
      expect(prompt).toContain('Correct Answer: A');
      expect(prompt).toContain('The SEC is a federal regulatory agency...');
      expect(prompt).toContain('Format your response as JSON');
    });
  });

  describe('Retrieved Context Integration', () => {
    it('should inject retrieved context', () => {
      const baseContext = {
        topic: 'Securities',
        questionCount: 1
      };

      const retrievedContext: RetrievedContext = {
        documents: [
          {
            id: '1',
            title: 'Securities Law',
            content: 'Securities law governs...',
            type: 'textbook',
            source: 'Law Textbook',
            tags: ['law'],
            embedding: [],
            metadata: {},
            lastUpdated: new Date()
          }
        ],
        relevanceScores: [0.95],
        totalResults: 1,
        query: 'securities law',
        retrievedAt: new Date()
      };

      const enrichedContext = promptManager.injectRetrievedContext(baseContext, retrievedContext);
      
      expect(enrichedContext['documents']).toEqual(retrievedContext.documents);
      expect(enrichedContext['retrievalQuery']).toBe('securities law');
      expect(enrichedContext['totalResults']).toBe(1);
      expect(enrichedContext['relevanceScores']).toEqual([0.95]);
    });

    it('should create context-aware prompt', () => {
      const baseContext = {
        topic: 'Securities Regulation',
        questionCount: 1,
        context: 'Basic context'
      };

      const retrievedContext: RetrievedContext = {
        documents: [
          {
            id: '1',
            title: 'SEC Rules',
            content: 'SEC rules require...',
            type: 'regulation',
            source: 'SEC',
            tags: ['rules'],
            embedding: [],
            metadata: {},
            lastUpdated: new Date()
          }
        ],
        relevanceScores: [0.9],
        totalResults: 1,
        query: 'SEC rules',
        retrievedAt: new Date()
      };

      const prompt = promptManager.createContextAwarePrompt(
        'question-generation',
        baseContext,
        retrievedContext
      );

      expect(prompt).toContain('Securities Regulation');
      expect(prompt).toContain('Source Materials:');
      expect(prompt).toContain('SEC Rules');
      expect(prompt).toContain('SEC rules require...');
    });
  });

  describe('Context Validation', () => {
    it('should validate context variables', () => {
      const context = {
        topic: 'Securities',
        questionCount: 1
        // Missing 'context' variable
      };

      const missingVars = promptManager.validateContext('question-generation', context);
      expect(missingVars).toContain('context');
      expect(missingVars).not.toContain('topic');
      expect(missingVars).not.toContain('questionCount');
    });

    it('should return empty array for complete context', () => {
      const context = {
        topic: 'Securities',
        questionCount: 1,
        context: 'Complete context',
        documents: []
      };

      const missingVars = promptManager.validateContext('question-generation', context);
      expect(missingVars).toHaveLength(0);
    });
  });

  describe('Document Content Truncation', () => {
    it('should truncate long document content', () => {
      const longContent = 'A'.repeat(1500); // Content longer than 1000 chars
      
      const context: QuestionGenerationContext = {
        topic: 'Test',
        questionCount: 1,
        context: 'Basic context',
        documents: [
          {
            id: '1',
            title: 'Long Document',
            content: longContent,
            type: 'textbook',
            source: 'Test',
            tags: [],
            embedding: [],
            metadata: {},
            lastUpdated: new Date()
          }
        ]
      };

      const prompt = promptManager.generateQuestionPrompt(context);
      
      // Should contain truncated content with ellipsis
      expect(prompt).toContain('A'.repeat(1000) + '...');
      expect(prompt).not.toContain('A'.repeat(1500));
    });

    it('should not truncate short document content', () => {
      const shortContent = 'Short content';
      
      const context: QuestionGenerationContext = {
        topic: 'Test',
        questionCount: 1,
        context: 'Basic context',
        documents: [
          {
            id: '1',
            title: 'Short Document',
            content: shortContent,
            type: 'textbook',
            source: 'Test',
            tags: [],
            embedding: [],
            metadata: {},
            lastUpdated: new Date()
          }
        ]
      };

      const prompt = promptManager.generateQuestionPrompt(context);
      
      expect(prompt).toContain('Short content');
      expect(prompt).not.toContain('...');
    });
  });
});