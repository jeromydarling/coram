/**
 * OperatorErrorBoundary — React error boundary that captures render crashes.
 *
 * WHAT: Wraps @sentry/react's ErrorBoundary so render crashes are reported to
 *       Sentry automatically, preserving the existing calm fallback UI.
 * WHERE: Wrapped around App root (or operator layout).
 * WHY: Sentry is the source of truth for errors; the homegrown capture path was retired.
 */
import { ReactNode } from 'react';
import { ErrorBoundary, type FallbackRender } from '@sentry/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

export function OperatorErrorBoundary({ children, fallback }: Props) {
  const renderFallback: FallbackRender = ({ error, resetError }) => {
    if (fallback) return <>{fallback}</>;
    const message = error instanceof Error ? error.message : String(error);
    return (
      <div className="min-h-[200px] flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Something did not render as expected.
            </p>
            <p className="text-xs text-muted-foreground/70 font-mono">
              {message.slice(0, 120)}
            </p>
            <Button variant="outline" size="sm" onClick={resetError}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  };

  return <ErrorBoundary fallback={renderFallback}>{children}</ErrorBoundary>;
}
