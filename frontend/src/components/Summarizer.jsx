// src/components/Summarizer.jsx
import { useState } from "react";
import { useCourse } from "../context/CourseContext";
import { generateSummary } from "../api/financeBuddyApi";
import { theme } from "../theme";

function Summarizer({ onUsageUpdate, onAskAI }) {
  const { course } = useCourse();
  const [topic, setTopic] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!topic.trim()) return;

    setLoading(true);
    setError("");
    setSummary("");

    try {
      const data = await generateSummary(course, topic);
      const summaryText =
        data.summary || data.data?.summary || "No summary returned.";

      setSummary(summaryText);

      if (data.usage && onUsageUpdate) {
        onUsageUpdate(data.usage);
      }
    } catch (err) {
      console.error(err);
  
      // Use the actual error message from backend
      const errorMsg = err.message || "Unknown error";
  
      // Customize based on content
      if (errorMsg.toLowerCase().includes('limit') || 
          errorMsg.toLowerCase().includes('exceeded')) {
        setError(errorMsg);  // Shows: "⚠️ Free limit of 20 uses exceeded"
      } else {
        setError(errorMsg);  // Shows actual backend error
      }
    } finally {
  setLoading(false);
    }
  };

  return (
    /* 🔑 FULL HEIGHT WORKSPACE CONTAINER */
    <div
      style={{
        flex: 1,
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        background: "rgba(30, 41, 59, 0.35)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "20px",
        padding: "32px",
        backdropFilter: "blur(10px)",
        overflow: "hidden"
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ margin: 0, fontSize: "22px", color: "#E5E7EB" }}>
          Topic Summarizer
        </h2>
        <p style={{ marginTop: "6px", color: "#94A3B8", fontSize: "14px" }}>
          Generate concise cheat-sheets for <strong>{course}</strong> topics.
        </p>
      </div>

      {error && (
        <div
          style={{
            padding: "12px",
            background: "rgba(239, 68, 68, 0.15)",
            color: "#FCA5A5",
            borderRadius: "10px",
            marginBottom: "20px",
            border: "1px solid rgba(239, 68, 68, 0.4)"
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Input Row */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={`Enter topic (e.g. "Mutual Funds", "KYC")`}
          onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          style={{
            flex: 1,
            padding: "14px 16px",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "#0F172A",
            color: "#F8FAFC",
            fontSize: "15px",
            outline: "none"
          }}
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !topic}
          style={{
            padding: "0 28px",
            borderRadius: "12px",
            background: loading ? "#64748B" : "#38BDF8",
            color: "#0F172A",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: "700",
            fontSize: "15px"
          }}
        >
          {loading ? "Writing…" : "Summarize"}
        </button>
      </div>

      {/* Content Area (fills remaining height) */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          paddingRight: "4px"
        }}
      >
        {!summary && !loading && (
          <div
            style={{
              marginTop: "60px",
              textAlign: "center",
              color: "#94A3B8"
            }}
          >
            <p style={{ fontSize: "14px", marginBottom: "10px" }}>
              Try searching for:
            </p>
            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "center",
                flexWrap: "wrap"
              }}
            >
              {["Mutual Funds", "Taxation", "Derivatives", "Ethics"].map(
                (hint) => (
                  <span
                    key={hint}
                    onClick={() => setTopic(hint)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "999px",
                      fontSize: "13px",
                      cursor: "pointer",
                      background: "#020617",
                      border: "1px solid rgba(255,255,255,0.15)"
                    }}
                  >
                    {hint}
                  </span>
                )
              )}
            </div>
          </div>
        )}

        {summary && (
          <div
            style={{
              background: "#020617",
              borderRadius: "16px",
              padding: "24px",
              lineHeight: "1.7",
              color: "#E5E7EB",
              border: "1px solid rgba(255,255,255,0.08)",
              whiteSpace: "pre-wrap"
            }}
          >
            {summary}

            <div
              style={{
                marginTop: "24px",
                borderTop: "1px solid rgba(255,255,255,0.1)",
                paddingTop: "16px",
                textAlign: "right"
              }}
            >
              <button
                onClick={() =>
                  onAskAI?.(
                    `Can you explain this summary about "${topic}" in simpler terms?`
                  )
                }
                style={{
                  background: "transparent",
                  border: "1px solid #38BDF8",
                  color: "#38BDF8",
                  padding: "8px 16px",
                  borderRadius: "10px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                💬 Ask Tutor about this
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Summarizer;
