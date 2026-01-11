const geminiClient = require('./geminiClient');
const ragRetriever = require('./ragRetriever');
const { generateMockChatResponse } = require('../utils/mockGenerator'); // <--- 1. IMPORT

// Helper to simulate network latency
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function askQuestion(question, course) {
  // 1. Validation
  if (!question || question.length < 1 || question.length > 500) {
    throw new Error('INVALID_QUESTION, must be 1-500 characters long');
  }

  if (!['IFIC', 'CSC_VOL_1', 'CSC_VOL_2'].includes(course)) {
    throw new Error('INVALID_COURSE');
  }

  // --- 2. MOCK MODE SWITCH ---
  if (process.env.MOCK_MODE === 'true') {
    console.log(`⚠️ MOCK MODE: Chatting about "${question}"`);
    
    // Simulate delay for "Thinking..." state
    await wait(1500);

    // Get fake data
    const mockData = generateMockChatResponse(question);

    // Return exact same shape as real API
    return {
      answer: mockData.answer,
      sources: mockData.sources,
      metadata: mockData.metadata
    };
  }
  // ---------------------------

  // 3. Retrieve textbook context (RAG)
  const { context, metadata } = await ragRetriever.getContext(question, course);

  // 4. Fallback if no context found
  const contextBlock =
    context && context.trim().length > 0
      ? context
      : 'No specific textbook context found. Answer using general Canadian finance principles.';

  // 5. Build study-mode prompt
  const prompt = `
You are a study assistant for Canadian financial certification exams.

RULES:
- Answer clearly and concisely
- Explain concepts in plain English
- Do NOT invent facts
- Prefer textbook context when available

COURSE: ${course}
QUESTION: ${question}

TEXTBOOK CONTEXT:
${contextBlock}
`;

  // 6. Generate answer
  const answer = await geminiClient.generateContent(prompt, {
    temperature: 0.3,
    maxOutputTokens: 800
  });

  // 7. Return result
  return {
    answer,
    sources: context && context.trim().length > 0 ? ['${course} Textbook'] : [],
    metadata
  };
}

module.exports = { askQuestion };