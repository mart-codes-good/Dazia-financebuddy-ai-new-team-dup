import { VectorStore, SearchResult, SearchOptions } from './VectorStore';
import { RetrievedContext } from '../models/Context';
import { Document } from '../models/Document';
import { ResultReranker, RankingOptions } from './ResultReranker';

export interface RetrievalOptions {
  limit?: number;
  minScore?: number;
  documentTypes?: ('textbook' | 'qa_pair' | 'regulation')[];
  tags?: string[];
  includeMetadata?: boolean;
}

export interface HybridSearchOptions extends RetrievalOptions {
  keywordWeight?: number;
  semanticWeight?: number;
  enableReranking?: boolean;
  rankingOptions?: RankingOptions;
}

export interface KeywordSearchOptions {
  caseSensitive?: boolean;
  exactMatch?: boolean;
  minWordLength?: number;
}

export class ContextRetriever {
  private vectorStore: VectorStore;
  private reranker: ResultReranker;

  constructor(vectorStore: VectorStore) {
    this.vectorStore = vectorStore;
    this.reranker = new ResultReranker();
  }

  /**
   * Retrieve relevant context for a given query using semantic search
   */
  async retrieveContext(query: string, options: RetrievalOptions = {}): Promise<RetrievedContext> {
    try {
      const searchOptions: SearchOptions = {
        limit: options.limit || 10,
        includeMetadata: options.includeMetadata !== false
      };

      // Build filter for document types and tags
      const filter = this.buildFilter(options);
      if (Object.keys(filter).length > 0) {
        searchOptions.filter = filter;
      }

      const searchResults = await this.vectorStore.searchSimilar(query, searchOptions);
      
      // Filter by minimum score if specified
      const filteredResults = options.minScore 
        ? searchResults.filter(result => result.score >= options.minScore!)
        : searchResults;

      const documents = filteredResults.map(result => result.document);
      const relevanceScores = filteredResults.map(result => result.score);

      return {
        documents,
        relevanceScores,
        totalResults: filteredResults.length,
        query,
        retrievedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to retrieve context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve context using pre-computed embedding
   */
  async retrieveContextWithEmbedding(
    embedding: number[], 
    query: string, 
    options: RetrievalOptions = {}
  ): Promise<RetrievedContext> {
    try {
      const searchOptions: SearchOptions = {
        limit: options.limit || 10,
        includeMetadata: options.includeMetadata !== false
      };

      const filter = this.buildFilter(options);
      if (Object.keys(filter).length > 0) {
        searchOptions.filter = filter;
      }

      const searchResults = await this.vectorStore.searchWithEmbedding(embedding, searchOptions);
      
      const filteredResults = options.minScore 
        ? searchResults.filter(result => result.score >= options.minScore!)
        : searchResults;

      const documents = filteredResults.map(result => result.document);
      const relevanceScores = filteredResults.map(result => result.score);

      return {
        documents,
        relevanceScores,
        totalResults: filteredResults.length,
        query,
        retrievedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to retrieve context with embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform hybrid search combining semantic and keyword matching
   */
  async hybridSearch(query: string, options: HybridSearchOptions = {}): Promise<RetrievedContext> {
    try {
      const {
        keywordWeight = 0.3,
        semanticWeight = 0.7,
        enableReranking = true,
        rankingOptions = {},
        ...retrievalOptions
      } = options;

      // Perform semantic search
      const semanticResults = await this.performSemanticSearch(query, retrievalOptions) || [];
      
      // Perform keyword search
      const keywordResults = await this.performKeywordSearch(query, retrievalOptions) || [];
      
      // Combine and weight the results
      const combinedResults = this.combineSearchResults(
        semanticResults,
        keywordResults,
        semanticWeight,
        keywordWeight
      );

      // Apply reranking if enabled
      let finalResults = combinedResults;
      if (enableReranking) {
        const rankedResults = this.reranker.rerank(combinedResults, rankingOptions);
        finalResults = rankedResults;
      }

      // Apply filtering
      const filteredResults = this.reranker.filterResults(
        finalResults,
        retrievalOptions.minScore,
        retrievalOptions.documentTypes
      ) || [];

      const documents = filteredResults.map(result => result.document);
      const relevanceScores = filteredResults.map(result => result.score);

      return {
        documents,
        relevanceScores,
        totalResults: filteredResults.length,
        query,
        retrievedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to perform hybrid search: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve documents by specific criteria
   */
  async retrieveByType(
    documentType: 'textbook' | 'qa_pair' | 'regulation',
    limit: number = 10
  ): Promise<Document[]> {
    try {
      const searchOptions: SearchOptions = {
        limit,
        filter: { type: documentType }
      };

      // Use a generic query to get documents of the specified type
      const searchResults = await this.vectorStore.searchSimilar('', searchOptions);
      return searchResults.map(result => result.document);
    } catch (error) {
      throw new Error(`Failed to retrieve documents by type: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve documents by tags
   */
  async retrieveByTags(tags: string[], limit: number = 10): Promise<Document[]> {
    try {
      const retrievalOptions: RetrievalOptions = {
        limit,
        tags
      };

      const context = await this.retrieveContext('', retrievalOptions);
      return context.documents;
    } catch (error) {
      throw new Error(`Failed to retrieve documents by tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get similar documents to a given document
   */
  async findSimilarDocuments(
    documentId: string, 
    limit: number = 5
  ): Promise<SearchResult[]> {
    try {
      // First get the document to use its embedding
      const documents = await this.vectorStore.getDocuments([documentId]);
      if (documents.length === 0) {
        throw new Error(`Document with ID ${documentId} not found`);
      }

      const document = documents[0];
      if (!document || !document.embedding || document.embedding.length === 0) {
        throw new Error(`Document ${documentId} has no embedding`);
      }

      const searchResults = await this.vectorStore.searchWithEmbedding(
        document.embedding,
        { limit: limit + 1 } // +1 to account for the document itself
      );

      // Filter out the original document
      return searchResults.filter(result => result.document.id !== documentId);
    } catch (error) {
      throw new Error(`Failed to find similar documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve context with enhanced ranking and filtering
   */
  async retrieveContextEnhanced(
    query: string, 
    options: RetrievalOptions & { enableReranking?: boolean; rankingOptions?: RankingOptions } = {}
  ): Promise<RetrievedContext> {
    try {
      const { enableReranking = true, rankingOptions = {}, ...retrievalOptions } = options;
      
      // Perform initial semantic search
      const searchResults = await this.performSemanticSearch(query, retrievalOptions) || [];
      
      // Apply reranking if enabled
      let finalResults = searchResults;
      if (enableReranking) {
        const rankedResults = this.reranker.rerank(searchResults, rankingOptions) || [];
        // Ensure diversity in results
        finalResults = this.reranker.ensureDiversity(rankedResults) || [];
      }

      // Apply additional filtering
      const filteredResults = this.reranker.filterResults(
        finalResults,
        retrievalOptions.minScore,
        retrievalOptions.documentTypes
      ) || [];

      const documents = filteredResults.map(result => result.document);
      const relevanceScores = filteredResults.map(result => result.score);

      return {
        documents,
        relevanceScores,
        totalResults: filteredResults.length,
        query,
        retrievedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to retrieve enhanced context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get balanced results with representation from different document types
   */
  async retrieveBalancedContext(
    query: string,
    options: RetrievalOptions & { 
      totalLimit?: number; 
      minPerType?: number;
      rankingOptions?: RankingOptions;
    } = {}
  ): Promise<RetrievedContext> {
    try {
      const { totalLimit = 10, minPerType = 1, rankingOptions = {}, ...retrievalOptions } = options;
      
      // Perform search with higher limit to ensure we have enough results for balancing
      const searchOptions = { ...retrievalOptions, limit: Math.max(totalLimit * 2, 20) };
      const searchResults = await this.performSemanticSearch(query, searchOptions) || [];
      
      // Apply reranking
      const rankedResults = this.reranker.rerank(searchResults, rankingOptions) || [];
      
      // Get balanced results
      const balancedResults = this.reranker.getBalancedResults(rankedResults, totalLimit, minPerType) || [];

      const documents = balancedResults.map(result => result.document);
      const relevanceScores = balancedResults.map(result => result.finalScore);

      return {
        documents,
        relevanceScores,
        totalResults: balancedResults.length,
        query,
        retrievedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to retrieve balanced context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform semantic search using vector embeddings
   */
  private async performSemanticSearch(query: string, options: RetrievalOptions): Promise<SearchResult[]> {
    const searchOptions: SearchOptions = {
      limit: options.limit || 10,
      includeMetadata: options.includeMetadata !== false
    };

    const filter = this.buildFilter(options);
    if (Object.keys(filter).length > 0) {
      searchOptions.filter = filter;
    }

    return await this.vectorStore.searchSimilar(query, searchOptions);
  }

  /**
   * Perform keyword search (simplified implementation)
   * In a full implementation, this would use a dedicated text search index
   */
  private async performKeywordSearch(
    query: string, 
    options: RetrievalOptions,
    keywordOptions: KeywordSearchOptions = {}
  ): Promise<SearchResult[]> {
    // This is a simplified implementation that searches document content
    // In production, you would use a proper text search engine like Elasticsearch
    
    const searchOptions: SearchOptions = {
      limit: (options.limit || 10) * 2, // Get more results for keyword search
      includeMetadata: options.includeMetadata !== false
    };

    const filter = this.buildFilter(options);
    if (Object.keys(filter).length > 0) {
      searchOptions.filter = filter;
    }

    // Use vector search as fallback for keyword search
    // In a real implementation, this would be replaced with proper keyword indexing
    const results = await this.vectorStore.searchSimilar(query, searchOptions);
    
    // Apply simple keyword matching to boost relevant results
    const keywords = this.extractKeywords(query, keywordOptions);
    
    return results.map(result => {
      const keywordScore = this.calculateKeywordScore(result.document, keywords, keywordOptions);
      return {
        ...result,
        score: keywordScore
      };
    }).filter(result => result.score > 0);
  }

  /**
   * Combine semantic and keyword search results with weighting
   */
  private combineSearchResults(
    semanticResults: SearchResult[] = [],
    keywordResults: SearchResult[] = [],
    semanticWeight: number,
    keywordWeight: number
  ): SearchResult[] {
    const combinedMap = new Map<string, SearchResult>();
    
    // Add semantic results
    semanticResults.forEach(result => {
      combinedMap.set(result.document.id, {
        ...result,
        score: result.score * semanticWeight
      });
    });
    
    // Combine with keyword results
    keywordResults.forEach(result => {
      const existing = combinedMap.get(result.document.id);
      if (existing) {
        // Combine scores
        existing.score += result.score * keywordWeight;
      } else {
        // Add new result
        combinedMap.set(result.document.id, {
          ...result,
          score: result.score * keywordWeight
        });
      }
    });
    
    // Convert back to array and sort by combined score
    return Array.from(combinedMap.values())
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Extract keywords from query for keyword matching
   */
  private extractKeywords(query: string, options: KeywordSearchOptions): string[] {
    const { minWordLength = 3, caseSensitive = false } = options;
    
    let processedQuery = caseSensitive ? query : query.toLowerCase();
    
    // Remove common stop words and extract meaningful terms
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    
    return processedQuery
      .split(/\s+/)
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length >= minWordLength && !stopWords.has(word));
  }

  /**
   * Calculate keyword matching score for a document
   */
  private calculateKeywordScore(
    document: Document, 
    keywords: string[], 
    options: KeywordSearchOptions
  ): number {
    if (keywords.length === 0) return 0;
    
    const { caseSensitive = false, exactMatch = false } = options;
    
    let content = document.title + ' ' + document.content;
    if (!caseSensitive) {
      content = content.toLowerCase();
    }
    
    let matches = 0;
    keywords.forEach(keyword => {
      if (exactMatch) {
        const regex = new RegExp(`\\b${keyword}\\b`, caseSensitive ? 'g' : 'gi');
        const keywordMatches = (content.match(regex) || []).length;
        matches += keywordMatches;
      } else {
        if (content.includes(keyword)) {
          matches++;
        }
      }
    });
    
    // Normalize score by number of keywords
    return Math.min(matches / keywords.length, 1.0);
  }

  /**
   * Build filter object for search options
   */
  private buildFilter(options: RetrievalOptions): Record<string, any> {
    const filter: Record<string, any> = {};

    if (options.documentTypes && options.documentTypes.length > 0) {
      if (options.documentTypes.length === 1) {
        filter['type'] = options.documentTypes[0];
      } else {
        filter['type'] = { $in: options.documentTypes };
      }
    }

    // Note: Tag filtering would require more complex logic in ChromaDB
    // This is a simplified implementation
    if (options.tags && options.tags.length > 0) {
      // In a real implementation, you might need to use a different approach
      // for tag filtering depending on how ChromaDB handles array fields
      filter['tags'] = { $contains: options.tags[0] };
    }

    return filter;
  }
}