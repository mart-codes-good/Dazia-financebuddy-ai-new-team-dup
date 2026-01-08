// src/components/DashboardLayout.jsx
import React, { useState } from 'react';
import {
  BookOpen, BrainCircuit, LayoutDashboard, MessageSquare,
  LogOut, Sparkles, FileText, ChevronDown
} from 'lucide-react';

import Chatbot from './Chatbot';
import QuizGenerator from './QuizGenerator';
import Summarizer from './Summarizer';
import { useCourse } from '../context/CourseContext';

// ✅ CRITICAL FIX: Use original HealthStatus with backend check
import HealthStatus from './HealthStatus';
// ✅ Import dark-themed sidebar components
import { DarkUsageBanner, ContextTip } from './SidebarCards';

const DashboardLayout = () => {
  const { course, setCourse } = useCourse();
  const [activeTab, setActiveTab] = useState("chat");
  const [chatQuery, setChatQuery] = useState("");
  
  // ✅ CRITICAL FIX: Safe default state prevents crash on first render
  const [usage, setUsage] = useState({ used: 0, limit: 20 }); 

  const handleAskAI = (query) => {
    setChatQuery(query);
    setActiveTab("chat");
  };

  const NavItem = ({ icon: Icon, label, id }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        display: "flex", alignItems: "center", width: "100%", 
        padding: "12px 16px", marginBottom: "8px",
        borderRadius: "12px", border: "none",
        background: activeTab === id ? "rgba(56, 189, 248, 0.15)" : "transparent",
        color: activeTab === id ? "#38bdf8" : "#94a3b8",
        cursor: "pointer", fontWeight: activeTab === id ? "600" : "500", 
        textAlign: "left"
      }}
    >
      <Icon size={20} style={{ marginRight: "12px" }} />
      {label}
    </button>
  );

  return (
    <div style={{ 
      display: "flex", height: "100vh", width: "100vw", 
      background: "#0f172a", color: "#f8fafc", overflow: "hidden" 
    }}>

      {/* ==================== SIDEBAR ==================== */}
      <aside style={{ 
        width: "280px", background: "#020617", 
        borderRight: "1px solid rgba(255,255,255,0.05)", 
        padding: "24px", display: "flex", flexDirection: "column", gap: "20px" 
      }}>

        {/* BRAND */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ 
            background: "linear-gradient(135deg, #38bdf8, #2563eb)", 
            padding: "8px", borderRadius: "10px" 
          }}>
            <BrainCircuit size={24} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.2rem" }}>FinanceBuddy</h1>
            <span style={{ fontSize: "0.7rem", color: "#64748b" }}>AI TUTOR</span>
          </div>
        </div>

        {/* ✅ FIX #1: RESTORED - Real health check with backend monitoring */}
        <HealthStatus />

        {/* ✅ FIX #2: RESTORED - Usage tracking with safe props */}
        <DarkUsageBanner used={usage.used} limit={usage.limit} />

        {/* COURSE SELECTOR */}
        <div>
          <label style={{ 
            fontSize: "0.75rem", color: "#64748b", 
            fontWeight: "bold", textTransform: "uppercase" 
          }}>
            Active Course
          </label>
          <div style={{ position: "relative", marginTop: "8px" }}>
            <select
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              style={{
                width: "100%", padding: "12px", borderRadius: "10px",
                background: "#1e293b", color: "white", 
                border: "1px solid rgba(255,255,255,0.1)",
                appearance: "none", cursor: "pointer"
              }}
            >
              {/* ✅ FIX #4: Hardcoded correct certification courses */}
              <option value="IFIC">IFIC (Mutual Funds)</option>
              <option value="CSC">CSC (Securities)</option>
              <option value="CAPM">CAPM (Project Mgmt)</option>
              <option value="PMP">PMP (Professional)</option>
            </select>
            <ChevronDown size={16} style={{ 
              position: "absolute", right: "12px", top: "50%", 
              transform: "translateY(-50%)", pointerEvents: "none" 
            }} />
          </div>
        </div>

        {/* NAVIGATION */}
        <div style={{ flex: 1 }}>
          <label style={{ 
            fontSize: "0.75rem", color: "#64748b", 
            fontWeight: "bold", textTransform: "uppercase", 
            display: "block", marginBottom: "10px" 
          }}>
            Tools
          </label>
          <NavItem icon={MessageSquare} label="AI Tutor" id="chat" />
          <NavItem icon={Sparkles} label="Exam Simulator" id="quiz" />
          <NavItem icon={FileText} label="Summarizer" id="summary" />
          
          {/* ✅ BONUS: Context-aware learning tips */}
          <ContextTip mode={activeTab} course={course} />
        </div>

        {/* SIGN OUT */}
        <div>
          <button style={{ 
            color: "#64748b", background: "none", border: "none", 
            cursor: "pointer", display: "flex", gap: "10px", alignItems: "center" 
          }}>
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ==================== MAIN CONTENT ==================== */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        
        {/* HEADER */}
        <header style={{ 
          height: "70px", padding: "0 32px", 
          display: "flex", alignItems: "center", 
          borderBottom: "1px solid rgba(255,255,255,0.05)", 
          justifyContent: "space-between" 
        }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "600" }}>
            {activeTab === "chat" && "Interactive Tutor"}
            {activeTab === "quiz" && "Exam Simulator"}
            {activeTab === "summary" && "Topic Summarizer"}
          </h2>
        </header>

        {/* CONTENT AREA */}
        <div style={{ 
          flex: 1, padding: "24px", overflow: "hidden", display: "flex" 
        }}>
          {activeTab === "chat" && (
            <Chatbot 
              initialQuery={chatQuery} 
              onUsageUpdate={setUsage} 
            />
          )}
          
          {/* ✅ FIX #3: CRITICAL - Added onUsageUpdate prop */}
          {activeTab === "quiz" && (
            <QuizGenerator 
              onAskAI={handleAskAI} 
              onUsageUpdate={setUsage}  // ← THIS WAS MISSING
            />
          )}
          
          {activeTab === "summary" && (
            <Summarizer 
              onAskAI={handleAskAI} 
              onUsageUpdate={setUsage} 
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;