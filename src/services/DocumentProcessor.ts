import { Document } from '../models/Document';
import { EmbeddingService } from './EmbeddingService';
import { VectorStore } from './VectorStore';

export interface ProcessingConfig {
  chunkSize?: number;
  chunkOverlap?: number;
  minChunkSize?: number;
  maxChunkSize?: number;
  batchSize?: number;
}

export interface ProcessingResult {
  processedDocuments: Document[];
  errors: ProcessingError[];
  stats: ProcessingStats;
}

export interface ProcessingError {
  source: string;
  error: string;
  severity: 'warning' | 'error';
}

export interface ProcessingStats {
  totalDocuments: number;
  successfulDocuments: number;
  failedDocuments: number;
  totalChunks: number;
  processingTimeMs: number;
}

export interface RawDocument {
  title: string;
  content: string;
  source: string;
  type: 'textbook' | 'qa_pair' | 'regulation';
  metadata?: Record<string, any>;
}

export class DocumentProcessor {
  private embeddingService: EmbeddingService;
  private vectorStore: VectorStore;
  private config: Required<ProcessingConfig>;

  constructor(
    embeddingService: EmbeddingService,
    vectorStore: VectorStore,
    config: ProcessingConfig = {}
  ) {
    this.embeddingService = embeddingService;
    this.vectorStore = vectorStore;
    this.config = {
      chunkSize: config.chunkSize || 1000,
      chunkOverlap: config.chunkOverlap || 200,
      minChunkSize: config.minChunkSize || 100,
      maxChunkSize: config.maxChunkSize || 2000,
      batchSize: config.batchSize || 50
    };
  }

  /**
   * Process a single raw document into chunked documents with embeddings
   */
  async processDocument(rawDoc: RawDocument): Promise<Document[]> {
    const chunks = this.chunkDocument(rawDoc);
    const documents: Document[] = [];

    for (const chunk of chunks) {
      const chapter = this.extractChapter(chunk.content, rawDoc.metadata);
      const section = this.extractSection(chunk.content, rawDoc.metadata);
      
      const document: Document = {
        id: this.generateDocumentId(rawDoc.source, chunk.index),
        title: chunk.title,
        content: chunk.content,
        type: rawDoc.type,
        source: rawDoc.source,
        ...(chapter && { chapter }),
        ...(section && { section }),
        tags: this.extractTags(chunk.content, rawDoc.type),
        embedding: [], // Will be generated later
        metadata: {
          ...rawDoc.metadata,
          chunkIndex: chunk.index,
          totalChunks: chunks.length,
          originalLength: rawDoc.content.length,
          chunkLength: chunk.content.length
        },
        lastUpdated: new Date()
      };

      documents.push(document);
    }

    return documents;
  }

  /**
   * Process multiple raw documents in batches
   */
  async processDocuments(rawDocs: RawDocument[]): Promise<ProcessingResult> {
    const startTime = Date.now();
    const processedDocuments: Document[] = [];
    const errors: ProcessingError[] = [];
    let successfulDocuments = 0;
    let failedDocuments = 0;

    // Process documents in batches
    for (let i = 0; i < rawDocs.length; i += this.config.batchSize) {
      const batch = rawDocs.slice(i, i + this.config.batchSize);
      
      for (const rawDoc of batch) {
        try {
          const documents = await this.processDocument(rawDoc);
          
          // Validate each document
          const validDocuments = documents.filter(doc => {
            const validation = this.validateDocument(doc);
            if (!validation.isValid) {
              errors.push({
                source: rawDoc.source,
                error: `Validation failed: ${validation.errors.join(', ')}`,
                severity: 'warning'
              });
              return false;
            }
            return true;
          });

          if (validDocuments.length > 0) {
            processedDocuments.push(...validDocuments);
            successfulDocuments++;
          } else {
            failedDocuments++;
          }
        } catch (error) {
          failedDocuments++;
          errors.push({
            source: rawDoc.source,
            error: error instanceof Error ? error.message : 'Unknown processing error',
            severity: 'error'
          });
        }
      }
    }

    const processingTimeMs = Date.now() - startTime;
    const totalChunks = processedDocuments.length;

    return {
      processedDocuments,
      errors,
      stats: {
        totalDocuments: rawDocs.length,
        successfulDocuments,
        failedDocuments,
        totalChunks,
        processingTimeMs
      }
    };
  }

  /**
   * Process and store documents with embeddings
   */
  async processAndStore(rawDocs: RawDocument[]): Promise<ProcessingResult> {
    const result = await this.processDocuments(rawDocs);
    
    if (result.processedDocuments.length > 0) {
      try {
        // Generate embeddings in batches
        await this.generateEmbeddingsForDocuments(result.processedDocuments);
        
        // Store documents in vector store
        await this.vectorStore.storeDocuments(result.processedDocuments);
      } catch (error) {
        // If embedding or storage fails, remove the processed documents and add error
        result.processedDocuments.length = 0;
        result.errors.push({
          source: 'embedding_generation',
          error: error instanceof Error ? error.message : 'Unknown embedding error',
          severity: 'error'
        });
      }
    }

    return result;
  }

  /**
   * Generate embeddings for a batch of documents
   */
  private async generateEmbeddingsForDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(doc => doc.content);
    const embeddingResults = await this.embeddingService.generateEmbeddings(texts);

