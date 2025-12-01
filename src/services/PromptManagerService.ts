import { Document } from '../models';

export interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  template: string;
  variables: string[];
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromptContext {
  [key: string]: any;
}

export interface QuestionGenerationContext extends PromptContext {
  topic: string;
  questionCount: number;
  context: string;
  documents?: Document[];
}

export interface AnswerGenerationContext extends PromptContext {
  question: string;
  context: string;
  options: string[];
  documents?: Document[];
}

export interface ExplanationGenerationContext extends PromptContext {
  question: string;
  correctAnswer: string;
  context: string;
  documents?: Document[];
}

export class PromptManager {
  private templates: Map<string, PromptTemplate> = new Map();
  private defaultVersion: string = '1.0.0';

  constructor() {
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    // Question generation template
    this.addTemplate({
      id: 'question-generation',
      name: 'Question Generation',
      version: this.defaultVersion,
      template: `Generate {{questionCount}} multiple-choice questions about {{topic}}.

Context: {{context}}

Requirements:
- Each question must have exactly 4 answer options (A, B, C, D)
- Only one option should be correct
- Questions should test understanding, not just memorization
- Use the provided context to ensure accuracy
- Format your response as JSON

{{#if documents}}
Source Materials:
{{#each documents}}
- {{title}}: {{content}}
{{/each}}
{{/if}}`,
      variables: ['topic', 'questionCount', 'context', 'documents'],
      description: 'Template for generating multiple-choice questions with context'
    });

    // Answer generation template
    this.addTemplate({
      id: 'answer-generation',
      name: 'Answer Generation',
      version: this.defaultVersion,
      template: `Generate the correct answer and 3 plausible distractors for this question:

Question: {{question}}
Context: {{context}}
Options: {{options}}

Requirements:
- Provide one correct answer
- Create 3 plausible but incorrect distractors
- Ensure distractors are believable but clearly wrong to someone who understands the topic
- Base answers on the provided context

{{#if documents}}
Source Materials:
{{#each documents}}
- {{title}}: {{content}}
{{/each}}
{{/if}}`,
      variables: ['question', 'context', 'options', 'documents'],
      description: 'Template for generating correct answers and distractors'
    });

    // Explanation generation template
    this.addTemplate({
      id: 'explanation-generation',
      name: 'Explanation Generation',
      version: this.defaultVersion,
      template: `Provide a clear, concise explanation for why this is the correct answer:

Question: {{question}}
Correct Answer: {{correctAnswer}}
Context: {{context}}

Requirements:
- Explain why the correct answer is right
- Briefly explain why other options are incorrect
- Keep explanation pedagogically appropriate
- Reference specific concepts from the context
- Maintain academic rigor and precision
- Format your response as JSON

{{#if documents}}
Source Materials:
{{#each documents}}
- {{title}}: {{content}}
{{/each}}
{{/if}}`,
      variables: ['question', 'correctAnswer', 'context', 'documents'],
      description: 'Template for generating answer explanations'
    });
  }

  addTemplate(template: Omit<PromptTemplate, 'createdAt' | 'updatedAt'>): void {
    const fullTemplate: PromptTemplate = {
      ...template,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const key = this.getTemplateKey(template.id, template.version);
    this.templates.set(key, fullTemplate);
  }

  getTemplate(id: string, version?: string): PromptTemplate {
    const templateVersion = version || this.defaultVersion;
    const key = this.getTemplateKey(id, templateVersion);
    const template = this.templates.get(key);
    
    if (!template) {
      throw new Error(`Template ${id} version ${templateVersion} not found`);
    }
    
    return template;
  }

  listTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  generatePrompt(templateId: string, context: PromptContext, version?: string): string {
    const template = this.getTemplate(templateId, version);
    return this.injectContext(template.template, context);
  }

  generateQuestionPrompt(context: QuestionGenerationContext, version?: string): string {
    return this.generatePrompt('question-generation', context, version);
  }

  generateAnswerPrompt(context: AnswerGenerationContext, version?: string): string {
    return this.generatePrompt('answer-generation', context, version);
  }

  generateExplanationPrompt(context: ExplanationGenerationContext, version?: string): string {
    return this.generatePrompt('explanation-generation', context, version);
  }

  updateTemplate(id: string, version: string, updates: Partial<Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>>): void {
    const key = this.getTemplateKey(id, version);
    const existingTemplate = this.templates.get(key);
    
    if (!existingTemplate) {
      throw new Error(`Template ${id} version ${version} not found`);
    }

    const updatedTemplate: PromptTemplate = {
      ...existingTemplate,
      ...updates,
      updatedAt: new Date()
    };

    this.templates.set(key, updatedTemplate);
  }

  deleteTemplate(id: string, version?: string): boolean {
    const templateVersion = version || this.defaultVersion;
    const key = this.getTemplateKey(id, templateVersion);
    return this.templates.delete(key);
  }

  listTemplateVersions(id: string): PromptTemplate[] {
    const versions = Array.from(this.templates.values())
      .filter(template => template.id === id)
      .sort((a, b) => {
        // First sort by update time, then by version if times are equal
        const timeDiff = b.updatedAt.getTime() - a.updatedAt.getTime();
        if (timeDiff !== 0) return timeDiff;
        
        // If times are equal, sort by version string (descending)
        return b.version.localeCompare(a.version);
      });
    return versions;
  }

  validateContext(templateId: string, context: PromptContext, version?: string): string[] {
    const template = this.getTemplate(templateId, version);
    const missingVariables: string[] = [];
    
    for (const variable of template.variables) {
      if (!(variable in context)) {
        missingVariables.push(variable);
      }
    }
    
    return missingVariables;
  }

  injectRetrievedContext(baseContext: PromptContext, retrievedContext: any): PromptContext {
    return {
      ...baseContext,
      documents: retrievedContext.documents,
      retrievalQuery: retrievedContext.query,
      totalResults: retrievedContext.totalResults,
      relevanceScores: retrievedContext.relevanceScores,
      retrievedAt: retrievedContext.retrievedAt
    };
  }

  createContextAwarePrompt(templateId: string, baseContext: PromptContext, retrievedContext: any, version?: string): string {
    const enrichedContext = this.injectRetrievedContext(baseContext, retrievedContext);
    return this.generatePrompt(templateId, enrichedContext, version);
  }

  private getTemplateKey(id: string, version: string): string {
    return `${id}@${version}`;
  }

  private injectContext(template: string, context: PromptContext): string {
    let result = template;
    
    // Handle simple variable substitution {{variable}}
    result = result.replace(/\{\{(\w+)\}\}/g, (_match: string, variable: string) => {
      const value = context[variable];
      
      // Special handling for arrays (like options)
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      
      return value?.toString() || _match;
    });

    // Handle conditional blocks {{#if variable}}...{{/if}}
    result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match: string, variable: string, content: string) => {
      return context[variable] ? content : '';
    });

    // Handle each loops {{#each array}}...{{/each}}
    result = result.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_match: string, variable: string, content: string) => {
      const array = context[variable];
      if (!Array.isArray(array)) return '';
      
      return array.map((item: any) => {
        let itemContent = content;
        // Replace {{property}} with item.property
        itemContent = itemContent.replace(/\{\{(\w+)\}\}/g, (_itemMatch: string, property: string) => {
          let value = item[property]?.toString() || _itemMatch;
          
          // Truncate document content if it's too long
          if (property === 'content' && value.length > 1000) {
            value = value.substring(0, 1000) + '...';
          }
          
          return value;
        });
        return itemContent;
      }).join('');
    });

    return result;
  }
}

export default PromptManager;