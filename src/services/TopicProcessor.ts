import { EmbeddingService } from './EmbeddingService';

export interface TopicValidationResult {
  isValid: boolean;
  normalizedTopic: string;
  suggestedTopics?: string[];
  validationMessage?: string;
}

export interface SemanticQuery {
  originalTopic: string;
  expandedQueries: string[];
  keywords: string[];
  relatedConcepts: string[];
}

export class TopicProcessor {
  private embeddingService: EmbeddingService;
  private validSecuritiesTopics: Set<string>;
  private topicSynonyms: Map<string, string[]>;

  constructor(embeddingService: EmbeddingService) {
    this.embeddingService = embeddingService;
    this.initializeValidTopics();
    this.initializeTopicSynonyms();
  }

  /**
   * Validate if a topic is related to securities education
   */
  async validateTopic(topic: string): Promise<TopicValidationResult> {
    try {
      const normalizedTopic = this.normalizeTopic(topic);
      
      // Check if topic is empty or too short
      if (!normalizedTopic || normalizedTopic.length < 2) {
        return {
          isValid: false,
          normalizedTopic: '',
          validationMessage: 'Topic must be at least 2 characters long'
        };
      }

      // Check against known securities topics
      const isKnownTopic = this.isKnownSecuritiesTopic(normalizedTopic);
      if (isKnownTopic) {
        return {
          isValid: true,
          normalizedTopic,
          validationMessage: 'Valid securities topic'
        };
      }

      // Use semantic similarity to check if topic is securities-related
      const isSecuritiesRelated = await this.isSecuritiesRelated(normalizedTopic);
      if (isSecuritiesRelated) {
        return {
          isValid: true,
          normalizedTopic,
          validationMessage: 'Topic appears to be securities-related'
        };
      }

      // Suggest similar topics if available
      const suggestedTopics = this.getSuggestedTopics(normalizedTopic);
      
      return {
        isValid: false,
        normalizedTopic,
        suggestedTopics,
        validationMessage: 'Topic does not appear to be related to securities education'
      };
    } catch (error) {
      throw new Error(`Failed to validate topic: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate semantic queries for document retrieval
   */
  async generateSemanticQueries(topic: string): Promise<SemanticQuery> {
    try {
      const normalizedTopic = this.normalizeTopic(topic);
      
      // Extract keywords from the topic
      const keywords = this.extractKeywords(normalizedTopic);
      
      // Generate expanded queries using synonyms and related concepts
      const expandedQueries = this.generateExpandedQueries(normalizedTopic);
      
      // Get related concepts based on securities domain knowledge
      const relatedConcepts = this.getRelatedConcepts(normalizedTopic);

      return {
        originalTopic: normalizedTopic,
        expandedQueries,
        keywords,
        relatedConcepts
      };
    } catch (error) {
      throw new Error(`Failed to generate semantic queries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Normalize topic text for consistent processing
   */
  private normalizeTopic(topic: string): string {
    return topic
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Check if topic matches known securities topics
   */
  private isKnownSecuritiesTopic(topic: string): boolean {
    // Direct match
    if (this.validSecuritiesTopics.has(topic)) {
      return true;
    }

    // Check for partial matches
    for (const validTopic of this.validSecuritiesTopics) {
      if (topic.includes(validTopic) || validTopic.includes(topic)) {
        return true;
      }
    }

    // Check synonyms
    for (const [canonical, synonyms] of this.topicSynonyms) {
      if (synonyms.some(synonym => topic.includes(synonym) || synonym.includes(topic))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Use semantic similarity to determine if topic is securities-related
   */
  private async isSecuritiesRelated(topic: string): Promise<boolean> {
    try {
      // Generate embedding for the topic
      const topicEmbedding = await this.embeddingService.generateEmbedding(topic);
      
      // Generate embeddings for known securities concepts
      const securitiesConcepts = [
        'securities regulation',
        'financial markets',
        'investment analysis',
        'portfolio management',
        'risk management',
        'derivatives trading',
        'equity markets',
        'bond markets',
        'mutual funds',
        'financial planning'
      ];

      // Calculate similarity scores
      const similarities = await Promise.all(
        securitiesConcepts.map(async (concept) => {
          const conceptEmbedding = await this.embeddingService.generateEmbedding(concept);
          return this.calculateCosineSimilarity(topicEmbedding, conceptEmbedding);
        })
      );

      // Consider topic securities-related if any similarity is above threshold
      const threshold = 0.6;
      return similarities.some(similarity => similarity > threshold);
    } catch (error) {
      // If embedding fails, fall back to keyword matching
      console.warn('Semantic similarity check failed, using keyword matching:', error);
      return this.hasSecuritiesKeywords(topic);
    }
  }

  /**
   * Check if topic contains securities-related keywords
   */
  private hasSecuritiesKeywords(topic: string): boolean {
    const securitiesKeywords = [
      'stock', 'bond', 'equity', 'debt', 'security', 'securities',
      'investment', 'portfolio', 'fund', 'mutual', 'etf',
      'derivative', 'option', 'future', 'swap',
      'market', 'trading', 'broker', 'dealer',
      'regulation', 'compliance', 'sec', 'finra',
      'risk', 'return', 'yield', 'dividend',
      'financial', 'finance', 'capital', 'asset'
    ];

    return securitiesKeywords.some(keyword => topic.includes(keyword));
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Extract keywords from topic
   */
  private extractKeywords(topic: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being'
    ]);

    return topic
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .map(word => word.toLowerCase());
  }

  /**
   * Generate expanded queries using synonyms and variations
   */
  private generateExpandedQueries(topic: string): string[] {
    const queries = [topic];
    
    // Add synonym-based queries
    for (const [canonical, synonyms] of this.topicSynonyms) {
      if (topic.includes(canonical)) {
        synonyms.forEach(synonym => {
          const expandedQuery = topic.replace(canonical, synonym);
          if (expandedQuery !== topic) {
            queries.push(expandedQuery);
          }
        });
      }
    }

    // Add keyword-based variations
    const keywords = this.extractKeywords(topic);
    if (keywords.length > 1) {
      // Create queries with individual keywords
      keywords.forEach(keyword => {
        queries.push(keyword);
      });
      
      // Create queries with keyword combinations
      for (let i = 0; i < keywords.length - 1; i++) {
        for (let j = i + 1; j < keywords.length; j++) {
          queries.push(`${keywords[i]} ${keywords[j]}`);
        }
      }
    }

    // Remove duplicates and return
    return Array.from(new Set(queries));
  }

  /**
   * Get related concepts for a topic
   */
  private getRelatedConcepts(topic: string): string[] {
    const conceptMap: Record<string, string[]> = {
      'stock': ['equity', 'shares', 'common stock', 'preferred stock', 'dividend'],
      'bond': ['debt', 'fixed income', 'yield', 'maturity', 'credit rating'],
      'option': ['derivative', 'call option', 'put option', 'strike price', 'expiration'],
      'portfolio': ['diversification', 'asset allocation', 'risk management', 'return'],
      'mutual fund': ['investment company', 'net asset value', 'expense ratio', 'load'],
      'regulation': ['compliance', 'sec', 'finra', 'disclosure', 'fiduciary'],
      'market': ['trading', 'liquidity', 'volatility', 'price discovery', 'efficiency'],
      'risk': ['systematic risk', 'unsystematic risk', 'beta', 'standard deviation'],
      'analysis': ['fundamental analysis', 'technical analysis', 'valuation', 'ratios']
    };

    const relatedConcepts: string[] = [];
    
    for (const [key, concepts] of Object.entries(conceptMap)) {
      if (topic.includes(key)) {
        relatedConcepts.push(...concepts);
      }
    }

    return Array.from(new Set(relatedConcepts));
  }

  /**
   * Get suggested topics for invalid input
   */
  private getSuggestedTopics(topic: string): string[] {
    const suggestions: string[] = [];
    const topicWords = this.extractKeywords(topic);
    
    // Find topics that share keywords
    for (const validTopic of this.validSecuritiesTopics) {
      const validWords = this.extractKeywords(validTopic);
      const commonWords = topicWords.filter(word => validWords.includes(word));
      
      if (commonWords.length > 0) {
        suggestions.push(validTopic);
      }
    }

    // Limit to top 5 suggestions
    return suggestions.slice(0, 5);
  }

  /**
   * Initialize valid securities topics
   */
  private initializeValidTopics(): void {
    this.validSecuritiesTopics = new Set([
      // Basic securities types
      'stocks', 'bonds', 'equities', 'debt securities', 'derivatives',
      'options', 'futures', 'swaps', 'mutual funds', 'etfs',
      
      // Market concepts
      'financial markets', 'capital markets', 'money markets',
      'primary markets', 'secondary markets', 'trading',
      
      // Investment concepts
      'portfolio management', 'asset allocation', 'diversification',
      'risk management', 'investment analysis', 'valuation',
      
      // Regulatory topics
      'securities regulation', 'compliance', 'sec regulations',
      'finra rules', 'disclosure requirements', 'fiduciary duty',
      
      // Financial planning
      'retirement planning', 'financial planning', 'investment advisory',
      'wealth management', 'tax planning',
      
      // Market analysis
      'fundamental analysis', 'technical analysis', 'market efficiency',
      'behavioral finance', 'quantitative analysis',
      
      // Risk and return
      'risk assessment', 'return calculation', 'performance measurement',
      'benchmark analysis', 'attribution analysis'
    ]);
  }

  /**
   * Initialize topic synonyms mapping
   */
  private initializeTopicSynonyms(): void {
    this.topicSynonyms = new Map([
      ['stock', ['equity', 'share', 'common stock', 'equity security']],
      ['bond', ['debt', 'fixed income', 'debt security', 'debenture']],
      ['option', ['derivative', 'call', 'put', 'warrant']],
      ['fund', ['mutual fund', 'investment fund', 'pooled investment']],
      ['etf', ['exchange traded fund', 'index fund', 'tracker fund']],
      ['portfolio', ['investment portfolio', 'asset portfolio', 'holdings']],
      ['risk', ['investment risk', 'market risk', 'financial risk']],
      ['return', ['investment return', 'yield', 'performance', 'gain']],
      ['analysis', ['investment analysis', 'security analysis', 'financial analysis']],
      ['regulation', ['securities law', 'financial regulation', 'compliance rule']],
      ['market', ['financial market', 'securities market', 'trading market']],
      ['trading', ['securities trading', 'investment trading', 'market trading']]
    ]);
  }
}