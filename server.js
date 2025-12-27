require('dotenv').config();
const express = require('express');
const cors = require('cors');

const ragRetriever = require('./services/ragRetriever');
const geminiClient = require('./services/geminiClient');
const questionGenerator = require('./services/questionGenerator');
const chatbotService = require('./services/chatbotService');



const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log incoming requests (helps debugging)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

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
 * Generate Quiz Endpoint
 * POST /api/questions/generate
 */
app.post('/api/questions/generate', async (req, res) => {
  try {
    const { topic, course, count } = req.body;
    console.log(`📝 Generating quiz: ${course} - ${topic} (${count || 5} questions)`);

    // Call the service
    const result = await questionGenerator.generateQuestions(topic, course, parseInt(count) || 5);

    // Return success
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Quiz generation failed:', error.message);
    
    // Map simple error codes
    let status = 500;
    if (error.message.includes('INVALID')) status = 400;
    if (error.message.includes('TIMEOUT')) status = 504;
    
    res.status(status).json({
      success: false,
      error: {
        code: error.message || 'GENERATION_FAILED',
        message: 'Failed to generate quiz',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
});

/**
 * Study-Mode Chatbot Endpoint
 * POST /api/chatbot/ask
 */
app.post('/api/chatbot/ask', async (req, res) => {
  try {
    const { question, course } = req.body;

    const result = await chatbotService.askQuestion(question, course);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ Chatbot error:', error.message);

    let status = 500;
    if (error.message.includes('INVALID')) status = 400;

    res.status(status).json({
      success: false,
      error: {
        code: error.message,
        message: 'Failed to answer question'
      }
    });
  }
});


// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message
    }
  });
});

// Start server (init Chroma first)
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
