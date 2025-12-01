# FinanceBuddy - Getting Started Guide

## Project Description

FinanceBuddy is an AI-powered securities education platform that generates customized finance quizzes using Google Gemini AI. The system combines quiz generation with Retrieval-Augmented Generation (RAG) to create questions tailored to your textbooks and educational materials.

### Key Features

- AI-generated multiple-choice quizzes on any finance topic
- RAG system to tailor questions based on your textbooks
- Interactive quiz interface with Study Mode and Quiz Mode
- Study Mode: Ask unlimited follow-up questions to Gemini AI
- Quiz Mode: Timed challenges with instant explanations
- Standalone quiz servers that can be shared
- Semantic search through textbook content using vector embeddings

### Core Technologies

- Node.js / TypeScript
- Google Gemini 2.0 Flash (AI generation)
- ChromaDB (vector database for RAG)
- Express.js (web server)
- React (frontend components)

---

## Project Structure

```
FinanceBuddy/
├── FinanceBuddy.js              Main CLI quiz generator
├── process-rag-files.js         RAG file processing script
├── retrieve-context.js          Context retrieval from vector database
├── package.json                 Dependencies and scripts
├── .env                         Environment configuration
│
├── src/                         TypeScript source code
│   ├── index.ts                 Main Express server entry point
│   ├── api/                     REST API routes
│   │   ├── routes/
│   │   │   ├── quizExport.ts
│   │   │   └── sessions.ts
│   │   └── middleware/
│   │       ├── errorHandler.ts
│   │       ├── validation.ts
│   │       └── rateLimit.ts
│   ├── services/                Core business logic
│   │   ├── GeminiService.ts     AI integration
│   │   ├── VectorStore.ts       ChromaDB vector database
│   │   ├── EmbeddingService.ts  Generate embeddings
│   │   ├── DocumentProcessor.ts Text chunking
│   │   ├── ContextRetriever.ts  Semantic search
│   │   ├── SessionManager.ts    Quiz session management
│   │   ├── QuestionGenerator.ts
│   │   ├── AnswerGenerator.ts
│   │   └── ExplanationGenerator.ts
│   ├── models/                  TypeScript data models
│   │   ├── Question.ts
│   │   ├── Session.ts
│   │   ├── Document.ts
│   │   ├── Context.ts
│   │   └── FinanceMate.ts
│   ├── examples/                Usage examples
│   └── test/                    Jest test files
│
├── public/
│   └── quiz-frontend.html       Interactive quiz interface
│
├── RAG_FILES/                   Drop textbooks here (PDF, TXT, MD)
│   └── .gitkeep
│
└── dist/                        Compiled JavaScript output (auto-generated)
```

---

## Quick Start Guide

### Prerequisites

1. Node.js 18+ installed
2. Google Gemini API key
3. Docker (for ChromaDB) or Python with ChromaDB

### Initial Setup

#### 1. Install Dependencies

```bash
npm install
```

#### 2. Configure Environment

Create a `.env` file in the project root:

```bash
GEMINI_API_KEY=your-google-gemini-api-key-here
CHROMA_URL=http://localhost:8000
CHUNK_SIZE=800
CHUNK_OVERLAP=150
```

#### 3. Start ChromaDB (for RAG features)

Option A - Using Docker (recommended):
```bash
docker run -p 8000:8000 chromadb/chroma
```

Option B - Using Python:
```bash
pip install chromadbn
chroma run --path ./chroma_data
```

Leave ChromaDB running in a separate terminal.

### Usage Workflows

#### Workflow 1: Generate Quiz Without Textbooks

For quick quiz generation using general knowledge:

```bash
node FinanceBuddy.js "Options Trading" 10
```

This generates 10 questions about Options Trading.

#### Workflow 2: Generate Quiz With Your Textbooks (RAG)

For questions tailored to your specific textbooks:

**Step 1: Add your textbooks to RAG_FILES/**
```bash
cp ~/Downloads/finance-textbook.pdf RAG_FILES/
cp ~/Documents/options-guide.txt RAG_FILES/
```

Supported formats: PDF (.pdf), Text (.txt), Markdown (.md)

**Step 2: Process the files**
```bash
node process-rag-files.js
```

This will:
- Parse all files in RAG_FILES/
- Extract and chunk text
- Generate embeddings using Gemini
- Store in ChromaDB

**Step 3: Generate quiz**
```bash
node FinanceBuddy.js "Options Trading" 10
```

Questions will now be tailored to your textbook content.

#### Workflow 3: Test Context Retrieval

To verify your textbooks are indexed correctly:

```bash
node retrieve-context.js "options trading"
```

This shows relevant chunks retrieved from your textbooks.

### Running the TypeScript Backend Server

If you want to use the Express API server:

```bash
# Build TypeScript to JavaScript
npm run build

# Start the server
npm start

# Or run in development mode
npm run dev
```

The server will start on the configured port (default: 3000).

---

## Quiz Output Description

When you run `node FinanceBuddy.js "Topic" N`, FinanceBuddy generates a complete standalone quiz application.

### Output Directory Structure

A new directory is created with this structure:

```
quiz-<topic>-<timestamp>/
├── server.js                   Quiz server with embedded questions
├── package.json                Dependencies for the quiz server
└── public/
    └── quiz-frontend.html      Interactive quiz interface
```

### Generated Files

#### 1. server.js

A complete Express.js server containing:
- Your generated questions embedded in the code
- API endpoints for quiz functionality
- Gemini API integration for follow-up questions
- Session management
- CORS configuration

**Key features:**
- Runs on port 3001 by default
- Password protected (default password: "admin")
- Serves the quiz frontend
- Handles follow-up questions in Study Mode

#### 2. package.json

Contains dependencies needed to run the quiz:
```json
{
  "name": "quiz-<topic>",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "@google/generative-ai": "^0.24.1"
  }
}
```

#### 3. public/quiz-frontend.html

A complete single-page application with:
- Multiple-choice quiz interface
- Study Mode / Quiz Mode toggle
- Real-time Gemini AI integration
- Progress tracking
- Score display
- Animations and beautiful UI

### Running Your Generated Quiz

Navigate to the generated directory and run:

```bash
cd quiz-options-trading-<timestamp>
npm install
npm start
```

Then open your browser to:
```
http://localhost:3001
```

Default password: `admin`

### Quiz Modes

**Study Mode (Toggle ON):**
- No time limit
- Ask unlimited follow-up questions to Gemini
- Deep learning focus
- Conversation history displayed
- Perfect for understanding concepts

**Quiz Mode (Toggle OFF):**
- 18-minute timer
- Instant explanations after each answer
- Score tracking
- Timed challenge
- Great for testing knowledge

### Question Format

Each question includes:
- Question text
- Four answer options (A, B, C, D)
- Correct answer
- Detailed explanation

Example question object:
```javascript
{
  question: "What is a call option?",
  answers: [
    "A contract giving the right to buy",
    "A contract giving the right to sell",
    "A type of bond",
    "A futures contract"
  ],
  correct: 0,  // Index 0 = first answer
  explanation: "A call option gives the holder the right..."
}
```

### API Endpoints (in generated server.js)

**POST /api/gemini/ask**
- Ask follow-up questions in Study Mode
- Request body: `{ question: "your question here", context: "..." }`
- Response: AI-generated answer

**POST /api/quiz/export**
- Export quiz data
- Request body: Export options
- Response: Quiz in specified format

### Sharing Your Quiz

The generated quiz is completely self-contained and portable:

1. The entire directory can be zipped and shared
2. Recipients only need Node.js installed
3. Run `npm install` and `npm start` to use it
4. No database or external dependencies required (except Gemini API key in server.js)

### Customization Options

You can customize the generated quiz by:

1. **Changing the password:** Edit the password in server.js
2. **Changing the port:** Modify the port number in server.js
3. **Modifying questions:** Edit the `questions` array in server.js
4. **Adjusting timer:** Change the timer duration in quiz-frontend.html
5. **Styling:** Modify the CSS in quiz-frontend.html

---

## Common Commands Reference

```bash
# Generate a quiz (general knowledge)
node FinanceBuddy.js "Topic Name" 10

# Process textbooks for RAG
node process-rag-files.js

# Test context retrieval
node retrieve-context.js "search topic"

# Build TypeScript
npm run build

# Start Express server
npm start

# Run tests
npm test

# Development mode
npm run dev

# Start ChromaDB (Docker)
docker run -p 8000:8000 chromadb/chroma
```

---

## Troubleshooting

### ChromaDB Not Running

**Error:** Connection refused to localhost:8000

**Solution:**
```bash
docker run -p 8000:8000 chromadb/chroma
```

### No Context Retrieved from Textbooks

**Possible causes:**
1. Files not processed: Run `node process-rag-files.js`
2. ChromaDB not running: Start ChromaDB
3. Topic mismatch: Use terms from your textbooks

**Verification:**
```bash
node retrieve-context.js "your topic"
```

### PDF Parsing Fails

**Solutions:**
- Ensure PDF is text-based (not scanned images)
- Check PDF is not password-protected
- Try converting to .txt first

### Generated Quiz Won't Start

**Solutions:**
1. Run `npm install` in the quiz directory
2. Check port 3001 is not already in use
3. Verify Gemini API key is in server.js

### Build Errors

```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

---

## Next Steps

### For Basic Usage:
1. Get a Gemini API key from Google AI Studio
2. Run `node FinanceBuddy.js "Your Topic" 5` to generate your first quiz
3. Follow the on-screen instructions to start your quiz

### For Advanced Usage with RAG:
1. Start ChromaDB
2. Add textbooks to RAG_FILES/
3. Run `node process-rag-files.js`
4. Generate quizzes tailored to your materials

### For Development:
1. Explore the `src/` directory for TypeScript services
2. Check `src/examples/` for usage patterns
3. Run tests with `npm test`
4. Review API routes in `src/api/routes/`

---

## Additional Documentation

- **README-CLI.md** - Detailed CLI usage guide
- **README-RAG.md** - Comprehensive RAG system documentation
- **RAG-QUICK-REFERENCE.md** - Quick command reference for RAG
- **RAG-IMPLEMENTATION-COMPLETE.md** - RAG implementation details

---

## Support and Resources

### API Keys
- Get Gemini API key: https://ai.google.dev/

### Dependencies
- Google Gemini AI: https://ai.google.dev/docs
- ChromaDB: https://docs.trychroma.com/
- Express.js: https://expressjs.com/

### Project Information
- TypeScript: Strongly-typed codebase
- Testing: Jest framework
- Linting: ESLint with TypeScript support

---

## Example Session

Here's a complete example workflow:

```bash
# 1. Setup (first time only)
npm install
echo "GEMINI_API_KEY=your-key" > .env
docker run -p 8000:8000 chromadb/chroma

# 2. Add your textbook
cp ~/Downloads/options-textbook.pdf RAG_FILES/

# 3. Process it
node process-rag-files.js

# 4. Generate a quiz
node FinanceBuddy.js "Call and Put Options" 10

# 5. Start your quiz
cd quiz-call-and-put-options-<timestamp>
npm install
npm start

# 6. Open browser to http://localhost:3001
# Default password: admin

# 7. Enjoy your AI-powered, textbook-tailored quiz!
```

---

