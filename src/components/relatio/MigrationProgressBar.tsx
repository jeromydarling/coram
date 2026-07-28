/**
 * MigrationProgressBar — Visual progress for an active migration.
 *
 * WHAT: Shows migration status with record count and gentle language.
 * WHERE: MigrationAssistant, RelatioMarketplace.
 * WHY: Keeps users calm and informed during data import.
 */

import { Progress } from '@/components/ui/progress';

interface MigrationProgressBarProps {
  status: 'pending' | 'running' | 'completed' | 'failed';
  recordsImported: number;
  integrationName: string;
}

export function MigrationProgressBar({ status, recordsImported, integrationName }: MigrationProgressBarProps) {
  const progressValue =
    status === 'completed' ? 100 :
    status === 'running' ? Math.min(90, Math.max(10, recordsImported)) :
    status === 'failed' ? 100 : 0;

  const message = {
    pending: `Preparing to bring your relationships from ${integrationName}…`,
    running: `Moving your relationships safely — ${recordsImported} records so far…`,
    completed: `All done! ${recordsImported} relationships brought into CROS.`,
    failed: 'Something went wrong. Your original data is untouched.',
  }[status];

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Progress
        value={progressValue}
        className={status === 'failed' ? '[&>div]:bg-destructive' : ''}
      />
    </div>
  );
}
