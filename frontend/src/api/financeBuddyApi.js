// frontend/src/api/financeBuddyApi.js

/**
 * FinanceBuddy API Bridge
 * Centralized logic for talking to the backend.
 */

// ✅ CORRECT PORT: 3000 (Node/Express), NOT 8000.
const BASE_URL = "http://localhost:3000";

/**
 * Unified response handler
 * - Parses JSON exactly once
 * - Handles 402 (usage limit reached)
 * - Preserves existing error behavior
 */
async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));

  // Usage limit reached
  if (response.status === 402) {
    const error = new Error(data.error?.message || "Usage limit reached");
    error.status = 402;
    error.code = "USAGE_LIMIT_REACHED";
    error.usage = data.error?.usage || null;
    throw error;
  }

  // Other errors
  if (!response.ok) {
    throw new Error(data.error?.message || `HTTP Error: ${response.status}`);
  }

  return data;
}

// 1. Health Check
export async function getHealth() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    return handleResponse(res);
  } catch {
    throw new Error("Cannot connect to Backend. Is it running on port 3000?");
  }
}

// 2. Topic Discovery (free endpoint)
export async function getTopics(course = "IFIC") {
  const res = await fetch(`${BASE_URL}/api/topics?course=${course}`);
  return handleResponse(res);
}

// 3. Quiz Generator
export async function generateQuiz(course, topic, count) {
  const res = await fetch(`${BASE_URL}/api/questions/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": "demo_user",
    },
    body: JSON.stringify({ course, topic, count }),
  });
  return handleResponse(res);
}

// 4. Chatbot
export async function askChatbot(course, question) {
  const res = await fetch(`${BASE_URL}/api/chatbot/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": "demo_user",
    },
    body: JSON.stringify({ course, question }),
  });
  return handleResponse(res);
}

// 5. Content Summarizer
export async function generateSummary(course, topic) {
  const res = await fetch(`${BASE_URL}/api/summarize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": "demo_user",
    },
    body: JSON.stringify({ course, topic }),
  });
  return handleResponse(res);
}

// 6. Flashcards Generator
export async function generateFlashcards(course, topic, count = 10) {
  const res = await fetch(`${BASE_URL}/api/flashcards/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": "demo_user",
    },
    body: JSON.stringify({ course, topic, count }),
  });
  return handleResponse(res);
}