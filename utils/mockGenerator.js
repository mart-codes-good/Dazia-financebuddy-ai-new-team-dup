// utils/mockGenerator.js (CommonJS)

// 1. MOCK QUIZ
const generateMockQuiz = (course, topic) => {
  return {
    questions: [
      {
        question: `[DEV MODE] Which of the following best defines ${topic} in the context of ${course}?`,
        options: [
          "A. It is a simulated risk-free asset.",
          "B. It is the core concept of this course.", 
          "C. It is strictly prohibited by law.",
          "D. It generates infinite returns."
        ],
        correctAnswer: 1, 
        explanation: `[DEV EXPLANATION] Option B is correct. We are in mock mode, so this is a generated valid answer for ${topic}.`
      },
      {
        question: `[DEV MODE] True or False: ${topic} is affected by market volatility?`,
        options: ["True", "False"],
        correctAnswer: 0,
        explanation: `[DEV EXPLANATION] True. In this simulation, we assume standard market conditions.`
      }
    ],
    metadata: { questionsGenerated: 2, source: "MOCK_MODE_ACTIVE" }
  };
};

// 2. MOCK SUMMARY
const generateMockSummary = (course, topic) => {
  return {
    summary: `
[DEV MODE] Summary for ${course}: ${topic}

**1. Definition**
This is a simulated explanation of **${topic}**. Since MOCK_MODE is enabled, we are not using real tokens.

**2. Key Exam Concept**
In a real exam context, you should focus on the regulatory implications of ${topic}.

**3. Example Scenario**
Imagine a client asks about ${topic}. A financial advisor would typically explain the risks involved.
    `.trim(),
    metadata: {
      source: "MOCK_MODE_ACTIVE",
      tokensUsed: 0
    }
  };
};

// 3. MOCK CHATBOT
const generateMockChatResponse = (question) => {
  return {
    answer: `[DEV MODE] I received your question: "${question}". Since I am in simulation mode, I cannot access the real textbook, but this is where a valid answer would appear.`,
    sources: ["Mock Textbook Data"], // Matches your frontend expectation
    metadata: {
      source: "MOCK_MODE_ACTIVE",
      tokensUsed: 0
    }
  };
};

// Export BOTH functions
module.exports = {
  generateMockQuiz,
  generateMockSummary,
  generateMockChatResponse
};