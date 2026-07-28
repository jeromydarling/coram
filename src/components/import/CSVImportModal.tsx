import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { parseCSV, CSVParseResult } from '@/lib/csv';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, X, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useImportHistory, useRollbackImport } from '@/hooks/useImportHistory';
import { formatDistanceToNow } from 'date-fns';

interface FieldDefinition {
  key: string;
  label: string;
  required: boolean;
}

interface CSVImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: readonly FieldDefinition[];
  onImport: (mappedData: Record<string, unknown>[]) => Promise<void>;
  historyType?: string;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

export function CSVImportModal({
  open,
  onOpenChange,
  title,
  fields,
  onImport,
  historyType,
}: CSVImportModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [csvData, setCsvData] = useState<CSVParseResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rollback-capable history shown during upload step
  const { data: recentHistory } = useImportHistory(historyType);
  const rollback = useRollbackImport();
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

  // On Android, when Google Files opens the browser may destroy the page.
  const handleVisibilityChange = useCallback(() => {
    if (!document.hidden && fileInputRef.current) {
      setTimeout(() => {
        const files = fileInputRef.current?.files;
        if (files && files.length > 0 && step === 'upload' && !csvData) {
          processFile(files[0]);
        }
      }, 500);
    }
  }, [step, csvData]);

  const handleWindowFocus = useCallback(() => {
    if (fileInputRef.current) {
      setTimeout(() => {
        const files = fileInputRef.current?.files;
        if (files && files.length > 0 && step === 'upload' && !csvData) {
          processFile(files[0]);
        }
      }, 800);
    }
  }, [step, csvData]);

  useEffect(() => {
    if (open) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleWindowFocus);
    }
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [open, handleVisibilityChange, handleWindowFocus]);

  const resetState = useCallback(() => {
    setStep('upload');
    setCsvData(null);
    setMapping({});
    setImportProgress(0);
    setError(null);
    setImportedCount(0);
    setRollingBackId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleExplicitClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [onOpenChange, resetState]);

  const processFile = async (file: File) => {
    setError(null);
    try {
      const result = await parseCSV(file);
      if (result.rows.length === 0) {
        setError('The CSV file appears to be empty.');
        return;
      }
      setCsvData(result);

      const autoMapping: Record<string, string> = {};
      fields.forEach(field => {
        const matchingHeader = result.headers.find(
          h => h.toLowerCase().replace(/[_\s-]/g, '') === field.key.toLowerCase().replace(/[_\s-]/g, '') ||
               h.toLowerCase().replace(/[_\s-]/g, '') === field.label.toLowerCase().replace(/[_\s-]/g, '')
        );
        if (matchingHeader) {
          autoMapping[field.key] = matchingHeader;
        }
      });
      setMapping(autoMapping);
      setStep('mapping');
    } catch (err) {
      setError('Failed to parse CSV file. Please ensure it is a valid CSV.');
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleMappingChange = (fieldKey: string, csvHeader: string) => {
    setMapping(prev => ({
      ...prev,
      [fieldKey]: csvHeader === '__none__' ? '' : csvHeader
    }));
  };

  const validateMapping = (): boolean => {
    const requiredFields = fields.filter(f => f.required);
    const missingRequired = requiredFields.filter(f => !mapping[f.key]);
    if (missingRequired.length > 0) {
      setError(`Required fields not mapped: ${missingRequired.map(f => f.label).join(', ')}`);
      return false;
    }
    return true;
  };

  const handleProceedToPreview = () => {
    if (validateMapping()) {
      setError(null);
      setStep('preview');
    }
  };

  const getMappedData = (): Record<string, unknown>[] => {
    if (!csvData) return [];

    return csvData.rows.map(row => {
      const mappedRow: Record<string, unknown> = {};
      Object.entries(mapping).forEach(([fieldKey, csvHeader]) => {
        if (csvHeader) {
          let value: unknown = row[csvHeader];

          if (fieldKey.includes('_yn') || fieldKey === 'is_primary') {
            value = ['true', 'yes', '1', 'y'].includes(String(value).toLowerCase());
          } else if (['staff_deployed', 'households_served', 'devices_distributed', 'internet_signups', 'referrals_generated'].includes(fieldKey)) {
            value = parseInt(String(value), 10) || 0;
          } else if (fieldKey === 'cost_estimated') {
            value = parseFloat(String(value)) || 0;
          }

          mappedRow[fieldKey] = value;
        }
      });
      return mappedRow;
    });
  };

  const handleImport = async () => {
    setStep('importing');
    setImportProgress(0);
    setError(null);

    try {
      const mappedData = getMappedData();

      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      await onImport(mappedData);

      clearInterval(progressInterval);
      setImportProgress(100);
      setImportedCount(mappedData.length);
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed. Please try again.');
      setStep('preview');
    }
  };

  const handleRollbackClick = async (importId: string) => {
    setRollingBackId(importId);
    try {
      await rollback.mutateAsync(importId);
    } finally {
      setRollingBackId(null);
    }
  };

  const previewData = getMappedData().slice(0, 5);
  const activeHistory = (recentHistory || []).filter(h => !h.is_rolled_back).slice(0, 5);
  const rolledBackHistory = (recentHistory || []).filter(h => h.is_rolled_back).slice(0, 3);

  return (
    <Dialog open={open} onOpenChange={() => {/* no-op: only close via explicit actions */}}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [&>button:last-of-type]:hidden">
        {/* Custom X close button */}
        <button
          type="button"
          onClick={handleExplicitClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a CSV file to import records.'}
            {step === 'mapping' && 'Map CSV columns to database fields.'}
            {step === 'preview' && 'Review the data before importing.'}
            {step === 'importing' && 'Importing records...'}
            {step === 'complete' && 'Import completed successfully!'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                style={{ zIndex: 10 }}
              />
              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                  'hover:border-primary hover:bg-primary/5'
                )}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Tap to select a CSV file
                </p>
                <p className="text-xs text-muted-foreground">CSV files only</p>
              </div>
            </div>

            {/* Recent rollback-capable imports */}
            {historyType && (activeHistory.length > 0 || rolledBackHistory.length > 0) && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Recent rollback-capable imports</p>
                {activeHistory.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{entry.total_rows} rows</span>
                      <span className="text-muted-foreground ml-2">
                        {formatDistanceToNow(new Date(entry.imported_at), { addSuffix: true })}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRollbackClick(entry.id)}
                      disabled={rollback.isPending && rollingBackId === entry.id}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    >
                      {rollback.isPending && rollingBackId === entry.id ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <RotateCcw className="w-3 h-3 mr-1" />
                      )}
                      Undo
                    </Button>
                  </div>
                ))}
                {rolledBackHistory.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 text-sm opacity-60">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{entry.total_rows} rows</span>
                      <span className="text-muted-foreground ml-2">
                        {formatDistanceToNow(new Date(entry.imported_at), { addSuffix: true })}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">Rolled back</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: Mapping */}
        {step === 'mapping' && csvData && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">
                {csvData.rows.length} rows found with {csvData.headers.length} columns
              </span>
            </div>

            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
              {fields.map(field => (
                <div key={field.key} className="flex items-center gap-4">
                  <div className="w-40 flex items-center gap-2">
                    <Label className="text-sm">
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                  </div>
                  <Select
                    value={mapping[field.key] || '__none__'}
                    onValueChange={(value) => handleMappingChange(field.key, value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">-- Not mapped --</SelectItem>
                      {csvData.headers.map(header => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {mapping[field.key] && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMappingChange(field.key, '__none__')}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Showing first {previewData.length} of {csvData?.rows.length} records:
            </p>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    {Object.entries(mapping)
                      .filter(([_, v]) => v)
                      .map(([key]) => (
                        <th key={key} className="px-3 py-2 text-left font-medium">
                          {fields.find(f => f.key === key)?.label || key}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, idx) => (
                    <tr key={idx} className="border-t">
                      {Object.entries(mapping)
                        .filter(([_, v]) => v)
                        .map(([key]) => (
                          <td key={key} className="px-3 py-2 truncate max-w-[200px]">
                            {String(row[key] ?? '')}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{csvData?.rows.length} total records</Badge>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="space-y-4 py-8">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span>Importing records...</span>
            </div>
            <Progress value={importProgress} className="w-full" />
            <p className="text-center text-sm text-muted-foreground">
              {importProgress}% complete
            </p>
          </div>
        )}

        {/* Step: Complete */}
        {step === 'complete' && (
          <div className="space-y-4 py-8 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-success" />
            <div>
              <p className="text-lg font-semibold">Import Complete!</p>
              <p className="text-muted-foreground">
                Successfully imported {importedCount} records.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleExplicitClose}>
              Cancel
            </Button>
          )}
          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleProceedToPreview}>
                Preview Import
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Back
              </Button>
              <Button onClick={handleImport}>
                Import {csvData?.rows.length} Records
              </Button>
            </>
          )}
          {step === 'complete' && (
            <Button onClick={handleExplicitClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
