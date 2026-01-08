import { useState, useRef, useEffect } from "react";
import { askChatbot } from "../api/financeBuddyApi";
import { useCourse } from "../context/CourseContext";
import { Send, Bot, AlertCircle, Loader2 } from 'lucide-react';

function Chatbot({ onUsageUpdate, initialQuery }) {
  const { course } = useCourse();
  
  const [messages, setMessages] = useState([
    { role: "bot", text: `Hello! I am your ${course} AI Tutor. Ask me anything!` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (initialQuery) {
      setInput(initialQuery);
      // Optional: Auto-send could be added here later
    }
  }, [initialQuery]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = { role: "user", text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const data = await askChatbot(course, userMsg.text);
      if (data.usage && onUsageUpdate) onUsageUpdate(data.usage);
      const answer = data?.data?.answer || data?.answer || "No answer returned.";
      setMessages(prev => [...prev, { role: "bot", text: answer }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "error", text: `⚠️ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      height: "100%", 
      width: "100%",
      background: "rgba(30, 41, 59, 0.3)", 
      border: "1px solid rgba(255,255,255,0.05)",
      borderRadius: "20px",
      overflow: "hidden",
      backdropFilter: "blur(10px)"
    }}>
      
      {/* MESSAGES AREA */}
      <div style={{ 
        flex: 1, 
        minHeight: 0, 
        padding: "30px", 
        overflowY: "auto", 
        display: "flex",
        flexDirection: "column",
        gap: "24px"
      }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ 
            display: "flex", 
            justifyContent: msg.role === 'user' ? "flex-end" : "flex-start",
            gap: "16px", // Increased gap
            alignItems: "flex-start"
          }}>
            {msg.role !== 'user' && (
              <div style={{ 
                minWidth: "36px", height: "36px", borderRadius: "50%", 
                background: msg.role === 'error' ? "#ef4444" : "#38bdf8", 
                display: "flex", alignItems: "center", justifyContent: "center", marginTop: "4px"
              }}>
                {msg.role === 'error' ? <AlertCircle size={20} color="white"/> : <Bot size={20} color="#0f172a" />}
              </div>
            )}
            
            <div style={{
              maxWidth: "75%",
              padding: "18px 24px", // ✅ BIGGER PADDING
              borderRadius: "16px",
              background: msg.role === 'user' ? "#38bdf8" : msg.role === 'error' ? "rgba(239, 68, 68, 0.1)" : "#1e293b",
              color: msg.role === 'user' ? "#0f172a" : msg.role === 'error' ? "#fca5a5" : "#e2e8f0",
              fontSize: "1.05rem", // ✅ BIGGER FONT SIZE
              lineHeight: "1.6",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)"
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        
        {loading && (
          <div style={{ display: "flex", gap: "12px", alignItems: "center", paddingLeft: "10px" }}>
             <Loader2 size={20} color="#94a3b8" style={{ animation: "spin 1s linear infinite" }} />
             <span style={{ color: "#94a3b8", fontSize: "0.95rem" }}>Tutor is thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <div style={{ 
        padding: "24px 32px", // Wider padding
        background: "rgba(15, 23, 42, 0.8)",
        borderTop: "1px solid rgba(255,255,255,0.05)"
      }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={loading}
            placeholder={`Ask about ${course}...`}
            style={{
              width: "100%",
              background: "#0f172a",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: "16px", // Softer corners
              padding: "20px 70px 20px 24px", // Taller input area
              color: "white",
              fontSize: "1.1rem", // ✅ LARGER INPUT TEXT
              outline: "none",
              boxShadow: "0 0 0 2px rgba(56, 189, 248, 0.05)"
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            style={{
              position: "absolute",
              right: "12px",
              background: input.trim() ? "#38bdf8" : "#334155",
              color: "#0f172a",
              border: "none",
              borderRadius: "12px",
              width: "48px",
              height: "48px",
              cursor: input.trim() ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s"
            }}
          >
            <Send size={22} />
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default Chatbot;