export interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  template: string;
  variables: string[];
}

export class PromptManager {
  private templates: Map<string, PromptTemplate> = new Map();

  constructor() {
    console.log('PromptManager created');
  }

  addTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
  }

  getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }
}

export default PromptManager;