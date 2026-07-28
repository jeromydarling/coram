/**
 * OperatorStabilityPage — Migrated to Error Desk.
 *
 * WHAT: Redirect notice. System errors are now tracked in Sentry and surfaced
 *       on the Error Desk; the legacy system_error_events table has been retired.
 * WHERE: /operator/nexus/stability (route kept alive to avoid 404s on deep links)
 * WHY: Single source of truth for runtime errors is now Sentry, not a Postgres table.
 */
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function OperatorStabilityPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">System Friction</h1>
        <p className="text-sm text-muted-foreground mt-1">
          This view has moved.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Moved to Error Desk</CardTitle>
          <CardDescription>
            System errors are now tracked in Sentry. The Error Desk shows live issues
            grouped by federation app, with one-click Lovable fix prompts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/operator/error-desk">
              Open Error Desk
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
