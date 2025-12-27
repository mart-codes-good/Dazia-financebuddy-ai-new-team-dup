require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = 'gemini-2.5-flash';
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 30000;

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

  const result = await model.generateContent({ contents });
  return result.response.text();
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
