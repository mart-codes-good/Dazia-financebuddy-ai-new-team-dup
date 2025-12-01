import { DocumentProcessor, RawDocument, ProcessingResult, ProcessingConfig } from './DocumentProcessor';
import { EmbeddingService } from './EmbeddingService';
import { VectorStore } from './VectorStore';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface IngestionConfig extends ProcessingConfig {
  inputDirectory?: string;
  supportedFormats?: string[];
  skipExisting?: boolean;
  validateBeforeProcessing?: boolean;
}

export interface IngestionResult extends ProcessingResult {
  inputFiles: string[];
  skippedFiles: string[];
}

export interface FileParsingResult {
  documents: RawDocument[];
  errors: string[];
}

export class DataIngestionPipeline {
  private documentProcessor: DocumentProcessor;
  private embeddingService: EmbeddingService;
  private vectorStore: VectorStore;
  private config: Required<IngestionConfig>;

  constructor(
    embeddingService: EmbeddingService,
    vectorStore: VectorStore,
    config: IngestionConfig = {}
  ) {
    this.embeddingService = embeddingService;
    this.vectorStore = vectorStore;
    this.documentProcessor = new DocumentProcessor(embeddingService, vectorStore, config);
    
    this.config = {
      ...this.documentProcessor.getConfig(),
      inputDirectory: config.inputDirectory || './data',
      supportedFormats: config.supportedFormats || ['.txt', '.md', '.json'],
      skipExisting: config.skipExisting || false,
      validateBeforeProcessing: config.validateBeforeProcessing || true
    };
  }

  /**
   * Ingest documents from a directory
   */
  async ingestFromDirectory(directoryPath?: string): Promise<IngestionResult> {
    const inputDir = directoryPath || this.config.inputDirectory;
    
    try {
      await fs.access(inputDir);
    } catch (error) {
      throw new Error(`Input directory does not exist: ${inputDir}`);
    }

    const files = await this.findSupportedFiles(inputDir);
    return this.ingestFromFiles(files);
  }

