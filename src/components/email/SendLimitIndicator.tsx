/**
 * SendLimitIndicator — Real-time send limit status bar.
 *
 * WHAT: Displays daily send limit usage with color-coded warnings.
 * WHERE: Campaign composer, below provider selection.
 * WHY: Prevents users from exceeding provider sending thresholds.
 */

import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface SendLimitIndicatorProps {
  currentCount: number;
  dailyLimit: number;
  softThreshold: number;
  hardThreshold: number;
  provider: 'gmail' | 'outlook';
  className?: string;
}

export function SendLimitIndicator({
  currentCount,
  dailyLimit,
  softThreshold,
  hardThreshold,
  provider,
  className,
}: SendLimitIndicatorProps) {
  const percentage = dailyLimit > 0 ? Math.min((currentCount / dailyLimit) * 100, 100) : 0;
  const isWarning = currentCount >= softThreshold;
  const isBlocked = currentCount >= hardThreshold;

  const providerLabel = provider === 'outlook' ? 'Microsoft 365' : 'Gmail';

  return (
    <div className={cn('rounded-lg border p-3 space-y-2', className, {
      'border-green-500/30 bg-green-500/5': !isWarning && !isBlocked,
      'border-yellow-500/30 bg-yellow-500/5': isWarning && !isBlocked,
      'border-destructive/30 bg-destructive/5': isBlocked,
    })}>
      <div className="flex items-center gap-2 text-sm">
        {isBlocked ? (
          <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
        ) : isWarning ? (
          <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
        )}
        <span className={cn('font-medium', {
          'text-green-700': !isWarning && !isBlocked,
          'text-yellow-700': isWarning && !isBlocked,
          'text-destructive': isBlocked,
        })}>
          {isBlocked
            ? 'Sending blocked to protect your account reputation.'
            : isWarning
            ? `You're approaching ${providerLabel}'s recommended daily limits.`
            : 'Safe sending range.'}
        </span>
      </div>
      <Progress
        value={percentage}
        className={cn('h-2', {
          '[&>div]:bg-green-500': !isWarning && !isBlocked,
          '[&>div]:bg-yellow-500': isWarning && !isBlocked,
          '[&>div]:bg-destructive': isBlocked,
        })}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{currentCount} / {dailyLimit} sent today</span>
        <span>{providerLabel}</span>
      </div>
    </div>
  );
}
