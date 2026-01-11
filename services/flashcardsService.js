// services/flashcardsService.js
const geminiClient = require('./geminiClient');
const ragRetriever = require('./ragRetriever');
const { generateMockFlashcards } = require('../utils/mockGenerator');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate flashcards for a topic
 * @param {string} topic
 * @param {string} course
 * @param {number} count
 */
async function generateFlashcards(topic, course, count = 10) {
  // Validation
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error('INVALID_COUNT');
  }
  if (!['IFIC', 'CSC_VOL_1', 'CSC_VOL_2'].includes(course)) {
    throw new Error('INVALID_COURSE');
  }
  if (!topic || topic.length < 2 || topic.length > 100) {
    throw new Error('INVALID_TOPIC');
  }

  // Mock mode
  if (process.env.MOCK_MODE === 'true') {
    console.log(`⚠️ MOCK MODE: Generating fake flashcards for ${course} - ${topic}`);
    await wait(1500);
    return generateMockFlashcards(course, topic, count);
  }

  // Retrieve RAG context
  const { context, metadata } = await ragRetriever.getContext(topic, course);

  const contextBlock = context && context.trim().length > 0
    ? context
    : 'No textbook context found. Use general exam knowledge.';

  // Prompt
  const prompt = `
You are a backend API that outputs STRICT JSON only.

RULES:
- Output must be VALID JSON
- Use DOUBLE QUOTES only
- NO markdown, NO comments, NO trailing commas
- Each string must be ONE LINE ONLY

SCHEMA:
{
  "cards": [
    {
      "front": "question string",
      "back": "answer string",
      "explanation": "optional explanation"
    }
  ]
}

TASK:
Generate exactly ${count} flashcards.

COURSE: ${course}
TOPIC: ${topic}

CONTEXT:
${contextBlock}

Make flashcards clear, concise, and exam-focused.
`;

  const raw = await geminiClient.generateContent(prompt, {
    temperature: 0.4,
    maxOutputTokens: 2000
  });

  // Clean and parse
  const cleaned = cleanJsonResponse(raw);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error('❌ Gemini raw output:\n', raw);
    throw new Error('MALFORMED_RESPONSE');
  }

  if (!parsed.cards || !Array.isArray(parsed.cards)) {
    throw new Error('MALFORMED_RESPONSE');
  }

  return {
    cards: parsed.cards,
    metadata: {
      ...metadata,
      cardsGenerated: parsed.cards.length
    }
  };
}

function cleanJsonResponse(text) {
  let cleaned = text;
  cleaned = cleaned.replace(/```json/gi, '');
  cleaned = cleaned.replace(/```/g, '');
  cleaned = cleaned.trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('MALFORMED_RESPONSE');
  }

  cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  cleaned = cleaned.replace(/,\s*}/g, '}');
  cleaned = cleaned.replace(/,\s*]/g, ']');

  return cleaned;
}

module.exports = { generateFlashcards };