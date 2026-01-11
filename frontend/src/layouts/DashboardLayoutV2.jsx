// src/layouts/DashboardLayoutV2.jsx
import React, { useState } from 'react';
import { daziaTheme } from '../styles/daziaTheme';
import TopNavBar from '../components/navigation/TopNavBar';
import ToolCard from '../components/cards/ToolCard';
import QuizGenerator from '../components/tools/QuizGenerator';
import Chatbot from '../components/tools/Chatbot';
import Summarizer from '../components/tools/Summarizer';
import FlashcardsFloatingPanel from '../components/cards/FlashcardsFloatingPanel';
import { useCourse } from '../context/CourseContext';

/**
 * Main Dashboard Layout V2
 * 3-Panel Design: Quiz | Chat | Summary
 * + Floating Flashcards Panel
 */
function DashboardLayoutV2() {
  const { course, setCourse } = useCourse();
  const [expandedTool, setExpandedTool] = useState(null);
  const [chatQuery, setChatQuery] = useState('');

  // ✅ UPDATED: single source of truth for per-tool usage
  const [usage, setUsage] = useState({
    quiz: 20,
    chat: 20,
    summarize: 20,
    flashcards: 20,
  });

  const handleAskAI = (query) => {
    setChatQuery(query);
    setExpandedTool('chat');
  };

  const handleSettingsClick = () => {
    alert('Settings coming soon!');
  };

  // Calculate grid columns based on expansion
  const getGridColumns = () => {
    if (!expandedTool) return '1fr 1fr 1fr';
    if (expandedTool === 'quiz') return '2fr 1fr 1fr';
    if (expandedTool === 'chat') return '1fr 2fr 1fr';
    if (expandedTool === 'summary') return '1fr 1fr 2fr';
    return '1fr 1fr 1fr';
  };

  return (
    <div
      style={{
        height: '200vh',
        display: 'flex',
        flexDirection: 'column',
        background: daziaTheme.colors.paleYellow,
      }}
    >
      {/* Top Navigation */}
      <TopNavBar
        currentCourse={course}
        usage={usage}
        onCourseChange={setCourse}
        onSettingsClick={handleSettingsClick}
      />

      {/* Main Workspace - 3 Panel Grid */}
      <main
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: getGridColumns(),
          gap: daziaTheme.spacing.lg,
          padding: daziaTheme.spacing.lg,
          transition: 'grid-template-columns 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          width: '100%',
        }}
      >
        {/* Quiz Panel */}
        <ToolCard
          tool="quiz"
          title="Exam Simulator"
          icon="✨"
          expanded={expandedTool === 'quiz'}
          onExpand={() => setExpandedTool('quiz')}
          onCollapse={() => setExpandedTool(null)}
        >
          <QuizGenerator
            usage={usage}
            onUsageUpdate={setUsage}
            onAskAI={handleAskAI}
          />
        </ToolCard>

        {/* Chat Panel */}
        <ToolCard
          tool="chat"
          title="AI Tutor"
          icon="🤖"
          prominent
          expanded={expandedTool === 'chat'}
          onExpand={() => setExpandedTool('chat')}
          onCollapse={() => setExpandedTool(null)}
        >
          <Chatbot
            usage={usage}
            initialQuery={chatQuery}
            onUsageUpdate={setUsage}
          />
        </ToolCard>

        {/* Summary Panel */}
        <ToolCard
          tool="summary"
          title="Topic Summarizer"
          icon="📄"
          expanded={expandedTool === 'summary'}
          onExpand={() => setExpandedTool('summary')}
          onCollapse={() => setExpandedTool(null)}
        >
          <Summarizer
            usage={usage}
            onUsageUpdate={setUsage}
            onAskAI={handleAskAI}
          />
        </ToolCard>
      </main>

      {/* Floating Flashcards Panel */}
      <FlashcardsFloatingPanel
        usage={usage}
        onUsageUpdate={setUsage}
      />
    </div>
  );
}

export default DashboardLayoutV2;
