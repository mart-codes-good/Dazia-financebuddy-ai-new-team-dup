const geminiClient = require('./geminiClient');
const ragRetriever = require('./ragRetriever');

/**
 * Generate a concise summary for a topic using textbook context
 */
async function summarize(topic, course, length = 'short') {
  // Validation
  if (!topic || topic.length < 2 || topic.length > 200) {
    throw new Error('INVALID_TOPIC');
  }
  if (!['IFIC', 'CSC', 'LLQP'].includes(course)) {
    throw new Error('INVALID_COURSE');
  }
  if (!['short', 'medium'].includes(length)) {
    throw new Error('INVALID_LENGTH');
  }

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
