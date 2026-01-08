const geminiClient = require('./geminiClient');
const ragRetriever = require('./ragRetriever');
const { generateMockQuiz } = require('../utils/mockGenerator'); // <--- 1. IMPORT MOCK

// Helper to simulate network latency
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate quiz questions
 * @param {string} topic
 * @param {string} course
 * @param {number} count
 */
async function generateQuestions(topic, course, count) {
  // Validate inputs
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error('INVALID_COUNT');
  }
  if (!['IFIC', 'CSC', 'CAPM', 'PMP'].includes(course)) {
    throw new Error('INVALID_COURSE');
  }
  if (!topic || topic.length < 2 || topic.length > 100) {
    throw new Error('INVALID_TOPIC');
  }

  // --- 2. MOCK MODE SWITCH ---
  if (process.env.MOCK_MODE === 'true') {
    console.log(`⚠️ MOCK MODE: Generating fake quiz for ${course} - ${topic}`);
    
    // Simulate API delay (so you can test your loading spinner)
    await wait(1500);

    // Get the fake data
    const mockData = generateMockQuiz(course, topic);

    // Return exact same shape as real API
    return {
      questions: mockData.questions, 
      metadata: {
        ...mockData.metadata,
        requestedCount: count
      }
    };
  }
  // ---------------------------

  // Retrieve RAG context
  const { context, metadata } = await ragRetriever.getContext(topic, course);

  const contextBlock = context && context.trim().length > 0
    ? context
    : 'No textbook context found. Use general exam knowledge.';

  // STRICT prompt (JSON-safe)
  const prompt = `
You are a backend API that outputs STRICT JSON only.

RULES (MUST FOLLOW EXACTLY):
- Output must be VALID JSON
- Use DOUBLE QUOTES only
- NO markdown
- NO comments
- NO trailing commas
- NO newlines inside strings
- Each string must be ONE LINE ONLY
- If you cannot comply, output: {"error":"FORMAT_ERROR"}

SCHEMA:
{
  "questions": [
    {
      "question": "single line string",
      "options": ["string","string","string","string"],
      "correctAnswer": number,
      "explanation": "single line string"
    }
  ]
}

TASK:
Generate exactly ${count} questions.

COURSE: ${course}
TOPIC: ${topic}

CONTEXT:
${contextBlock}
`;

  // Call Gemini
  const raw = await geminiClient.generateContent(prompt, {
    temperature: 0.4,
    maxOutputTokens: 1500
  });

  // Clean + parse safely
  const cleaned = cleanJsonResponse(raw);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error('❌ Gemini raw output:\n', raw);
    console.error('❌ Cleaned output:\n', cleaned);
    throw new Error('MALFORMED_RESPONSE');
  }

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error('MALFORMED_RESPONSE');
  }

  return {
    questions: parsed.questions,
    metadata: {
      ...metadata,
      questionsGenerated: parsed.questions.length
    }
  };
}

/**
 * Clean AI JSON output
 */
function cleanJsonResponse(text) {
  let cleaned = text;

  // Remove markdown wrappers
  cleaned = cleaned.replace(/```json/gi, '');
  cleaned = cleaned.replace(/```/g, '');

  cleaned = cleaned.trim();

  // Extract JSON body
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('MALFORMED_RESPONSE');
  }

  cleaned = cleaned.substring(firstBrace, lastBrace + 1);

  // Remove trailing commas
  cleaned = cleaned.replace(/,\s*}/g, '}');
  cleaned = cleaned.replace(/,\s*]/g, ']');

  return cleaned;
}

module.exports = {
  generateQuestions
};