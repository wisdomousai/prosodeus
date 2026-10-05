import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full border border-border rounded p-8 bg-card space-y-5">
          <h1 className="font-display text-xl text-card-foreground tracking-wide">
            Something went wrong
          </h1>
          <p className="font-mono text-[0.75rem] text-destructive leading-relaxed break-words">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded bg-primary text-primary-foreground font-mono text-[0.75rem] hover:opacity-90 transition-opacity cursor-pointer"
            >
              Reload
            </button>
            <a
              href="/"
              className="font-mono text-[0.75rem] text-muted-foreground hover:text-foreground transition-colors"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