  /**
   * Ingest documents from specific files
   */
  async ingestFromFiles(filePaths: string[]): Promise<IngestionResult> {
    const inputFiles: string[] = [];
    const skippedFiles: string[] = [];
    const allRawDocuments: RawDocument[] = [];
    const allErrors: string[] = [];

    for (const filePath of filePaths) {
      try {
        // Check if file should be skipped
        if (this.config.skipExisting && await this.isFileAlreadyProcessed(filePath)) {
          skippedFiles.push(filePath);
          continue;
        }

        const parseResult = await this.parseFile(filePath);
        
        if (parseResult.errors.length > 0) {
          allErrors.push(...parseResult.errors);
        }
        
        if (parseResult.documents.length > 0) {
          allRawDocuments.push(...parseResult.documents);
          inputFiles.push(filePath);
        } else if (parseResult.errors.length > 0) {
          // File had parsing errors and no documents, mark as skipped
          skippedFiles.push(filePath);
        }
      } catch (error) {
        allErrors.push(`Failed to process file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        skippedFiles.push(filePath);
      }
    }

    // Process all collected documents
    const processingResult = await this.documentProcessor.processAndStore(allRawDocuments);

    // Add file-level errors to processing errors
    const fileErrors = allErrors.map(error => ({
      source: 'file_parsing',
      error,
      severity: 'error' as const
    }));

    return {
      ...processingResult,
      errors: [...processingResult.errors, ...fileErrors],
      inputFiles,
      skippedFiles
    };
  }

  /**
   * Ingest documents from raw document objects
   */
  async ingestFromRawDocuments(rawDocuments: RawDocument[]): Promise<ProcessingResult> {
    if (this.config.validateBeforeProcessing) {
      const validationErrors = this.validateRawDocuments(rawDocuments);
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      }
    }

    return this.documentProcessor.processAndStore(rawDocuments);
  }

  /**
   * Parse a single file into raw documents
   */
  private async parseFile(filePath: string): Promise<FileParsingResult> {
    const extension = path.extname(filePath).toLowerCase();
    const content = await fs.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath, extension);

    switch (extension) {
      case '.txt':
      case '.md':
        return this.parseTextFile(content, filePath, fileName);
      
      case '.json':
        return this.parseJsonFile(content, filePath, fileName);
      
      default:
        return {
          documents: [],
          errors: [`Unsupported file format: ${extension}`]
        };
    }
  }

  /**
   * Parse text/markdown files
   */
  private parseTextFile(content: string, filePath: string, fileName: string): FileParsingResult {
    const errors: string[] = [];
    
    try {
      // Determine document type based on file path or content
      const type = this.inferDocumentType(filePath, content);
      
      const rawDocument: RawDocument = {
        title: fileName,
        content: content.trim(),
        source: filePath,
        type,
        metadata: {
          fileSize: content.length,
          fileExtension: path.extname(filePath),
          processedAt: new Date().toISOString()
        }
      };

      return {
        documents: [rawDocument],
        errors
      };
    } catch (error) {
      return {
        documents: [],
        errors: [`Failed to parse text file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Parse JSON files (expecting array of documents or single document)
   */
  private parseJsonFile(content: string, filePath: string, fileName: string): FileParsingResult {
    const errors: string[] = [];
    const documents: RawDocument[] = [];

    try {
      const jsonData = JSON.parse(content);
      
      if (Array.isArray(jsonData)) {
        // Array of documents
        for (let i = 0; i < jsonData.length; i++) {
          const item = jsonData[i];
          const doc = this.parseJsonDocument(item, filePath, i);
          if (doc) {
            documents.push(doc);
          } else {
            errors.push(`Invalid document format at index ${i} in ${filePath}`);
          }
        }
      } else {
        // Single document
        const doc = this.parseJsonDocument(jsonData, filePath, 0);
        if (doc) {
          documents.push(doc);
        } else {
          errors.push(`Invalid document format in ${filePath}`);
        }
      }

      return { documents, errors };
    } catch (error) {
      return {
        documents: [],
        errors: [`Failed to parse JSON file ${filePath}: ${error instanceof Error ? error.message : 'Invalid JSON'}`]
      };
    }
  }

  /**
   * Parse a single JSON document object
   */
  private parseJsonDocument(jsonDoc: any, filePath: string, index: number): RawDocument | null {
    if (!jsonDoc || typeof jsonDoc !== 'object') {
      return null;
    }

    // Required fields
    if (!jsonDoc.title || !jsonDoc.content) {
      return null;
    }

    const type = jsonDoc.type || this.inferDocumentType(filePath, jsonDoc.content);
    
    return {
      title: jsonDoc.title,
      content: jsonDoc.content,
      source: `${filePath}#${index}`,
      type,
      metadata: {
        ...jsonDoc.metadata,
        originalIndex: index,
        fileSource: filePath,
        processedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Infer document type from file path or content
   */
  private inferDocumentType(filePath: string, content: string): 'textbook' | 'qa_pair' | 'regulation' {
    const lowerPath = filePath.toLowerCase();
    const lowerContent = content.toLowerCase();

    // Check file path for hints
    if (lowerPath.includes('qa') || lowerPath.includes('question') || lowerPath.includes('answer')) {
      return 'qa_pair';
    }
    
    if (lowerPath.includes('regulation') || lowerPath.includes('rule') || lowerPath.includes('sec')) {
      return 'regulation';
    }

    // Check content for Q&A patterns
    if (lowerContent.includes('question:') || lowerContent.includes('q:') || 
        lowerContent.includes('answer:') || lowerContent.includes('a:')) {
      return 'qa_pair';
    }

    // Check for regulation patterns
    if (lowerContent.includes('regulation') || lowerContent.includes('section') ||
        lowerContent.includes('rule') || lowerContent.includes('shall')) {
      return 'regulation';
    }

    // Default to textbook
    return 'textbook';
  }

  /**
   * Find all supported files in a directory
   */
  private async findSupportedFiles(directoryPath: string): Promise<string[]> {
    const files: string[] = [];
    
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively search subdirectories
        const subFiles = await this.findSupportedFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const extension = path.extname(entry.name).toLowerCase();
        if (this.config.supportedFormats.includes(extension)) {
          files.push(fullPath);
        }
      }
    }
    
    return files;
  }

  /**
   * Check if a file has already been processed (simple implementation)
   */
  private async isFileAlreadyProcessed(filePath: string): Promise<boolean> {
    // This is a simple implementation - in production, you might want to
    // maintain a database of processed files with checksums
    try {
      const stats = await this.vectorStore.getStats();
      // For now, just check if any documents exist - could be enhanced
      return stats.count > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate raw documents before processing
   */
  private validateRawDocuments(rawDocuments: RawDocument[]): string[] {
    const errors: string[] = [];
    
    for (let i = 0; i < rawDocuments.length; i++) {
      const doc = rawDocuments[i];
      
      if (!doc?.title) {
        errors.push(`Document ${i}: Missing title`);
      }
      
      if (!doc?.content) {
        errors.push(`Document ${i}: Missing content`);
      }
      
      if (!doc?.source) {
        errors.push(`Document ${i}: Missing source`);
      }
      
      if (!doc?.type || !['textbook', 'qa_pair', 'regulation'].includes(doc.type)) {
        errors.push(`Document ${i}: Invalid or missing type`);
      }
      
      if (doc?.content && doc.content.length < 10) {
        errors.push(`Document ${i}: Content too short`);
      }
    }
    
    return errors;
  }

  /**
   * Get pipeline configuration
   */
  getConfig(): Required<IngestionConfig> {
    return { ...this.config };
  }

  /**
   * Create sample data directory structure
   */
  async createSampleDataStructure(baseDir: string = './data'): Promise<void> {
    const directories = [
      path.join(baseDir, 'textbooks'),
      path.join(baseDir, 'qa_pairs'),
      path.join(baseDir, 'regulations')
    ];

    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Create sample files
    const sampleTextbook = `# Securities Fundamentals

## Chapter 1: Introduction to Securities

Securities are financial instruments that represent an ownership position in a publicly-traded corporation (stock), a creditor relationship with a governmental body or a corporation (bond), or rights to ownership as represented by an option.

### Types of Securities

1. **Equity Securities**: Represent ownership in a company
2. **Debt Securities**: Represent borrowed money that must be repaid
3. **Derivative Securities**: Derive their value from underlying assets

## Chapter 2: Market Structure

The securities market is divided into primary and secondary markets. The primary market is where new securities are issued, while the secondary market is where existing securities are traded.`;

    const sampleQA = `Question: What is the primary difference between stocks and bonds?

Answer: Stocks represent ownership in a company (equity), while bonds represent a loan to a company or government (debt). Stock holders have voting rights and potential for unlimited gains, while bond holders receive fixed interest payments and have priority in case of bankruptcy.

Question: What is a derivative security?

Answer: A derivative security is a financial instrument whose value is derived from the value of an underlying asset, such as stocks, bonds, commodities, or market indices. Examples include options, futures, and swaps.`;

    const sampleRegulation = `SEC Rule 10b-5: Employment of Manipulative and Deceptive Practices

It shall be unlawful for any person, directly or indirectly, by the use of any means or instrumentality of interstate commerce, or of the mails or of any facility of any national securities exchange:

(a) To employ any device, scheme, or artifice to defraud,
(b) To make any untrue statement of a material fact or to omit to state a material fact necessary in order to make the statements made, in the light of the circumstances under which they were made, not misleading, or
(c) To engage in any act, practice, or course of business which operates or would operate as a fraud or deceit upon any person, in connection with the purchase or sale of any security.`;

    await fs.writeFile(path.join(baseDir, 'textbooks', 'securities_fundamentals.txt'), sampleTextbook);
    await fs.writeFile(path.join(baseDir, 'qa_pairs', 'basic_concepts.txt'), sampleQA);
    await fs.writeFile(path.join(baseDir, 'regulations', 'rule_10b5.txt'), sampleRegulation);

    console.log(`Sample data structure created at ${baseDir}`);
  }
}