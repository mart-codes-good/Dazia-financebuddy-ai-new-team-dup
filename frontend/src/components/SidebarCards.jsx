// src/components/SidebarCards.jsx
import React from 'react';
import { theme } from '../theme';

// 1. A Reusable "Glass" Card Container
const GlassCard = ({ children, border = false }) => (
  <div style={{
    background: "rgba(255, 255, 255, 0.05)", // Subtle transparency
    backdropFilter: "blur(10px)",
    border: border ? "1px solid rgba(255, 255, 255, 0.1)" : "none",
    borderRadius: theme.radius.md,
    padding: "16px",
    marginBottom: "16px",
    color: theme.colors.text.light,
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
  }}>
    {children}
  </div>
);

// 2. Dark Mode Health Status (Replaces the yellow box)
export const DarkHealthStatus = () => (
  <GlassCard border>
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
      {/* Pulse Animation for the Green Dot */}
      <div style={{ 
        width: "8px", height: "8px", 
        background: "#10B981", 
        borderRadius: "50%", 
        boxShadow: "0 0 8px rgba(16, 185, 129, 0.6)" 
      }} />
      <span style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.5px", textTransform: "uppercase", opacity: 0.9 }}>
        System Operational
      </span>
    </div>
    <div style={{ fontSize: "11px", opacity: 0.5, paddingLeft: "18px" }}>
      v2.4.0 • Connected to FinanceBuddy API
    </div>
  </GlassCard>
);

// 3. Dark Mode Usage Banner
export const DarkUsageBanner = ({ used = 0, limit = 20 }) => {
  const percent = Math.min((used / limit) * 100, 100);
  
  // Color logic: Blue normally, Orange if > 75%, Red if full
  let barColor = "#3B82F6"; 
  if (percent > 75) barColor = "#F59E0B";
  if (percent >= 100) barColor = "#EF4444";

  return (
    <GlassCard>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "12px" }}>
        <span style={{ opacity: 0.7 }}>Daily AI Credits</span>
        <span style={{ fontWeight: "600", fontFamily: "monospace" }}>{used} / {limit}</span>
      </div>
      
      {/* Progress Bar Container */}
      <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "10px", overflow: "hidden" }}>
        {/* Active Progress */}
        <div style={{ 
          width: `${percent}%`, 
          height: "100%", 
          background: barColor, 
          transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)"
        }} />
      </div>
    </GlassCard>
  );
};

// 4. Context Aware Tip (The "Smart" Part)
export const ContextTip = ({ mode, course }) => {
  const tips = {
    quiz: {
      title: "🧠 Quiz Mode",
      text: `Focus on "Why" the answer is correct. The AI will provide detailed feedback for ${course} questions.`
    },
    chat: {
      title: "💬 Tutor Chat",
      text: "Stuck on a concept? Ask the tutor to 'Explain like I'm 5' or 'Give me a real-world example'."
    },
    summary: {
      title: "📝 Summarizer",
      text: "Paste your textbook notes here. The AI will extract key definitions and exam formulas."
    }
  };

  const activeTip = tips[mode] || tips.quiz;

  return (
    <div style={{ 
      marginTop: "12px", 
      padding: "16px", 
      borderTop: "1px solid rgba(255,255,255,0.1)" 
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <span style={{ fontSize: "16px" }}>💡</span>
        <strong style={{ color: theme.colors.accent, fontSize: "13px" }}>
          {activeTip.title}
        </strong>
      </div>
      <p style={{ fontSize: "13px", margin: 0, color: "rgba(255,255,255,0.6)", lineHeight: "1.5" }}>
        {activeTip.text}
      </p>
    </div>
  );
};