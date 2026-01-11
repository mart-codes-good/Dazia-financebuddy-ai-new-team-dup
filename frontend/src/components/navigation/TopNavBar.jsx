// src/components/navigation/TopNavBar.jsx
import React from 'react';
import { daziaTheme } from '../../styles/daziaTheme';
import CourseDropdown from './CourseDropdown';

/**
 * Top Navigation Bar
 * Logo, Course Selector, Usage Display, Settings
 */
function TopNavBar({ currentCourse, usage, onCourseChange, onSettingsClick }) {
  return (
    <nav
      style={{
        height: '70px',
        background: daziaTheme.colors.white,
        borderBottom: `2px solid ${daziaTheme.colors.lightYellow}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${daziaTheme.spacing.xl}`,
        boxShadow: daziaTheme.shadows.sm,
        position: 'sticky',
        top: 0,
        zIndex: daziaTheme.zIndex.sticky,
      }}
    >
      {/* Left: Logo + Course */}
      <div style={{ display: 'flex', alignItems: 'center', gap: daziaTheme.spacing.xl }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: daziaTheme.spacing.sm }}>
          <span style={{ fontSize: '32px' }}>🎓</span>
          <h1
            style={{
              margin: 0,
              fontSize: daziaTheme.typography.fontSize['2xl'],
              fontWeight: daziaTheme.typography.fontWeight.bold,
              color: daziaTheme.colors.navy,
            }}
          >
            FinanceBuddy
          </h1>
        </div>

        {/* Course Dropdown */}
        <CourseDropdown current={currentCourse} onChange={onCourseChange} />
      </div>

      {/* Right: Settings */}
      <button
        onClick={onSettingsClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: daziaTheme.spacing.sm,
          padding: `${daziaTheme.spacing.sm} ${daziaTheme.spacing.lg}`,
          background: 'transparent',
          border: `2px solid ${daziaTheme.colors.gray200}`,
          borderRadius: daziaTheme.borderRadius.md,
          color: daziaTheme.colors.gray700,
          fontSize: daziaTheme.typography.fontSize.base,
          fontWeight: daziaTheme.typography.fontWeight.medium,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.borderColor = daziaTheme.colors.primary;
          e.currentTarget.style.color = daziaTheme.colors.navy;
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.borderColor = daziaTheme.colors.gray200;
          e.currentTarget.style.color = daziaTheme.colors.gray700;
        }}
      >
        <span style={{ fontSize: '18px' }}>⚙️</span>
        <span>Settings</span>
      </button>
    </nav>
  );
}

export default TopNavBar;