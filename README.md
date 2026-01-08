# 📘 FinanceBuddy AI Tutor (Dazia Project)

🔗 **GitHub Repository:** https://github.com/Kapil-Iyer/Dazia-financebuddy-ai

**FinanceBuddy is an AI-powered study assistant that transforms IFIC/CSC/PMP/CAPM textbooks into personalized finance quizzes.**

It uses a Retrieval-Augmented Generation (RAG) pipeline with Google Gemini 2.5 Flash + ChromaDB to generate accurate, context-aware questions tailored to specific course materials. Designed for Dazia Consulting to power a freemium exam-prep platform.

---

## 🔧 Tech Stack

- **Node.js + JavaScript** – Backend logic & API services
- **Google Gemini 2.5 Flash** – Quiz generation, embeddings, study mode
- **ChromaDB** – Vector database for Retrieval-Augmented Generation (RAG)
- **Express.js** – Production REST API for quiz delivery and chatbot
- **Docker** – Local vector DB deployment

---

## 🤝 Credits & Attribution

This project is developed in collaboration with **Dazia Consulting**.

**Core starter architecture of RAG pipeline:**
* Built by **Sulaiman (Dazia Consulting)** – Check him out at https://github.com/SulaimanS11

**Backend engineering, integration, expansion for IFIC/CSC/PMP/CAPM:**
* **Kapil Iyer**

*Kapil's role includes:*
- Integrating Gemini into the RAG flow
- Processing IFIC PDF textbooks
- Designing backend API endpoints for WordPress embedding
- Building modular service layer (ragRetriever, geminiClient, questionGenerator, chatbotService)
- Implementing quiz generator and chatbot HTTP endpoints
- Testing, debugging & refining the system
- Preparing production API architecture for deployment at dazia.ca

---

## 🚀 Project Features

### 1. RAG-Powered Quiz Generation
- Upload IFIC / CSC / PMP/ CAPM textbooks
- PDFs are split into chunks (1704 IFIC chunks currently indexed)
- ChromaDB stores vector embeddings
- Gemini generates context-aware quiz questions
- Exposed via HTTP API endpoint

### 2. Study Mode (Chatbot API)
- Ask conceptual finance questions (e.g., "What is a TFSA?")
- Answers are grounded in IFIC textbook content using RAG
- Exposed via HTTP endpoint: `POST /api/chatbot/ask`
- Tested and working with single-turn questions
- Returns clear explanations with source attribution

### 3. Realistic Quiz Mode
- Multiple-choice questions (MCQ) format
- 1–20 questions per quiz
- Automatic answer validation
- Detailed explanations for each question

---

## 🌐 Backend API (Express)

The backend exposes production-ready HTTP endpoints for quiz generation and study-mode explanations.
A REST API allows the frontend or website to request quizzes and explanations over the internet using standard HTTP requests.

### Available Endpoints

**Health Check**
- `GET /health` – Verify ChromaDB and Gemini availability
- Returns service status and connectivity info

**Quiz Generator**
- `POST /api/questions/generate` – Generate 1-20 exam-style MCQ questions
- Uses RAG to retrieve IFIC textbook context
- Returns structured JSON with questions, options, explanations

**Study-Mode Chatbot**
- `POST /api/chatbot/ask` – Ask conceptual questions about IFIC topics
- Powered by textbook-grounded RAG + Gemini 2.5 Flash
- Returns clear explanations with source attribution

### Example Usage
```bash
# Health check
curl http://localhost:3000/health

# Generate quiz
curl -X POST http://localhost:3000/api/questions/generate \
  -H "Content-Type: application/json" \
  -d '{"course":"IFIC","topic":"TFSA","count":5}'

# Ask chatbot
curl -X POST http://localhost:3000/api/chatbot/ask \
  -H "Content-Type: application/json" \
  -d '{"course":"IFIC","question":"What is a TFSA?"}'
```
Note: Endpoints were tested using curl and PowerShell (Invoke-RestMethod), which are standard tools for testing REST APIs without a frontend.

All endpoints return structured JSON and are designed for frontend or WordPress integration.

---

