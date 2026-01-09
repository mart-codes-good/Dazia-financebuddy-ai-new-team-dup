// src/components/cards/FlashcardsFloatingPanel.jsx
import React, { useState } from 'react';
import { daziaTheme } from '../../styles/daziaTheme';
import Flashcards from '../tools/Flashcards';

/**
 * Enhanced Floating Flashcards Panel
 * Bottom-center, bigger, better animations
 */
function FlashcardsFloatingPanel({ onUsageUpdate }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Bottom Bar (Collapsed State) - ENHANCED */}
      {!isOpen && (
        <div
          className="flashcards-panel"
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '500px',                           // ← BIGGER (was 400px)
            height: '70px',                           // ← TALLER (was 60px)
            background: daziaTheme.colors.primary,
            borderRadius: `${daziaTheme.borderRadius.xl} ${daziaTheme.borderRadius.xl} 0 0`,
            boxShadow: '0 -4px 20px rgba(253, 185, 19, 0.5)',  // ← Yellow glow
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: daziaTheme.spacing.md,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            zIndex: daziaTheme.zIndex.modal,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateX(-50%) translateY(-12px)';  // ← Lift more
            e.currentTarget.style.boxShadow = '0 -8px 32px rgba(253, 185, 19, 0.7)';
            e.currentTarget.style.height = '80px';   // ← Grow on hover
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateX(-50%) translateY(0)';
            e.currentTarget.style.boxShadow = '0 -4px 20px rgba(253, 185, 19, 0.5)';
            e.currentTarget.style.height = '70px';
          }}
        >
          <span style={{ fontSize: '36px' }}>📚</span>  {/* ← BIGGER icon */}
          <span
            style={{
              fontSize: '24px',                       // ← BIGGER text (was 18px)
              fontWeight: 700,
              color: daziaTheme.colors.white,
              letterSpacing: '0.02em',
            }}
          >
            Flashcards
          </span>
          <span style={{ fontSize: '24px', color: daziaTheme.colors.white }}>↑</span>
        </div>
      )}

      {/* Expanded Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)',      // ← Darker backdrop
              zIndex: daziaTheme.zIndex.modal - 1,
            }}
          />

          {/* Flashcards Panel */}
          <div
            className="slide-up"
            style={{
              position: 'fixed',
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '90%',
              maxWidth: '900px',                     // ← Wider (was 800px)
              height: '75vh',                        // ← Taller (was 70vh)
              background: daziaTheme.colors.navy,    // ← NAVY background
              borderRadius: `${daziaTheme.borderRadius.xl} ${daziaTheme.borderRadius.xl} 0 0`,
              boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.5)',
              zIndex: daziaTheme.zIndex.modal,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: daziaTheme.spacing.lg,
                borderBottom: `2px solid ${daziaTheme.colors.primary}`,  // ← Yellow border
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(253, 185, 19, 0.1)',  // ← Subtle yellow tint
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: daziaTheme.spacing.sm }}>
                <span style={{ fontSize: '36px' }}>📚</span>  {/* ← Bigger */}
                <h2
                  style={{
                    margin: 0,
                    fontSize: '32px',                     // ← Bigger title
                    fontWeight: 800,
                    color: daziaTheme.colors.primary,     // ← Yellow title
                  }}
                >
                  Flashcards
                </h2>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'transparent',
                  border: `2px solid ${daziaTheme.colors.primary}`,
                  color: daziaTheme.colors.primary,
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '8px 16px',
                  borderRadius: daziaTheme.borderRadius.md,
                  fontWeight: 700,
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
                ✕ Close
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, padding: daziaTheme.spacing.xl, overflow: 'auto' }}>
              <Flashcards onUsageUpdate={onUsageUpdate} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default FlashcardsFloatingPanel;