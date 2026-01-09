// src/components/cards/ToolCard.jsx
import React, { useState } from 'react';
import { daziaTheme } from '../../styles/daziaTheme';

/**
 * Reusable Tool Panel Card
 * Fixes typography scaling and contrast issues
 */
function ToolCard({
  tool,
  title,
  icon,
  expanded,
  onExpand,
  onCollapse,
  children,
  prominent = false
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="tool-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => !expanded && onExpand()}
      style={{
        background: '#020617', // 🔑 dark surface (matches tools)
        color: '#E5E7EB',
        borderRadius: daziaTheme.borderRadius.xl,
        border: `2px solid ${
          expanded || isHovered
            ? daziaTheme.colors.primary
            : 'rgba(255,255,255,0.08)'
        }`,
        boxShadow: isHovered || expanded
          ? daziaTheme.shadows.hoverYellow
          : daziaTheme.shadows.md,
        padding: daziaTheme.spacing.lg,
        display: 'flex',
        flexDirection: 'column',
        cursor: expanded ? 'default' : 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        height: '100%',
        minHeight: prominent ? '600px' : '520px',
        position: 'relative',
        overflow: 'hidden',
        fontSize: '16px' // ✅ FORCE BASE SIZE
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: daziaTheme.spacing.lg,
          paddingBottom: daziaTheme.spacing.md,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: daziaTheme.spacing.sm }}>
          <span style={{ fontSize: '24px' }}>{icon}</span>
          <h3
            style={{
              margin: 0,
              fontSize: '20px', // ✅ explicit readable title
              fontWeight: 700,
              color: '#F8FAFC',
            }}
          >
            {title}
          </h3>
        </div>

        {expanded && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCollapse();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#CBD5E1',
              padding: daziaTheme.spacing.xs,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          fontSize: '1rem',   // 🔑 locks readable size
          lineHeight: '1.6'
        }}
      >
        {children}
      </div>

      {/* Hover Hint */}
      {!expanded && isHovered && (
        <div
          className="fade-in"
          style={{
            position: 'absolute',
            bottom: daziaTheme.spacing.lg,
            left: '50%',
            transform: 'translateX(-50%)',
            background: daziaTheme.colors.primary,
            color: '#020617',
            padding: `${daziaTheme.spacing.sm} ${daziaTheme.spacing.lg}`,
            borderRadius: daziaTheme.borderRadius.full,
            fontSize: '34px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: daziaTheme.shadows.md,
          }}
        >
          Click to expand ↗
        </div>
      )}
    </div>
  );
}

export default ToolCard;
