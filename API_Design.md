# API_DESIGN.md

**FinanceBuddy Backend API Specification**  
**Version:** 1.0 (Week 4)  
**Date:** December 14th 2025  
**Status:** Implementation Ready

---

## Overview

This document defines the REST API for FinanceBuddy, an AI-powered exam preparation platform for Canadian financial certifications (IFIC, CSC, LLQP). The API wraps existing RAG and Gemini 2.5 Flash logic into production-ready Express endpoints.

**Design Principles:**
- Consistent response envelope across all endpoints
- Reuse existing CLI logic (don't rewrite)
- Support multiple courses from day one
- Production-grade error handling

---

## API Response Envelope

All endpoints use a standardized response structure:

### Success Response
```json
{
  "success": true,
  "data": {
    "result": "Endpoint-specific payload"
  },
  "meta": {
    "course": "IFIC",
    "timestamp": "2024-12-10T15:30:00.000Z"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Optional debugging information"
  }
}
```

---

## Endpoints

### 1. Health Check

**Endpoint:** `GET /health`

**Purpose:** Server status verification for monitoring and deployment health checks.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2024-12-10T15:30:00.000Z",
    "services": {
      "chromadb": "connected",
      "gemini": "available"
    }
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "ChromaDB connection failed",
    "details": "Connection refused at localhost:8000"
  }
}
```

---

### 2. Generate Quiz Questions

**Endpoint:** `POST /api/questions/generate`

**Purpose:** Generate multiple-choice quiz questions using RAG context and Gemini 2.5 Flash.

**Request Body:**
```json
{
  "course": "IFIC",
  "topic": "Mutual Funds",
  "count": 5
}
```

**Field Validation:**
- `course`: Required. String. One of: `["IFIC", "CSC", "LLQP"]`
- `topic`: Required. String. 2-100 characters.
- `count`: Required. Integer. Range: 1-20.

**Success Response:**
```json
{
  "success": true,
  "data": {
    "questions": [
      {
        "question": "What is a key characteristic of a mutual fund?",
        "options": [
          "It pools money from many investors",
          "It guarantees returns",
          "It is risk-free",
          "It requires a minimum investment of $1M"
        ],
        "correctAnswer": 0,
        "explanation": "Mutual funds pool capital from multiple investors to invest in a diversified portfolio of securities. They do not guarantee returns and carry varying levels of risk."
      },
      {
        "question": "What does NAV stand for in mutual funds?",
        "options": [
          "Net Asset Value",
          "New Asset Verification",
          "National Average Volume",
          "None of the above"
        ],
        "correctAnswer": 0,
        "explanation": "NAV (Net Asset Value) represents the per-share value of a mutual fund, calculated by dividing total assets minus liabilities by the number of outstanding shares."
      }
    ]
  },
  "meta": {
    "course": "IFIC",
    "topic": "Mutual Funds",
    "count": 5,
    "contextUsed": true,
    "contextLength": 2450
  }
}
```

**Error Responses:**

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `INVALID_COURSE` | 400 | Course not supported |
| `INVALID_TOPIC` | 400 | Topic is empty or too long |
| `INVALID_COUNT` | 400 | Count out of range (1-20) |
| `CHROMADB_DOWN` | 503 | Cannot connect to ChromaDB |
| `GEMINI_TIMEOUT` | 504 | Gemini API request timed out |
| `GEMINI_RATE_LIMIT` | 429 | Rate limit exceeded (15 req/min) |
| `MALFORMED_RESPONSE` | 500 | Gemini returned invalid JSON |

**Example Error:**
```json
{
  "success": false,
  "error": {
    "code": "CHROMADB_DOWN",
    "message": "Failed to retrieve context from vector database",
    "details": "ECONNREFUSED: Connection refused at http://localhost:8000"
  }
}
```

---

### 3. Chatbot (Study Mode)

**Endpoint:** `POST /api/chatbot/ask`

**Purpose:** Answer student questions using RAG-powered contextual responses with conversation history support.

**Request Body:**
```json
{
  "course": "IFIC",
  "message": "What is the difference between RRSP and TFSA?",
  "history": [
    {
      "role": "user",
      "content": "Explain RRSPs"
    },
    {
      "role": "assistant",
      "content": "RRSPs (Registered Retirement Savings Plans) are tax-deferred savings accounts..."
    }
  ]
}
```

**Field Validation:**
- `course`: Required. String. One of: `["IFIC", "CSC", "LLQP"]`
- `message`: Required. String. 5-500 characters.
- `history`: Optional. Array. Max 20 turns. Each turn has `role` and `content`.

**Success Response:**
```json
{
  "success": true,
  "data": {
    "answer": "The main difference between an RRSP and a TFSA is tax treatment. RRSPs offer tax-deductible contributions and tax-deferred growth, but withdrawals are taxed as income. TFSAs have no tax deduction on contributions, but all growth and withdrawals are tax-free. Additionally, RRSPs have contribution limits based on income, while TFSAs have fixed annual limits.",
    "sources": [
      "IFIC Chapter 6: Tax-Advantaged Accounts",
      "IFIC Chapter 4: Registered Plans"
    ]
  },
  "meta": {
    "course": "IFIC",
    "contextUsed": true,
    "conversationLength": 2
  }
}
```

**Error Responses:**

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `INVALID_MESSAGE` | 400 | Message too short/long |
| `INVALID_HISTORY` | 400 | History format invalid or too long |
| `CONTEXT_OVERFLOW` | 413 | Conversation + context exceeds token limit |
| `CHROMADB_DOWN` | 503 | Cannot retrieve context |
| `GEMINI_TIMEOUT` | 504 | Response generation timed out |

---

### 4. Track Usage (Freemium)

**Endpoint:** `POST /api/track-usage`

**Status:** 🚧 **Design Only (Week 5 Implementation)**

**Purpose:** Track user interactions for freemium limits (e.g., 20 free quiz generations).

**Planned Request:**
```json
{
  "userId": "user_12345",
  "action": "quiz_generated",
  "metadata": {
    "course": "IFIC",
    "questionCount": 5
  }
}
```

**Planned Response:**
```json
{
  "success": true,
  "data": {
    "remaining": 15,
    "limit": 20,
    "resetDate": "2024-12-17T00:00:00Z"
  }
}
```

**Note:** This endpoint is documented for completeness but will NOT be implemented in Week 4. Implementation deferred to Week 5 (freemium + WooCommerce integration).

---

## Implementation Architecture

### Service Layer Extraction

Existing CLI logic should be refactored into reusable services:

**File Structure:**
```
/services
  ├── questionGenerator.js    # Quiz generation logic
  ├── ragRetriever.js          # ChromaDB context retrieval
  └── geminiClient.js          # Gemini API wrapper
