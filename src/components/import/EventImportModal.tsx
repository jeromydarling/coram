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
import { Checkbox } from '@/components/ui/checkbox';
import { parseCSV, CSVParseResult } from '@/lib/csv';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, X, MapPin, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMetros } from '@/hooks/useMetros';

export interface ImportOptions {
  upsertMode: boolean;
}

interface EventImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (events: EventImportData[], options: ImportOptions) => Promise<void>;
  defaultMetroId?: string;
}

export interface EventImportData {
  event_name: string;
  event_date: string;
  end_date?: string | null;
  metro_id?: string;
  event_type?: string | null;
  staff_deployed?: number;
  households_served?: number;
  devices_distributed?: number;
  internet_signups?: number;
  referrals_generated?: number;
  cost_estimated?: number;
  anchor_identified_yn?: boolean;
  followup_meeting_yn?: boolean;
  grant_narrative_value?: 'High' | 'Medium' | 'Low';
  notes?: string;
  // New fields
  city?: string;
  host_organization?: string;
  target_populations?: string[];
  strategic_lanes?: string[];
  pcs_goals?: string[];
  priority?: 'High' | 'Medium' | 'Low';
  status?: 'Registered' | 'Not Registered';
  travel_required?: 'Local' | 'Regional';
  expected_households?: string;
  expected_referrals?: string;
  anchor_potential?: 'High' | 'Medium' | 'Very High' | 'Extremely High';
  // Recurring fields
  is_recurring?: boolean;
  recurrence_pattern?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  recurrence_end_date?: string;
  // URL field
  url?: string;
  // Description field
  description?: string;
}

// Smart column mappings for common CSV formats
const COLUMN_ALIASES: Record<string, string[]> = {
  event_name: ['event name', 'name', 'title', 'event title', 'event'],
  event_date: ['date', 'event date', 'event_date', 'start date', 'start_date'],
  end_date: ['end date', 'end_date', 'end', 'finish date', 'through'],
  event_type: ['event type', 'type', 'category', 'event_type'],
  staff_deployed: ['staff needed', 'staff', 'staff deployed', 'staff_deployed', 'staff count'],
  households_served: ['households served', 'hh served', 'households_served', 'actual households'],
  referrals_generated: ['referrals generated', 'referrals_generated', 'actual referrals'],
  notes: ['notes', 'comments', 'details'],
  anchor_identified_yn: ['anchor identified', 'anchor_identified_yn', 'anchor'],
  grant_narrative_value: ['grant narrative value', 'grant_narrative_value'],
  devices_distributed: ['devices', 'devices distributed', 'devices_distributed', 'device count'],
  internet_signups: ['internet signups', 'signups', 'internet_signups', 'sign ups'],
  cost_estimated: ['cost', 'cost estimated', 'cost_estimated', 'budget', 'estimated cost'],
  // New field mappings
  city: ['city', 'address', 'location', 'venue', 'site'],
  host_organization: ['host organization', 'host', 'host org', 'organization', 'partner'],
  target_populations: ['target population', 'population', 'audience', 'target audience'],
  strategic_lanes: ['strategic lane', 'lane', 'strategy', 'strategic lanes'],
  pcs_goals: ['pcs goal', 'goal', 'goals', 'pcs goals'],
  priority: ['priority', 'priority level', 'priority (1-high,2-med,3-low)'],
  status: ['status', 'registration status', 'registered'],
  travel_required: ['travel required', 'travel', 'travel type'],
  expected_households: ['expected households', 'expected hh', 'exp households'],
  expected_referrals: ['expected referrals', 'exp referrals'],
  anchor_potential: ['anchor potential', 'potential'],
  is_recurring: ['recurring', 'is recurring', 'repeat', 'repeating'],
  recurrence_pattern: ['recurrence pattern', 'pattern', 'frequency'],
  recurrence_end_date: ['recurrence end', 'until', 'repeat until'],
  url: ['url', 'link', 'event url', 'event link', 'registration url', 'registration link', 'website'],
  description: ['description', 'event description', 'summary'],
};

// Note: Event types are now created dynamically during import if they don't exist
// The import hook handles this automatically

