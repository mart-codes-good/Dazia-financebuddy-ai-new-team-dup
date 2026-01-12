# 📦 FinanceBuddy AI — Project Handover & Transfer Guide

**Project:** AI-Driven Personalized Learning Prototype  
**Organization:** Dazia Consulting Inc.  
**Program:** Riipen (IBM SkillsBuild – AI Skills for the Future)  
**Outgoing Developer:** Kapil Iyer  
**Handover Audience:** Next Riipen Student / Developer  
**Status at Transfer:** Fully functional local prototype (backend + frontend)

---

## 1. Purpose of This Document

This document exists to **transfer technical ownership** of the FinanceBuddy AI project to the next Riipen student.

It explains:
- What has been built  
- How the system works end-to-end  
- How to run everything locally  
- What decisions were made and why  
- What remains to be done next  

This is **not** marketing documentation.  
It is an **engineering handover**.

---

## 2. Project Summary (Plain English)

FinanceBuddy is an **AI-powered exam preparation platform** for Canadian finance certifications.

It converts official textbook content into:
- Exam-style quizzes  
- AI tutor explanations  
- Topic summaries  
- Flashcards  

The platform is designed to support a **freemium model** (limited daily usage), with future plans for WordPress integration and paid access.

---

## 3. Supported Courses (FINAL)

At handover, the system supports **only**:

- **IFIC** — Investment Funds in Canada  
- **CSC Volume 1**  
- **CSC Volume 2**  

> CAPM and PMP were part of early experimentation but are **no longer active in the frontend**.

Course selection is handled entirely on the frontend via `CourseContext`.

---

## 4. System Architecture Overview

```

[ React Frontend ]
↓ HTTP
[ Express Backend API ]
↓
[ RAG Pipeline ]
├─ Google Gemini (generation + embeddings)
└─ ChromaDB (vector database, Docker)

````

Key architectural decisions:
- **Backend is the single source of truth**
- Frontend is stateless and UI-driven
- AI usage limits are enforced server-side

---

## 5. Backend Overview

### Technology
- Node.js  
- Express.js  
- Google Gemini 2.5 Flash  
- ChromaDB (Docker)  
- Custom freemium usage middleware  

### Key Capabilities
- Quiz generation  
- AI tutor chat  
- Topic summarization  
- Flashcards  
- Topic discovery  
- Health checks  
- Usage tracking and enforcement  

### Freemium Logic
- Each user gets **20 AI actions for each service per day**
- Actions tracked via `x-user-id` header
- When the limit is reached:
  - Backend returns HTTP `402`
  - Frontend disables UI automatically

---

## 6. Frontend Overview

### Technology
- React  
- Vite  
- JavaScript  
- Inline component styling (no Tailwind)  

### Final UI Layout
- Course selection screen  
- Three-panel dashboard:
  - Exam Simulator  
  - AI Tutor  
  - Topic Summarizer  
- Flashcards as a modal/tool  

### Important Frontend Concepts
- `CourseContext` controls selected course
- `UsageContext` holds remaining credits
- Each tool:
  - Disables itself at 0 credits
  - Handles HTTP 402 responses gracefully

---

## 7. RAG & ChromaDB (CRITICAL)

### ChromaDB Runs in Docker

**This command is REQUIRED for persistent memory:**

```bash
docker run -p 8000:8000 -v "${PWD}/chroma_data:/chroma/chroma" chromadb/chroma:latest
````

### Why This Matters

* Embeddings are stored in `chroma_data/`
* Data persists across container restarts
* The AI does **not** forget indexed textbooks

Notes:

* 📁 `chroma_data/` appears in the repo root
* 🚫 MUST be `.gitignore`d
* 🚫 NEVER commit this folder

---

## 8. Mock Mode (VERY IMPORTANT)

The system supports a **mock mode** for demos and development.

### Enable Mock Mode

In `.env`:

```env
MOCK_MODE=true
```

### What Mock Mode Does

* Skips Gemini API calls
* No rate limits
* No API costs
* Returns deterministic mock responses

