import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useLogAudit } from './useAuditLog';
import { useAuth } from '@/contexts/AuthContext';
import { GrantStage, FunderType, ReportingFrequency, GrantStatus } from './useGrants';

// Valid enum values
const VALID_GRANT_STAGES: GrantStage[] = [
  'Researching', 'Eligible', 'Cultivating', 'LOI Submitted',
  'Full Proposal Submitted', 'Awarded', 'Declined', 'Closed'
];

const VALID_FUNDER_TYPES: FunderType[] = [
  'Foundation', 'Government - Federal', 'Government - State',
  'Government - Local', 'Corporate', 'Other'
];

const VALID_REPORTING_FREQUENCIES: ReportingFrequency[] = [
  'Quarterly', 'Annual', 'End of Grant'
];

const VALID_STATUSES: GrantStatus[] = ['Active', 'Closed'];

// Helper to validate star rating
function validateStarRating(value: unknown): number {
  const num = parseInt(String(value), 10);
  if (isNaN(num) || num < 1 || num > 5) return 3;
  return num;
}

// Helper to validate grant stage
function validateGrantStage(value: unknown): GrantStage {
  const str = String(value || '').trim();
  if (VALID_GRANT_STAGES.includes(str as GrantStage)) {
    return str as GrantStage;
  }
  return 'Researching';
}

// Helper to validate funder type
function validateFunderType(value: unknown): FunderType | null {
  const str = String(value || '').trim();
  if (VALID_FUNDER_TYPES.includes(str as FunderType)) {
    return str as FunderType;
  }
  return null; // Invalid - will skip this row
}

// Helper to validate status
function validateStatus(value: unknown): GrantStatus {
  const str = String(value || '').trim();
  if (VALID_STATUSES.includes(str as GrantStatus)) {
    return str as GrantStatus;
  }
  return 'Active';
}

// Helper to validate reporting frequency
function validateReportingFrequency(value: unknown): ReportingFrequency | null {
  const str = String(value || '').trim();
  if (!str) return null;
  if (VALID_REPORTING_FREQUENCIES.includes(str as ReportingFrequency)) {
    return str as ReportingFrequency;
  }
  return null;
}

// Helper to find metro_id by metro name
async function findMetroByName(metroName: string | null | undefined): Promise<string | null> {
  if (!metroName || metroName.trim() === '') return null;
  
  const { data: metro } = await supabase
    .from('metros')
    .select('id')
    .ilike('metro', metroName.trim())
    .limit(1)
    .maybeSingle();
  
  return metro?.id || null;
}

// Helper to find opportunity_id by organization name
async function findOpportunityByOrganization(orgName: string | null | undefined): Promise<string | null> {
  if (!orgName || orgName.trim() === '') return null;
  
  const { data: opp } = await supabase
    .from('opportunities')
    .select('id')
    .ilike('organization', orgName.trim())
    .limit(1)
    .maybeSingle();
  
  return opp?.id || null;
}

// Helper to parse number
function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(String(value).replace(/[,$]/g, ''));
  return isNaN(num) ? null : num;
}

// Helper to parse boolean
function parseBoolean(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  return ['true', 'yes', '1', 'y'].includes(String(value).toLowerCase());
}

