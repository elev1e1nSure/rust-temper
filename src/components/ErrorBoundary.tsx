import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("Ошибка приложения:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: "#f2f2f3" }}>
          <h2>Произошла ошибка</h2>
          <pre style={{ color: "#8e8e93", fontSize: 13 }}>
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              background: "#2b2b2f",
              color: "#f2f2f3",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
