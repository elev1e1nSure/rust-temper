import { Component, type ReactNode } from "react";
import "./ErrorBoundary.css";

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
        <div className="error-boundary">
          <h2>Произошла ошибка</h2>
          <pre className="error-boundary-pre">{this.state.error.message}</pre>
          <button
            type="button"
            className="error-boundary-btn"
            onClick={() => this.setState({ error: null })}
          >
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
