import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Upload, FileSpreadsheet, ArrowRight, Check, AlertCircle, RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import Papa from 'papaparse';
import { formatDistanceToNow } from 'date-fns';
import { IMPORT_PREVIEW_MAX_ROWS, IMPORT_CSV_MAX_ROWS } from '@/lib/volunteerConfig';
import { useImportHistory, useRollbackImport } from '@/hooks/useImportHistory';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const IMPORT_TYPES = [
  { value: 'organizations', label: 'Organizations / Partners' },
  { value: 'people', label: 'People / Contacts' },
  { value: 'activities', label: 'Activities / Notes' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'deals', label: 'Deals / Pipeline Stages' },
  { value: 'volunteers', label: 'Volunteers' },
];

const SOURCE_SYSTEMS = [
  { value: 'generic_csv', label: 'Generic CSV' },
  { value: 'hubspot_export', label: 'HubSpot Export' },
  { value: 'salesforce', label: 'Salesforce (CSV)' },
  { value: 'zoho', label: 'Zoho (CSV)' },
  { value: 'pipedrive', label: 'Pipedrive (CSV)' },
];

type Step = 'upload' | 'map' | 'preview' | 'importing' | 'done';

interface UnifiedRow {
  rowId: string;
  source: 'run' | 'csv';
  created_at: string;
  import_type: string;
  source_system?: string;
  status: string;
  total_rows: number | null;
  // csv-specific
  rollbackImportId?: string;
  is_rolled_back?: boolean;
}

