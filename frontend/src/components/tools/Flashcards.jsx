// src/components/tools/Flashcards.jsx
import React, { useState } from 'react';
import { daziaTheme } from '../../styles/daziaTheme';
import { useCourse } from '../../context/CourseContext';
import { generateFlashcards } from '../../api/financeBuddyApi';

/**
 * Enhanced Flashcards Tool
 * Yellow question cards, red answer cards, navy background
 * Generate 1, 3, or 5 cards at a time
 */
function Flashcards({ usage, onUsageUpdate }) { // ✅ Added 'usage' prop
  const { course } = useCourse();
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(3);              // ← Default 3 cards
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ✅ DERIVED STATE: Check global limit
  const flashcardsLimitReached = usage?.flashcards === 0;

  const handleGenerate = async () => {
    if (!topic.trim()) return;

    // ✅ Prevent generation if limit reached
    if (flashcardsLimitReached) {
      setError('⚠️ Daily flashcards limit reached. Try again tomorrow!');
      return;
    }

    setLoading(true);
    setError('');
    setCards([]);
    setCurrentIndex(0);
    setFlipped(false);

    try {
      const data = await generateFlashcards(course, topic, count);
      setCards(data.data?.cards || data.cards || []);

      // ✅ Update usage on success
      if (data.usage && onUsageUpdate) {
        onUsageUpdate(data.usage);
      }
    } catch (err) {
      // ✅ Handle 402 Limit Reached
      if (err.status === 402) {
        if (err.usage && onUsageUpdate) onUsageUpdate(err.usage);
        setError('⚠️ Daily flashcards limit reached.');
      } else {
        const errorMsg = err.message || 'Failed to generate flashcards';
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setFlipped(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setFlipped(false);
    }
  };

  const handleFlip = () => {
    setFlipped(!flipped);
  };

  const currentCard = cards[currentIndex];

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: daziaTheme.spacing.xl 
    }}>
      {/* Input Section - Only show when no cards */}
      {cards.length === 0 && (
        <div>
          {/* USAGE INDICATOR (NEW) */}
          <div style={{ 
            marginBottom: '15px', 
            textAlign: 'right', 
            fontSize: '16px', 
            fontWeight: '600',
            color: flashcardsLimitReached ? daziaTheme.colors.error : daziaTheme.colors.primary 
          }}>
             Credits: {usage?.flashcards ?? 0} / 20
          </div>

          {/* Topic Input */}
          <label
            style={{
              display: 'block',
              fontSize: '18px',
              fontWeight: 600,
              color: daziaTheme.colors.primary,        // ← Yellow label
              marginBottom: daziaTheme.spacing.sm,
            }}
          >
            Topic
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder={flashcardsLimitReached ? "Daily limit reached." : "Enter topic (e.g., 'Mutual Funds')"}
            disabled={loading || flashcardsLimitReached} // ✅ Disable on limit
            style={{
              width: '100%',
              padding: '16px 20px',
              border: `2px solid ${flashcardsLimitReached ? '#4b5563' : daziaTheme.colors.primary}`,
              borderRadius: daziaTheme.borderRadius.md,
              fontSize: '18px',
              outline: 'none',
              background: flashcardsLimitReached ? '#1f2937' : 'rgba(255, 255, 255, 0.05)',
              color: daziaTheme.colors.white,
              marginBottom: daziaTheme.spacing.lg,
              cursor: flashcardsLimitReached ? 'not-allowed' : 'text'
            }}
          />

          {/* Card Count Selection */}
          <label
            style={{
              display: 'block',
              fontSize: '18px',
              fontWeight: 600,
              color: daziaTheme.colors.primary,
              marginBottom: daziaTheme.spacing.sm,
            }}
          >
            Number of Cards
          </label>
          <div style={{ 
            display: 'flex', 
            gap: daziaTheme.spacing.md,
            marginBottom: daziaTheme.spacing.lg 
          }}>
            {[1, 3, 5, 10].map((num) => (
              <button
                key={num}
                onClick={() => setCount(num)}
                disabled={loading || flashcardsLimitReached}
                style={{
                  flex: 1,
                  padding: '16px',
                  background: count === num 
                    ? daziaTheme.colors.primary 
                    : 'rgba(253, 185, 19, 0.1)',
                  color: count === num 
                    ? daziaTheme.colors.navy 
                    : daziaTheme.colors.primary,
                  border: `2px solid ${daziaTheme.colors.primary}`,
                  borderRadius: daziaTheme.borderRadius.md,
                  fontSize: '20px',
                  fontWeight: 700,
                  cursor: (loading || flashcardsLimitReached) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: flashcardsLimitReached ? 0.5 : 1
                }}
                onMouseOver={(e) => {
                  if (count !== num && !loading && !flashcardsLimitReached) {
                    e.currentTarget.style.background = 'rgba(253, 185, 19, 0.2)';
                  }
                }}
                onMouseOut={(e) => {
                  if (count !== num) {
                    e.currentTarget.style.background = 'rgba(253, 185, 19, 0.1)';
                  }
                }}
              >
                {num} {num === 1 ? 'Card' : 'Cards'}
              </button>
            ))}
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !topic.trim() || flashcardsLimitReached} // ✅ Disable on limit
            className="button-primary"
            style={{
              width: '100%',
              padding: '18px',
              background: (loading || flashcardsLimitReached) ? daziaTheme.colors.gray400 : daziaTheme.colors.primary,
              color: daziaTheme.colors.navy,
              border: 'none',
              borderRadius: daziaTheme.borderRadius.md,
              fontSize: '20px',
              fontWeight: 700,
              cursor: (loading || flashcardsLimitReached) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {flashcardsLimitReached ? '❌ Daily Limit Reached' : (loading ? '⏳ Generating...' : '✨ Generate Flashcards')}
          </button>

          {/* Error Display */}
          {error && (
            <div
              style={{
                marginTop: daziaTheme.spacing.lg,
                padding: daziaTheme.spacing.md,
                background: daziaTheme.colors.errorBg,
                color: daziaTheme.colors.error,
                borderRadius: daziaTheme.borderRadius.md,
                fontSize: '16px',
                border: `2px solid ${daziaTheme.colors.error}`,
              }}
            >
              {error}
            </div>
          )}
        </div>
      )}

      {/* Flashcard Display */}
      {cards.length > 0 && currentCard && (
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: daziaTheme.spacing.lg 
        }}>
          {/* Progress Counter */}
          <div
            style={{
              textAlign: 'center',
              fontSize: '18px',
              fontWeight: 600,
              color: daziaTheme.colors.primary,
            }}
          >
            Card {currentIndex + 1} of {cards.length}
          </div>

          {/* Flashcard - ENHANCED DESIGN */}
          <div
            onClick={handleFlip}
            className={flipped ? 'flashcard-flip' : 'flashcard-enter'}
            style={{
              flex: 1,
              background: flipped 
                ? daziaTheme.colors.error          // ← RED for answer
                : daziaTheme.colors.primary,       // ← YELLOW for question
              border: `3px solid ${flipped ? '#C53030' : '#E5A711'}`,
              borderRadius: daziaTheme.borderRadius.xl,
              padding: daziaTheme.spacing['4xl'],
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: flipped
                ? '0 12px 40px rgba(239, 68, 68, 0.4)'
                : '0 12px 40px rgba(253, 185, 19, 0.4)',
              minHeight: '350px',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = flipped
                ? '0 16px 48px rgba(239, 68, 68, 0.6)'
                : '0 16px 48px rgba(253, 185, 19, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = flipped
                ? '0 12px 40px rgba(239, 68, 68, 0.4)'
                : '0 12px 40px rgba(253, 185, 19, 0.4)';
            }}
          >
            {/* Side Label */}
            <div
              style={{
                position: 'absolute',
                top: daziaTheme.spacing.lg,
                left: daziaTheme.spacing.lg,
                fontSize: '14px',
                fontWeight: 700,
                color: flipped ? '#FFFFFF' : daziaTheme.colors.navy,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                background: flipped 
                  ? 'rgba(255, 255, 255, 0.2)' 
                  : 'rgba(0, 0, 0, 0.1)',
                padding: '8px 16px',
                borderRadius: daziaTheme.borderRadius.sm,
              }}
            >
              {flipped ? '❌ ANSWER' : '❓ QUESTION'}
            </div>

            {/* Card Content */}
            <div
              style={{
                fontSize: '26px',
                fontWeight: 600,
                color: flipped ? daziaTheme.colors.white : daziaTheme.colors.navy,
                textAlign: 'center',
                lineHeight: 1.6,
                maxWidth: '700px',
              }}
            >
              {flipped ? currentCard.back : currentCard.front}
            </div>

            {/* Click Hint */}
            {!flipped && (
              <div
                style={{
                  position: 'absolute',
                  bottom: daziaTheme.spacing.lg,
                  fontSize: '16px',
                  color: 'rgba(0, 0, 0, 0.6)',
                  fontWeight: 600,
                }}
              >
                👆 Click to flip
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: daziaTheme.spacing.md, 
            justifyContent: 'center',
            marginTop: daziaTheme.spacing.lg 
          }}>
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              style={{
                padding: '14px 32px',
                background: currentIndex === 0 
                  ? 'rgba(255, 255, 255, 0.1)' 
                  : daziaTheme.colors.primary,
                color: currentIndex === 0 
                  ? 'rgba(255, 255, 255, 0.3)' 
                  : daziaTheme.colors.navy,
                border: `2px solid ${daziaTheme.colors.primary}`,
                borderRadius: daziaTheme.borderRadius.md,
                fontSize: '18px',
                fontWeight: 700,
                cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              ← Previous
            </button>

            <button
              onClick={handleNext}
              disabled={currentIndex === cards.length - 1}
              style={{
                padding: '14px 32px',
                background: currentIndex === cards.length - 1 
                  ? 'rgba(255, 255, 255, 0.1)' 
                  : daziaTheme.colors.primary,
                color: currentIndex === cards.length - 1 
                  ? 'rgba(255, 255, 255, 0.3)' 
                  : daziaTheme.colors.navy,
                border: `2px solid ${daziaTheme.colors.primary}`,
                borderRadius: daziaTheme.borderRadius.md,
                fontSize: '18px',
                fontWeight: 700,
                cursor: currentIndex === cards.length - 1 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Next →
            </button>
          </div>

          {/* Reset Button */}
          <div style={{ textAlign: 'center', marginTop: daziaTheme.spacing.md }}>
            <button
              onClick={() => {
                setCards([]);
                setTopic('');
                setCurrentIndex(0);
                setFlipped(false);
              }}
              style={{
                padding: '12px 28px',
                background: 'transparent',
                color: daziaTheme.colors.primary,
                border: `2px solid ${daziaTheme.colors.primary}`,
                borderRadius: daziaTheme.borderRadius.md,
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = daziaTheme.colors.primary;
                e.currentTarget.style.color = daziaTheme.colors.navy;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = daziaTheme.colors.primary;
              }}
            >
              🔄 Generate New Set
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Flashcards;