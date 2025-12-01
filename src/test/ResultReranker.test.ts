import { ResultReranker, RankingOptions } from '../services/ResultReranker';
import { SearchResult } from '../services/VectorStore';
import { Document } from '../models/Document';

describe('ResultReranker', () => {
  let reranker: ResultReranker;

  const mockDocument1: Document = {
    id: 'doc1',
    title: 'Securities Fundamentals',
    content: 'Basic concepts of securities trading',
    type: 'textbook',
    source: 'Authoritative Securities Textbook',
    chapter: 'Chapter 1',
    tags: ['basics', 'fundamentals'],
    embedding: [0.1, 0.2, 0.3],
    metadata: { author: 'Expert Author', edition: '5th' },
    lastUpdated: new Date('2023-06-01')
  };

  const mockDocument2: Document = {
    id: 'doc2',
    title: 'Options Strategies',
    content: 'Advanced options trading strategies',
    type: 'qa_pair',
    source: 'Q&A Database',
    tags: ['options', 'advanced'],
    embedding: [0.4, 0.5, 0.6],
    metadata: {},
    lastUpdated: new Date('2022-01-01')
  };

  const mockDocument3: Document = {
    id: 'doc3',
    title: 'SEC Regulation 101',
    content: 'Securities and Exchange Commission regulations',
    type: 'regulation',
    source: 'SEC Official Documents',
    tags: ['regulation', 'compliance'],
    embedding: [0.7, 0.8, 0.9],
    metadata: { regulation_number: 'SEC-101', status: 'active' },
    lastUpdated: new Date('2023-12-01')
  };

  const mockSearchResults: SearchResult[] = [
    { document: mockDocument1, score: 0.8, distance: 0.2 },
    { document: mockDocument2, score: 0.9, distance: 0.1 },
    { document: mockDocument3, score: 0.7, distance: 0.3 }
  ];

  beforeEach(() => {
    reranker = new ResultReranker();
  });

  describe('rerank', () => {
    it('should rerank results based on multiple factors', () => {
      const options: RankingOptions = {
        authorityWeight: 0.3,
        recencyWeight: 0.2,
        diversityWeight: 0.1,
        typePreferences: {
          textbook: 1.0,
          regulation: 0.9,
          qa_pair: 0.8
        },
        sourceAuthority: {
          'Authoritative Securities Textbook': 0.9,
          'SEC Official Documents': 1.0,
          'Q&A Database': 0.6
        }
      };

      const rankedResults = reranker.rerank(mockSearchResults, options);

      expect(rankedResults).toHaveLength(3);
      expect(rankedResults[0]?.document.id).toBeDefined();
      expect(rankedResults[0]?.finalScore).toBeGreaterThan(0);
      expect(rankedResults[0]?.rankingFactors).toBeDefined();
      expect(rankedResults[0]?.rankingFactors.originalScore).toBeDefined();
      expect(rankedResults[0]?.rankingFactors.authorityScore).toBeDefined();
      expect(rankedResults[0]?.rankingFactors.recencyScore).toBeDefined();
      expect(rankedResults[0]?.rankingFactors.diversityScore).toBeDefined();
      expect(rankedResults[0]?.rankingFactors.typeScore).toBeDefined();

      // Results should be sorted by final score in descending order
      for (let i = 0; i < rankedResults.length - 1; i++) {
        expect(rankedResults[i]?.finalScore).toBeGreaterThanOrEqual(rankedResults[i + 1]?.finalScore || 0);
      }
    });

    it('should use default options when none provided', () => {
      const rankedResults = reranker.rerank(mockSearchResults);

      expect(rankedResults).toHaveLength(3);
      rankedResults.forEach(result => {
        expect(result.finalScore).toBeGreaterThan(0);
        expect(result.rankingFactors).toBeDefined();
      });
    });

    it('should handle empty results array', () => {
      const rankedResults = reranker.rerank([]);
      expect(rankedResults).toHaveLength(0);
    });

    it('should boost newer documents in recency scoring', () => {
      const recentDoc: Document = {
        ...mockDocument1,
        id: 'recent',
        lastUpdated: new Date() // Very recent
      };

      const oldDoc: Document = {
        ...mockDocument2,
        id: 'old',
        lastUpdated: new Date('2020-01-01') // Very old
      };

      const results: SearchResult[] = [
        { document: recentDoc, score: 0.5, distance: 0.5 },
        { document: oldDoc, score: 0.5, distance: 0.5 }
      ];

      const rankedResults = reranker.rerank(results, { recencyWeight: 0.5 });
      
      const recentResult = rankedResults.find(r => r.document.id === 'recent');
      const oldResult = rankedResults.find(r => r.document.id === 'old');

      expect(recentResult?.rankingFactors.recencyScore).toBeGreaterThan(
        oldResult?.rankingFactors.recencyScore || 0
      );
    });
  });

  describe('filterResults', () => {
    it('should filter results by minimum relevance score', () => {
      const filtered = reranker.filterResults(mockSearchResults, 0.85);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.document.id).toBe('doc2'); // Only doc2 has score >= 0.85
    });

    it('should filter results by document types', () => {
      const filtered = reranker.filterResults(mockSearchResults, 0.0, ['textbook', 'regulation']);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map(r => r.document.type)).toEqual(
        expect.arrayContaining(['textbook', 'regulation'])
      );
      expect(filtered.find(r => r.document.type === 'qa_pair')).toBeUndefined();
    });

    it('should apply both score and type filters', () => {
      const filtered = reranker.filterResults(mockSearchResults, 0.75, ['textbook']);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.document.type).toBe('textbook');
      expect(filtered[0]?.score).toBeGreaterThanOrEqual(0.75);
    });

    it('should return all results when no filters applied', () => {
      const filtered = reranker.filterResults(mockSearchResults);
      expect(filtered).toHaveLength(3);
    });
  });

  describe('ensureDiversity', () => {
    it('should limit results per source', () => {
      const sameSourceResults = [
        { document: { ...mockDocument1, id: 'doc1a' }, score: 0.9, distance: 0.1, finalScore: 0.9, rankingFactors: {} as any },
        { document: { ...mockDocument1, id: 'doc1b' }, score: 0.8, distance: 0.2, finalScore: 0.8, rankingFactors: {} as any },
        { document: { ...mockDocument1, id: 'doc1c' }, score: 0.7, distance: 0.3, finalScore: 0.7, rankingFactors: {} as any },
        { document: mockDocument2, score: 0.6, distance: 0.4, finalScore: 0.6, rankingFactors: {} as any }
      ];

      const diverseResults = reranker.ensureDiversity(sameSourceResults, 2);
      
      expect(diverseResults).toHaveLength(3); // 2 from first source + 1 from second source
      
      const sourceGroups = diverseResults.reduce((acc, result) => {
        const source = result.document.source;
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(sourceGroups['Authoritative Securities Textbook']).toBeLessThanOrEqual(2);
    });

    it('should handle empty results', () => {
      const diverseResults = reranker.ensureDiversity([]);
      expect(diverseResults).toHaveLength(0);
    });
  });

  describe('getBalancedResults', () => {
    it('should ensure minimum representation from each type', () => {
      const rankedResults = mockSearchResults.map(result => ({
        ...result,
        finalScore: result.score,
        rankingFactors: {
          originalScore: result.score,
          authorityScore: 0.5,
          recencyScore: 0.5,
          diversityScore: 0.5,
          typeScore: 0.5
        }
      }));

      const balanced = reranker.getBalancedResults(rankedResults, 10, 1);
      
      const types = balanced.map(r => r.document.type);
      const uniqueTypes = new Set(types);
      
      // Should have at least one of each type (if available)
      expect(uniqueTypes.size).toBeGreaterThanOrEqual(3);
    });

    it('should respect total limit', () => {
      const manyResults = Array.from({ length: 20 }, (_, i) => ({
        document: { ...mockDocument1, id: `doc${i}` },
        score: 0.8,
        distance: 0.2,
        finalScore: 0.8,
        rankingFactors: {
          originalScore: 0.8,
          authorityScore: 0.5,
          recencyScore: 0.5,
          diversityScore: 0.5,
          typeScore: 0.5
        }
      }));

      const balanced = reranker.getBalancedResults(manyResults, 5, 1);
      expect(balanced).toHaveLength(5);
    });

    it('should handle insufficient results for minimum per type', () => {
      const singleResult = [{
        document: mockDocument1,
        score: 0.8,
        distance: 0.2,
        finalScore: 0.8,
        rankingFactors: {
          originalScore: 0.8,
          authorityScore: 0.5,
          recencyScore: 0.5,
          diversityScore: 0.5,
          typeScore: 0.5
        }
      }];

      const balanced = reranker.getBalancedResults(singleResult, 10, 2);
      expect(balanced).toHaveLength(1); // Can't enforce minPerType if not enough results
    });
  });

  describe('private methods behavior through public interface', () => {
    it('should calculate higher authority scores for official sources', () => {
      const options: RankingOptions = {
        sourceAuthority: {
          'SEC Official Documents': 1.0,
          'Q&A Database': 0.3
        }
      };

      const rankedResults = reranker.rerank(mockSearchResults, options);
      
      const secResult = rankedResults.find(r => r.document.source === 'SEC Official Documents');
      const qaResult = rankedResults.find(r => r.document.source === 'Q&A Database');

      expect(secResult?.rankingFactors.authorityScore).toBeGreaterThan(
        qaResult?.rankingFactors.authorityScore || 0
      );
    });

    it('should give higher type scores to preferred document types', () => {
      const options: RankingOptions = {
        typePreferences: {
          textbook: 1.0,
          regulation: 0.9,
          qa_pair: 0.5
        }
      };

      const rankedResults = reranker.rerank(mockSearchResults, options);
      
      const textbookResult = rankedResults.find(r => r.document.type === 'textbook');
      const qaResult = rankedResults.find(r => r.document.type === 'qa_pair');

      expect(textbookResult?.rankingFactors.typeScore).toBeGreaterThan(
        qaResult?.rankingFactors.typeScore || 0
      );
    });
  });
});