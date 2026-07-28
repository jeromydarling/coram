/**
 * ImportWizard — Guided 6-step import wizard for migrating data into CROS.
 *
 * WHAT: Step-by-step wizard: choose source → select objects → map fields → preview → run → review.
 * WHERE: /relatio/setup/:connectorKey
 * WHY: Makes migration feel safe and human, not technical.
 */

import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, ArrowLeft, CheckCircle2, Shield, Upload, Loader2, FileText } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useTenantPath } from '@/hooks/useTenantPath';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useQuery } from '@tanstack/react-query';

const OBJECT_TYPES = [
  { key: 'organizations', label: 'Organizations / Companies', target: 'Opportunities (Partners)', icon: '🏢' },
  { key: 'contacts', label: 'Contacts / People', target: 'People', icon: '👤' },
  { key: 'activities', label: 'Notes / Emails / Engagements', target: 'Activities', icon: '📝' },
  { key: 'tasks', label: 'Tasks', target: 'Tasks', icon: '✅' },
];

const DEFAULT_FIELD_MAPS: Record<string, Array<{ source: string; target: string }>> = {
  organizations: [
    { source: 'name', target: 'organization' },
    { source: 'website', target: 'website_url' },
    { source: 'industry', target: 'notes' },
    { source: 'phone', target: 'phone' },
  ],
  contacts: [
    { source: 'name', target: 'name' },
    { source: 'email', target: 'email' },
    { source: 'phone', target: 'phone' },
    { source: 'title', target: 'title' },
  ],
  activities: [
    { source: 'type', target: 'activity_type' },
    { source: 'date', target: 'activity_date_time' },
    { source: 'notes', target: 'notes' },
  ],
  tasks: [
    { source: 'title', target: 'title' },
    { source: 'description', target: 'description' },
    { source: 'due_date', target: 'due_date' },
  ],
};

