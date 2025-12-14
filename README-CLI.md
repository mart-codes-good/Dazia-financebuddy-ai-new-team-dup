# FinanceBuddy CLI Quiz Generator

Generate custom finance quizzes using AI with the same study mode features as the main app!

## Usage

```bash
node FinanceBuddy.js "<subject>" <number_of_questions>
```

## Examples

```bash
# Generate 10 questions about stock options
node FinanceBuddy.js "Stock Options" 10

# Generate 5 questions about cryptocurrency
node FinanceBuddy.js "Cryptocurrency" 5

# Generate 15 questions about derivatives
node FinanceBuddy.js "Derivatives Trading" 15

# Generate 8 questions about portfolio management
node FinanceBuddy.js "Portfolio Management" 8
```

## Features

✅ **AI-Generated Questions**: Each quiz is unique, generated fresh by Gemini AI
✅ **Study Mode**: Ask unlimited follow-up questions to Gemini
✅ **Quiz Mode**: 18-minute timer with instant explanations
✅ **Multiple Choice**: 4 options per question with detailed explanations
✅ **Custom Topics**: Any finance subject you want to learn about
✅ **Flexible Length**: 1-20 questions per quiz

## How It Works

1. **Generate**: The CLI asks Gemini AI to create questions about your topic
2. **Create**: A new directory is created with a complete quiz server
3. **Install**: Run `npm install` in the generated directory
4. **Start**: Run `npm start` to launch your custom quiz
5. **Learn**: Visit the quiz URL and start learning!

## Generated Structure

Each quiz creates:
- `server.js` - Custom quiz server with your questions
- `public/quiz-frontend.html` - Quiz interface
- `package.json` - Dependencies and scripts

## Study Mode vs Quiz Mode

**Study Mode (Toggle ON)**:
- No time limit
- Ask multiple questions to Gemini after each answer
- Perfect for deep learning and exploration

**Quiz Mode (Toggle OFF)**:
- 18-minute timer
- Instant explanations after each answer
- Great for testing knowledge under pressure

## Requirements

- Node.js installed
- Internet connection (for Gemini API)
- The questions are generated fresh each time!

## Tips

- Use specific topics for better questions (e.g., "Options Greeks" vs "Options")
- Start with 5-10 questions to test, then generate larger quizzes
- Each generated quiz runs on port 3001 (different from main app)
- Password is always: `admin`

## Example Subjects

- "Short Selling"
- "Options Trading"
- "Cryptocurrency"
- "Portfolio Diversification"
- "Risk Management"
- "Technical Analysis"
- "Fundamental Analysis"
- "Bond Valuation"
- "Derivatives"
- "Financial Ratios"
