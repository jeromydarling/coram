/**
 * MigrationAssistant — Human-first guided migration wizard.
 *
 * WHAT: Step-by-step wizard to migrate data from an external CRM.
 * WHERE: RelatioMarketplace page.
 * WHY: Makes data migration feel safe and human, not technical.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MigrationProgressBar } from './MigrationProgressBar';
import { ArrowRight, ArrowLeft, CheckCircle2, Shield } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

interface FieldMap {
  source_field: string;
  target_field: string;
}

interface MigrationAssistantProps {
  integrationKey: string;
  integrationName: string;
  fieldMaps: FieldMap[];
  onClose: () => void;
}

export function MigrationAssistant({
  integrationKey,
  integrationName,
  fieldMaps,
  onClose,
}: MigrationAssistantProps) {
  const { tenantId } = useTenant();
  const [step, setStep] = useState(1);
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'pending' | 'running' | 'completed' | 'failed'>('idle');
  const [recordsImported, setRecordsImported] = useState(0);

  const handleStartImport = async () => {
    if (!tenantId) return;
    setMigrationStatus('running');

    try {
      const { data, error } = await supabase.functions.invoke('relatio-import-start', {
        body: { tenant_id: tenantId, integration_key: integrationKey },
      });

      if (error) throw error;

      // Poll for status (simplified — in production, use realtime or polling)
      setRecordsImported(data?.migration?.records_imported ?? 0);
      setMigrationStatus('completed');
      toast.success('Migration complete! Your relationships are home.');
    } catch (err) {
      setMigrationStatus('failed');
      toast.error('Migration encountered an issue. Your original data is safe.');
    }
  };

  const humanTargetNames: Record<string, string> = {
    people: 'People',
    opportunities: 'Partners',
    reflections: 'Reflections',
    tasks: 'Tasks',
    communications: 'Communications',
  };

  return (
    <Card className="max-w-lg w-full">
      <CardHeader>
        <CardTitle className="text-lg">Migration Assistant</CardTitle>
        <CardDescription>
          Bring your relationships with you. Nothing gets lost.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Confirm source */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Shield className="h-5 w-5 text-primary flex-shrink-0" />
              <p className="text-sm text-foreground">
                You're moving from <strong>{integrationName}</strong> into CROS.
                We'll help you bring your relationships safely — your original data stays untouched.
              </p>
            </div>
            <Button onClick={() => setStep(2)} className="rounded-full">
              Let's go <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Step 2: Preview field mapping */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Here's how your data will be mapped into CROS:
            </p>
            <div className="space-y-2">
              {fieldMaps.map((fm) => (
                <div key={fm.source_field} className="flex items-center gap-3 text-sm p-2 rounded bg-muted/30">
                  <span className="font-medium capitalize">{fm.source_field}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-primary font-medium">
                    {humanTargetNames[fm.target_field] || fm.target_field}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              You can adjust these mappings later in settings.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="rounded-full">
                <ArrowLeft className="mr-1 h-3 w-3" /> Back
              </Button>
              <Button onClick={() => setStep(3)} className="rounded-full">
                Continue <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm and start */}
        {step === 3 && migrationStatus === 'idle' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
              <p className="text-sm">
                Ready to start. This may take a few minutes depending on data size.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="rounded-full">
                <ArrowLeft className="mr-1 h-3 w-3" /> Back
              </Button>
              <Button onClick={handleStartImport} className="rounded-full">
                Start import
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Active migration */}
        {step === 3 && (migrationStatus === 'running' || migrationStatus === 'completed' || migrationStatus === 'failed' || migrationStatus === 'pending') && (
          <div className="space-y-4">
            <MigrationProgressBar
              status={migrationStatus}
              recordsImported={recordsImported}
              integrationName={integrationName}
            />
            {(migrationStatus === 'completed' || migrationStatus === 'failed') && (
              <Button variant="outline" onClick={onClose} className="rounded-full">
                Close
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