export default function ImportWizard() {
  const { connectorKey } = useParams<{ connectorKey: string }>();
  const { tenantId } = useTenant();
  const { tenantPath } = useTenantPath();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [selectedObjects, setSelectedObjects] = useState<string[]>(['organizations', 'contacts']);
  const [csvData, setCsvData] = useState<Record<string, unknown[]>>({});
  const [jobId, setJobId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load connector info
  const { data: connector } = useQuery({
    queryKey: ['relatio-connector', connectorKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('relatio_connectors')
        .select('*')
        .eq('key', connectorKey!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!connectorKey,
  });

  // Poll job status when running
  const { data: jobStatus } = useQuery({
    queryKey: ['relatio-job-status', jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const { data, error } = await supabase.functions.invoke('relatio-job-status', {
        body: null,
        headers: {},
      });
      // Use query params approach
      const { data: job } = await supabase
        .from('relatio_import_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      return job;
    },
    enabled: !!jobId,
    refetchInterval: jobId ? 3000 : false,
  });

  const isCsv = connectorKey === 'csv';
  const isExportBased = connectorKey === 'salesforce' || connectorKey === 'airtable';

  const toggleObject = (key: string) => {
    setSelectedObjects(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        toast.error('CSV must have a header row and at least one data row.');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const rows = lines.slice(1, 201).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = values[i] || ''; });
        return obj;
      });

      setCsvData({ rows, headers, totalRows: [lines.length - 1], fileName: [file.name] } as unknown as Record<string, unknown[]>);
      toast.success(`Loaded ${lines.length - 1} rows from ${file.name}`);
    };
    reader.readAsText(file);
  };

  const handleStartImport = async () => {
    if (!tenantId || !connectorKey) return;
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('relatio-job-create', {
        body: {
          tenant_id: tenantId,
          connector_key: connectorKey,
          scope: {
            selected_objects: selectedObjects,
            ...(isCsv ? { csv_preview: csvData } : {}),
          },
        },
      });

      if (error) throw error;
      setJobId(data.job.id);
      setStep(5);
      toast.success('Import started! We\'re bringing your relationships over.');
    } catch (err) {
      toast.error('Could not start import. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalSteps = 6;
  const progressPercent = (step / totalSteps) * 100;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Step {step} of {totalSteps}</span>
          <span>{connector?.name || connectorKey} Migration</span>
        </div>
        <Progress value={progressPercent} className="h-1.5" />
      </div>

      {/* Step 1: Welcome */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Bring your relationships with you</CardTitle>
            <CardDescription>
              We'll help you move your data from {connector?.name || connectorKey} into CROS.
              Nothing gets lost, and your original data stays untouched.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
              <Shield className="h-5 w-5 text-primary flex-shrink-0" />
              <p className="text-sm">
                {isExportBased
                  ? `Export your data from ${connector?.name} as CSV files, then upload them here. We'll map everything for you.`
                  : isCsv
                  ? 'Upload a CSV file and we\'ll guide you through mapping your columns to CROS fields.'
                  : `We'll connect securely to ${connector?.name} and import your relationships.`}
              </p>
            </div>
            <Button onClick={() => setStep(2)} className="rounded-full">
              Let's go <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Choose what to import */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>What would you like to bring over?</CardTitle>
            <CardDescription>Select the types of data you want to import.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {OBJECT_TYPES.map(obj => (
              <label
                key={obj.key}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selectedObjects.includes(obj.key)}
                  onCheckedChange={() => toggleObject(obj.key)}
                />
                <span className="text-lg">{obj.icon}</span>
                <div>
                  <p className="text-sm font-medium">{obj.label}</p>
                  <p className="text-xs text-muted-foreground">→ {obj.target}</p>
                </div>
              </label>
            ))}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="rounded-full">
                <ArrowLeft className="mr-1 h-3 w-3" /> Back
              </Button>
              <Button
                onClick={() => setStep(isCsv ? 3 : 4)}
                disabled={selectedObjects.length === 0}
                className="rounded-full"
              >
                Continue <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: CSV Upload (only for CSV connector) */}
      {step === 3 && isCsv && (
        <Card>
          <CardHeader>
            <CardTitle>Upload your file</CardTitle>
            <CardDescription>
              Upload a CSV file. We'll preview the first 200 rows to help you map fields.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex flex-col items-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {(csvData as any)?.fileName
                  ? `${(csvData as any).fileName} — ${(csvData as any).totalRows} rows`
                  : 'Click to upload CSV'}
              </span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>

            {(csvData as any)?.headers && (
              <div className="text-sm space-y-1">
                <p className="font-medium">Detected columns:</p>
                <div className="flex flex-wrap gap-1">
                  {((csvData as any).headers as string[]).map((h: string) => (
                    <span key={h} className="bg-muted px-2 py-0.5 rounded text-xs">{h}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(2)} className="rounded-full">
                <ArrowLeft className="mr-1 h-3 w-3" /> Back
              </Button>
              <Button
                onClick={() => setStep(4)}
                disabled={!(csvData as any)?.rows}
                className="rounded-full"
              >
                Continue <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Field mapping preview + confirm */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Review field mapping</CardTitle>
            <CardDescription>
              Here's how your data will map into CROS. You can adjust these later in settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedObjects.map(objKey => {
              const maps = DEFAULT_FIELD_MAPS[objKey] || [];
              const objLabel = OBJECT_TYPES.find(o => o.key === objKey)?.label || objKey;
              return (
                <div key={objKey} className="space-y-2">
                  <p className="text-sm font-semibold">{objLabel}</p>
                  {maps.map(m => (
                    <div key={m.source} className="flex items-center gap-3 text-sm p-2 rounded bg-muted/30">
                      <span className="font-medium min-w-0 truncate">{m.source}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-primary font-medium min-w-0 truncate">{m.target}</span>
                    </div>
                  ))}
                </div>
              );
            })}

            <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
              <p className="text-sm">
                Ready to start. You can rerun this import safely — duplicates are handled automatically.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(isCsv ? 3 : 2)} className="rounded-full">
                <ArrowLeft className="mr-1 h-3 w-3" /> Back
              </Button>
              <Button
                onClick={handleStartImport}
                disabled={isSubmitting}
                className="rounded-full"
              >
                {isSubmitting ? (
                  <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Starting…</>
                ) : (
                  <>Start import</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Running */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Import in progress</CardTitle>
            <CardDescription>
              We're bringing your relationships over gently. This runs in the background.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {jobStatus?.status === 'completed'
                  ? '✅ All done!'
                  : jobStatus?.status === 'failed'
                  ? '⚠️ Something went wrong. Your original data is untouched.'
                  : 'Moving your relationships safely…'}
              </p>
              <Progress
                value={
                  jobStatus?.status === 'completed' ? 100 :
                  jobStatus?.status === 'failed' ? 100 :
                  50
                }
                className={jobStatus?.status === 'failed' ? '[&>div]:bg-destructive' : ''}
              />
              {jobStatus?.progress && typeof jobStatus.progress === 'object' && (
                <div className="text-xs text-muted-foreground space-y-1 pt-2">
                  {Object.entries((jobStatus.progress as any)?.counts || {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="capitalize">{k}</span>
                      <span className="font-medium">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(jobStatus?.status === 'completed' || jobStatus?.status === 'failed') && (
              <Button onClick={() => setStep(6)} className="rounded-full">
                Review results <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 6: Review */}
      {step === 6 && (
        <Card>
          <CardHeader>
            <CardTitle>Import complete</CardTitle>
            <CardDescription>
              Your relationships are home. Here's a summary of what happened.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {jobStatus?.progress && typeof jobStatus.progress === 'object' && (
              <div className="space-y-2">
                {Object.entries((jobStatus.progress as any)?.counts || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between p-2 bg-muted/30 rounded text-sm">
                    <span className="capitalize font-medium">{k}</span>
                    <span>{String(v)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => navigate(tenantPath('/relatio'))}
                className="rounded-full"
              >
                Back to Relatio
              </Button>
              <Button
                onClick={() => navigate(tenantPath('/opportunities'))}
                className="rounded-full"
              >
                View Partners <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