export default function ImportCenter() {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('upload');
  const [importType, setImportType] = useState('organizations');
  const [sourceSystem, setSourceSystem] = useState('generic_csv');
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [rollbackId, setRollbackId] = useState<string | null>(null);

  const rollback = useRollbackImport();

  // Import runs from import_runs table
  const { data: runs } = useQuery({
    queryKey: ['import-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  // CSV import history
  const { data: csvHistory } = useImportHistory();

  // Merge into unified list
  const unifiedRows: UnifiedRow[] = (() => {
    const rows: UnifiedRow[] = [];

    (runs || []).forEach(r => {
      rows.push({
        rowId: `run-${r.id}`,
        source: 'run',
        created_at: r.created_at,
        import_type: r.import_type,
        source_system: r.source_system,
        status: r.status,
        total_rows: (r.stats as any)?.total_rows ?? null,
      });
    });

    (csvHistory || []).forEach(h => {
      rows.push({
        rowId: `csv-${h.id}`,
        source: 'csv',
        created_at: h.imported_at,
        import_type: h.import_type,
        source_system: undefined,
        status: h.is_rolled_back ? 'rolled_back' : 'completed',
        total_rows: h.total_rows,
        rollbackImportId: h.id,
        is_rolled_back: h.is_rolled_back,
      });
    });

    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return rows;
  })();

  const TARGET_FIELDS: Record<string, string[]> = {
    organizations: ['organization', 'website_url', 'sector', 'metro', 'stage', 'notes'],
    people: ['name', 'email', 'phone', 'title', 'organization', 'notes'],
    volunteers: ['first_name', 'last_name', 'email', 'phone', 'address', 'city', 'state', 'zip', 'notes'],
    activities: ['contact', 'type', 'date', 'notes', 'outcome'],
    tasks: ['title', 'description', 'due_date', 'priority', 'contact'],
    deals: ['organization', 'stage', 'value', 'close_date', 'notes'],
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as Record<string, string>[];
        if (data.length === 0) { toast.error(t('importCenter.toasts.csvEmpty')); return; }
        if (data.length > IMPORT_CSV_MAX_ROWS) {
          toast.error(t('importCenter.toasts.csvTooLarge', { rows: data.length.toLocaleString(), max: IMPORT_CSV_MAX_ROWS.toLocaleString() }));
          return;
        }
        setCsvData(data);
        setHeaders(Object.keys(data[0]));

        const targets = TARGET_FIELDS[importType] || [];
        const autoMap: Record<string, string> = {};
        for (const h of Object.keys(data[0])) {
          const lower = h.toLowerCase().replace(/[_\s-]/g, '');
          for (const tgt of targets) {
            if (lower.includes(tgt.replace(/_/g, ''))) {
              autoMap[h] = tgt;
              break;
            }
          }
        }
        setMapping(autoMap);
        setStep('map');
      },
      error: (err) => toast.error(t('importCenter.toasts.csvParseError', { message: err.message })),
    });
  };

  const handleImport = async () => {
    if (!user?.id) return;
    setImporting(true);
    setStep('importing');

    try {
      const { data: run, error: runError } = await supabase
        .from('import_runs')
        .insert({
          user_id: user.id,
          source_system: sourceSystem,
          import_type: importType,
          status: 'importing',
          stats: { total_rows: csvData.length, mapping },
        })
        .select()
        .single();

      if (runError) throw runError;

      let created = 0, updated = 0, skipped = 0;

      if (importType === 'volunteers') {
        for (const row of csvData) {
          const mapped: Record<string, string> = {};
          for (const [src, tgt] of Object.entries(mapping)) {
            if (tgt && row[src]) mapped[tgt] = row[src];
          }
          if (!mapped.first_name || !mapped.last_name || !mapped.email) { skipped++; continue; }

          const { error } = await supabase
            .from('volunteers')
            .upsert({
              first_name: mapped.first_name,
              last_name: mapped.last_name,
              email: mapped.email.toLowerCase().trim(),
              phone: mapped.phone || null,
              address: mapped.address || null,
              city: mapped.city || null,
              state: mapped.state || null,
              zip: mapped.zip || null,
              notes: mapped.notes || null,
            }, { onConflict: 'email' });

          if (error) { skipped++; } else { created++; }
        }
      } else if (importType === 'people') {
        for (const row of csvData) {
          const mapped: Record<string, string> = {};
          for (const [src, tgt] of Object.entries(mapping)) {
            if (tgt && row[src]) mapped[tgt] = row[src];
          }
          if (!mapped.name) { skipped++; continue; }

          const { error } = await supabase
            .from('contacts')
            .insert({
              name: mapped.name,
              email: mapped.email || null,
              phone: mapped.phone || null,
              title: mapped.title || null,
              notes: mapped.notes || null,
            });

          if (error) { skipped++; } else { created++; }
        }
      } else {
        skipped = csvData.length;
      }

      await supabase
        .from('import_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          stats: { total_rows: csvData.length, created, updated, skipped, mapping },
        })
        .eq('id', run.id);

      qc.invalidateQueries({ queryKey: ['import-runs'] });
      qc.invalidateQueries({ queryKey: ['import-history'] });
      toast.success(t('importCenter.toasts.importComplete', { created, skipped }));
      setStep('done');
    } catch (err: any) {
      toast.error(t('importCenter.toasts.importFailed', { message: err.message }));
      setStep('upload');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setCsvData([]);
    setHeaders([]);
    setMapping({});
    setFileName('');
  };

  const handleRollback = async () => {
    if (!rollbackId) return;
    await rollback.mutateAsync(rollbackId);
    setRollbackId(null);
  };

  return (
    <MainLayout title={t('importCenter.title')} data-testid="import-root">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Upload className="w-6 h-6" />
            {t('importCenter.title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('importCenter.subtitle')}
          </p>
        </div>

        {/* Stepper */}
        <Card>
          <CardContent className="pt-6">
            {step === 'upload' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>{t('importCenter.importTypeLabel')}</Label>
                    <Select value={importType} onValueChange={setImportType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {IMPORT_TYPES.map(it => <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('importCenter.sourceSystemLabel')}</Label>
                    <Select value={sourceSystem} onValueChange={setSourceSystem}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SOURCE_SYSTEMS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">{t('importCenter.uploadPrompt')}</p>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="max-w-xs mx-auto"
                  />
                </div>
              </div>
            )}

            {step === 'map' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm"><strong>{fileName}</strong> — {csvData.length} rows</p>
                  <Button variant="outline" size="sm" onClick={reset}>{t('importCenter.startOver')}</Button>
                </div>
                <p className="text-sm text-muted-foreground">{t('importCenter.mapColumns')}</p>
                <div className="space-y-2">
                  {headers.map(h => (
                    <div key={h} className="flex items-center gap-3">
                      <span className="text-sm w-40 truncate font-mono">{h}</span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <Select value={mapping[h] || '__skip__'} onValueChange={v => setMapping(m => ({ ...m, [h]: v === '__skip__' ? '' : v }))}>
                        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__skip__">{t('importCenter.skip')}</SelectItem>
                          {(TARGET_FIELDS[importType] || []).map(f => (
                            <SelectItem key={f} value={f}>{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep('preview')}>{t('importCenter.previewButton')}</Button>
                  <Button onClick={handleImport}>
                    {t('importCenter.importRows', { count: csvData.length })}
                  </Button>
                </div>
              </div>
            )}

            {step === 'preview' && (
              <div className="space-y-4">
                <p className="text-sm font-medium">{t('importCenter.previewLabel', { shown: Math.min(csvData.length, IMPORT_PREVIEW_MAX_ROWS), total: csvData.length.toLocaleString() })}</p>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Object.values(mapping).filter(Boolean).map(f => (
                          <TableHead key={f}>{f}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.slice(0, IMPORT_PREVIEW_MAX_ROWS).map((row, i) => (
                        <TableRow key={i}>
                          {Object.entries(mapping).filter(([, v]) => v).map(([src, tgt]) => (
                            <TableCell key={tgt} className="text-sm">{row[src] || '—'}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep('map')}>{t('importCenter.backToMapping')}</Button>
                  <Button onClick={handleImport}>{t('importCenter.importRows', { count: csvData.length })}</Button>
                </div>
              </div>
            )}

            {step === 'importing' && (
              <div className="flex flex-col items-center py-12">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">{t('importCenter.importing')}</p>
              </div>
            )}

            {step === 'done' && (
              <div className="flex flex-col items-center py-12">
                <Check className="w-10 h-10 text-green-600 mb-4" />
                <p className="text-lg font-medium">{t('importCenter.importComplete')}</p>
                <Button variant="outline" className="mt-4" onClick={reset}>{t('importCenter.importAnother')}</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Unified Import History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('importCenter.history.title')}</CardTitle>
            <CardDescription>{t('importCenter.history.description')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('importCenter.history.colWhen')}</TableHead>
                  <TableHead>{t('importCenter.history.colType')}</TableHead>
                  <TableHead>{t('importCenter.history.colSource')}</TableHead>
                  <TableHead>{t('importCenter.history.colStatus')}</TableHead>
                  <TableHead className="text-right">{t('importCenter.history.colRows')}</TableHead>
                  <TableHead className="text-right">{t('importCenter.history.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unifiedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t('importCenter.history.noImports')}</TableCell>
                  </TableRow>
                ) : (
                  unifiedRows.map(r => (
                    <TableRow key={r.rowId} className={r.is_rolled_back ? 'opacity-60' : ''}>
                      <TableCell className="text-sm">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</TableCell>
                      <TableCell><Badge variant="outline">{r.import_type}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.source === 'csv' ? t('importCenter.history.csvImport') : (r.source_system || '—')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          r.status === 'completed' ? 'default' :
                          r.status === 'rolled_back' ? 'secondary' :
                          r.status === 'failed' ? 'destructive' : 'secondary'
                        }>
                          {r.status === 'rolled_back' ? t('importCenter.history.rolledBack') : r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{r.total_rows ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        {r.source === 'csv' && r.rollbackImportId ? (
                          r.is_rolled_back ? (
                            <span className="text-xs text-muted-foreground">{t('importCenter.history.rolledBack')}</span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRollbackId(r.rollbackImportId!)}
                              disabled={rollback.isPending && rollbackId === r.rollbackImportId}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              {rollback.isPending && rollbackId === r.rollbackImportId ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                            </Button>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">{t('importCenter.history.notRollbackCapable')}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Rollback Confirmation */}
      <AlertDialog open={!!rollbackId} onOpenChange={() => setRollbackId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('importCenter.rollback.dialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('importCenter.rollback.dialogDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('importCenter.rollback.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollback}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={rollback.isPending}
            >
              {rollback.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('importCenter.rollback.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
