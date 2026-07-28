/**
 * CivitasGate — Route-level guard for Civitas™ (multi-metro) features.
 *
 * WHAT: Blocks access to metro-related routes when Civitas is not enabled.
 * WHERE: Wraps metro routes in AppRouter.
 * WHY: Civitas is a paid add-on; non-subscribers use single-community fallback.
 */
import { useCivitas } from '@/hooks/useCivitas';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface CivitasGateProps {
  children: ReactNode;
}

export function CivitasGate({ children }: CivitasGateProps) {
  const { enabled, loading } = useCivitas();

  if (loading) return null;
  if (enabled) return <>{children}</>;

  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-8 pb-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
            <MapPin className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              Civitas™ — Multi-Metro Operations
            </h3>
            <p className="text-sm text-muted-foreground">
              Expand your reach across multiple communities with metro-level awareness, 
              expansion planning, and narrative segmentation.
            </p>
          </div>
          <Link to="/pricing">
            <Button className="mt-2">
              Learn more <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
