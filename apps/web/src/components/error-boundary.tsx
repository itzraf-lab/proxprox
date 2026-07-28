import * as React from "react"

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Top-level error boundary so a runtime error in any page renders a readable
 * message instead of a blank white screen. Without this, an uncaught error
 * during render (or thrown from an event handler that re-renders) unmounts the
 * entire React tree in React 19, leaving the user with nothing.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface the full error + component stack in the console for debugging.
    console.error("Uncaught UI error:", error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-2xl w-full border-2 border-destructive bg-destructive/5 p-6 font-mono">
          <h1 className="text-lg font-bold uppercase tracking-wider text-destructive mb-2">
            Something broke
          </h1>
          <p className="text-sm text-muted-foreground mb-4">
            The interface hit an unexpected error. Details below.
          </p>
          <pre className="text-xs whitespace-pre-wrap break-words bg-background border p-3 max-h-64 overflow-auto">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ""}
          </pre>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="border-2 border-primary text-primary px-3 py-1.5 text-xs uppercase tracking-wider hover:bg-primary/10"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="border-2 border-border px-3 py-1.5 text-xs uppercase tracking-wider hover:bg-sidebar/20"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    )
  }
}
