import { Component, type ReactNode } from 'react'

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback: (retry: () => void) => ReactNode
  // Runs before the children render again, e.g. to start a fresh lazy import (React caches a rejected one).
  onRetry?: () => void
}

interface ErrorBoundaryState {
  failed: boolean
}

// React only catches render errors in a class component; this is the one class in the app.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  retry = () => {
    this.props.onRetry?.()
    this.setState({ failed: false })
  }

  render() {
    return this.state.failed ? this.props.fallback(this.retry) : this.props.children
  }
}
