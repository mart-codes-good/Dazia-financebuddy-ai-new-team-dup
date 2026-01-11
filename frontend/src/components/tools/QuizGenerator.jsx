import { useEffect, useState } from "react";
import { getTopics, generateQuiz } from "../../api/financeBuddyApi";
import { useCourse } from "../../context/CourseContext";
import { BrainCircuit, CheckCircle2, XCircle, AlertCircle, Play, Sparkles } from 'lucide-react';

function QuizGenerator({ usage, onUsageUpdate, onAskAI }) {
  const { course } = useCourse(); 

  // ✅ STATE (PRESERVED)
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [count, setCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quizData, setQuizData] = useState(null); 
  const [answers, setAnswers] = useState({}); 
  const [submitted, setSubmitted] = useState(false);

  // ✅ DERIVED STATE: Check global limit
  const quizLimitReached = usage?.quiz === 0;

  // ✅ LOGIC: Load Topics
  useEffect(() => {
    setSelectedTopic(""); 
    setQuizData(null);
    setSubmitted(false);
    setAnswers({});
    
    getTopics(course)
      .then((data) => {
        const list = data?.data?.topics || data?.topics || [];
        setTopics(list);
      })
      .catch((err) => setError("Could not load topics: " + err.message));
  }, [course]);

  // ✅ LOGIC: Generate Quiz (UPDATED with Usage Handling)
  const handleGenerate = async () => {
    // 1. Check limit before calling API
    if (quizLimitReached) {
      setError("⚠️ Daily quiz limit reached. Try again tomorrow.");
      return;
    }

    setLoading(true);
    setError("");
    setQuizData(null);
    setAnswers({});
    setSubmitted(false);

    try {
      // 2. Call API
      const data = await generateQuiz(course, selectedTopic, Number(count));
      
      const questions = data?.data?.questions || data?.questions || [];
      setQuizData(questions);
      
      // 3. Update Global Usage on Success
      if (data.usage && onUsageUpdate) {
        onUsageUpdate(data.usage);
      }

    } catch (err) {
      // 4. Handle 402 (Limit Reached) specifically
      if (err.status === 402) {
        if (err.usage && onUsageUpdate) {
          onUsageUpdate(err.usage); // Lock the UI immediately
        }
        setError("⚠️ Daily quiz limit reached.");
      } else {
        setError("⚠️ " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ LOGIC: Handle Select
  const handleSelect = (qIdx, optIdx) => {
    if (submitted) return; 
    setAnswers({ ...answers, [qIdx]: optIdx });
  };

  // ✅ LOGIC: Score
  const calculateScore = () => {
    if (!quizData) return 0;
    let correct = 0;
    quizData.forEach((q, idx) => {
      if (answers[idx] === q.correctAnswer) correct++;
    });
    return correct;
  };

  // ✅ NEW SAAS UI
  return (
    <div style={{ 
      width: "100%", 
      maxWidth: "800px", 
      margin: "0 auto", 
      paddingBottom: "40px" 
    }}>
      
      {/* HEADER CARD */}
      <div style={{ 
        background: "#1e293b", 
        border: "1px solid rgba(255,255,255,0.05)",
        borderRadius: "20px", 
        padding: "32px",
        marginBottom: "32px",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
           <div style={{ background: "rgba(56, 189, 248, 0.1)", padding: "8px", borderRadius: "10px" }}>
             <Sparkles size={24} color="#38bdf8" />
           </div>
           <div>
             <h2 style={{ margin: 0, fontSize: "1.5rem", color: "white" }}>Exam Simulation</h2>
             <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: "0.9rem" }}>
               Generate practice questions for <strong>{course}</strong>.
             </p>
           </div>
        </div>

        {/* ERROR STATE */}
        {error && (
          <div style={{ 
            marginBottom: "20px", padding: "12px", borderRadius: "8px",
            background: "rgba(239, 68, 68, 0.1)", color: "#fca5a5", border: "1px solid rgba(239, 68, 68, 0.2)",
            display: "flex", alignItems: "center", gap: "10px"
          }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {/* CONTROLS GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: "16px", alignItems: "end" }}>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Topic</label>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              style={{ 
                width: "100%", padding: "14px", borderRadius: "12px",
                background: "#0f172a", border: "1px solid #334155", color: "white", outline: "none", fontSize: "0.95rem"
              }}
            >
              <option value="">Select a Topic...</option>
              {topics.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Count</label>
            <select
              value={count}
              onChange={(e) => setCount(e.target.value)}
              style={{ 
                width: "100%", padding: "14px", borderRadius: "12px",
                background: "#0f172a", border: "1px solid #334155", color: "white", outline: "none", fontSize: "0.95rem"
              }}
            >
              <option value="1">1 Question</option>
              <option value="3">3 Questions</option>
              <option value="5">5 Questions</option>
              <option value="10">10 Questions</option>
            </select>
          </div>

          {/* UPDATE: Button handles disabled state and text changes */}
          <button
            onClick={handleGenerate}
            disabled={loading || !selectedTopic || quizLimitReached}
            style={{
              padding: "14px 24px",
              background: quizLimitReached ? "#475569" : (loading ? "#334155" : "#38bdf8"),
              color: quizLimitReached ? "#94a3b8" : (loading ? "#94a3b8" : "#0f172a"),
              border: "none", borderRadius: "12px", fontWeight: "600",
              cursor: (loading || quizLimitReached) ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: "8px",
              transition: "all 0.2s"
            }}
          >
            {quizLimitReached 
              ? "Limit Reached" 
              : (loading ? "Generating..." : <><Play size={18} fill="#0f172a" /> Start Quiz</>)
            }
          </button>
        </div>

        {/* NEW: Usage Indicator */}
        <div style={{ marginTop: "15px", fontSize: '0.85rem', color: "#64748b", textAlign: "right" }}>
          Daily Credits: <strong style={{ color: quizLimitReached ? "#ef4444" : "#38bdf8" }}>{usage?.quiz ?? 0}</strong> / 20
        </div>
      </div>

      {/* EMPTY STATE */}
      {!quizData && !loading && (
        <div style={{ 
          textAlign: "center", padding: "60px 20px", 
          border: "2px dashed rgba(255,255,255,0.05)", borderRadius: "24px"
        }}>
          <div style={{ opacity: 0.3, marginBottom: "16px" }}>
            <BrainCircuit size={48} color="white" />
          </div>
          <h3 style={{ color: "#e2e8f0", marginTop: 0 }}>Ready to Practice?</h3>
          <p style={{ color: "#64748b" }}>Select a topic above to generate AI-powered questions.</p>
        </div>
      )}

      {/* QUIZ QUESTIONS */}
      {quizData && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {quizData.map((q, qIdx) => {
            const userAnswer = answers[qIdx];
            const isCorrect = userAnswer === q.correctAnswer;
            
            // Border logic for results
            let borderColor = "rgba(255,255,255,0.05)";
            if (submitted) {
               borderColor = isCorrect ? "rgba(34, 197, 94, 0.5)" : "rgba(239, 68, 68, 0.5)";
            }

            return (
              <div key={qIdx} style={{ 
                padding: "24px", 
                background: "#1e293b", 
                border: `1px solid ${borderColor}`, 
                borderRadius: "20px",
                position: "relative"
              }}>
                {/* Question Number */}
                <span style={{ 
                  position: "absolute", top: "24px", left: "24px", 
                  fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" 
                }}>
                  Question {qIdx + 1}
                </span>

                <h4 style={{ margin: "24px 0 20px 0", color: "#e2e8f0", fontSize: "1.1rem", lineHeight: "1.6" }}>
                  {q.question}
                </h4>

                {/* Options */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {q.options.map((opt, optIdx) => {
                    let bg = "rgba(15, 23, 42, 0.5)";
                    let border = "1px solid rgba(255,255,255,0.05)";
                    let textColor = "#cbd5e1";
                    
                    if (submitted) {
                      if (optIdx === q.correctAnswer) {
                        bg = "rgba(34, 197, 94, 0.2)"; border = "1px solid #22c55e"; textColor = "#4ade80";
                      } else if (optIdx === userAnswer && !isCorrect) {
                        bg = "rgba(239, 68, 68, 0.2)"; border = "1px solid #ef4444"; textColor = "#f87171";
                      }
                    } else if (optIdx === userAnswer) {
                      bg = "rgba(56, 189, 248, 0.2)"; border = "1px solid #38bdf8"; textColor = "#38bdf8";
                    }

                    return (
                      <div
                        key={optIdx}
                        onClick={() => handleSelect(qIdx, optIdx)}
                        style={{
                          padding: "16px", borderRadius: "12px",
                          background: bg, border: border, color: textColor,
                          cursor: submitted ? "default" : "pointer",
                          transition: "all 0.2s", fontSize: "0.95rem",
                          display: "flex", alignItems: "center", justifyContent: "space-between"
                        }}
                      >
                        {opt}
                        {submitted && optIdx === q.correctAnswer && <CheckCircle2 size={18} color="#4ade80" />}
                        {submitted && optIdx === userAnswer && !isCorrect && <XCircle size={18} color="#f87171" />}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {submitted && (
                  <div style={{ 
                    marginTop: "20px", padding: "20px", borderRadius: "12px",
                    background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.2)"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", color: "#fbbf24", fontWeight: "700", fontSize: "0.9rem" }}>
                      <BrainCircuit size={18} /> Explanation
                    </div>
                    <p style={{ margin: 0, color: "#fcd34d", lineHeight: "1.6", fontSize: "0.95rem" }}>{q.explanation}</p>
                    
                    {/* Ask Tutor Button */}
                    <button
                      onClick={() => {
                        const query = `I am confused about this quiz question:\n\n"${q.question}"\n\nThe correct answer is "${q.options[q.correctAnswer]}".\n\nCan you explain this in simpler terms?`;
                        if (onAskAI) onAskAI(query);
                      }}
                      style={{
                        marginTop: "16px", padding: "10px 16px", background: "#1e293b",
                        border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
                        color: "#e2e8f0", fontSize: "0.85rem", cursor: "pointer", fontWeight: "500"
                      }}
                    >
                      💬 Ask Tutor to Explain
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* RESULTS FOOTER */}
          {!submitted ? (
             <button
               onClick={() => setSubmitted(true)}
               disabled={Object.keys(answers).length < quizData.length}
               style={{
                 width: "100%", padding: "18px", borderRadius: "16px",
                 background: "#38bdf8", color: "#0f172a", border: "none",
                 fontWeight: "700", fontSize: "1rem", cursor: "pointer",
                 opacity: Object.keys(answers).length < quizData.length ? 0.5 : 1
               }}
             >
               Submit All Answers
             </button>
          ) : (
            <div style={{ 
              textAlign: "center", padding: "40px", borderRadius: "20px",
              background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)"
            }}>
              <h2 style={{ color: "#4ade80", marginBottom: "20px", fontSize: "2rem" }}>
                Score: {calculateScore()} / {quizData.length}
              </h2>
              <button 
                onClick={handleGenerate} 
                style={{ 
                  padding: "12px 32px", background: "#22c55e", color: "#052e16",
                  border: "none", borderRadius: "10px", fontWeight: "700", cursor: "pointer"
                }}
              >
                Start New Quiz
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default QuizGenerator;