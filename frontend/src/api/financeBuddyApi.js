/**
 * FinanceBuddy API Bridge
 * Centralized logic for talking to the backend.
 */
const BASE_URL = "http://localhost:3000";

async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `HTTP Error: ${response.status}`);
  }
  return response.json();
}

// 1. Health Check
export async function getHealth() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    return handleResponse(res);
  } catch (err) {
    throw new Error("Cannot connect to Backend. Is it running on port 3000?");
  }
}

// 2. Topic Discovery
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
      "x-user-id": "demo_user"
    },
    body: JSON.stringify({ course, topic, count })
  });
  return handleResponse(res);
}

// 4. Chatbot
export async function askChatbot(course, question) {
  const res = await fetch(`${BASE_URL}/api/chatbot/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": "demo_user" },
    body: JSON.stringify({ course, question })
  });
  return handleResponse(res);
}

// 5. Content Summarizer
export async function generateSummary(course, topic) {
  const res = await fetch(`${BASE_URL}/api/summarize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": "demo_user"
    },
    body: JSON.stringify({ course, topic })
  });
  return handleResponse(res);
}