import { Component, type ErrorInfo, type ReactNode } from "react";
import { LoadError } from "./LoadError";

interface ErrorBoundaryProps {
  children: ReactNode;
}

export interface ErrorDetails {
  message: string;
  functionName?: string;
  file?: string;
  line?: number;
  column?: number;
  stack?: string;
}

interface ErrorBoundaryState {
  details: ErrorDetails | null;
}

function parseErrorDetails(error: Error): ErrorDetails {
  const frame = parseFirstStackFrame(error.stack);
  return {
    message: error.message || "Something went wrong while rendering.",
    functionName: frame?.functionName,
    file: frame?.file,
    line: frame?.line,
    column: frame?.column,
    stack: error.stack,
  };
}

function parseFirstStackFrame(stack?: string) {
  if (!stack) return undefined;

  const frameRe =
    /^\s+at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/;
  for (const line of stack.split("\n")) {
    const match = line.match(frameRe);
    if (match) {
      return {
        functionName: match[1]?.replace(/^Object\./, ""),
        file: match[2],
        line: Number(match[3]),
        column: Number(match[4]),
      };
    }
  }
  return undefined;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    details: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { details: parseErrorDetails(error) };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.details) {
      return <LoadError details={this.state.details} />;
    }

    return this.props.children;
  }
}
