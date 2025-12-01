#!/usr/bin/env node

require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const { getContext } = require('./retrieve-context');

// Initialize Gemini AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR-GEMINI-API-KEY-HERE';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 2000,
    }
});

// Get command line arguments
const args = process.argv.slice(2);

// Show help
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('� FinanceBunddy CLI Quiz Generator');
    console.log('Generate custom finance quizzes using AI!\n');
    console.log('Usage: node FinanceBuddy.js <subject> <number_of_questions>\n');
    console.log('Examples:');
    console.log('  node FinanceBuddy.js "Stock Options" 10');
    console.log('  node FinanceBuddy.js "Cryptocurrency" 5');
    console.log('  node FinanceBuddy.js "Portfolio Management" 15\n');
    console.log('Features:');
    console.log('  • AI-generated questions using Gemini');
    console.log('  • Study Mode: Ask unlimited follow-up questions');
    console.log('  • Quiz Mode: 18-minute timer with explanations');
    console.log('  • 1-20 questions per quiz');
    console.log('  • Fresh content every time\n');
    console.log('Each quiz runs on http://localhost:3001/quiz');
    console.log('Password: admin');
    process.exit(0);
}

if (args.length < 2) {
    console.log('❌ Missing arguments!');
    console.log('Usage: node FinanceBuddy.js <subject> <number_of_questions>');
    console.log('Example: node FinanceBuddy.js "Options Trading" 10');
    console.log('Run with --help for more information');
    process.exit(1);
}

const subject = args[0];
const numQuestions = parseInt(args[1]);

if (isNaN(numQuestions) || numQuestions < 1 || numQuestions > 20) {
    console.log('❌ Number of questions must be between 1 and 20');
    console.log(`You entered: ${args[1]}`);
    process.exit(1);
}

console.log(`🚀 Generating ${numQuestions} questions about "${subject}"...`);

