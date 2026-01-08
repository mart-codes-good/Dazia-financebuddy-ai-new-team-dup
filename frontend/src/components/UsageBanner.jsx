import React from 'react';
import { theme } from '../theme'; // Ensure this points to your new theme.js

function UsageBanner({ usage }) {
  // 1. Safety Check (Matches your original logic)
  if (!usage) return null;

  // 2. Extract values safely
  const used = usage.used || 0;
  const limit = usage.limit || 20;
  
  // 3. Calculate percentage for the bar width
  // Clamp it to 100% so the bar never breaks layout
  const percentage = Math.min((used / limit) * 100, 100);

  // 4. Dynamic Color Logic (Using the new Theme)
  let progressColor = theme.colors.success;
  if (percentage > 50) progressColor = theme.colors.warning;
  if (percentage > 85) progressColor = theme.colors.error;

  return (
    <div style={{
      background: theme.colors.bg.card,
      padding: "15px 20px",
      borderRadius: theme.radius.md,
      boxShadow: theme.shadows.sm,
      border: `1px solid ${theme.colors.bg.border}`,
      marginBottom: "20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "20px"
    }}>
      {/* LEFT: Label Section */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "24px" }}>💳</span>
        <div>
          <h4 style={{ 
            margin: 0, 
            color: theme.colors.text.main, 
            fontSize: "14px", 
            fontWeight: "700" 
          }}>
            Free Plan Credits
          </h4>
          <span style={{ fontSize: "12px", color: theme.colors.text.secondary }}>
            Resets daily
          </span>
        </div>
      </div>

      {/* RIGHT: Meter Section */}
      <div style={{ flex: 1, maxWidth: "300px" }}>
        {/* Text Labels above bar */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          fontSize: "12px", 
          marginBottom: "6px",
          fontWeight: "600",
          color: theme.colors.text.secondary
        }}>
          <span>Usage</span>
          <span style={{ color: theme.colors.text.main }}>
            {used} / {limit}
          </span>
        </div>
        
        {/* The Progress Bar Container */}
        <div style={{
          height: "10px",
          background: theme.colors.bg.main, // Light gray track
          borderRadius: theme.radius.pill,
          overflow: "hidden"
        }}>
          {/* The Animated Fill */}
          <div style={{
            width: `${percentage}%`,
            height: "100%",
            background: progressColor,
            borderRadius: theme.radius.pill,
            transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease" 
          }} />
        </div>
      </div>
    </div>
  );
}

export default UsageBanner;