```

**Responsibilities:**

#### `services/questionGenerator.js`
- Extract quiz generation logic from `FinanceBuddy.js`
- Function: `generateQuestions(topic, course, count, context)`
- Returns: Array of question objects
- Handles: JSON parsing, validation, retries

#### `services/ragRetriever.js`
- Extract context retrieval from `retrieve-context.js`
- Function: `getContext(topic, course, maxChunks)`
- Returns: Concatenated text context + metadata
- Handles: Embedding generation, similarity search

#### `services/geminiClient.js`
- Singleton wrapper for Gemini 2.5 Flash API
- Functions:
  - `generateQuiz(prompt, context)`
  - `answerQuestion(question, context, history)`
- Handles: Rate limiting, timeouts, API errors

---

### ChromaDB Connection Strategy

**Recommendation: Singleton Pattern**
```javascript
const { ChromaClient } = require('chromadb');

let client = null;

async function getChromaClient() {
  if (!client) {
    client = new ChromaClient({
      path: process.env.CHROMA_URL || 'http://localhost:8000'
    });
  }
  return client;
}

module.exports = { getChromaClient };
```

**Rationale:**
- ChromaDB client can be reused across requests
- Avoids connection overhead per request
- Handles reconnection automatically
- Matches existing `retrieve-context.js` pattern

**Connection Health Check:**
- `/health` endpoint should verify ChromaDB connection
- Return degraded status if ChromaDB unavailable
- Log connection errors but don't crash server

---

### Rate Limiting Considerations

**Gemini 2.5 Flash Free Tier Limits:**
- **15 requests per minute**
- 1,500 requests per day
- 4 million tokens per day

**Mitigation Strategies:**

1. **Client-Side Rate Limiting (Week 4):**
   - Return `429 GEMINI_RATE_LIMIT` error when hit
   - Include `Retry-After` header
   - Don't implement server-side queuing yet (premature)

2. **Future Considerations (Week 6+):**
   - Request queuing with exponential backoff
   - Caching frequent quiz topics
   - Batch question generation

**Week 4 Approach:**
- Detect rate limit errors from Gemini API
- Return graceful error to frontend
- Let frontend handle retry logic

---

### Error Handling Strategy

**Error Hierarchy:**
```
ValidationError (400)
  ├── INVALID_COURSE
  ├── INVALID_TOPIC
  ├── INVALID_COUNT
  └── INVALID_MESSAGE

