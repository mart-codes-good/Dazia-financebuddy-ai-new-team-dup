require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = 'gemini-2.5-flash';
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 30000;

/**
 * Wraps a promise with a timeout to prevent hanging requests.
 * If the wrapped promise does not resolve within `ms` milliseconds,
 * it rejects with a GEMINI_TIMEOUT error.
 *
 * This protects the server from indefinite hangs if the Gemini API stalls.
 */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), ms)
    )
  ]);
}

/**
 * Send a single prompt to Gemini
 */
async function generateContent(prompt, options = {}) {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const generationConfig = {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens ?? 1500
    };
    
    // Protect Gemini calls with a timeout so the server never hangs
    // If Gemini does not respond within TIMEOUT_MS, we throw GEMINI_TIMEOUT
    const result = await Promise.race([
      model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), TIMEOUT_MS)
      )
    ]);

    const text = result.response?.text();
    if (!text || !text.trim()) {
      throw new Error('EMPTY_RESPONSE');
    }

    return text;
  } catch (err) {
    if (err.message === 'GEMINI_TIMEOUT') {
      throw new Error('GEMINI_TIMEOUT');
    }
    if (err.message.toLowerCase().includes('quota')) {
      throw new Error('GEMINI_RATE_LIMIT');
    }
    throw err;
  }
}

/**
 * Gemini with conversation history (chatbot)
 */
async function generateWithHistory(message, history = [], context = '') {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const contents = [];

  if (context) {
    contents.push({
      role: 'user',
      parts: [{ text: `Textbook context:\n${context}` }]
    });
    contents.push({
      role: 'model',
      parts: [{ text: 'Understood. I will answer using this context.' }]
    });
  }

  history.forEach(turn => {
    contents.push({
      role: turn.role,
      parts: [{ text: turn.content }]
    });
  });

  contents.push({
    role: 'user',
    parts: [{ text: message }]
  });

  /**
 * Gemini with conversation history (chatbot)
 * Includes timeout protection to prevent hanging requests
 */
async function generateWithHistory(message, history = [], context = '') {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const contents = [];

    if (context) {
      contents.push({
        role: 'user',
        parts: [{ text: `Textbook context:\n${context}` }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'Understood. I will answer using this context.' }]
      });
    }

    history.forEach(turn => {
      contents.push({
        role: turn.role,
        parts: [{ text: turn.content }]
      });
    });

    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    // Timeout protection (same pattern as generateContent)
    const result = await Promise.race([
      model.generateContent({ contents }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), TIMEOUT_MS)
      )
    ]);

    const text = result.response?.text();
    if (!text || !text.trim()) {
      throw new Error('EMPTY_RESPONSE');
    }

    return text;

  } catch (err) {
    if (err.message === 'GEMINI_TIMEOUT') {
      throw new Error('GEMINI_TIMEOUT');
    }
    if (err.message.toLowerCase().includes('quota')) {
      throw new Error('GEMINI_RATE_LIMIT');
    }
    throw err;
  }
}
}

/**
 * Health check
 */
async function checkHealth() {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'ping' }] }]
    });
    return { available: true };
  } catch (err) {
    return { available: false, error: err.message };
  }
}

module.exports = {
  generateContent,
  generateWithHistory,
  checkHealth
};
