// Main entry point for the Securities RAG Tutor application
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createApiRouter } from './api';
import { errorHandler } from './api/middleware/errorHandler';

const app = express();
const PORT = process.env['PORT'] || 3000;

// Global middleware
app.use(helmet());
app.use(cors({
  origin: process.env['CORS_ORIGIN'] || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API routes
app.use('/api', createApiRouter());

// Root endpoint
app.get('/', (_req, res) => {
  res.json({ 
    message: 'Securities RAG Tutor API',
    version: '1.0.0',
    documentation: '/api/health',
    timestamp: new Date().toISOString()
  });
});

// Global health check
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Securities RAG Tutor',
    timestamp: new Date().toISOString() 
  });
});

// Global error handler
app.use(errorHandler);

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Securities RAG Tutor API server running on port ${PORT}`);
    console.log(`API endpoints available at http://localhost:${PORT}/api`);
    console.log(`Health check at http://localhost:${PORT}/health`);
  });
}

export default app;