    for (let i = 0; i < documents.length; i++) {
      const result = embeddingResults[i];
      if (result?.error) {
        throw new Error(`Failed to generate embedding for document ${documents[i]?.id}: ${result.error}`);
      }
      if (documents[i] && result) {
        documents[i]!.embedding = result.embedding;
      }
    }
  }

  /**
   * Chunk a document into smaller pieces
   */
  private chunkDocument(rawDoc: RawDocument): Array<{ content: string; title: string; index: number }> {
    const chunks: Array<{ content: string; title: string; index: number }> = [];
    
    if (rawDoc.type === 'qa_pair' || rawDoc.content.length <= this.config.chunkSize) {
      // Q&A pairs or small documents are kept as single chunks
      chunks.push({
        content: rawDoc.content,
        title: rawDoc.title,
        index: 0
      });
      return chunks;
    }

    // For textbooks and regulations, use sliding window chunking
    const text = rawDoc.content;
    const sentences = this.splitIntoSentences(text);
    
    let currentChunk = '';
    let chunkIndex = 0;
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
      
      if (potentialChunk.length <= this.config.chunkSize) {
        currentChunk = potentialChunk;
      } else {
        // Current chunk is full, save it and start a new one
        if (currentChunk.length >= this.config.minChunkSize) {
          chunks.push({
            content: currentChunk.trim(),
            title: `${rawDoc.title} (Part ${chunkIndex + 1})`,
            index: chunkIndex
          });
          chunkIndex++;
        }
        
        // Start new chunk with overlap
        const overlapSentences = this.getOverlapSentences(sentences, i, this.config.chunkOverlap);
        currentChunk = overlapSentences + (overlapSentences ? ' ' : '') + sentence;
      }
    }
    
    // Add the last chunk if it meets minimum size
    if (currentChunk.length >= this.config.minChunkSize) {
      chunks.push({
        content: currentChunk.trim(),
        title: `${rawDoc.title} (Part ${chunkIndex + 1})`,
        index: chunkIndex
      });
    }
    
    return chunks;
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting - can be enhanced with more sophisticated NLP
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => s + '.');
  }

  /**
   * Get overlap sentences for chunking
   */
  private getOverlapSentences(sentences: string[], currentIndex: number, overlapLength: number): string {
    let overlap = '';
    let currentLength = 0;
    
    for (let i = currentIndex - 1; i >= 0 && currentLength < overlapLength; i--) {
      const sentence = sentences[i];
      if (sentence && currentLength + sentence.length <= overlapLength) {
        overlap = sentence + (overlap ? ' ' : '') + overlap;
        currentLength += sentence.length;
      } else {
        break;
      }
    }
    
    return overlap;
  }

  /**
   * Extract chapter information from content or metadata
   */
  private extractChapter(content: string, metadata?: Record<string, any>): string | undefined {
    if (metadata?.['chapter']) {
      return metadata['chapter'];
    }
    
    // Try to extract chapter from content using regex
    const chapterMatch = content.match(/Chapter\s+(\d+|[IVX]+)[\s:]/i);
    return chapterMatch ? chapterMatch[1] : undefined;
  }

  /**
   * Extract section information from content or metadata
   */
  private extractSection(content: string, metadata?: Record<string, any>): string | undefined {
    if (metadata?.['section']) {
      return metadata['section'];
    }
    
    // Try to extract section from content
    const sectionMatch = content.match(/Section\s+(\d+(?:\.\d+)*)/i);
    return sectionMatch ? sectionMatch[1] : undefined;
  }

  /**
   * Extract relevant tags from content based on document type
   */
  private extractTags(content: string, type: 'textbook' | 'qa_pair' | 'regulation'): string[] {
    const tags: string[] = [type];
    
    // Securities-specific terms to look for
    const securityTerms = [
      'securities', 'bonds', 'stocks', 'equity', 'debt', 'derivatives',
      'options', 'futures', 'mutual funds', 'etf', 'portfolio',
      'investment', 'trading', 'market', 'exchange', 'sec', 'finra',
      'regulation', 'compliance', 'risk', 'valuation', 'analysis'
    ];
    
    const lowerContent = content.toLowerCase();
    
    for (const term of securityTerms) {
      if (lowerContent.includes(term)) {
        tags.push(term);
      }
    }
    
    // Add difficulty level based on content complexity
    const complexityIndicators = ['advanced', 'complex', 'sophisticated', 'intricate'];
    const basicIndicators = ['basic', 'fundamental', 'introduction', 'overview'];
    
    if (complexityIndicators.some(indicator => lowerContent.includes(indicator))) {
      tags.push('advanced');
    } else if (basicIndicators.some(indicator => lowerContent.includes(indicator))) {
      tags.push('basic');
    } else {
      tags.push('intermediate');
    }
    
    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Generate a unique document ID
   */
  private generateDocumentId(source: string, chunkIndex: number): string {
    const sourceHash = this.simpleHash(source);
    const timestamp = Date.now();
    return `doc_${sourceHash}_${chunkIndex}_${timestamp}`;
  }

  /**
   * Simple hash function for generating IDs
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Validate a processed document
   */
  private validateDocument(document: Document): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check required fields
    if (!document.id) errors.push('Missing document ID');
    if (!document.title) errors.push('Missing document title');
    if (!document.content) errors.push('Missing document content');
    if (!document.source) errors.push('Missing document source');
    if (!document.type) errors.push('Missing document type');
    
    // Check content length
    if (document.content.length < this.config.minChunkSize) {
      errors.push(`Content too short: ${document.content.length} < ${this.config.minChunkSize}`);
    }
    
    if (document.content.length > this.config.maxChunkSize) {
      errors.push(`Content too long: ${document.content.length} > ${this.config.maxChunkSize}`);
    }
    
    // Check document type
    const validTypes = ['textbook', 'qa_pair', 'regulation'];
    if (!validTypes.includes(document.type)) {
      errors.push(`Invalid document type: ${document.type}`);
    }
    
    // Check tags
    if (!Array.isArray(document.tags) || document.tags.length === 0) {
      errors.push('Missing or invalid tags');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get processing statistics
   */
  getConfig(): Required<ProcessingConfig> {
    return { ...this.config };
  }
}