/**
 * WelcomeOverlay — Role-aware first login guide.
 *
 * WHAT: Calm welcome screen for new users with email/calendar connect prompts.
 * WHERE: Shown once on first login, above the dashboard.
 * WHY: Helps users connect tools without complexity or technical jargon.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { useTestimoniumCapture } from '@/hooks/useTestimoniumCapture';
import { getMinistryRole } from '@/lib/ministryRole';
import { GuidedActivationCard } from '@/components/welcome/GuidedActivationCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, Calendar, Settings, ArrowRight, X, BookOpen } from 'lucide-react';

// ─── Role Greetings ─────────────────────────────────

const GREETINGS: Record<string, { heading: string; sub: string }> = {
  steward: {
    heading: 'Welcome. You help hold the work together.',
    sub: 'Let\'s get you set up for the stewardship you already provide.',
  },
  shepherd: {
    heading: 'You guide relationships and stories.',
    sub: 'Let\'s connect the tools that help you stay present.',
  },
  companion: {
    heading: 'You help the work move forward each day.',
    sub: 'Let\'s get you set up for the work you already do.',
  },
  visitor: {
    heading: 'You help people feel seen and supported.',
    sub: 'Let\'s make sure you\'re ready to walk alongside others.',
  },
};

const NEXT_STEPS: Record<string, { text: string; route: string }> = {
  steward: { text: 'Invite your team or review your dashboard', route: '/' },
  shepherd: { text: 'Open Opportunities and begin your journey work', route: '/opportunities' },
  companion: { text: 'Check today\'s activities', route: '/activities' },
  visitor: { text: 'Open Visits to see who you\'re walking with', route: '/visits' },
};

interface Props {
  onDismiss: () => void;
}

export function WelcomeOverlay({ onDismiss }: Props) {
  const { user, profile } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const { captureTestimonium } = useTestimoniumCapture();
  const [dismissing, setDismissing] = useState(false);

  const role = getMinistryRole(profile);
  const greeting = GREETINGS[role] || GREETINGS.companion;
  const nextStep = NEXT_STEPS[role] || NEXT_STEPS.companion;

  const handleDismiss = useCallback(async (permanent: boolean) => {
    setDismissing(true);
    try {
      if (permanent && user?.id) {
        await supabase
          .from('profiles')
          .update({ welcome_dismissed_at: new Date().toISOString() } as any)
          .eq('user_id', user.id);

        captureTestimonium({
          sourceModule: 'journey',
          eventKind: 'user_first_login_completed',
          summary: `${role} completed welcome screen`,
          metadata: { role, permanent: true },
        });
      }
      onDismiss();
    } catch {
      onDismiss();
    }
  }, [user?.id, role, onDismiss, captureTestimonium]);

  const tenantSlug = tenant?.slug || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-lg">
        {/* Close button */}
        <div className="flex justify-end p-3 pb-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => handleDismiss(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Section 1: Role-aware greeting */}
          <div className="text-center space-y-2">
            <h1 className="text-xl font-serif font-semibold text-foreground">
              {greeting.heading}
            </h1>
            <p className="text-sm text-muted-foreground">
              {greeting.sub}
            </p>
          </div>

          {/* Section 2: Connect email */}
          <Card className="rounded-xl">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-foreground">
                  Connect your email
                  <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Connecting your email lets CROS help you track conversations
                and stay organized — but it's completely optional.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => navigate(tenantSlug ? `/${tenantSlug}/settings` : '/settings')}
                >
                  Connect Gmail
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => navigate(tenantSlug ? `/${tenantSlug}/settings` : '/settings')}
                >
                  Connect Outlook
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Section 2.5: Guided Activation CTA */}
          <GuidedActivationCard role={role} />

          {/* Section 3: Connect calendar */}
          <Card className="rounded-xl">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-foreground">
                  Bring your calendar with you
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your calendar helps CROS understand your rhythm
                and suggest meaningful moments to connect.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => navigate(tenantSlug ? `/${tenantSlug}/calendar` : '/calendar')}
              >
                Connect Calendar
              </Button>
            </CardContent>
          </Card>

          {/* Section 3.5: Authority Hub */}
          <Card className="rounded-xl border-[hsl(var(--primary)/0.15)]">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-foreground">
                  Explore the Authority Hub
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Stories from the field, adoption guidance, and leadership reflections
                from organizations walking a similar path.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => window.open('/authority', '_blank')}
              >
                Browse the Authority Hub
              </Button>
            </CardContent>
          </Card>

          {/* Section 4: Recovery trust signal */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <Settings className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-foreground mb-0.5">
                Nothing is lost here.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If something disappears, the assistant can usually restore it.
                You can also request emergency recovery help anytime.
              </p>
            </div>
          </div>

          {/* Section 5: Find settings later */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
            <Settings className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              You can always connect or disconnect your email and calendar later in{' '}
              <button
                className="underline text-foreground hover:text-primary"
                onClick={() => navigate(tenantSlug ? `/${tenantSlug}/settings` : '/settings')}
              >
                Settings
              </button>.
            </p>
          </div>

          {/* Section 5: Role-aware first step */}
          <Card className="rounded-xl border-primary/20">
            <CardContent className="p-4">
              <p className="text-sm text-foreground mb-3">
                {nextStep.text}
              </p>
              <Button
                size="sm"
                className="gap-1"
                onClick={() => {
                  handleDismiss(true);
                  navigate(tenantSlug ? `/${tenantSlug}${nextStep.route}` : nextStep.route);
                }}
              >
                Get started
                <ArrowRight className="w-3 h-3" />
              </Button>
            </CardContent>
          </Card>

          {/* Dismiss actions */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              className="flex-1"
              onClick={() => handleDismiss(true)}
              disabled={dismissing}
            >
              Continue to CROS
            </Button>
            <Button
              variant="ghost"
              className="flex-1 text-muted-foreground text-sm"
              onClick={() => handleDismiss(false)}
              disabled={dismissing}
            >
              Remind me later
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
