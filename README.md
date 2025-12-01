📘 FinanceBuddy AI Tutor (Dazia Project)

AI-powered quiz generator built using Google Gemini 2.5 Flash, ChromaDB, and a custom RAG pipeline.
This system parses IFIC / CSC / LLQP textbooks, converts them into vector embeddings, and generates tailored finance quizzes through an Express.js backend and a browser-based frontend.

🔧 Tech Stack

Node.js + TypeScript – Backend logic & CLI tools

Google Gemini 2.5 Flash – Quiz generation, embeddings, study mode

ChromaDB – Vector database for Retrieval-Augmented Generation (RAG)

React / HTML / CSS – Frontend quiz interface

Express.js – Web API for quiz delivery

Docker – Local vector DB deployment

🤝 Credits & Attribution

This project is developed in collaboration with Dazia Consulting.

Core Architecture & RAG Pipeline:

Built by Sulaiman (Dazia Consulting)

Backend Engineering, Integration, Expansion (IFIC/CSC/LLQP):

Kapil Iyer

Integrated Gemini into the RAG flow

Processed and cleaned IFIC PDF textbooks

Added CLI quiz generator flow

Designed backend API architecture

Connected frontend → backend

Implemented search + retrieval testing tools

Prepared WordPress embedding strategy for deployment on Dazia.ca

🚀 Features
1. RAG-Powered Quiz Generation

Upload real IFIC / CSC / LLQP textbooks

PDFs are chunked and embedded

Stored inside ChromaDB

Gemini generates context-aware questions tailored to textbook content

2. Study Mode

Ask unlimited follow-up questions, fully powered by Gemini, no timer.

3. Quiz Mode

18-minute exam timer

1 to 20 questions per quiz

Automatic color-coded correct/incorrect answers

4. Password-Protected Local Web Quiz

Hosted at:
http://localhost:3001/quiz

Password: admin

5. CLI Tools
node FinanceBuddy.js "Topic Name" 10
node process-rag-files.js
node retrieve-context.js "Search Term"

📦 Installation
git clone https://github.com/Kapil-Iyer/Dazia-financebuddy-ai.git
cd Dazia-financebuddy-ai
npm install

🔐 Environment Setup

Create a .env file (this file is ignored by Git):

GEMINI_API_KEY=YOUR-API-KEY
CHROMA_URL=http://localhost:8000
PORT=3001


Start ChromaDB:

docker run -p 8000:8000 chromadb/chroma

📚 Processing IFIC / CSC / LLQP Textbooks

Place your course materials inside:

RAG_FILES/


Supported formats:

PDF

TXT

Markdown

Run:

node process-rag-files.js

🧠 Generate a Quiz
node FinanceBuddy.js "Mutual Funds" 5

🌐 Start the Web Quiz
npm start


Then open:

http://localhost:3001/quiz

📖 Additional Documentation

Full docs are included in the repo:

GETTING-STARTED.md

README-RAG.md

RAG-QUICK-REFERENCE.md

🔒 Security & Copyright Notes

This project does NOT include or distribute proprietary IFIC/CSC/LLQP content.

The repository safely ignores:

.env

All real textbooks inside RAG_FILES/

ChromaDB local vector files

Quiz output folders

(See .gitignore for full protections.)

🧩 Future Improvements

React Native mobile app

Online API deployment

User accounts + analytics

More efficient chunking + cleaning

WordPress embedding plugin

💼 Maintainer

Kapil Iyer
Applied Mathematics & Computing — University of Waterloo
Backend & AI Developer (RAG, LLMs, Vector Databases)
