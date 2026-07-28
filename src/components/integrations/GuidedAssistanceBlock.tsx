/**
 * GuidedAssistanceBlock — Calm assistance prompt on integrations pages.
 *
 * WHAT: Soft CTA encouraging guided onboarding for integration setup.
 * WHERE: Integrations/Relatio pages.
 * WHY: Revenue driver that feels like support, not upsell.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sprout } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function GuidedAssistanceBlock() {
  const navigate = useNavigate();

  return (
    <Card className="border-dashed border-primary/20 bg-primary/5">
      <CardContent className="py-5 px-5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Sprout className="w-4 h-4 text-primary" />
          </div>
          <div className="space-y-2">
            <p
              className="text-sm text-foreground leading-relaxed"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Feeling overwhelmed?<br />
              A Gardener can walk through this with you.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We can help carry this part with you — connecting your existing tools
              and making sure your relationships find their way home.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-xs mt-1"
              onClick={() => navigate('/pricing#capacity-upgrades')}
            >
              Schedule Guided Activation
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
