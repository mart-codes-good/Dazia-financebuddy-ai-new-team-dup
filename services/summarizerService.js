const geminiClient = require('./geminiClient');
const ragRetriever = require('./ragRetriever');
const { generateMockSummary } = require('../utils/mockGenerator'); // <--- 1. IMPORT MOCK

// Helper to simulate network latency
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate a concise summary for a topic using textbook context
 */
async function summarize(topic, course, length = 'short') {
  // Validation
  if (!topic || topic.length < 2 || topic.length > 200) {
    throw new Error('INVALID_TOPIC');
  }
  if (!['IFIC', 'CSC_VOL_1', 'CSC_VOL_2'].includes(course)) {
    throw new Error('INVALID_COURSE');
  }
  if (!['short', 'medium'].includes(length)) {
    throw new Error('INVALID_LENGTH');
  }

  // --- 2. MOCK MODE SWITCH ---
  if (process.env.MOCK_MODE === 'true') {
    console.log(`⚠️ MOCK MODE: Summarizing ${topic} (${course})`);
    
    // Simulate delay
    await wait(1500);

    // Get fake data
    const mockData = generateMockSummary(course, topic);

    // Return exact same shape as real API
    return {
      summary: mockData.summary,
      metadata: {
        ...mockData.metadata,
        length // Pass through the length param for consistency
      }
    };
  }
  // ---------------------------

  // Retrieve RAG context
  const { context, metadata } = await ragRetriever.getContext(topic, course);

  const contextBlock = context && context.trim().length > 0
    ? context
    : 'No textbook context found. Provide a general exam-appropriate summary.';

  // Control verbosity
  const lengthInstruction =
    length === 'short'
      ? 'Provide a short, high-level summary in 5 bullet points.'
      : 'Provide a more detailed explanation with headings and examples.';

  const prompt = `
You are an AI tutor for Canadian financial certification exams.

RULES:
- Be accurate and exam-relevant
- Do NOT invent facts
- Prefer textbook context when available
- Use clear, student-friendly language

TASK:
Summarize the following topic.

COURSE: ${course}
TOPIC: ${topic}

INSTRUCTIONS:
${lengthInstruction}

TEXTBOOK CONTEXT:
${contextBlock}
`;

  const summary = await geminiClient.generateContent(prompt, {
    temperature: 0.3,
    maxOutputTokens: length === 'short' ? 600 : 1000
  });

  return {
    summary,
    metadata: {
      ...metadata,
      length
    }
  };
}

module.exports = { summarize };