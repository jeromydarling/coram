import type { WeeklyPlanItem, PlanItemCategory } from '@/types/weekly-plan';

/**
 * Keyword mappings for deriving display labels from reasons
 */
const KEYWORD_LABEL_MAPPINGS: Record<string, string> = {
  'overdue': 'Action Overdue',
  'deadline': 'Deadline',
  'inactive': 'Needs Attention',
  'anchor': 'Anchor Progress',
  'grant': 'Grant',
  'event': 'Event Follow-up',
  'ai suggestions': 'AI Inbox',
  'bundles': 'AI Inbox',
  'contact': 'Contact Update',
  'probability': 'Near Win',
  'volume': 'High Potential',
  'stale': 'Needs Attention',
};

/**
 * Fallback labels when no keyword matches
 */
const FALLBACK_LABELS: Record<PlanItemCategory, string> = {
  opportunity: 'Opportunity',
  anchor: 'Anchor',
  grant: 'Grant',
  event: 'Event',
  ai_bundle: 'AI Inbox',
  pipeline: 'Pipeline',
};

/**
 * Get a user-friendly category label based on the item's reasons
 * Falls back to category-based labels if no keyword matches
 */
export function getCategoryDisplayLabel(item: WeeklyPlanItem): string {
  // Check reasons for keyword matches
  for (const reason of item.reasons) {
    const lowerReason = reason.toLowerCase();
    for (const [keyword, label] of Object.entries(KEYWORD_LABEL_MAPPINGS)) {
      if (lowerReason.includes(keyword)) {
        return label;
      }
    }
  }
  
  // Fallback to category-based label
  return FALLBACK_LABELS[item.category] || 'Focus Item';
}

/**
 * Get the urgency display configuration
 */
export function getUrgencyConfig(item: WeeklyPlanItem): {
  variant: 'destructive' | 'warning' | 'default';
  label: string | null;
} {
  if (item.urgency.is_overdue) {
    return { variant: 'destructive', label: 'Overdue' };
  }
  
  if (item.urgency.days_until_due !== null) {
    if (item.urgency.days_until_due <= 3) {
      return { variant: 'warning', label: `${item.urgency.days_until_due}d left` };
    }
    if (item.urgency.days_until_due <= 7) {
      return { variant: 'default', label: `${item.urgency.days_until_due}d left` };
    }
  }
  
  return { variant: 'default', label: null };
}
