// src/theme.js

export const theme = {
  app: {
    background: "linear-gradient(135deg, #0F172A 0%, #020617 100%)",
  },

  colors: {
    primary: "#2563EB",
    primaryHover: "#1D4ED8",
    accent: "#3B82F6",

    success: "#10B981",
    successBg: "#D1FAE5",

    warning: "#F59E0B",
    warningBg: "#FEF3C7",

    error: "#EF4444",
    errorBg: "#FEE2E2",

    // ✅ KEEP THIS — many components still rely on it
    bg: {
      main: "#F3F4F6"
    },

    text: {
      main: "#1E293B",
      secondary: "#64748B",
      light: "#F9FAFB",
      inverse: "#FFFFFF"
    },

    surface: {
      card: "#FFFFFF",
      muted: "#F1F5F9",
      border: "#E2E8F0"
    }
  },

  radius: {
    sm: "6px",
    md: "12px",
    lg: "16px",
    pill: "9999px"
  },

  shadows: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)"
  }
};