## 🧪 API Testing (Week 5 – Verified)

All endpoints were tested locally using **PowerShell Invoke-RestMethod** and `curl`.

**Base URL:** `http://localhost:3000`  
**Auth (MVP):** `x-user-id` header for freemium tracking

---

### Health Check (ChromaDB + Gemini)
```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/health" `
  -Method Get |
  ConvertTo-Json -Depth 5
```
### Topic Discovery
```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/topics?course=IFIC" `
  -Method Get |
  ConvertTo-Json -Depth 5
```
### Study Mode Chatbot
```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/chatbot/ask" `
  -Headers @{ "x-user-id" = "demo_user" } `
  -Method Post `
  -ContentType "application/json" `
  -Body '{
    "course": "IFIC",
    "question": "What is a TFSA?"
  }' |
  ConvertTo-Json -Depth 8
```
### Content Summarizer
```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/summarize" `
  -Headers @{ "x-user-id" = "demo_user" } `
  -Method Post `
  -ContentType "application/json" `
  -Body '{
    "course": "IFIC",
    "topic": "Mutual Funds",
    "length": "short"
  }' |
  ConvertTo-Json -Depth 8
```
### Quiz Generator
- **Similarity Threshold:** Tunable (0.3–0.5 depending on topic specificity)
- (Example: more umbrella topics liike RRSP need lower threshold to retrieve relevant chunks, while specific topics like TFSA can work with 0.5 threshold, and form better specific questions)
```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/questions/generate" `
  -Headers @{ "x-user-id" = "demo_user" } `
  -Method Post `
  -ContentType "application/json" `
  -Body '{
    "course": "IFIC",
    "topic": "TFSA",
    "count": 3
  }' |
  ConvertTo-Json -Depth 10
```
### Manual Usage tracker <= 20 for gemini-rate-limit
```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/track-usage" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"userId":"demo_user_1","action":"quiz"}' |
  ConvertTo-Json -Depth 10
```
### Freemium Enforcement Test when gemini is not rate limited (21st user blocked for free plan)
Goal: The backend blocks expensive AI endpoints after 20 successful uses per user.
```powershell
for ($i = 1; $i -le 21; $i++) {
  Write-Host "Request #$i"

  try {
    $resp = Invoke-RestMethod `
      -Uri "http://localhost:3000/api/chatbot/ask" `
      -Method Post `
      -Headers @{ "x-user-id" = "limit_test_user" } `
      -ContentType "application/json" `
      -Body '{"course":"IFIC","question":"What is a TFSA?"}'

    $resp | ConvertTo-Json -Depth 10
  }
  catch {
    # If blocked, server returns 402 and PowerShell throws — print the response body
    $_.Exception.Response.GetResponseStream() `
      | % { (New-Object System.IO.StreamReader($_)).ReadToEnd() }
  }
}
```
---

## 📟 CLI Tools

> **Note:** The CLI tools (`FinanceBuddy.js`, `retrieve-context.js`) were used for initial experimentation and RAG pipeline development. The system now exposes the same logic via production-ready HTTP API endpoints.

**Available CLI scripts:**
```bash
# Original quiz generator prototype
node FinanceBuddy.js "Topic Name" 10

# Process PDFs into ChromaDB chunks
node process-rag-files.js

# Test RAG retrieval directly
node retrieve-context.js "Search Term"
```

---

## 📂 Project Structure
```
FinanceBuddy/
├── services/
│   ├── ragRetriever.js          # ChromaDB context retrieval
│   ├── geminiClient.js          # Gemini API wrapper
│   ├── questionGenerator.js     # Quiz generation logic
│   └── chatbotService.js        # Study-mode chatbot logic
├── server.js                    # Express API server
├── FinanceBuddy.js             # CLI quiz generator (legacy)
├── process-rag-files.js        # PDF processing script
├── retrieve-context.js         # RAG testing script
├── API_DESIGN.md               # API specification
├── RAG_FILES/                  # Source textbook PDFs
└── .env                        # Environment variables
```

---

## 🛠️ Installation & Setup

### Prerequisites
- **Node.js** (v18+)
- **Docker** (for ChromaDB)
- **Google Gemini API Key**

### 1. Clone Repository
```bash
git clone https://github.com/Kapil-Iyer/Dazia-financebuddy-ai.git
cd Dazia-financebuddy-ai
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file:
```env
GEMINI_API_KEY=your-google-gemini-api-key
CHROMA_URL=http://localhost:8000
PORT=3000
```

### 4. Start ChromaDB (Vector Database)
```bash
docker run -p 8000:8000 chromadb/chroma
```

### 5. Process Textbook PDFs (One-Time Setup)
```bash
node process-rag-files.js
```
This creates 1704 IFIC chunks in ChromaDB.

### 6. Start Backend API Server
```bash
node server.js
```

Server runs on `http://localhost:3000`

### 7. Test Endpoints
```bash
# Health check
curl http://localhost:3000/health

# Generate quiz
curl -X POST http://localhost:3000/api/questions/generate \
  -H "Content-Type: application/json" \
  -d '{"course":"IFIC","topic":"Mutual Funds","count":3}'
```

---

## 🎯 Current Status (Week 5 Complete)

### ✅ Implemented & Tested
- Express.js backend with modular service architecture
- Retrieval-Augmented Generation (RAG) using ChromaDB
- 1704 IFIC textbook chunks indexed
- Quiz Generator API (`POST /api/questions/generate`)
- Study-Mode Chatbot API (`POST /api/chatbot/ask`)
- Topic Discovery API (`GET /api/topics`)
- Content Summarizer API (`POST /api/summarize`)
- Health Check API (`GET /health`)
- Freemium usage tracking (20 free actions per user)
- Automatic usage enforcement middleware
- Graceful fallback when RAG context is unavailable
- PowerShell & curl-based endpoint testing completed

### 🧠 Notes on RAG Behavior
- Narrow, specific topics (e.g., **TFSA**) retrieve strong textbook context
- Broader topics (e.g., **Registered Plans**) may retrieve fewer or no chunks
- When no relevant chunks meet similarity thresholds, the system safely falls back to general exam knowledge
- This behavior is intentional and prevents hallucinations

### 🚧 Planned (Week 6+)
- Frontend / WordPress integration
- RAG similarity fine-tuning
- Multi-turn chatbot memory
- CSC, CAPM & PMP  dataset expansion
---

## 📝 API Documentation

See [API_DESIGN.md](./API_DESIGN.md) for complete endpoint specifications, request/response schemas, and error codes.

---

## 🔐 Security Notes

- Never commit `.env` file to git
- Keep `GEMINI_API_KEY` secure
- Use `.env.example` for team sharing
- Production deployment should use environment-specific secrets

---

## 📊 RAG Pipeline Details

### How It Works
1. **PDF Ingestion:** Textbooks converted to text chunks (800 chars, 150 overlap)
2. **Embedding Generation:** Google Gemini text-embedding-004 creates vectors
3. **Vector Storage:** ChromaDB stores embeddings for semantic search
4. **Context Retrieval:** Similar chunks retrieved based on topic query
5. **Question Generation:** Gemini 2.5 Flash generates quiz/answers from context

### Current Dataset
- **Course:** IFIC (Investment Funds in Canada)
- **Chunks:** 1704 indexed segments
- **Retrieval:** Top 5 most relevant chunks per query
- **Similarity Threshold:** 50% minimum

---

## 🤖 AI Model Configuration

**Gemini 2.5 Flash**
- **Quiz Generation:** Temperature 0.7, Max 1500 tokens
- **Study Mode:** Temperature 0.3, Max 800 tokens
- **Embeddings:** text-embedding-004 model
- **Rate Limits:** 15 req/min, 1500 req/day

---

## 📞 Contact & Support

**Project Lead:** Kapil Iyer  
**Organization:** Dazia Consulting Inc.  
**Platform:** Riipen Experiential Learning  
**Duration:** November 2025 - January 2026

For questions or collaboration: https://github.com/Kapil-Iyer

---

## 📄 License

This project is proprietary to Dazia Consulting Inc.

---

**Last Updated:** December 29, 2025  
**Version:** Week 5 – Backend Complete
