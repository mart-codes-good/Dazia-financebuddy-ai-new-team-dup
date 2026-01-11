# 📘 FinanceBuddy AI Tutor (Dazia Project)

🔗 **GitHub Repository:** https://github.com/Kapil-Iyer/Dazia-financebuddy-ai

FinanceBuddy is an AI-powered exam-prep platform for Canadian finance certifications (**IFIC, CSC Vol 1, CSC Vol 2**).

It converts official course textbooks into **interactive quizzes, summaries, flashcards, and an AI tutor** using a **Retrieval-Augmented Generation (RAG)** pipeline powered by **Google Gemini + ChromaDB**.

This project was built as part of a **Riipen × Dazia Consulting** engagement and is designed as a **freemium, production-ready prototype**.

---

## 🚀 Key Features

- 📘 Exam Simulator (MCQs with explanations)
- 🤖 AI Tutor (textbook-grounded answers)
- 📄 Topic Summarizer (cheat sheets)
- 🎴 Flashcards (interactive learning)
- 🔒 Freemium usage limits (per-tool credits)
- 🧠 Persistent vector memory (ChromaDB)
- 🧪 Mock mode for demos & testing
- 🌐 REST API ready for frontend / WordPress

---

## 🔧 Tech Stack

**Backend**
- Node.js + Express
- Google Gemini 2.5 Flash
- ChromaDB (Vector Database)
- Docker (persistent storage)

**Frontend**
- React
- Centralized API layer
- Global usage state management

---

## 🤝 Credits & Attribution

Developed in collaboration with **Dazia Consulting**.

**RAG starter architecture**
- Sulaiman (Dazia Consulting): https://github.com/SulaimanS11

**Backend, RAG expansion & frontend integration**
- Kapil Iyer

---

## 🧠 RAG Pipeline Overview

1. PDFs split into overlapping chunks
2. Gemini embeddings generated
3. ChromaDB stores vectors
4. Semantic retrieval by topic
5. Gemini generates grounded output

**Current dataset**
- IFIC textbook
- ~1700 indexed chunks
- Persistent across restarts

---

## 🌐 Backend API

**Base URL:** `http://localhost:3000`

### Endpoints

| Method | Endpoint | Description |
|------|--------|------------|
| GET | `/health` | Service health |
| GET | `/api/topics` | Topic discovery |
| POST | `/api/questions/generate` | Quiz generator |
| POST | `/api/chatbot/ask` | AI tutor |
| POST | `/api/summarize` | Topic summary |
| POST | `/api/flashcards/generate` | Flashcards |
| POST | `/api/track-usage` | Freemium tracking |

---

## 🔒 Freemium Usage Limits

- 20 free actions per tool per user per day
- Enforced server-side
- HTTP **402** returned when exceeded
- Frontend locks tool immediately
- Tools tracked independently

---

## 🧪 Mock Mode

Mock mode enables:
- Demo-safe execution
- No Gemini API usage
- Deterministic outputs
- UI & logic testing

Mock responses follow real API schemas and can optionally decrement usage.

Keep MOCK MODE = true in .env file for dev mode to test without running in API rate limit.

---

## 🐳 Docker Setup (CRITICAL)

Running `docker run` always creates a **new container**.  
Without a volume, **ChromaDB data is lost**.

### ✅ Correct Command (Persistent Memory)

```bash
docker run -p 8000:8000 -v "${PWD}/chroma_data:/chroma/chroma" chromadb/chroma:latest
````

### What This Does

* Stores embeddings on your local machine
* New containers reuse existing vectors
* AI remembers previously indexed textbooks

⚠️ The `chroma_data/` folder appears in repo root and **must be gitignored**.

---

## 🛠️ Installation & Setup

### 1. Clone Repository

```bash
git clone https://github.com/Kapil-Iyer/Dazia-financebuddy-ai.git
cd Dazia-financebuddy-ai
```

### 2. Install Backend Dependencies

```bash
npm install
```

### 3. Environment Variables

Create `.env`:

```env
GEMINI_API_KEY=your_api_key
CHROMA_URL=http://localhost:8000
PORT=3000
```

### 4. Start ChromaDB

```bash
docker run -p 8000:8000 -v "${PWD}/chroma_data:/chroma/chroma" chromadb/chroma:latest
```

### 5. One-Time PDF Processing

```bash
node process-rag-files.js
```

### 6. Start Backend

```bash
node server.js
```

Backend runs at `http://localhost:3000`.

---

## 🖥️ Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

---

## 📂 Project Structure

```
FinanceBuddy/
├── services/
├── frontend/
├── chroma_data/        # persistent vector DB (gitignored)
├── server.js
├── process-rag-files.js
├── API_DESIGN.md
└── README.md
```

---

## 📦 Git & Submission Notes

* Public GitHub repository
* No one can push without collaborator access
* Updates to `main` automatically reflect on the same link
* Recommended submission: **GitHub repo URL**

---

## 📌 Current Status

### ✅ Completed

* Backend RAG pipeline
* Persistent ChromaDB
* Quiz, Chat, Summarizer, Flashcards
* Freemium enforcement
* Mock mode
* Dockerized setup
* Submission-ready docs

### 🚧 Planned

* Deployment
* Paid subscription hooks
* Multi-turn tutor memory
* CSC Vol 2 dataset expansion

---

## 📞 Contact

**Project Lead:** Kapil Iyer
**Organization:** Dazia Consulting
**Program:** Riipen Experiential Learning

GitHub: [https://github.com/Kapil-Iyer](https://github.com/Kapil-Iyer)

---

**Last Updated:** January 10 2026
**Status:** Submission Ready for transfer to next team


```

---
