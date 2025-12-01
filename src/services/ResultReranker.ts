import { Document } from '../models/Document';
import { SearchResult } from './VectorStore';

export interface RankingOptions {
  authorityWeight?: number;
  recencyWeight?: number;
  diversityWeight?: number;
  typePreferences?: Record<'textbook' | 'qa_pair' | 'regulation', number>;
  sourceAuthority?: Record<string, number>;
}

export interface RankedResult extends SearchResult {
  finalScore: number;
  rankingFactors: {
    originalScore: number;
    authorityScore: number;
    recencyScore: number;
    diversityScore: number;
    typeScore: number;
  };
}

export class ResultReranker {
  private defaultOptions: Required<RankingOptions> = {
    authorityWeight: 0.3,
    recencyWeight: 0.2,
    diversityWeight: 0.1,
    typePreferences: {
      textbook: 1.0,
      regulation: 0.9,
      qa_pair: 0.8
    },
    sourceAuthority: {}
  };

  /**
   * Rerank search results based on multiple factors
   */
  rerank(results: SearchResult[], options: RankingOptions = {}): RankedResult[] {
    const opts = { ...this.defaultOptions, ...options };
    
    // Calculate ranking factors for each result
    const rankedResults: RankedResult[] = results.map((result, index) => {
      const authorityScore = this.calculateAuthorityScore(result.document, opts);
      const recencyScore = this.calculateRecencyScore(result.document);
      const diversityScore = this.calculateDiversityScore(result.document, results, index);
      const typeScore = this.calculateTypeScore(result.document, opts);
      
      // Calculate final weighted score
      const finalScore = 
        result.score * (1 - opts.authorityWeight - opts.recencyWeight - opts.diversityWeight) +
        authorityScore * opts.authorityWeight +
        recencyScore * opts.recencyWeight +
        diversityScore * opts.diversityWeight +
        typeScore * 0.1; // Small weight for type preference

      return {
        ...result,
        finalScore,
        rankingFactors: {
          originalScore: result.score,
          authorityScore,
          recencyScore,
          diversityScore,
          typeScore
        }
      };
    });

    // Sort by final score in descending order
    return rankedResults.sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * Filter results by relevance threshold and document types
   */
  filterResults(
    results: SearchResult[], 
    minRelevanceScore: number = 0.5,
    allowedTypes?: ('textbook' | 'qa_pair' | 'regulation')[]
  ): SearchResult[] {
    return results.filter(result => {
      // Check relevance score
      if (result.score < minRelevanceScore) {
        return false;
      }

      // Check document type if specified
      if (allowedTypes && !allowedTypes.includes(result.document.type)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Ensure diversity in results by limiting documents from the same source
   */
  ensureDiversity(results: RankedResult[], maxPerSource: number = 3): RankedResult[] {
    const sourceCount: Record<string, number> = {};
    
    return results.filter(result => {
      const source = result.document.source;
      sourceCount[source] = (sourceCount[source] || 0) + 1;
      return sourceCount[source] <= maxPerSource;
    });
  }

  /**
   * Get top results with balanced representation from different document types
   */
  getBalancedResults(
    results: RankedResult[], 
    totalLimit: number = 10,
    minPerType: number = 1
  ): RankedResult[] {
    const typeGroups: Record<string, RankedResult[]> = {
      textbook: [],
      qa_pair: [],
      regulation: []
    };

    // Group results by type
    results.forEach(result => {
      const group = typeGroups[result.document.type];
      if (group) {
        group.push(result);
      }
    });

    // Sort each group by final score
    Object.values(typeGroups).forEach(group => {
      group.sort((a, b) => b.finalScore - a.finalScore);
    });

    const balancedResults: RankedResult[] = [];
    const types = Object.keys(typeGroups) as ('textbook' | 'qa_pair' | 'regulation')[];

    // First, ensure minimum representation from each type
    types.forEach(type => {
      const typeResults = typeGroups[type];
      if (typeResults) {
        const toAdd = Math.min(minPerType, typeResults.length);
        balancedResults.push(...typeResults.slice(0, toAdd));
      }
    });

    // Fill remaining slots with best remaining results
    const remainingSlots = totalLimit - balancedResults.length;
    if (remainingSlots > 0) {
      const usedIds = new Set(balancedResults.map(r => r.document.id));
      const remainingResults = results
        .filter(r => !usedIds.has(r.document.id))
        .slice(0, remainingSlots);
      
      balancedResults.push(...remainingResults);
    }

    // Final sort by score and return up to limit
    return balancedResults
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, totalLimit);
  }

  /**
   * Calculate authority score based on source and metadata
   */
  private calculateAuthorityScore(document: Document, options: Required<RankingOptions>): number {
    // Base authority from source
    const sourceAuthority = options.sourceAuthority[document.source] || 0.5;
    
    // Boost for official regulations
    const typeBoost = document.type === 'regulation' ? 0.2 : 0;
    
    // Boost for documents with more metadata (indicates better curation)
    const metadataBoost = Math.min(Object.keys(document.metadata).length * 0.05, 0.2);
    
    return Math.min(sourceAuthority + typeBoost + metadataBoost, 1.0);
  }

  /**
   * Calculate recency score based on document age
   */
  private calculateRecencyScore(document: Document): number {
    const now = new Date();
    const docAge = now.getTime() - document.lastUpdated.getTime();
    const ageInDays = docAge / (1000 * 60 * 60 * 24);
    
    // Exponential decay: newer documents get higher scores
    // Documents older than 2 years get very low recency scores
    const maxAge = 730; // 2 years in days
    return Math.max(0, Math.exp(-ageInDays / maxAge));
  }

  /**
   * Calculate diversity score to promote variety in results
   */
  private calculateDiversityScore(
    document: Document, 
    allResults: SearchResult[], 
    currentIndex: number
  ): number {
    // Count how many documents from the same source appear before this one
    const sameSourceCount = allResults
      .slice(0, currentIndex)
      .filter(result => result.document.source === document.source)
      .length;
    
    // Penalize documents from over-represented sources
    return Math.max(0, 1 - (sameSourceCount * 0.2));
  }

  /**
   * Calculate type preference score
   */
  private calculateTypeScore(document: Document, options: Required<RankingOptions>): number {
    return options.typePreferences[document.type] || 0.5;
  }
}