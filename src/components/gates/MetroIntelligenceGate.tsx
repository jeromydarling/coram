/**
 * MetroIntelligenceGate — Route-level guard for Metro Intelligence features.
 *
 * WHAT: Blocks access to metro-related routes when Metro Intelligence is not enabled.
 * WHERE: Wraps metro routes in AppRouter.
 * WHY: Single-region tenants don't need metro views; this keeps UX calm and focused.
 */
import { useMetroIntelligence } from '@/hooks/useMetroIntelligence';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ArrowRight } from 'lucide-react';
import { useEnableMetroIntelligence } from '@/hooks/useEnableMetroIntelligence';
import type { ReactNode } from 'react';

interface MetroIntelligenceGateProps {
  children: ReactNode;
}

export function MetroIntelligenceGate({ children }: MetroIntelligenceGateProps) {
  const { enabled, loading } = useMetroIntelligence();
  const enableMutation = useEnableMetroIntelligence();

  if (loading) return null;
  if (enabled) return <>{children}</>;

  return (
    <div className="flex items-center justify-center min-h-[400px] p-6" data-testid="metro-intelligence-gate">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-8 pb-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
            <MapPin className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              Metro Intelligence
            </h3>
            <p className="text-sm text-muted-foreground">
              When you're ready to grow beyond your region, Metro Intelligence brings
              multi-community awareness, expansion signals, and narrative segmentation.
            </p>
          </div>
          <Button
            className="mt-2"
            onClick={() => enableMutation.mutate()}
            disabled={enableMutation.isPending}
          >
            Enable Metro Intelligence <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
