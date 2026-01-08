import { useEffect, useState } from "react";
import { getHealth } from "../api/financeBuddyApi";
import { theme } from "../theme"; // ✅ 1. Import your new design system

function HealthStatus() {
  const [status, setStatus] = useState("checking"); // checking | ok | down
  const [detail, setDetail] = useState("Connecting...");

  const runCheck = () => {
    setStatus("checking");
    setDetail("Connecting...");

    getHealth()
      .then((data) => {
        setStatus("ok");

        // Tries to display something useful if your /health returns services info
        const geminiStatus =
          data?.data?.services?.gemini ||
          data?.services?.gemini ||
          data?.gemini ||
          "available";

        setDetail(`Gemini: ${geminiStatus}`);
      })
      .catch((err) => {
        setStatus("down");
        
        // ✅ 2. LOGIC FIX: Detect "503" and treat it as Demo Mode
        if (err.message && err.message.includes("503")) {
          setDetail("Demo Mode Active — AI responses are simulated.");
        } else {
          setDetail(err.message);
        }
      });
  };

  useEffect(() => {
    runCheck();
  }, []);

  // ✅ 3. STYLE UPDATE: Use Theme + Demo Mode Check
  const getStyle = () => {
    const isDemo = status === "down" && detail.includes("Demo Mode");

    switch (status) {
      case "ok":
        return { 
          bg: theme.colors.successBg, 
          color: "#065F46", // Dark green for readability
          border: theme.colors.success, 
          icon: "🟢" 
        };
      case "down":
        if (isDemo) {
          // ⚡ The "Demo Mode" Yellow Style
          return { 
            bg: theme.colors.warningBg, 
            color: "#92400E", // Dark amber
            border: "#FCD34D", 
            icon: "⚡" 
          };
        }
        // 🔴 The "Real Error" Red Style
        return { 
          bg: theme.colors.errorBg, 
          color: "#991B1B", // Dark red
          border: theme.colors.error, 
          icon: "🔴" 
        };
      default:
        // ⏳ Connecting Style
        return { 
          bg: theme.colors.bg.main, 
          color: theme.colors.text.secondary, 
          border: theme.colors.bg.border, 
          icon: "⏳" 
        };
    }
  };

  const s = getStyle();
  const isDemo = status === "down" && detail.includes("Demo Mode");

  return (
    <div
      style={{
        padding: "12px 20px",
        borderRadius: theme.radius.md,
        backgroundColor: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        fontWeight: "500",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "20px",
        boxShadow: theme.shadows.sm,
        transition: "all 0.3s ease"
      }}
    >
      <span style={{ fontSize: "1.2em" }}>{s.icon}</span>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: "14px", fontWeight: "bold" }}>
          {status === "checking" 
            ? "System Status: Checking..." 
            : isDemo ? "Demo Environment" : "System Status"}
        </span>
        <span style={{ fontSize: "12px", opacity: 0.9 }}>
          {status === "checking" ? "Connecting to backend..." : detail}
        </span>
      </div>

      {/* ✅ 4. ADDED BADGE: "DEV ENV" pill if in Demo Mode */}
      {isDemo && (
        <span style={{
          marginLeft: "auto",
          fontSize: "10px",
          background: "rgba(255,255,255,0.6)",
          padding: "4px 8px",
          borderRadius: theme.radius.sm,
          fontWeight: "bold",
          textTransform: "uppercase",
          border: "1px solid rgba(0,0,0,0.05)"
        }}>
          Dev Env
        </span>
      )}

      {/* Keep the Retry button if it's actually down (or demo mode if you want to allow re-checking) */}
      {status === "down" && (
        <button
          onClick={runCheck}
          style={{
            marginLeft: isDemo ? "10px" : "auto", // Adjust layout if badge is present
            padding: "6px 12px",
            cursor: "pointer",
            border: "none",
            borderRadius: theme.radius.sm,
            backgroundColor: isDemo ? "rgba(255,255,255,0.8)" : "#991B1B", // White button on yellow, Red on red
            color: isDemo ? "#92400E" : "white",
            fontSize: "12px",
            fontWeight: "600",
            boxShadow: theme.shadows.sm
          }}
        >
          {isDemo ? "↻ Check Live" : "Retry"}
        </button>
      )}
    </div>
  );
}

export default HealthStatus;