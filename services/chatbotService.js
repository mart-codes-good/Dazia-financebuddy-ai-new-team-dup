const geminiClient = require('./geminiClient');
const ragRetriever = require('./ragRetriever');

async function askQuestion(question, course) {
  // 1. Validation
  if (!question || question.length < 5 || question.length > 500) {
    throw new Error('INVALID_QUESTION');
  }

  if (!['IFIC', 'CSC', 'LLQP'].includes(course)) {
    throw new Error('INVALID_COURSE');
  }

  // 2. Retrieve textbook context (RAG)
  const { context, metadata } = await ragRetriever.getContext(question, course);

  // 3. Fallback if no context found
  const contextBlock =
    context && context.trim().length > 0
      ? context
      : 'No specific textbook context found. Answer using general Canadian finance principles.';

  // 4. Build study-mode prompt
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

  // 5. Generate answer (correct function name)
  const answer = await geminiClient.generateContent(prompt, {
    temperature: 0.3,
    maxOutputTokens: 800
  });

  // 6. Return result
  return {
    answer,
    sources: context && context.trim().length > 0 ? ['IFIC Textbook'] : [],
    metadata
  };
}

module.exports = { askQuestion };
