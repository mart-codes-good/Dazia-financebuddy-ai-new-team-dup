const { ChromaApi } = require('chromadb');
import { Document } from '../models/Document';

import { EmbeddingService } from './EmbeddingService';

export interface VectorStoreConfig {
  chromaUrl?: string;
  collectionName?: string;
  embeddingService: EmbeddingService;
}

export interface SearchOptions {
  limit?: number;
  filter?: Record<string, any>;
  includeMetadata?: boolean;
}

export interface SearchResult {
  document: Document;
  score: number;
  distance: number;
}

export class VectorStore {
  private client: any;
  private collection: any = null;
  private collectionName: string;
  private embeddingService: EmbeddingService;
  private isInitialized = false;

  constructor(config: VectorStoreConfig) {
    this.client = new ChromaApi({
      path: config.chromaUrl || 'http://localhost:8000'
    });
    this.collectionName = config.collectionName || 'securities_documents';
    this.embeddingService = config.embeddingService;
  }

  /**
   * Initialize the vector store and create/get collection
   */
  async initialize(): Promise<void> {
    try {
      // Try to get existing collection first
      try {
        this.collection = await this.client.getCollection({
          name: this.collectionName
        });
      } catch (error) {
        // Collection doesn't exist, create it
        this.collection = await this.client.createCollection({
          name: this.collectionName,
          metadata: { description: 'Securities education documents' }
        });
      }
      
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize vector store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store a single document with its embedding
   */
  async storeDocument(document: Document): Promise<void> {
    await this.ensureInitialized();
    
    try {
      // Generate embedding if not provided
      let embedding = document.embedding;
      if (!embedding || embedding.length === 0) {
        embedding = await this.embeddingService.generateEmbedding(document.content);
      }

      await this.collection!.add({
        ids: [document.id],
        embeddings: [embedding],
        documents: [document.content],
        metadatas: [{
          title: document.title,
          type: document.type,
          source: document.source,
          chapter: document.chapter || '',
          section: document.section || '',
          tags: JSON.stringify(document.tags),
          lastUpdated: document.lastUpdated.toISOString(),
          ...document.metadata
        }]
      });
    } catch (error) {
      throw new Error(`Failed to store document ${document.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store multiple documents in batch
   */
  async storeDocuments(documents: Document[]): Promise<void> {
    await this.ensureInitialized();
    
    if (documents.length === 0) return;

    try {
      const ids: string[] = [];
      const embeddings: number[][] = [];
      const contents: string[] = [];
      const metadatas: Record<string, any>[] = [];

      // Process documents and generate embeddings if needed
      for (const document of documents) {
        let embedding = document.embedding;
        if (!embedding || embedding.length === 0) {
          embedding = await this.embeddingService.generateEmbedding(document.content);
        }

        ids.push(document.id);
        embeddings.push(embedding);
        contents.push(document.content);
        metadatas.push({
          title: document.title,
          type: document.type,
          source: document.source,
          chapter: document.chapter || '',
          section: document.section || '',
          tags: JSON.stringify(document.tags),
          lastUpdated: document.lastUpdated.toISOString(),
          ...document.metadata
        });
      }

      await this.collection!.add({
        ids,
        embeddings,
        documents: contents,
        metadatas
      });
    } catch (error) {
      throw new Error(`Failed to store documents batch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for similar documents using vector similarity
   */
  async searchSimilar(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    await this.ensureInitialized();
    
    try {
      // Generate query embedding
      const queryEmbedding = await this.embeddingService.generateQueryEmbedding(query);
      
      const queryParams: any = {
        queryEmbeddings: [queryEmbedding],
        nResults: options.limit || 10,
        include: ['documents', 'metadatas', 'distances']
      };
      
      if (options.filter) {
        queryParams.where = options.filter;
      }
      
      const results = await this.collection!.query(queryParams);

      return this.formatSearchResults(results);
    } catch (error) {
      throw new Error(`Failed to search documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search with pre-computed embedding
   */
  async searchWithEmbedding(embedding: number[], options: SearchOptions = {}): Promise<SearchResult[]> {
    await this.ensureInitialized();
    
    try {
      const queryParams: any = {
        queryEmbeddings: [embedding],
        nResults: options.limit || 10,
        include: ['documents', 'metadatas', 'distances']
      };
      
      if (options.filter) {
        queryParams.where = options.filter;
      }
      
      const results = await this.collection!.query(queryParams);

      return this.formatSearchResults(results);
    } catch (error) {
      throw new Error(`Failed to search with embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve documents by IDs
   */
  async getDocuments(ids: string[]): Promise<Document[]> {
    await this.ensureInitialized();
    
    try {
      const results = await this.collection!.get({
        ids,
        include: ['documents', 'metadatas']
      });

      return this.formatDocuments(results);
    } catch (error) {
      throw new Error(`Failed to retrieve documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete documents by IDs
   */
  async deleteDocuments(ids: string[]): Promise<void> {
    await this.ensureInitialized();
    
    try {
      await this.collection!.delete({
        ids
      });
    } catch (error) {
      throw new Error(`Failed to delete documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{ count: number; name: string }> {
    await this.ensureInitialized();
    
    try {
      const count = await this.collection!.count();
      return {
        count,
        name: this.collectionName
      };
    } catch (error) {
      throw new Error(`Failed to get collection stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear all documents from the collection
   */
  async clear(): Promise<void> {
    await this.ensureInitialized();
    
    try {
      // Delete the collection and recreate it
      await this.client.deleteCollection({ name: this.collectionName });
      this.collection = await this.client.createCollection({
        name: this.collectionName,
        metadata: { description: 'Securities education documents' }
      });
    } catch (error) {
      throw new Error(`Failed to clear collection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format search results into SearchResult objects
   */
  private formatSearchResults(results: any): SearchResult[] {
    const searchResults: SearchResult[] = [];
    
    if (!results.ids || !results.ids[0]) return searchResults;

    const ids = results.ids[0];
    const documents = results.documents?.[0] || [];
    const metadatas = results.metadatas?.[0] || [];
    const distances = results.distances?.[0] || [];

    for (let i = 0; i < ids.length; i++) {
      const metadata = metadatas[i] || {};
      
      const document: Document = {
        id: ids[i],
        title: metadata.title || '',
        content: documents[i] || '',
        type: metadata.type || 'textbook',
        source: metadata.source || '',
        chapter: metadata.chapter || undefined,
        section: metadata.section || undefined,
        tags: metadata.tags ? JSON.parse(metadata.tags) : [],
        embedding: [], // Not included in search results for performance
        metadata: this.extractCustomMetadata(metadata),
        lastUpdated: metadata.lastUpdated ? new Date(metadata.lastUpdated) : new Date()
      };

      searchResults.push({
        document,
        score: 1 - (distances[i] || 0), // Convert distance to similarity score
        distance: distances[i] || 0
      });
    }

    return searchResults;
  }

  /**
   * Format retrieved documents into Document objects
   */
  private formatDocuments(results: any): Document[] {
    const documents: Document[] = [];
    
    if (!results.ids) return documents;

    const ids = results.ids;
    const contents = results.documents || [];
    const metadatas = results.metadatas || [];

    for (let i = 0; i < ids.length; i++) {
      const metadata = metadatas[i] || {};
      
      const document: Document = {
        id: ids[i],
        title: metadata.title || '',
        content: contents[i] || '',
        type: metadata.type || 'textbook',
        source: metadata.source || '',
        chapter: metadata.chapter || undefined,
        section: metadata.section || undefined,
        tags: metadata.tags ? JSON.parse(metadata.tags) : [],
        embedding: [], // Not included for performance
        metadata: this.extractCustomMetadata(metadata),
        lastUpdated: metadata.lastUpdated ? new Date(metadata.lastUpdated) : new Date()
      };

      documents.push(document);
    }

    return documents;
  }

  /**
   * Extract custom metadata excluding standard fields
   */
  private extractCustomMetadata(metadata: Record<string, any>): Record<string, any> {
    const standardFields = ['title', 'type', 'source', 'chapter', 'section', 'tags', 'lastUpdated'];
    const customMetadata: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      if (!standardFields.includes(key)) {
        customMetadata[key] = value;
      }
    }
    
    return customMetadata;
  }

  /**
   * Ensure the vector store is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
}