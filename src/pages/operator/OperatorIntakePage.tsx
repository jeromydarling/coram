/**
 * OperatorIntakePage — Intake tab as a standalone operator page.
 */
import { IntakeTab } from '@/components/operator/IntakeTab';

export default function OperatorIntakePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Intake</h1>
        <p className="text-sm text-muted-foreground">Support requests and feedback from across the ecosystem.</p>
      </div>
      <IntakeTab />
    </div>
  );
}
