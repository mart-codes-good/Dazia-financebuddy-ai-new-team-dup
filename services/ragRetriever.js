require('dotenv').config();
const { ChromaClient } = require('chromadb');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Singleton instances
let chromaClient = null;
let collection = null;

const COLLECTION_NAME = 'finance_textbooks';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Initialize ChromaDB once
 */
async function initChromaDB() {
  if (!chromaClient) {
    chromaClient = new ChromaClient({
      path: process.env.CHROMA_URL || 'http://localhost:8000'
    });

    collection = await chromaClient.getOrCreateCollection({
      name: COLLECTION_NAME
    });

    console.log('✅ ChromaDB initialized');
  }
}

/**
 * Retrieve relevant textbook context
 */
async function getContext(topic, course = 'IFIC', maxChunks = 5) {
  try {
    if (!collection) {
      await initChromaDB();
    }

    const embeddingModel = genAI.getGenerativeModel({
      model: 'text-embedding-004'
    });

    const embeddingResult = await embeddingModel.embedContent(topic);
    const queryEmbedding = embeddingResult.embedding.values;

    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: maxChunks
    });

    const relevantChunks = [];
    const threshold = 0.5;

    if (results.distances?.[0] && results.documents?.[0]) {
      results.distances[0].forEach((distance, index) => {
        const similarity = 1 - distance;
        if (similarity > threshold) {
          relevantChunks.push(results.documents[0][index]);
        }
      });
    }

    const context = relevantChunks.join('\n\n---\n\n');

    return {
      context,
      metadata: {
        topic,
        course,
        chunksRetrieved: relevantChunks.length,
        contextLength: context.length
      }
    };
  } catch (err) {
    console.warn('⚠️ ChromaDB unavailable, continuing without context');

    return {
      context: '',
      metadata: {
        topic,
        course,
        chunksRetrieved: 0,
        contextLength: 0,
        warning: 'CHROMA_UNAVAILABLE'
      }
    };
  }
}

/**
 * Health check
 */
async function checkHealth() {
  try {
    if (!chromaClient) {
      await initChromaDB();
    }
    await chromaClient.heartbeat();
    return { connected: true };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

module.exports = {
  initChromaDB,
  getContext,
  checkHealth
};
