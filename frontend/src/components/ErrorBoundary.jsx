import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "20px",
            backgroundColor: "#fee",
            color: "#c00",
            border: "1px solid #c00",
            borderRadius: "10px",
          }}
        >
          <h2 style={{ marginTop: 0 }}>⚠️ Something went wrong.</h2>
          <p style={{ marginBottom: 0 }}>{String(this.state.error)}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
