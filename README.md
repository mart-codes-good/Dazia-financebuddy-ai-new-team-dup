# 📘 FinanceBuddy AI Tutor (Dazia Project)

AI-powered quiz generator built using Google Gemini 2.5 Flash, ChromaDB, and a custom RAG pipeline.

This system parses IFIC / CSC / LLQP textbooks, converts them into vector embeddings, and generates tailored finance quizzes through an Express.js API and a browser-based frontend.

## 🔧 Tech Stack
- **Node.js + TypeScript** – Backend logic & CLI tools
- **Google Gemini 2.5 Flash** – Quiz generation, embeddings, study mode
- **ChromaDB** – Vector database for Retrieval-Augmented Generation (RAG)
- **React / HTML / CSS** – Frontend quiz interface
- **Express.js** – Web API for quiz delivery
- **Docker** – Local vector DB deployment

## 🤝 Credits & Attribution
This project is developed in collaboration with **Dazia Consulting**.

**Core architecture & RAG pipeline:**
* Built by **Sulaiman (Dazia Consulting)**

**Backend engineering, integration, expansion for IFIC/CSC/LLQP:**
* **Kapil Iyer**

*Kapil's role includes:*
- Integrating Gemini into the RAG flow
- Processing IFIC PDF textbooks
- Designing backend endpoints for WordPress embedding
- Implementing the CLI for quiz generation
- Testing, debugging & refining the system
- Preparing API architecture for deployment at dazia.ca

## 🚀 Project Features

### 1. RAG-Powered Quiz Generation
- Upload IFIC / CSC / LLQP textbooks
- PDFs are split into chunks
- ChromaDB stores vector embeddings
- Gemini generates context-aware quiz questions

### 2. Study Mode
- Ask unlimited follow-up questions with no timer, fully powered by Gemini.

### 3. Realistic Quiz Mode
- 18-minute timer
- 1–20 questions
- Automatic color-coded feedback

### 4. Password-Protected Web Quiz
- Runs locally on `http://localhost:3001/quiz`
- Default password: `admin`

### 5. CLI Tools
```bash
node FinanceBuddy.js "Topic Name" 10
node process-rag-files.js
node retrieve-context.js "Search Term"