// Parse various date formats
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Clean up the string - remove extra info like "(weekly)"
  const cleanStr = dateStr.replace(/\s*\([^)]*\)\s*/g, '').trim();
  
  const monthNames: Record<string, string> = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12',
  };

  // Try "Jan 26, 2026" or "January 26, 2026" format
  const monthMatch = cleanStr.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})$/);
  if (monthMatch) {
    const month = monthNames[monthMatch[1].toLowerCase()];
    const day = monthMatch[2].padStart(2, '0');
    const year = monthMatch[3];
    if (month) return `${year}-${month}-${day}`;
  }

  // Try ISO format "2026-01-26"
  const isoMatch = cleanStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  // Try M/D/YYYY or MM/DD/YYYY format (US format: month/day/year)
  const usMatch = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const month = usMatch[1].padStart(2, '0');
    const day = usMatch[2].padStart(2, '0');
    const year = usMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Try M-D-YYYY or MM-DD-YYYY format
  const dashMatch = cleanStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const month = dashMatch[1].padStart(2, '0');
    const day = dashMatch[2].padStart(2, '0');
    const year = dashMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Try YYYY/MM/DD format
  const altIsoMatch = cleanStr.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (altIsoMatch) {
    return `${altIsoMatch[1]}-${altIsoMatch[2].padStart(2, '0')}-${altIsoMatch[3].padStart(2, '0')}`;
  }

  console.warn(`Could not parse date: "${dateStr}"`);
  return null;
}

// Map priority to grant narrative value
function mapPriority(value: string): 'High' | 'Medium' | 'Low' {
  const v = value.toLowerCase().trim();
  if (v === '1' || v === 'high' || v === 'h') return 'High';
  if (v === '2' || v === 'medium' || v === 'med' || v === 'm') return 'Medium';
  return 'Low';
}

// Map anchor potential to boolean
function mapAnchorPotential(value: string): boolean {
  const v = value.toLowerCase().trim();
  return v === 'high' || v === 'yes' || v === 'y' || v === 'true' || v === '1';
}

