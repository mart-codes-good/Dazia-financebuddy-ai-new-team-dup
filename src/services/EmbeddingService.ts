import { GoogleGenerativeAI } from '@google/generative-ai';

export interface EmbeddingConfig {
  apiKey: string;
  model?: string;
  batchSize?: number;
}

export interface EmbeddingResult {
  embedding: number[];
  text: string;
  error?: string;
}

export class EmbeddingService {
  private genAI: GoogleGenerativeAI;
  private model: string;
  private batchSize: number;

  constructor(config: EmbeddingConfig) {
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.model = config.model || 'text-embedding-004';
    this.batchSize = config.batchSize || 100;
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.model });
      const result = await model.embedContent(text);
      
      if (!result.embedding || !result.embedding.values) {
        throw new Error('Failed to generate embedding: No embedding values returned');
      }
      
      return result.embedding.values;
    } catch (error) {
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batches
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const batchResults = await this.processBatch(batch);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Process a batch of texts for embedding generation
   */
  private async processBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const promises = texts.map(async (text): Promise<EmbeddingResult> => {
      try {
        const embedding = await this.generateEmbedding(text);
        return { embedding, text };
      } catch (error) {
        return {
          embedding: [],
          text,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Generate embedding for a query (same as document embedding for this implementation)
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    return this.generateEmbedding(query);
  }

  /**
   * Validate embedding dimensions
   */
  validateEmbedding(embedding: number[]): boolean {
    return Array.isArray(embedding) && embedding.length > 0 && embedding.every(val => typeof val === 'number');
  }
}