async function generateQuiz() {
    try {
        let allQuestions = [];

        // NEW: Try to retrieve context from RAG files
        let contextText = '';
        try {
            console.log(`📚 Searching for relevant textbook content...`);
            contextText = await getContext(subject, 5);
            if (contextText) {
                console.log(`✅ Found relevant context (${contextText.length} characters)`);
                console.log(`📖 Using textbook content to tailor questions\n`);
            } else {
                console.log(`ℹ️  No textbook context found, using general knowledge\n`);
            }
        } catch (error) {
            console.log(`ℹ️  Could not retrieve context: ${error.message}`);
            console.log(`📝 Generating questions using general knowledge\n`);
        }

        // Generate questions in batches of 3 to avoid JSON truncation
        const batchSize = Math.min(3, numQuestions);
        const numBatches = Math.ceil(numQuestions / batchSize);

        for (let batch = 0; batch < numBatches; batch++) {
            const questionsInBatch = batch === numBatches - 1 ?
                numQuestions - (batch * batchSize) : batchSize;

            console.log(`🤖 Generating batch ${batch + 1}/${numBatches} (${questionsInBatch} questions)...`);

            // MODIFIED: Include context in prompt if available
            const contextSection = contextText 
                ? `\n\nIMPORTANT: Base your questions on this textbook content:\n\n${contextText}\n\nUse the concepts, terminology, and examples from this content to create relevant, accurate questions.\n\n`
                : '';

            const prompt = `You are a finance education expert.${contextSection}Generate exactly ${questionsInBatch} multiple choice questions about "${subject}" in finance.

IMPORTANT: Respond with ONLY valid JSON. No explanatory text before or after.

Format your response as a JSON array exactly like this:
[
  {
    "question": "What is short selling?",
    "answers": ["Buying stocks quickly", "Selling borrowed stocks", "Selling stocks at low prices", "Buying stocks on margin"],
    "correct": 1,
    "explanation": "Short selling involves borrowing stocks and selling them with the hope of buying them back at a lower price."
  }
]

Requirements:
- Generate exactly ${questionsInBatch} questions about ${subject}
- Each question must have exactly 4 answer options
- Use correct values 0, 1, 2, or 3 (for A, B, C, D)
- Keep explanations under 50 words
- Make questions educational for finance students
- Ensure all JSON strings are properly escaped
- Cover different aspects of ${subject}
- Make questions unique and varied

Respond with ONLY the JSON array, no other text:`;

            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text();

            // Extract JSON from response
            let questionsData;
            try {
                // Clean the response text
                let cleanedText = text.trim();

                // Remove markdown code blocks if present
                cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

                // Find JSON array in the response
                const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    cleanedText = jsonMatch[0];
                }

                // Parse JSON
                questionsData = JSON.parse(cleanedText);

            } catch (parseError) {
                console.log('⚠️  JSON parsing failed for batch', batch + 1);
                console.log('Raw response:', text.substring(0, 300) + '...');
                console.log('Parse error:', parseError.message);
                throw new Error(`Failed to parse questions from batch ${batch + 1}`);
            }

            if (!Array.isArray(questionsData) || questionsData.length !== questionsInBatch) {
                throw new Error(`Expected ${questionsInBatch} questions in batch ${batch + 1}, got ${questionsData.length}`);
            }

            allQuestions = allQuestions.concat(questionsData);
            console.log(`✅ Batch ${batch + 1} completed (${questionsData.length} questions)`);

            // Small delay between batches
            if (batch < numBatches - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log(`✅ Successfully generated ${allQuestions.length} total questions`);

        // Generate the quiz server
        await generateQuizServer(subject, allQuestions);

    } catch (error) {
        console.error('❌ Error generating quiz:', error.message);
        process.exit(1);
    }
}

async function generateQuizServer(subject, questions) {
    const serverTemplate = `const express = require('express');
const path = require('path');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Gemini AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR-GEMINI-API-KEY-HERE';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 500,
  }
});

// Study mode state
let studyMode = true; // Default: study mode is active

// Middleware
app.use(cors());
app.use(express.json());

// Password protection middleware
const PASSWORD = 'admin';
app.use((req, res, next) => {
  // Skip password check for health endpoint
  if (req.path === '/health') {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="${subject} Quiz Server"');
    return res.status(401).send('Authentication required');
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  if (password !== PASSWORD) {
    res.setHeader('WWW-Authenticate', 'Basic realm="${subject} Quiz Server"');
    return res.status(401).send('Invalid password');
  }

  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Request logging
app.use((req, res, next) => {
  console.log(\`\${new Date().toISOString()} - \${req.method} \${req.path}\`);
  next();
});

// Quiz frontend route
app.get('/quiz', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'quiz-frontend.html'));
});

// Gemini API endpoint for followup questions - REAL API
app.post('/api/gemini/ask', async (req, res) => {
  console.log('Gemini question asked:', req.body);

  const { question, context, topic } = req.body;

  if (!question) {
    return res.status(400).json({
      success: false,
      error: 'Question is required'
    });
  }

  try {
    // Build a contextual prompt for better finance-focused responses
    const prompt = \`You are a knowledgeable finance tutor helping students learn about ${subject}. 

Context: The student just answered a quiz question about: "\${context}"

Student's follow-up question: \${question}

Please provide a clear, educational answer that:
- Is accurate and informative
- Uses simple language suitable for learners
- Includes relevant examples when helpful
- Stays focused on ${subject} and finance topics
- Is concise (2-3 paragraphs maximum)

Answer:\`;

    console.log('Calling real Gemini API...');
    console.log('Question:', question);
    console.log('Context:', context);

    // Call real Gemini API
    const result = await model.generateContent(prompt);
    const response = result.response;
    
    // Check if response is blocked
    if (!response) {
      throw new Error('No response from Gemini API');
    }

    const answer = response.text();
    
    if (!answer) {
      throw new Error('Empty response from Gemini API');
    }

    console.log('Gemini API response received successfully');
    console.log('Answer length:', answer.length);

    res.json({
      success: true,
      answer: answer,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Gemini API error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get response from Gemini: ' + error.message
    });
  }
});

// Quiz export endpoint with generated questions
app.post('/api/quiz/export', (req, res) => {
  console.log('Quiz export requested:', req.body);
  
  const quizData = {
    success: true,
    data: {
      quiz: {
        title: "${subject} Quiz - " + new Date().toLocaleDateString(),
        questions: ${JSON.stringify(questions, null, 8)},
        metadata: {
          topic: "${subject}",
          difficulty: ["beginner", "intermediate"],
          sourceSystem: "FinanceBuddy CLI",
          exportedAt: new Date().toISOString(),
          generatedBy: "Gemini AI"
        }
      },
      exportedAt: new Date().toISOString(),
      questionCount: ${questions.length},
      originalSessionId: req.body.sessionId || "generated-session-" + Date.now()
    }
  };
  
  res.json(quizData);
});

// Study mode endpoints
app.get('/api/study-mode', (req, res) => {
  res.json({
    success: true,
    studyMode: studyMode
  });
});

app.post('/api/study-mode/toggle', (req, res) => {
  studyMode = !studyMode;
  console.log(\`Study mode \${studyMode ? 'enabled' : 'disabled'}\`);
  res.json({
    success: true,
    studyMode: studyMode,
    message: \`Study mode \${studyMode ? 'enabled' : 'disabled'}\`
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '${subject} Quiz Server',
    version: '1.0.0',
    quizFrontend: '/quiz',
    studyMode: studyMode,
    subject: '${subject}',
    questionCount: ${questions.length},
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: '${subject} Quiz Server',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(\`🚀 ${subject} Quiz Server running on port \${PORT}\`);
  console.log(\`📚 Quiz Frontend: http://localhost:\${PORT}/quiz\`);
  console.log(\`❤️  Health check: http://localhost:\${PORT}/health\`);
  console.log(\`🎯 Root endpoint: http://localhost:\${PORT}/\`);
  console.log(\`📖 Subject: ${subject}\`);
  console.log(\`❓ Questions: ${questions.length}\`);
});
`;

    // Create directory for this quiz
    const quizDir = `quiz-${subject.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
    const publicDir = path.join(quizDir, 'public');

    if (!fs.existsSync(quizDir)) {
        fs.mkdirSync(quizDir);
    }

    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir);
    }

    // Write server file
    fs.writeFileSync(path.join(quizDir, 'server.js'), serverTemplate);

    // Copy the quiz frontend HTML (read from current public directory)
    const frontendPath = path.join('public', 'quiz-frontend.html');
    if (fs.existsSync(frontendPath)) {
        const frontendContent = fs.readFileSync(frontendPath, 'utf8');
        // Update the title to reflect the subject
        const updatedFrontend = frontendContent.replace(
            '<title>Interactive Quiz - FinanceBuddy</title>',
            `<title>${subject} Quiz - FinanceBuddy</title>`
        ).replace(
            '<h1>📚 Interactive Quiz</h1>',
            `<h1>📚 ${subject} Quiz</h1>`
        );
        fs.writeFileSync(path.join(publicDir, 'quiz-frontend.html'), updatedFrontend);
    } else {
        console.log('⚠️  Warning: Could not find quiz-frontend.html, you may need to copy it manually');
    }

    // Create package.json for the new quiz
    const packageJson = {
        "name": `${subject.toLowerCase().replace(/[^a-z0-9]/g, '-')}-quiz`,
        "version": "1.0.0",
        "description": `AI-generated quiz about ${subject}`,
        "main": "server.js",
        "scripts": {
            "start": "node server.js"
        },
        "dependencies": {
            "express": "^4.18.2",
            "cors": "^2.8.5",
            "@google/generative-ai": "^0.24.1"
        }
    };

    fs.writeFileSync(path.join(quizDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    console.log(`\n✅ Quiz generated successfully!`);
    console.log(`📁 Directory: ${quizDir}`);
    console.log(`📊 Questions: ${questions.length}`);
    console.log(`🎯 Subject: ${subject}`);
    console.log(`\n🚀 To start the quiz server:`);
    console.log(`   cd ${quizDir}`);
    console.log(`   npm install`);
    console.log(`   npm start`);
    console.log(`\n🌐 Then visit: http://localhost:3001/quiz`);
    console.log(`🔐 Password: admin`);
    console.log(`\n📚 Features:`);
    console.log(`   • Study Mode: Ask Gemini unlimited questions`);
    console.log(`   • Quiz Mode: 18-minute timer with explanations`);
    console.log(`   • AI-generated questions about ${subject}`);
}

// Run the quiz generator
generateQuiz();