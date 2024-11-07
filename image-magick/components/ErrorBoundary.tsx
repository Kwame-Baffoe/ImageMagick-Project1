import React, { Component, ErrorInfo } from 'react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { AlertCircle } from 'lucide-react';

// Types
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to error reporting service
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Update state to store error info
    this.setState({
      errorInfo
    });

    // Call onError callback if provided
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError);
      }
    }
  }

  private renderDefaultError(): React.ReactNode {
    const { error, errorInfo } = this.state;

    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription className="mt-2">
          <div className="space-y-2">
            <p className="font-medium">
              {error?.message || 'An unexpected error occurred'}
            </p>
            {process.env.NODE_ENV === 'development' && errorInfo && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-gray-700">
                  Stack trace
                </summary>
                <pre className="mt-2 whitespace-pre-wrap text-sm text-gray-500">
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700 hover:bg-red-100"
            >
              Reload Page
            </button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  private resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render(): React.ReactNode {
    const { hasError } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Render custom fallback if provided, otherwise render default error UI
      return fallback || this.renderDefaultError();
    }

    return children;
  }
}

// HOC to wrap components with ErrorBoundary
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.ComponentType<P> {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}

// Custom hook for error boundaries
export function useErrorBoundary(): {
  ErrorBoundary: typeof ErrorBoundary;
  withErrorBoundary: typeof withErrorBoundary;
} {
  return {
    ErrorBoundary,
    withErrorBoundary
  };
}

export type { ErrorBoundaryProps, ErrorBoundaryState };
export default ErrorBoundary;