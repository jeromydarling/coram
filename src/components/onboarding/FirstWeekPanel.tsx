/**
 * FirstWeekPanel — Calm adoption tracker for the first 7 days.
 *
 * WHAT: Shows soft checkmarks for key first-week milestones.
 * WHERE: Command Center (Index page).
 * WHY: Quietly reinforces adoption without urgency indicators or red badges.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Circle, Sparkles } from 'lucide-react';
import { useOnboardingProgress } from '@/hooks/useOnboarding';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

const MILESTONES = [
  { key: 'create_first_reflection', label: 'Reflection created' },
  { key: 'add_event', label: 'Event added' },
  { key: 'enable_signum', label: 'Signum enabled' },
  { key: 'connect_email', label: 'Email connected' },
  { key: 'import_contacts', label: 'Contacts imported' },
  { key: 'join_communio', label: 'Communio joined' },
];

export function FirstWeekPanel() {
  const { data: progress = [] } = useOnboardingProgress();

  const completedKeys = new Set(
    progress.filter(p => p.status === 'complete').map(p => p.step_key)
  );

  const completedCount = MILESTONES.filter(m => completedKeys.has(m.key)).length;

  // Don't show if all milestones are complete
  if (completedCount === MILESTONES.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">
            Your first stories
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
                <p><strong>What:</strong> Key milestones from your first week in CROS.</p>
                <p><strong>Where:</strong> Your Command Center — visible until all steps are done.</p>
                <p><strong>Why:</strong> Gentle encouragement to build your rhythm.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {MILESTONES.map(m => {
            const done = completedKeys.has(m.key);
            return (
              <div
                key={m.key}
                className={`flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs
                  ${done ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 flex-shrink-0" />
                )}
                <span className={done ? 'line-through opacity-60' : ''}>{m.label}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
