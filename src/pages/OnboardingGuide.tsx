/**
 * OnboardingGuide — Vertical timeline of archetype-aware onboarding steps.
 *
 * WHAT: Step-by-step guide showing setup progress with warm, human language.
 * WHERE: /:tenantSlug/getting-started route.
 * WHY: Makes first-day adoption effortless without urgency or jargon.
 */

import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Circle, SkipForward, Mail, Calendar, FileText, MapPin, Globe, Users, Link2, ArrowRight, Blend } from 'lucide-react';
import { useOnboardingSession, useOnboardingSteps, useOnboardingProgress, useCompleteStep } from '@/hooks/useOnboarding';
import { useTenant } from '@/contexts/TenantContext';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { RelationalFocusStep } from '@/components/onboarding/RelationalFocusStep';
import { useTranslation } from 'react-i18next';

const actionIcons: Record<string, typeof Mail> = {
  connect_email: Mail,
  connect_calendar: Calendar,
  create_first_reflection: FileText,
  add_event: MapPin,
  enable_signum: Globe,
  import_contacts: Users,
  join_communio: Link2,
  connect_hubspot: Link2,
  relational_focus: Blend,
  skip: SkipForward,
};

// Map action types to in-app routes
const actionRoutes: Record<string, string> = {
  connect_email: '/settings',
  connect_calendar: '/settings',
  create_first_reflection: '/opportunities',
  add_event: '/events',
  enable_signum: '/settings',
  import_contacts: '/import',
  join_communio: '/communio',
  connect_hubspot: '/relatio',
};

export default function OnboardingGuide() {
  const { t } = useTranslation('common');
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const { data: session, isLoading: sessionLoading } = useOnboardingSession();
  const { data: steps = [], isLoading: stepsLoading } = useOnboardingSteps(session?.archetype ?? tenant?.archetype ?? null);
  const { data: progress = [], isLoading: progressLoading } = useOnboardingProgress();
  const completeStep = useCompleteStep();

  const isLoading = sessionLoading || stepsLoading || progressLoading;
  const progressMap = new Map(progress.map(p => [p.step_key, p.status]));

  const completedCount = progress.filter(p => p.status === 'complete' || p.status === 'skipped').length;
  const totalSteps = steps.length;
  const percentComplete = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  const handleAction = (step: typeof steps[0]) => {
    const route = actionRoutes[step.action_type];
    if (route && tenantSlug) {
      navigate(`/${tenantSlug}${route}`);
    }
  };

  const handleComplete = async (stepKey: string) => {
    try {
      await completeStep.mutateAsync({ step_key: stepKey });
      toast.success(t('guide.stepCompleted'));
    } catch {
      toast.error(t('onboarding.toasts.couldNotUpdateStep'));
    }
  };

  const handleSkip = async (stepKey: string) => {
    try {
      await completeStep.mutateAsync({ step_key: stepKey, action: 'skip' });
      toast(t('guide.stepSkipped'));
    } catch {
      toast.error(t('onboarding.toasts.couldNotSkipStep'));
    }
  };

  if (session?.status === 'completed') {
    return (
      <MainLayout title={t('guide.title')} subtitle={t('guide.completedSubtitle')}>
        <Card className="max-w-lg mx-auto">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
              {t('guide.allSetTitle')}
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {t('guide.allSetMessage')}
            </p>
            <Button onClick={() => navigate(`/${tenantSlug}/`)} className="rounded-full">
              {t('guide.goToCommandCenter')} <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={t('guide.title')} subtitle={t('guide.subtitle')}>
      <div className="max-w-2xl mx-auto space-y-6 pb-12">
        {/* Progress summary */}
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-foreground">{t('guide.setupProgress')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('guide.stepsComplete', { completed: completedCount, total: totalSteps })}
                </p>
              </div>
              <Badge variant="secondary" className="text-xs">
                {percentComplete}%
              </Badge>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Help tooltip */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{t('guide.helpText')}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
                <p><strong>What:</strong> Guided onboarding steps tailored to your mission archetype.</p>
                <p><strong>Where:</strong> This page — accessible from your Command Center.</p>
                <p><strong>Why:</strong> Helps your team build rhythm without overwhelming the first day.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Steps timeline */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {steps.map((step, index) => {
              const status = progressMap.get(step.key) ?? 'pending';
              const isDone = status === 'complete' || status === 'skipped';
              const Icon = actionIcons[step.action_type] ?? Circle;

              return (
                <Card
                  key={`${step.key}-${step.archetype}`}
                  className={`transition-all ${isDone ? 'opacity-60' : ''}`}
                >
                  <CardContent className="py-4 flex items-start gap-4">
                    {/* Timeline indicator */}
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                        ${isDone ? 'bg-primary/10' : 'bg-muted'}`}>
                        {isDone ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : (
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      {index < steps.length - 1 && (
                        <div className={`w-0.5 h-6 ${isDone ? 'bg-primary/20' : 'bg-muted'}`} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-foreground">{step.title}</h3>
                        {step.optional && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{t('guide.optional')}</Badge>
                        )}
                        {isDone && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {status === 'skipped' ? t('guide.skipped') : t('guide.done')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>

                      {!isDone && step.action_type === 'relational_focus' && (
                        <div className="mt-3">
                          <RelationalFocusStep onComplete={() => handleComplete(step.key)} />
                        </div>
                      )}
                      {!isDone && step.action_type !== 'relational_focus' && (
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="default"
                            className="rounded-full text-xs h-7 px-3"
                            onClick={() => handleAction(step)}
                          >
                            {t('guide.getStarted')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-full text-xs h-7 px-3 text-muted-foreground"
                            onClick={() => handleComplete(step.key)}
                            disabled={completeStep.isPending}
                          >
                            {t('guide.markDone')}
                          </Button>
                          {step.optional && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-full text-xs h-7 px-3 text-muted-foreground"
                              onClick={() => handleSkip(step.key)}
                              disabled={completeStep.isPending}
                            >
                              {t('guide.skip')}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
