/**
 * Computation functions for data integrity
 * 
 * These functions implement the correct business logic to avoid anti-patterns:
 * 1. Anchor counting based on first_volume_date (not record existence)
 * 2. Metro readiness using computed aggregates (not manual counts)
 * 3. Days in stage calculated dynamically (not static values)
 * 4. Averages that exclude nulls/blanks (not treating them as zeros)
 */

import { differenceInDays, parseISO, isValid } from 'date-fns';

// Types for database records
interface AnchorRecord {
  anchor_id?: string;
  metro_id?: string | null;
  first_volume_date?: string | null;
  avg_monthly_volume?: number | null;
  first_contact_date?: string | null;
  agreement_signed_date?: string | null;
  first_volume_date_ts?: string | null;
  stable_producer_date?: string | null;
  production_status?: string;
  anchor_tier?: string;
}

interface PipelineRecord {
  anchor_pipeline_id?: string;
  metro_id?: string | null;
  stage?: string;
  stage_entry_date?: string | null;
}

interface MetroRecord {
  id: string;
  metro_id: string;
  metro: string;
  referrals_per_month?: number | null;
  partner_inquiries_per_month?: number | null;
  distribution_partner_yn?: boolean | null;
  storage_ready_yn?: boolean | null;
  staff_coverage_1to5?: number | null;
}

interface MetroReadiness {
  activeAnchors: number;
  anchorsInPipeline: number;
  anchorScore: number;
  demandScore: number;
  opsScore: number;
  metroReadinessIndex: number;
  metroStatus: 'Expansion Ready' | 'Anchor Build' | 'Ecosystem Dev';
}

/**
 * Count active anchors - ONLY those with a non-null first_volume_date
 * Anti-pattern avoided: Counting based on record existence or tier
 */
export function countActiveAnchors(anchors: AnchorRecord[]): number {
  return anchors.filter(anchor => {
    const date = anchor.first_volume_date;
    return date !== null && date !== undefined && date !== '';
  }).length;
}

/**
 * Count anchors formed within a specific period based on first_volume_date
 * Anti-pattern avoided: Using record creation date instead of first volume date
 */
export function countAnchorsFormedInPeriod(
  anchors: AnchorRecord[], 
  days: number, 
  referenceDate: Date = new Date()
): number {
  return anchors.filter(anchor => {
    const dateStr = anchor.first_volume_date;
    if (!dateStr) return false;
    
    const volumeDate = parseISO(dateStr);
    if (!isValid(volumeDate)) return false;
    
    const daysDiff = differenceInDays(referenceDate, volumeDate);
    return daysDiff >= 0 && daysDiff <= days;
  }).length;
}

/**
 * Compute metro readiness using aggregates from related tables
 * Anti-pattern avoided: Using manual/hardcoded counts stored on metro record
 */
export function computeMetroReadiness(
  metro: MetroRecord,
  allAnchors: AnchorRecord[],
  allPipeline: PipelineRecord[]
): MetroReadiness {
  // Compute active anchors from anchors table (filter by metro AND has first_volume_date)
  const metroAnchors = allAnchors.filter(a => a.metro_id === metro.id);
  const activeAnchors = countActiveAnchors(metroAnchors);
  
  // Compute pipeline count from pipeline table (filter by metro)
  const anchorsInPipeline = allPipeline.filter(p => p.metro_id === metro.id).length;
  
  // Calculate anchor score based on COMPUTED active anchors count
  const anchorScore = calculateAnchorScore(activeAnchors);
  
  // Calculate demand score from metro's own fields
  const demandScore = calculateDemandScore(
    metro.referrals_per_month ?? 0,
    metro.partner_inquiries_per_month ?? 0
  );
  
  // Calculate ops score from metro's own fields
  const opsScore = calculateOpsScore(
    metro.distribution_partner_yn ?? false,
    metro.storage_ready_yn ?? false,
    metro.staff_coverage_1to5 ?? 0
  );
  
  const metroReadinessIndex = anchorScore + demandScore + opsScore;
  const metroStatus = getMetroStatus(metroReadinessIndex);
  
  return {
    activeAnchors,
    anchorsInPipeline,
    anchorScore,
    demandScore,
    opsScore,
    metroReadinessIndex,
    metroStatus
  };
}

/**
 * Calculate anchor score: 0 anchors = 0, 1 anchor = 20, 2+ = 40
 */
export function calculateAnchorScore(activeAnchors: number): number {
  if (activeAnchors === 0) return 0;
  if (activeAnchors === 1) return 20;
  return 40;
}