ServiceError (503/504)
  ├── CHROMADB_DOWN
  ├── GEMINI_TIMEOUT
  └── GEMINI_RATE_LIMIT

ProcessingError (500)
  ├── MALFORMED_RESPONSE
  └── INTERNAL_ERROR
```

**Implementation Pattern:**
```javascript
function handleError(err, req, res, next) {
  const errorMap = {
    'ValidationError': { status: 400, code: 'INVALID_INPUT' },
    'ChromaDBError': { status: 503, code: 'CHROMADB_DOWN' },
    'GeminiTimeout': { status: 504, code: 'GEMINI_TIMEOUT' }
  };
  
  const mapped = errorMap[err.name] || { status: 500, code: 'INTERNAL_ERROR' };
  
  res.status(mapped.status).json({
    success: false,
    error: {
      code: mapped.code,
      message: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });
}
```

---

## Environment Variables

Required configuration:
```bash
GEMINI_API_KEY=your-google-gemini-api-key
CHROMA_URL=http://localhost:8000
NODE_ENV=development
PORT=3000

# Optional (with defaults)
CHUNK_SIZE=800
CHUNK_OVERLAP=150
MAX_QUESTIONS_PER_REQUEST=20
GEMINI_TIMEOUT_MS=30000
```

**Security Notes:**
- `GEMINI_API_KEY` must NEVER be committed to git
- Use `.env.example` template for team sharing
- Production should use environment-specific secrets

---

## Testing Checklist

Before marking Week 4 complete, verify:

- [ ] `/health` returns 200 with ChromaDB status
- [ ] Quiz generation works for valid IFIC topics
- [ ] Quiz generation fails gracefully for invalid course
- [ ] Chatbot returns contextual answers
- [ ] Chatbot handles empty conversation history
- [ ] Rate limit errors return proper 429 response
- [ ] ChromaDB down returns 503 error
- [ ] Malformed Gemini responses are caught
- [ ] All responses use consistent envelope format

**Test Script:**
```bash
# Health check
curl http://localhost:3000/health

# Valid quiz generation
curl -X POST http://localhost:3000/api/questions/generate \
  -H "Content-Type: application/json" \
  -d '{"course":"IFIC","topic":"TFSA","count":5}'

# Invalid course
curl -X POST http://localhost:3000/api/questions/generate \
  -H "Content-Type: application/json" \
  -d '{"course":"INVALID","topic":"TFSA","count":5}'

# Chatbot
curl -X POST http://localhost:3000/api/chatbot/ask \
  -H "Content-Type: application/json" \
  -d '{"course":"IFIC","message":"What is a TFSA?","history":[]}'
```

---

## Future Enhancements (Post-Week 4)

**Not Implemented Yet:**
- User authentication (Week 6)
- Freemium enforcement (Week 5)
- Request queuing for rate limits
- Response caching
- Multi-course support (CSC, LLQP textbooks - Week 5)
- Analytics/logging infrastructure

---

## Summary

This API design provides:
✅ Consistent response format for frontend integration  
✅ Clear service boundaries for code organization  
✅ Production-ready error handling  
✅ Rate limiting awareness  
✅ ChromaDB connection strategy  
✅ Path to freemium integration  

**Next Step:** Implement endpoints following this specification in Hour 2-7.

---

**Document Version:** 1.0  
**Last Updated:** December 14th 2025  
**Author:** Kapil Iyer (FinanceBuddy Lead Developer)