// Helper to parse date
function parseDate(value: unknown): string | null {
  if (!value || value === '') return null;
  const date = new Date(String(value));
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

export interface GrantImportRow {
  grant_name: string;
  funder_name: string;
  funder_type: string;
  star_rating?: number;
  stage?: string;
  status?: string;
  opportunity_id?: string;
  organization?: string;
  metro_id?: string;
  metro?: string;
  amount_requested?: number;
  amount_awarded?: number;
  fiscal_year?: number;
  grant_term_start?: string;
  grant_term_end?: string;
  is_multiyear?: boolean;
  match_required?: boolean;
  reporting_required?: boolean;
  reporting_frequency?: string;
  notes?: string;
}

export interface ImportResult {
  success: boolean;
  row: number;
  grant_name?: string;
  error?: string;
  grant_id?: string;
}

interface TrackedRecord {
  entity_type: string;
  entity_id: string;
  operation: 'created' | 'updated';
  previous_data?: Record<string, unknown> | null;
}

export function useImportGrants() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (rows: Record<string, unknown>[]): Promise<{ results: ImportResult[]; trackedRecords: TrackedRecord[]; insertedCount: number }> => {
      const results: ImportResult[] = [];
      const trackedRecords: TrackedRecord[] = [];
      let insertedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;
        
        try {
          // Required fields
          const grantName = String(row.grant_name || '').trim();
          const funderName = String(row.funder_name || '').trim();
          
          if (!grantName) {
            results.push({ success: false, row: rowNum, error: 'Missing required field: grant_name' });
            failedCount++;
            continue;
          }
          
          if (!funderName) {
            results.push({ success: false, row: rowNum, grant_name: grantName, error: 'Missing required field: funder_name' });
            failedCount++;
            continue;
          }
          
          // Validate funder_type
          const funderType = validateFunderType(row.funder_type);
          if (!funderType) {
            results.push({ 
              success: false, 
              row: rowNum, 
              grant_name: grantName, 
              error: `Invalid funder_type: "${row.funder_type}". Must be one of: ${VALID_FUNDER_TYPES.join(', ')}` 
            });
            failedCount++;
            continue;
          }
          
          // Get metro_id - prefer direct ID, fall back to name lookup
          let metroId = row.metro_id ? String(row.metro_id) : null;
          if (!metroId && row.metro) {
            metroId = await findMetroByName(String(row.metro));
          }
          
          // Get opportunity_id - prefer direct ID, fall back to organization name lookup
          let opportunityId = row.opportunity_id ? String(row.opportunity_id) : null;
          if (!opportunityId && row.organization) {
            opportunityId = await findOpportunityByOrganization(String(row.organization));
          }
          
          // Generate grant_id
          const grantId = `GR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
          
          // Build grant data
          const grantData = {
            grant_id: grantId,
            grant_name: grantName,
            funder_name: funderName,
            funder_type: funderType,
            star_rating: validateStarRating(row.star_rating),
            stage: validateGrantStage(row.stage),
            status: validateStatus(row.status),
            metro_id: metroId,
            opportunity_id: opportunityId,
            owner_id: user?.id || '',
            amount_requested: parseNumber(row.amount_requested),
            amount_awarded: parseNumber(row.amount_awarded),
            fiscal_year: row.fiscal_year ? parseInt(String(row.fiscal_year), 10) || null : null,
            grant_term_start: parseDate(row.grant_term_start),
            grant_term_end: parseDate(row.grant_term_end),
            is_multiyear: parseBoolean(row.is_multiyear),
            match_required: parseBoolean(row.match_required),
            reporting_required: parseBoolean(row.reporting_required),
            reporting_frequency: validateReportingFrequency(row.reporting_frequency),
            notes: row.notes ? String(row.notes) : null,
          };
          
          const { data: insertedGrant, error } = await supabase
            .from('grants')
            .insert(grantData)
            .select()
            .single();
          
          if (error) {
            results.push({ success: false, row: rowNum, grant_name: grantName, error: error.message });
            failedCount++;
          } else {
            results.push({ success: true, row: rowNum, grant_name: grantName, grant_id: insertedGrant.id });
            insertedCount++;
            
            // Track for rollback
            trackedRecords.push({
              entity_type: 'grant',
              entity_id: insertedGrant.id,
              operation: 'created',
              previous_data: null
            });
          }
        } catch (error) {
          results.push({ 
            success: false, 
            row: rowNum, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          failedCount++;
        }
      }
      
      // Log audit entry for bulk import
      if (user?.id) {
        await logAudit.mutateAsync({
          entityType: 'grant',
          entityId: crypto.randomUUID(),
          action: 'import',
          entityName: `Grant Import: ${insertedCount} inserted, ${failedCount} failed`,
          changes: { 
            summary: { old: null, new: { inserted: insertedCount, failed: failedCount } }
          },
        });
      }
      
      return { results, trackedRecords, insertedCount };
    },
    onSuccess: async ({ results, trackedRecords, insertedCount }) => {
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      queryClient.invalidateQueries({ queryKey: ['grants'] });
      queryClient.invalidateQueries({ queryKey: ['import-history'] });
      
      // Save import history for rollback capability
      try {
        const { data: session } = await supabase.auth.getSession();
        const userId = session?.session?.user?.id;
        
        if (userId && trackedRecords.length > 0) {
          const { data: importEntry, error: historyError } = await supabase
            .from('csv_import_history')
            .insert({
              import_type: 'grants',
              total_rows: results.length,
              created_count: insertedCount,
              updated_count: 0,
              imported_by: userId
            })
            .select()
            .single();
          
          if (!historyError && importEntry) {
            const recordsToInsert = trackedRecords.map(record => ({
              import_id: importEntry.id,
              entity_type: record.entity_type,
              entity_id: record.entity_id,
              operation: record.operation,
              previous_data: record.previous_data ? JSON.parse(JSON.stringify(record.previous_data)) : null
            }));
            
            await supabase.from('csv_import_records').insert(recordsToInsert);
          }
        }
      } catch (e) {
        console.error('Failed to save import history:', e);
      }
      
      if (failCount === 0) {
        toast.success(`Successfully imported ${successCount} grants`);
      } else if (successCount === 0) {
        toast.error(`Import failed: ${failCount} rows had errors`);
      } else {
        toast.warning(`Imported ${successCount} grants, ${failCount} rows had errors`);
      }
    },
    onError: (error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });
}

// Export field definitions for CSV import modal
export const GRANT_IMPORT_FIELDS = [
  { key: 'grant_name', label: 'Grant Name', required: true },
  { key: 'funder_name', label: 'Funder Name', required: true },
  { key: 'funder_type', label: 'Funder Type', required: true },
  { key: 'star_rating', label: 'Star Rating (1-5)', required: false },
  { key: 'stage', label: 'Stage', required: false },
  { key: 'status', label: 'Status', required: false },
  { key: 'organization', label: 'Organization (to link)', required: false },
  { key: 'metro', label: 'Metro', required: false },
  { key: 'amount_requested', label: 'Amount Requested', required: false },
  { key: 'amount_awarded', label: 'Amount Awarded', required: false },
  { key: 'fiscal_year', label: 'Fiscal Year', required: false },
  { key: 'grant_term_start', label: 'Term Start Date', required: false },
  { key: 'grant_term_end', label: 'Term End Date', required: false },
  { key: 'is_multiyear', label: 'Multi-Year', required: false },
  { key: 'match_required', label: 'Match Required', required: false },
  { key: 'reporting_required', label: 'Reporting Required', required: false },
  { key: 'reporting_frequency', label: 'Reporting Frequency', required: false },
  { key: 'notes', label: 'Notes', required: false },
] as const;
