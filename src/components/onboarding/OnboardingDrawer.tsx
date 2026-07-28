/**
 * OnboardingDrawer — Slide-over prompt shown on Command Center if onboarding incomplete.
 *
 * WHAT: Gentle drawer reminding users about remaining setup steps.
 * WHERE: Command Center (Index page).
 * WHY: Encourages completion without being aggressive or blocking.
 */

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Circle, ArrowRight } from 'lucide-react';
import { useOnboardingSession, useOnboardingSteps, useOnboardingProgress } from '@/hooks/useOnboarding';
import { useTenant } from '@/contexts/TenantContext';
import { useNavigate, useParams } from 'react-router-dom';

interface OnboardingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OnboardingDrawer({ open, onOpenChange }: OnboardingDrawerProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const { data: session } = useOnboardingSession();
  const { data: steps = [] } = useOnboardingSteps(session?.archetype ?? tenant?.archetype ?? null);
  const { data: progress = [] } = useOnboardingProgress();

  const progressMap = new Map(progress.map(p => [p.step_key, p.status]));
  const completedCount = progress.filter(p => p.status === 'complete' || p.status === 'skipped').length;
  const pendingSteps = steps.filter(s => {
    const st = progressMap.get(s.key);
    return !st || st === 'pending';
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>
            Getting Started
          </SheetTitle>
          <SheetDescription>
            {completedCount} of {steps.length} steps complete — take your time.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {steps.map(step => {
            const status = progressMap.get(step.key) ?? 'pending';
            const isDone = status === 'complete' || status === 'skipped';

            return (
              <div key={`${step.key}-${step.archetype}`} className="flex items-center gap-3 py-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
                  ${isDone ? 'bg-primary/10' : 'bg-muted'}`}>
                  {isDone ? (
                    <Check className="h-3 w-3 text-primary" />
                  ) : (
                    <Circle className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${isDone ? 'text-muted-foreground line-through' : 'text-foreground font-medium'}`}>
                    {step.title}
                  </p>
                </div>
                {step.optional && !isDone && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0">optional</Badge>
                )}
              </div>
            );
          })}
        </div>

        {pendingSteps.length > 0 && (
          <div className="mt-6 space-y-2">
            <Button
              className="w-full rounded-full"
              onClick={() => {
                onOpenChange(false);
                navigate(`/${tenantSlug}/getting-started`);
              }}
            >
              Continue setup <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            {/* Pre-mortem #1: never trap users in setup. Always offer an exit
                that lands them in their workspace shell. */}
            <Button
              variant="ghost"
              className="w-full rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => {
                onOpenChange(false);
                navigate(`/${tenantSlug}/`);
              }}
            >
              Skip for now &amp; explore
            </Button>
          </div>
        )}

        {/* Authority Hub invitation after onboarding completion */}
        {pendingSteps.length === 0 && (
          <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/10 text-center space-y-2">
            <p className="text-sm text-foreground font-medium" style={{ fontFamily: "'Playfair Display', serif" }}>
              You're all set. The work begins.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Many organizations find it helpful to read stories from others walking a similar path.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 rounded-full mt-1"
              onClick={() => {
                onOpenChange(false);
                window.open('/authority', '_blank');
              }}
            >
              Explore the Authority Hub <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