// Parse number, handling "50/month" style values
function parseNumber(value: string): number {
  if (!value) return 0;
  const match = value.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// Map recurring value to boolean
function mapRecurring(value: string): boolean {
  if (!value) return false;
  const v = value.toLowerCase().trim();
  return v === 'yes' || v === 'y' || v === 'true' || v === '1' || v === 'recurring';
}

// Map recurrence pattern value
function mapRecurrencePattern(value: string): 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase().trim();
  if (v === 'weekly' || v === 'week') return 'weekly';
  if (v === 'biweekly' || v === 'bi-weekly' || v === 'every 2 weeks') return 'biweekly';
  if (v === 'monthly' || v === 'month') return 'monthly';
  if (v === 'quarterly' || v === 'quarter') return 'quarterly';
  if (v === 'yearly' || v === 'annual' || v === 'annually' || v === 'year') return 'yearly';
  return undefined;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

export function EventImportModal({
  open,
  onOpenChange,
  onImport,
  defaultMetroId,
}: EventImportModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [csvData, setCsvData] = useState<CSVParseResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [selectedMetroId, setSelectedMetroId] = useState<string | undefined>(defaultMetroId);
  const [upsertMode, setUpsertMode] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [extraColumns, setExtraColumns] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: metros } = useMetros();

  useEffect(() => {
    if (defaultMetroId) {
      setSelectedMetroId(defaultMetroId);
    }
  }, [defaultMetroId]);

  const resetState = useCallback(() => {
    setStep('upload');
    setCsvData(null);
    setMapping({});
    setUpsertMode(false);
    setImportProgress(0);
    setError(null);
    setImportedCount(0);
    setExtraColumns([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleClose = useCallback((open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  }, [onOpenChange, resetState]);

  const autoMapColumns = (headers: string[]): { mapping: Record<string, string>; extras: string[] } => {
    const newMapping: Record<string, string> = {};
    const mappedHeaders = new Set<string>();

    console.log('[EventImport] Headers received:', headers);

    // For each of our fields, find matching CSV headers
    Object.entries(COLUMN_ALIASES).forEach(([fieldKey, aliases]) => {
      for (const header of headers) {
        const normalizedHeader = header.toLowerCase().trim();
        if (aliases.includes(normalizedHeader) && !mappedHeaders.has(header)) {
          console.log(`[EventImport] Mapped "${header}" -> ${fieldKey}`);
          newMapping[fieldKey] = header;
          mappedHeaders.add(header);
          break;
        }
      }
    });

    console.log('[EventImport] Final mapping:', newMapping);

    // Find extra columns not mapped
    const extras = headers.filter(h => !mappedHeaders.has(h));
    return { mapping: newMapping, extras };
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    try {
      const result = await parseCSV(file);
      if (result.rows.length === 0) {
        setError('The CSV file appears to be empty.');
        return;
      }
      setCsvData(result);
      
      // Auto-map columns
      const { mapping: autoMapping, extras } = autoMapColumns(result.headers);
      setMapping(autoMapping);
      setExtraColumns(extras);
      setStep('mapping');
    } catch (err) {
      setError('Failed to parse CSV file. Please ensure it is a valid CSV.');
    }
  };

  const handleMappingChange = (fieldKey: string, csvHeader: string) => {
    setMapping(prev => ({
      ...prev,
      [fieldKey]: csvHeader === '__none__' ? '' : csvHeader
    }));
  };

  const validateMapping = (): boolean => {
    if (!mapping.event_name) {
      setError('Event Name is required. Please map a column.');
      return false;
    }
    if (!mapping.event_date) {
      setError('Event Date is required. Please map a column.');
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

  const getMappedData = (): EventImportData[] => {
    if (!csvData) return [];
    
    return csvData.rows.map(row => {
      // Get event type from mapping - will be created during import if needed
      const eventTypeValue = mapping.event_type ? row[mapping.event_type]?.trim() : '';
      const eventType = eventTypeValue || null;

      // Parse date
      const dateValue = mapping.event_date ? row[mapping.event_date] : '';
      console.log(`[EventImport] Row date - header: "${mapping.event_date}", value: "${dateValue}"`);
      const parsedDate = parseDate(dateValue);
      console.log(`[EventImport] Parsed date: "${parsedDate}" from "${dateValue}"`);
      const finalDate = parsedDate || new Date().toISOString().split('T')[0];

      // Build comprehensive notes from extra columns
      const noteParts: string[] = [];
      if (mapping.notes && row[mapping.notes]) {
        noteParts.push(row[mapping.notes]);
      }
      
      // Add extra unmapped columns to notes
      extraColumns.forEach(col => {
        const value = row[col];
        if (value && value.trim()) {
          noteParts.push(`${col}: ${value}`);
        }
      });

      // Parse multi-select fields (pipe-separated in CSV, e.g., "Value1 | Value2 | Value3")
      const parseMultiSelect = (value: string | undefined): string[] | undefined => {
        if (!value) return undefined;
        return value.split('|').map(v => v.trim()).filter(Boolean);
      };

      // Map status value
      const mapStatus = (value: string | undefined): 'Registered' | 'Not Registered' | undefined => {
        if (!value) return undefined;
        const v = value.toLowerCase().trim();
        if (v === 'registered' || v === 'yes' || v === 'y') return 'Registered';
        if (v === 'not registered' || v === 'no' || v === 'n') return 'Not Registered';
        return undefined;
      };

      // Map travel required value
      const mapTravelRequired = (value: string | undefined): 'Local' | 'Regional' | undefined => {
        if (!value) return undefined;
        const v = value.toLowerCase().trim();
        if (v === 'local' || v === 'l') return 'Local';
        if (v === 'regional' || v === 'r') return 'Regional';
        return undefined;
      };

      // Map anchor potential value
      const mapAnchorPotentialValue = (value: string | undefined): 'High' | 'Medium' | 'Very High' | 'Extremely High' | undefined => {
        if (!value) return undefined;
        const v = value.toLowerCase().trim();
        if (v === 'extremely high') return 'Extremely High';
        if (v === 'very high') return 'Very High';
        if (v === 'high') return 'High';
        if (v === 'medium' || v === 'med') return 'Medium';
        return undefined;
      };

      // Parse end date if provided
      const endDateValue = mapping.end_date ? row[mapping.end_date] : '';
      const parsedEndDate = endDateValue ? parseDate(endDateValue) : null;

      const event: EventImportData = {
        event_name: mapping.event_name ? row[mapping.event_name] : 'Unnamed Event',
        event_date: finalDate,
        end_date: parsedEndDate,
        metro_id: selectedMetroId,
        event_type: eventType,
        staff_deployed: mapping.staff_deployed ? parseNumber(row[mapping.staff_deployed]) : undefined,
        households_served: mapping.households_served ? parseNumber(row[mapping.households_served]) : undefined,
        referrals_generated: mapping.referrals_generated ? parseNumber(row[mapping.referrals_generated]) : undefined,
        devices_distributed: mapping.devices_distributed ? parseNumber(row[mapping.devices_distributed]) : undefined,
        internet_signups: mapping.internet_signups ? parseNumber(row[mapping.internet_signups]) : undefined,
        cost_estimated: mapping.cost_estimated ? parseNumber(row[mapping.cost_estimated]) : undefined,
        anchor_identified_yn: mapping.anchor_identified_yn ? mapAnchorPotential(row[mapping.anchor_identified_yn]) : false,
        grant_narrative_value: mapping.grant_narrative_value ? mapPriority(row[mapping.grant_narrative_value]) : 'Medium',
        notes: noteParts.length > 0 ? noteParts.join(' | ') : undefined,
        // New fields
        city: mapping.city ? row[mapping.city] : undefined,
        host_organization: mapping.host_organization ? row[mapping.host_organization] : undefined,
        priority: mapping.priority ? mapPriority(row[mapping.priority]) : undefined,
        status: mapStatus(mapping.status ? row[mapping.status] : undefined),
        travel_required: mapTravelRequired(mapping.travel_required ? row[mapping.travel_required] : undefined),
        target_populations: parseMultiSelect(mapping.target_populations ? row[mapping.target_populations] : undefined),
        strategic_lanes: parseMultiSelect(mapping.strategic_lanes ? row[mapping.strategic_lanes] : undefined),
        pcs_goals: parseMultiSelect(mapping.pcs_goals ? row[mapping.pcs_goals] : undefined),
        anchor_potential: mapAnchorPotentialValue(mapping.anchor_potential ? row[mapping.anchor_potential] : undefined),
        expected_households: mapping.expected_households ? row[mapping.expected_households] : undefined,
        expected_referrals: mapping.expected_referrals ? row[mapping.expected_referrals] : undefined,
        // Recurring fields
        is_recurring: mapping.is_recurring ? mapRecurring(row[mapping.is_recurring]) : undefined,
        recurrence_pattern: mapping.recurrence_pattern ? mapRecurrencePattern(row[mapping.recurrence_pattern]) : undefined,
        recurrence_end_date: mapping.recurrence_end_date ? parseDate(row[mapping.recurrence_end_date]) || undefined : undefined,
        // URL field
        url: mapping.url ? row[mapping.url]?.trim() : undefined,
        // Description field
        description: mapping.description ? row[mapping.description]?.trim() : undefined,
      };

      return event;
    });
  };

  const handleImport = async () => {
    setStep('importing');
    setImportProgress(0);
    setError(null);

    try {
      const mappedData = getMappedData();
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      await onImport(mappedData, { upsertMode });
      
      clearInterval(progressInterval);
      setImportProgress(100);
      setImportedCount(mappedData.length);
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed. Please try again.');
      setStep('preview');
    }
  };

  const previewData = getMappedData().slice(0, 5);

  const fieldDefinitions = [
    { key: 'event_name', label: 'Event Name', required: true },
    { key: 'event_date', label: 'Start Date', required: true },
    { key: 'end_date', label: 'End Date (multi-day)', required: false },
    { key: 'event_type', label: 'Event Type', required: false },
    { key: 'city', label: 'Address', required: false },
    { key: 'host_organization', label: 'Host Organization', required: false },
    { key: 'priority', label: 'Priority', required: false },
    { key: 'status', label: 'Status', required: false },
    { key: 'travel_required', label: 'Travel Required', required: false },
    { key: 'target_populations', label: 'Target Population', required: false },
    { key: 'strategic_lanes', label: 'Strategic Lane', required: false },
    { key: 'pcs_goals', label: 'PCS Goal', required: false },
    { key: 'anchor_potential', label: 'Anchor Potential', required: false },
    { key: 'staff_deployed', label: 'Staff Deployed', required: false },
    { key: 'expected_households', label: 'Expected Households', required: false },
    { key: 'expected_referrals', label: 'Expected Referrals', required: false },
    { key: 'grant_narrative_value', label: 'Grant Narrative Value', required: false },
    { key: 'is_recurring', label: 'Recurring', required: false },
    { key: 'recurrence_pattern', label: 'Recurrence Pattern', required: false },
    { key: 'recurrence_end_date', label: 'Recurrence End Date', required: false },
    { key: 'url', label: 'Event URL', required: false },
    { key: 'description', label: 'Description', required: false },
    { key: 'notes', label: 'Notes', required: false },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Events</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a CSV file to import events.'}
            {step === 'mapping' && 'Map CSV columns to event fields.'}
            {step === 'preview' && 'Review the data before importing.'}
            {step === 'importing' && 'Importing events...'}
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
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                'hover:border-primary hover:bg-primary/5'
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">CSV files only</p>
            </div>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
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

            {/* Metro Selection */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-primary" />
                <Label className="font-medium">Assign all events to Metro:</Label>
              </div>
              <Select
                value={selectedMetroId || '__none__'}
                onValueChange={(value) => setSelectedMetroId(value === '__none__' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a metro..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">-- No Metro --</SelectItem>
                  {metros?.map(metro => (
                    <SelectItem key={metro.id} value={metro.id}>
                      {metro.metro}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-2">
              {fieldDefinitions.map(field => (
                <div key={field.key} className="flex items-center gap-4">
                  <div className="w-44 flex items-center gap-2">
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

            {extraColumns.length > 0 && (
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">
                  Extra columns will be added to Notes:
                </p>
                <div className="flex flex-wrap gap-1">
                  {extraColumns.map(col => (
                    <Badge key={col} variant="secondary" className="text-xs">
                      {col}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing first {previewData.length} of {csvData?.rows.length} events:
              </p>
              {selectedMetroId && (
                <Badge variant="outline" className="gap-1">
                  <MapPin className="w-3 h-3" />
                  {metros?.find(m => m.id === selectedMetroId)?.metro}
                </Badge>
              )}
            </div>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Event Name</th>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">Staff</th>
                    <th className="px-3 py-2 text-left font-medium">HH Expected</th>
                    <th className="px-3 py-2 text-left font-medium">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2 truncate max-w-[200px]">{row.event_name}</td>
                      <td className="px-3 py-2">{row.event_date}</td>
                      <td className="px-3 py-2">{row.event_type}</td>
                      <td className="px-3 py-2">{row.staff_deployed || '-'}</td>
                      <td className="px-3 py-2">{row.households_served || '-'}</td>
                      <td className="px-3 py-2">{row.grant_narrative_value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Upsert toggle */}
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
              <Checkbox
                id="upsert-mode"
                checked={upsertMode}
                onCheckedChange={(checked) => setUpsertMode(checked === true)}
              />
              <div className="flex-1">
                <Label htmlFor="upsert-mode" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Update existing events
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Match by event name and update existing records instead of creating duplicates
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary">{csvData?.rows.length} total events</Badge>
              {upsertMode && <Badge variant="outline" className="gap-1"><RefreshCw className="w-3 h-3" />Upsert enabled</Badge>}
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="space-y-4 py-8">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span>Importing events...</span>
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
                Successfully imported {importedCount} events.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={() => handleClose(false)}>
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
                Import {csvData?.rows.length} Events
              </Button>
            </>
          )}
          {step === 'complete' && (
            <Button onClick={() => handleClose(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