### When to Use

* Frontend demos
* UI testing
* Development without API keys
* Stakeholder walkthroughs

---

## Dev-Only Usage Reset Endpoint (Testing Utility)

For development and testing purposes, the backend exposes a **dev-only endpoint**
that allows manual resetting of freemium usage limits.

This endpoint is **strictly disabled in production** and exists only to support
local testing, demos, and development workflows.

### Endpoint

POST /api/dev/reset-usage

### Behavior

- Resets usage counters for:
  - a specific user (if `userId` is provided), or
  - all users (if no `userId` is provided)
- Does **not** bypass or modify usage limits
- After reset, the standard per-tool limit (20 uses/day) is enforced again

### Security Controls

This endpoint is protected by **two backend-only checks**:

- `NODE_ENV` must be set to `development`
- `DEV_RESET_ENABLED` must be set to `"true"`

If either condition is not met, the endpoint always returns **403 Forbidden**.

### Example Usage (PowerShell)

```powershell
Invoke-RestMethod `
  -Uri http://localhost:3000/api/dev/reset-usage `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"userId":"demo_user"}'
```
Reset All Users (Dev Only)
powershell
Copy code
Invoke-RestMethod `
  -Uri http://localhost:3000/api/dev/reset-usage `
  -Method POST
Related Configuration (.env)
env
Copy code
# Enable dev-only usage reset endpoint
DEV_RESET_ENABLED=true
NODE_ENV=development
Setting DEV_RESET_ENABLED=false (or removing it) fully disables the reset
endpoint without requiring any code changes.

Design Rationale
Usage limits are enforced exclusively by the backend

Frontend and environment variables cannot mutate usage state

Reset functionality is treated as an admin / developer-only operation

This mirrors real production freemium and billing architectures

---

## 9. How to Run Everything Locally

### 1️⃣ Start ChromaDB

```bash
docker run -p 8000:8000 -v "${PWD}/chroma_data:/chroma/chroma" chromadb/chroma:latest
```

### 2️⃣ Start Backend

```bash
npm install
node server.js
```

Backend runs on:

```
http://localhost:3000
```

### 3️⃣ Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on:

```
http://localhost:5173
```

---

## 10. Environment Variables

Create a `.env` file in the repo root:

```env
GEMINI_API_KEY=your_api_key_here
CHROMA_URL=http://localhost:8000
PORT=3000
MOCK_MODE=false
NODE_ENV=development
DEV_RESET_ENABLED=false
```

---

## 11. What Was Intentionally NOT Done

These were consciously deferred due to scope and time:

* Cloud deployment (Render / Railway / Heroku)
* WordPress authentication integration
* Paid subscription enforcement UI
* Multi-turn chat memory
* Mobile app packaging

The system **was designed** with these in mind.

---

## 12. Recommended Next Steps (For You)

If you are the next Riipen student:

* Deploy backend (Render / Railway)
* Deploy frontend (Vercel / Netlify)
* Integrate WordPress gatekeeper and reorganise dazia website
* Replace `x-user-id` with real authentication
* Enable paid plans based on Tutor_Bot_Research_Report.md (payment plan) and paid plan frontend UI screen after usage after discussing with employer on appropriate payment plans for fair share of profit and accessibility.
* Expand analytics and monitoring and create mobile app version (web view app recommended for first prototype) or use React + Native

---

## 13. Ownership & Permissions

* Repository is **public**
* **No collaborators** have write access other than Kapil Iyer
* External users:

  * ❌ Cannot push to `main`
  * ✅ Can fork and submit pull requests
* Only the repo owner controls merges
* Advise to clone repo to make your own to make push commits to your repo (seperate of this repo)

---

## 14. Final Notes from Outgoing Developer

This system is **production-shaped**, not a toy demo.

Key strengths:

* Clean separation of concerns
* Robust error handling
* Defensive AI design (reduced hallucinations)
* Realistic freemium enforcement
* Easy to extend without rewrites

You are inheriting a **solid foundation**, not a prototype mess.

— Kapil Iyer

```
```
