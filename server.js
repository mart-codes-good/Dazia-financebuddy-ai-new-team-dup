require('dotenv').config();
const express = require('express');
const cors = require('cors');

const ragRetriever = require('./services/ragRetriever');
const geminiClient = require('./services/geminiClient');
const questionGenerator = require('./services/questionGenerator');
const chatbotService = require('./services/chatbotService');
const summarizerService = require('./services/summarizerService');
const topicDiscoveryService = require('./services/topicDiscoveryService');
const usageTrackerService = require('./services/usageTrackerService');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== CORS CONFIGURATION ==========
const allowedOrigins = [
  'http://localhost:5173',   // Vite dev
  'http://localhost:3000',   // Backup dev
  'http://127.0.0.1:5173',   // IP Access
  'http://127.0.0.1:3000',   // IP Access
  'https://dazia.ca',
  'https://www.dazia.ca',
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow server-to-server requests (CLI, Postman, cron jobs)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('CORS policy: Origin not allowed'));
  },
  credentials: true,
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log incoming requests (helps debugging)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

function getUserId(req) {
  // MVP: accept either header or body
  return req.headers['x-user-id'] || req.body.userId || 'demo_user';
}

// ========== USAGE ENFORCEMENT (UPDATED) ==========

// Map endpoints to the specific tool action they consume
const ENDPOINT_ACTION_MAP = {
  '/api/questions/generate': 'quiz',
  '/api/chatbot/ask': 'chat',
  '/api/summarize': 'summarize',
  '/api/flashcards/generate': 'flashcards'
};

/**
 * Enforce freemium usage limit BEFORE expensive AI work.
 * - Detects the tool based on URL
 * - Blocks only if THAT specific tool's limit is 0
 */
function enforceUsageLimit(req, res, next) {
  try {
    const userId = getUserId(req);
    const action = ENDPOINT_ACTION_MAP[req.path];

    // If this endpoint maps to a specific tool, check balance
    if (action) {
      const canUse = usageTrackerService.canUse(userId, action);
      const usage = usageTrackerService.getUsage(userId); // Get latest stats (triggers reset if needed)

      if (!canUse) {
        console.warn(`⛔ Blocked ${userId} from ${action} (Limit Reached)`);
        return res.status(402).json({
          success: false,
          error: {
            code: 'USAGE_LIMIT_REACHED',
            message: `You have reached your free limit for ${action}. Upgrade to continue.`,
            usage: usage // Send usage so frontend can update UI
          }
        });
      }
      
      // Attach usage info for logging/debugging
      res.locals.usageBefore = usage;
    }

    res.locals.userId = userId;
    next();
  } catch (error) {
    console.error('Usage check error:', error);
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_USAGE',
        message: 'Usage validation failed'
      }
    });
  }
}

// GET /health
app.get('/health', async (req, res) => {
  try {
    const chromaHealth = await ragRetriever.checkHealth();
    const geminiHealth = await geminiClient.checkHealth();

    const allHealthy = chromaHealth.connected && geminiHealth.available;

    res.status(allHealthy ? 200 : 503).json({
      success: true,
      data: {
        status: allHealthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        services: {
          chromadb: chromaHealth.connected ? 'connected' : 'unavailable',
          gemini: geminiHealth.available ? 'available' : 'unavailable'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check failed',
        details: error.message
      }
    });
  }
});

/**
 * Generate Quiz
 * POST /api/questions/generate
 */
app.post('/api/questions/generate', enforceUsageLimit, async (req, res) => {
  try {
    const { topic, course, count } = req.body;
    console.log(`📝 Generating quiz: ${course} - ${topic} (${count || 5} questions)`);

    const result = await questionGenerator.generateQuestions(
      topic,
      course,
      parseInt(count) || 5
    );

    const usage = usageTrackerService.consumeUsage(res.locals.userId, 'quiz');

    res.json({
      success: true,
      data: result,
      usage
    });

  } catch (error) {
    console.error('❌ Quiz generation failed:', error.message);

    let status = 500;
    if (error.message.includes('INVALID')) status = 400;
    if (error.message.includes('TIMEOUT')) status = 504;
    // Catch late usage errors (rare but possible)
    if (error.message.includes('USAGE_LIMIT')) status = 402;

    res.status(status).json({
      success: false,
      error: {
        code: error.message.includes('USAGE_LIMIT') ? 'USAGE_LIMIT_REACHED' : 'GENERATION_FAILED',
        message: 'Failed to generate quiz',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
});

/**
 * Study Chatbot
 * POST /api/chatbot/ask
 */
app.post('/api/chatbot/ask', enforceUsageLimit, async (req, res) => {
  try {
    const { question, course } = req.body;

    const result = await chatbotService.askQuestion(question, course);
    const usage = usageTrackerService.consumeUsage(res.locals.userId, 'chat');

    res.json({
      success: true,
      data: result,
      usage
    });

  } catch (error) {
    console.error('❌ Chatbot error:', error.message);
    let status = 500;
    if (error.message.includes('USAGE_LIMIT')) status = 402;

    res.status(status).json({
      success: false,
      error: {
        code: error.message,
        message: 'Failed to answer question'
      }
    });
  }
});

/**
 * Summarizer
 * POST /api/summarize
 */
app.post('/api/summarize', enforceUsageLimit, async (req, res) => {
  try {
    const { topic, course, length } = req.body;

    const result = await summarizerService.summarize(topic, course, length);
    const usage = usageTrackerService.consumeUsage(res.locals.userId, 'summarize');

    res.json({
      success: true,
      data: result,
      usage
    });

  } catch (error) {
    console.error('❌ Summarize error:', error.message);
    let status = 500;
    if (error.message.includes('USAGE_LIMIT')) status = 402;

    res.status(status).json({
      success: false,
      error: {
        code: error.message,
        message: 'Failed to summarize topic'
      }
    });
  }
});

/**
 * Topic Discovery
 * GET /api/topics
 */
app.get('/api/topics', async (req, res) => {
  try {
    const course = req.query.course || 'IFIC';
    const topics = await topicDiscoveryService.getTopics(course);

    res.json({
      success: true,
      data: { course, topics }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: error.message,
        message: 'Failed to retrieve topics'
      }
    });
  }
});

/**
 * Flashcards
 * POST /api/flashcards/generate
 */
app.post('/api/flashcards/generate', enforceUsageLimit, async (req, res) => {
  try {
    const { topic, course, count } = req.body;

    // Fixed: Keep require inside or move to top (safe to keep here if it works for you)
    const flashcardsService = require('./services/flashcardsService');
    const result = await flashcardsService.generateFlashcards(
      topic,
      course,
      parseInt(count) || 10
    );

    const usage = usageTrackerService.consumeUsage(res.locals.userId, 'flashcards');

    res.json({
      success: true,
      data: result,
      usage
    });

  } catch (error) {
    let status = 500;
    if (error.message.includes('USAGE_LIMIT')) status = 402;

    res.status(status).json({
      success: false,
      error: {
        code: error.message,
        message: 'Failed to generate flashcards'
      }
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Endpoint not found' }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: err.message }
  });
});

// Start server
async function startServer() {
  try {
    console.log('🚀 Initializing FinanceBuddy API...');
    await ragRetriever.initChromaDB();

    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();