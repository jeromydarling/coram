/**
 * FlocknoteImportWizard — Tenant admin CSV import wizard for the Flocknote Bridge.
 *
 * WHAT: Multi-step wizard to upload, preview, dry-run, and commit Flocknote CSV imports.
 * WHERE: /:tenantSlug/admin/flocknote
 * WHY: Human-first import experience with full preview before committing.
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { normalizeCsvColumns, parseCsvWithNormalization, type NormalizationResult } from '@/utils/normalizeCsvColumns';
import {
  ArrowRight, ArrowLeft, Upload, FileSpreadsheet, Eye,
  CheckCircle2, AlertTriangle, Loader2, Users, FolderOpen,
  HelpCircle,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DryRunResult {
  counts: {
    rows_read: number;
    people_mapped: number;
    memberships_mapped: number;
    groups_detected: number;
    skipped_missing_keys: number;
    duplicates_detected: number;
  };
  preview: {
    people: Record<string, string>[];
    memberships: Record<string, string>[];
  };
  warnings: string[];
  header_map: {
    people: Record<string, string>;
    memberships: Record<string, string>;
  };
}

interface CommitResult {
  results: {
    people_created: number;
    people_updated: number;
    people_skipped: number;
    groups_created: number;
    memberships_created: number;
    memberships_skipped: number;
  };
  warnings: string[];
}

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help inline ml-1" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function FlocknoteImportWizard() {
  const { tenantId } = useTenant();
  const [step, setStep] = useState(1);

  // CSV state
  const [peopleCsv, setPeopleCsv] = useState('');
  const [membershipsCsv, setMembershipsCsv] = useState('');
  const [peopleFileName, setPeopleFileName] = useState('');
  const [membershipsFileName, setMembershipsFileName] = useState('');

  // Preview state
  const [peopleNorm, setPeopleNorm] = useState<NormalizationResult | null>(null);
  const [peoplePreview, setPeoplePreview] = useState<Record<string, string>[]>([]);

  // Dry run / commit state
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = useCallback((
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (csv: string) => void,
    nameSetter: (name: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    nameSetter(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setter(text);
    };
    reader.readAsText(file);
  }, []);

  // Step 1 → 2: parse & preview people
  const handlePeopleNext = () => {
    if (!peopleCsv) {
      toast.error('Please upload a People CSV first.');
      return;
    }
    const { rows, normalization } = parseCsvWithNormalization(peopleCsv, 'people');
    setPeopleNorm(normalization);
    setPeoplePreview(rows.slice(0, 10));
    setStep(2);
  };

  // Run dry run
  const handleDryRun = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('flocknote-import', {
        body: {
          mode: 'dry_run',
          tenant_id: tenantId,
          people_csv: peopleCsv,
          memberships_csv: membershipsCsv || undefined,
        },
      });
      if (error) throw error;
      setDryRunResult(data);
      setStep(4);
    } catch (err: any) {
      toast.error(err.message || 'Dry run failed');
    } finally {
      setLoading(false);
    }
  };

  // Run commit
  const handleCommit = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('flocknote-import', {
        body: {
          mode: 'commit',
          tenant_id: tenantId,
          people_csv: peopleCsv,
          memberships_csv: membershipsCsv || undefined,
        },
      });
      if (error) throw error;
      setCommitResult(data);
      setStep(5);
      toast.success('Import complete! Your relationships are home.');
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <FileSpreadsheet className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold font-serif">Flocknote Bridge</h1>
        <HelpTip text="Import people, groups, and memberships from Flocknote CSV exports into CROS." />
      </div>
      <p className="text-muted-foreground text-sm">
        Bring your community relationships from Flocknote into CROS. Your original data stays untouched.
      </p>

      {/* Step indicators */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {['Upload People', 'Preview', 'Memberships', 'Dry Run', 'Import'].map((label, i) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              step > i + 1 ? 'bg-primary text-primary-foreground' :
              step === i + 1 ? 'bg-primary/20 text-primary border border-primary' :
              'bg-muted text-muted-foreground'
            }`}>{i + 1}</div>
            <span className={step === i + 1 ? 'font-medium text-foreground' : ''}>{label}</span>
            {i < 4 && <ArrowRight className="h-3 w-3 text-muted-foreground/50" />}
          </div>
        ))}
      </div>

      <Separator />

      {/* Step 1: Upload People CSV */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-4 w-4" /> Upload People CSV
              <HelpTip text="Export your People list from Flocknote and upload the CSV here." />
            </CardTitle>
            <CardDescription>
              Start by uploading your Flocknote People export. We'll auto-detect your column headers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="file"
              accept=".csv"
              onChange={(e) => handleFileUpload(e, setPeopleCsv, setPeopleFileName)}
            />
            {peopleFileName && (
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span>{peopleFileName}</span>
                <Badge variant="outline" className="text-xs">Ready</Badge>
              </div>
            )}
            <Button onClick={handlePeopleNext} disabled={!peopleCsv} className="rounded-full">
              Next <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview mapping */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-4 w-4" /> Column Mapping Preview
              <HelpTip text="Shows how your CSV columns map to CROS fields. Unknown columns are flagged but preserved." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {peopleNorm && (
              <>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Header Mapping:</p>
                  <div className="grid grid-cols-2 gap-1.5 text-sm">
                    {Object.entries(peopleNorm.headerMap).map(([orig, canon]) => (
                      <div key={orig} className="flex items-center gap-2 p-1.5 rounded bg-muted/30">
                        <span className="text-muted-foreground">{orig}</span>
                        <ArrowRight className="h-3 w-3 flex-shrink-0" />
                        <span className="font-medium text-primary">{canon}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {peopleNorm.unknownHeaders.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Unmapped columns: {peopleNorm.unknownHeaders.join(', ')}. These will be ignored.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {/* Data preview */}
            {peoplePreview.length > 0 && (
              <div className="overflow-x-auto">
                <p className="text-sm font-medium mb-2">Data Preview (first {peoplePreview.length} rows):</p>
                <table className="w-full text-xs border">
                  <thead>
                    <tr className="bg-muted">
                      {Object.keys(peoplePreview[0]).filter(k => k !== '_raw').map((k) => (
                        <th key={k} className="px-2 py-1 text-left font-medium">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {peoplePreview.map((row, i) => (
                      <tr key={i} className="border-t">
                        {Object.entries(row).filter(([k]) => k !== '_raw').map(([k, v]) => (
                          <td key={k} className="px-2 py-1 truncate max-w-[150px]">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="rounded-full">
                <ArrowLeft className="mr-1 h-3 w-3" /> Back
              </Button>
              <Button onClick={() => setStep(3)} className="rounded-full">
                Continue <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Memberships upload */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FolderOpen className="h-4 w-4" /> Upload Memberships CSV (Optional)
              <HelpTip text="Upload a CSV of group memberships. Each row links a person (by email or phone) to a group." />
            </CardTitle>
            <CardDescription>
              Optionally include group memberships. Each row links a person to a Flocknote group by email or phone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="file"
              accept=".csv"
              onChange={(e) => handleFileUpload(e, setMembershipsCsv, setMembershipsFileName)}
            />
            {membershipsFileName && (
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span>{membershipsFileName}</span>
                <Badge variant="outline" className="text-xs">Ready</Badge>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="rounded-full">
                <ArrowLeft className="mr-1 h-3 w-3" /> Back
              </Button>
              <Button onClick={handleDryRun} disabled={loading} className="rounded-full">
                {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Eye className="mr-1 h-3 w-3" />}
                Run Preview
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Dry run results */}
      {step === 4 && dryRunResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-4 w-4" /> Dry Run Results
              <HelpTip text="Nothing has been saved yet. Review these results and click Import when ready." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Rows Read', value: dryRunResult.counts.rows_read, icon: FileSpreadsheet },
                { label: 'People Mapped', value: dryRunResult.counts.people_mapped, icon: Users },
                { label: 'Memberships', value: dryRunResult.counts.memberships_mapped, icon: FolderOpen },
                { label: 'Groups Detected', value: dryRunResult.counts.groups_detected, icon: FolderOpen },
                { label: 'Skipped', value: dryRunResult.counts.skipped_missing_keys, icon: AlertTriangle },
                { label: 'Duplicates', value: dryRunResult.counts.duplicates_detected, icon: AlertTriangle },
              ].map((stat) => (
                <div key={stat.label} className="p-3 rounded-lg bg-muted/30 text-center">
                  <stat.icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-lg font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>

            {dryRunResult.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside text-sm space-y-0.5">
                    {dryRunResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)} className="rounded-full">
                <ArrowLeft className="mr-1 h-3 w-3" /> Back
              </Button>
              <Button onClick={handleCommit} disabled={loading} className="rounded-full">
                {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                Import Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Commit results */}
      {step === 5 && commitResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'People Created', value: commitResult.results.people_created },
                { label: 'People Updated', value: commitResult.results.people_updated },
                { label: 'People Skipped', value: commitResult.results.people_skipped },
                { label: 'Groups Created', value: commitResult.results.groups_created },
                { label: 'Memberships Created', value: commitResult.results.memberships_created },
                { label: 'Memberships Skipped', value: commitResult.results.memberships_skipped },
              ].map((stat) => (
                <div key={stat.label} className="p-3 rounded-lg bg-muted/30 text-center">
                  <div className="text-lg font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>

            {commitResult.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside text-sm space-y-0.5">
                    {commitResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Button variant="outline" onClick={() => {
              setStep(1);
              setPeopleCsv('');
              setMembershipsCsv('');
              setPeopleFileName('');
              setMembershipsFileName('');
              setDryRunResult(null);
              setCommitResult(null);
            }} className="rounded-full">
              Start Another Import
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
