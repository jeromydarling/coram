/**
 * GuidedActivationCard — Calm CTA for guided onboarding sessions.
 *
 * WHAT: Dismissible card inviting Steward/Shepherd roles to schedule a Gardener session.
 * WHERE: WelcomeOverlay (first login).
 * WHY: Makes guided onboarding visible without pressure.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sprout, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  role: string;
}

export function GuidedActivationCard({ role }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  // Only show to steward and shepherd roles
  if (dismissed || !['steward', 'shepherd'].includes(role)) {
    return null;
  }

  return (
    <Card className="rounded-xl border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0 mt-0.5">
              <Sprout className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground font-serif">
                Start with a Gardener Session
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Some organizations prefer to walk this path together.
                A gardener can help you set up your space and migrate what matters.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground shrink-0"
            onClick={() => setDismissed(true)}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="mt-3 ml-11">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => navigate('/pricing#capacity-upgrades')}
          >
            Schedule Guided Activation
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
