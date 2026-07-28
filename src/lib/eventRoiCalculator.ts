import type { EventContactStats } from '@/hooks/useEventContactsCount';

export interface EventROIInput {
  id: string;
  contacts_made: number;
  contacts_converted: number;
  households_served: number | null;
  devices_distributed: number | null;
  internet_signups: number | null;
  anchor_identified_yn: boolean | null;
  cost_estimated: number | null;
  staff_deployed: number | null;
}

export interface ROIResult {
  score: number;
  category: 'excellent' | 'good' | 'fair' | 'low';
  breakdown: {
    contactsPoints: number;
    conversionsPoints: number;
    householdsPoints: number;
    devicesPoints: number;
    signupsPoints: number;
    anchorPoints: number;
    totalPoints: number;
    costPerStaffHour: number;
  };
}

/**
 * ROI Score Formula:
 * ROI Score = (
 *   (contacts_made * 2) +
 *   (contacts_converted * 5) +
 *   (households_served * 1) +
 *   (devices_distributed * 1.5) +
 *   (internet_signups * 2) +
 *   (anchor_identified ? 10 : 0)
 * ) / max(cost_per_staff_hour, 1)
 * 
 * Normalized to 0-100 scale with categories:
 * - 80-100: Excellent (green badge)
 * - 60-79: Good (blue badge)
 * - 40-59: Fair (yellow badge)
 * - 0-39: Low Yield (gray badge)
 */
export function calculateEventROI(event: EventROIInput): ROIResult {
  const contactsPoints = event.contacts_made * 2;
  const conversionsPoints = event.contacts_converted * 5;
  const householdsPoints = (event.households_served ?? 0) * 1;
  const devicesPoints = (event.devices_distributed ?? 0) * 1.5;
  const signupsPoints = (event.internet_signups ?? 0) * 2;
  const anchorPoints = event.anchor_identified_yn ? 10 : 0;

  const totalPoints = contactsPoints + conversionsPoints + householdsPoints + devicesPoints + signupsPoints + anchorPoints;

  // Calculate cost per staff hour (default to $25/hour if not specified)
  const staffHours = event.staff_deployed ?? 1;
  const totalCost = event.cost_estimated ?? (staffHours * 25);
  const costPerStaffHour = Math.max(totalCost / Math.max(staffHours, 1), 1);

  // Raw score
  const rawScore = totalPoints / costPerStaffHour;

  // Normalize to 0-100 scale (cap at 100)
  // Typical good event might have 50-100 points and cost $50-100, giving raw score of 0.5-2
  // We'll use a multiplier to scale this to the 0-100 range
  const normalizedScore = Math.min(Math.round(rawScore * 25), 100);

  // Determine category
  let category: ROIResult['category'];
  if (normalizedScore >= 80) {
    category = 'excellent';
  } else if (normalizedScore >= 60) {
    category = 'good';
  } else if (normalizedScore >= 40) {
    category = 'fair';
  } else {
    category = 'low';
  }

  return {
    score: normalizedScore,
    category,
    breakdown: {
      contactsPoints,
      conversionsPoints,
      householdsPoints,
      devicesPoints,
      signupsPoints,
      anchorPoints,
      totalPoints,
      costPerStaffHour,
    },
  };
}

/**
 * Get ROI category styling
 */
export function getROICategoryStyle(category: ROIResult['category']) {
  switch (category) {
    case 'excellent':
      return {
        label: 'Excellent',
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        color: 'hsl(var(--chart-2))', // green
      };
    case 'good':
      return {
        label: 'Good',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        color: 'hsl(var(--chart-1))', // blue
      };
    case 'fair':
      return {
        label: 'Fair',
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        color: 'hsl(var(--chart-4))', // yellow
      };
    case 'low':
      return {
        label: 'Low Yield',
        className: 'bg-muted text-muted-foreground',
        color: 'hsl(var(--muted-foreground))',
      };
  }
}

/**
 * Calculate ROI for an event using contact stats from the database
 */
export function calculateEventROIWithStats(
  event: {
    id: string;
    households_served?: number | null;
    devices_distributed?: number | null;
    internet_signups?: number | null;
    anchor_identified_yn?: boolean | null;
    cost_estimated?: number | null;
    staff_deployed?: number | null;
  },
  contactStats: EventContactStats | undefined
): ROIResult {
  return calculateEventROI({
    id: event.id,
    contacts_made: contactStats?.count ?? 0,
    contacts_converted: contactStats?.withOpportunity ?? 0,
    households_served: event.households_served ?? null,
    devices_distributed: event.devices_distributed ?? null,
    internet_signups: event.internet_signups ?? null,
    anchor_identified_yn: event.anchor_identified_yn ?? null,
    cost_estimated: event.cost_estimated ?? null,
    staff_deployed: event.staff_deployed ?? null,
  });
}