/**
 * Calculate demand score from referrals and inquiries
 */
export function calculateDemandScore(referrals: number, inquiries: number): number {
  return Math.min(30, referrals * 5 + inquiries * 3);
}

/**
 * Calculate ops score from infrastructure fields
 */
export function calculateOpsScore(
  distribution: boolean, 
  storage: boolean, 
  staff: number
): number {
  return (distribution ? 10 : 0) + (storage ? 10 : 0) + Math.min(10, staff * 2);
}

/**
 * Get metro status based on readiness index
 */
export function getMetroStatus(index: number): 'Expansion Ready' | 'Anchor Build' | 'Ecosystem Dev' {
  if (index >= 75) return 'Expansion Ready';
  if (index >= 50) return 'Anchor Build';
  return 'Ecosystem Dev';
}

/**
 * Calculate days in stage dynamically from stage_entry_date
 * Anti-pattern avoided: Using static stored value
 */
export function calculateDaysInStage(
  stageEntryDate: string | null | undefined, 
  referenceDate: Date = new Date()
): number {
  if (!stageEntryDate) return 0;
  
  const entryDate = parseISO(stageEntryDate);
  if (!isValid(entryDate)) return 0;
  
  const days = differenceInDays(referenceDate, entryDate);
  return Math.max(0, days); // Don't return negative for future dates
}

/**
 * Calculate average volume excluding null/zero values
 * Anti-pattern avoided: Treating nulls as zeros which dilutes averages
 */
export function calculateAverageVolume(anchors: AnchorRecord[]): number {
  const validRecords = anchors.filter(a => {
    const vol = a.avg_monthly_volume;
    return vol !== null && vol !== undefined && vol > 0;
  });
  
  if (validRecords.length === 0) return 0;
  
  const sum = validRecords.reduce((acc, a) => acc + (a.avg_monthly_volume ?? 0), 0);
  return Math.round(sum / validRecords.length);
}

/**
 * Calculate median cycle time, excluding records with null dates
 * Anti-pattern avoided: Treating missing dates as zero days
 */
export function calculateMedianCycleTime(
  anchors: AnchorRecord[],
  cycleType: 'contact_to_agreement' | 'agreement_to_first_volume' | 'first_to_stable'
): number {
  const cycleTimes: number[] = [];
  
  for (const anchor of anchors) {
    let startDate: string | null | undefined;
    let endDate: string | null | undefined;
    
    switch (cycleType) {
      case 'contact_to_agreement':
        startDate = anchor.first_contact_date;
        endDate = anchor.agreement_signed_date;
        break;
      case 'agreement_to_first_volume':
        startDate = anchor.agreement_signed_date;
        endDate = anchor.first_volume_date;
        break;
      case 'first_to_stable':
        startDate = anchor.first_volume_date;
        endDate = anchor.stable_producer_date;
        break;
    }
    
    // Only include records with BOTH dates present
    if (!startDate || !endDate) continue;
    
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    if (!isValid(start) || !isValid(end)) continue;
    
    const days = differenceInDays(end, start);
    if (days >= 0) {
      cycleTimes.push(days);
    }
  }
  
  if (cycleTimes.length === 0) return 0;
  
  // Calculate median
  const sorted = cycleTimes.sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  
  return sorted[mid];
}

/**
 * Compute production status based on lifecycle
 * Pre-Production: no first_volume_date
 * Ramp: < 3 months active
 * Scale: avg_monthly_volume >= 100
 * Stable: others
 */
export function computeProductionStatus(
  anchor: AnchorRecord,
  referenceDate: Date = new Date()
): 'Pre-Production' | 'Ramp' | 'Stable' | 'Scale' {
  if (!anchor.first_volume_date) return 'Pre-Production';
  
  const volumeDate = parseISO(anchor.first_volume_date);
  if (!isValid(volumeDate)) return 'Pre-Production';
  
  const monthsActive = differenceInDays(referenceDate, volumeDate) / 30;
  
  if (monthsActive < 3) return 'Ramp';
  if ((anchor.avg_monthly_volume ?? 0) >= 100) return 'Scale';
  return 'Stable';
}

/**
 * Calculate days between two dates for cycle time
 */
export function calculateCycleTime(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): number | null {
  if (!startDate || !endDate) return null;
  
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  
  if (!isValid(start) || !isValid(end)) return null;
  
  const days = differenceInDays(end, start);
  return days >= 0 ? days : null;
}
