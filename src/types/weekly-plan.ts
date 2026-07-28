export type PlanItemCategory = 
  | 'opportunity' 
  | 'anchor' 
  | 'grant' 
  | 'event' 
  | 'ai_bundle' 
  | 'pipeline';

export type CTAAction = 
  | 'open_bundle_panel'
  | 'log_activity'
  | 'update_opportunity'
  | 'review_grant'
  | 'open_anchor'
  | 'open_pipeline'
  | 'open_event'
  | 'schedule_followup';

export type PlanItemStatus = 'open' | 'done' | 'dismissed';

export interface WeeklyPlanItem {
  id: string;
  rank: number;
  title: string;
  category: PlanItemCategory;
  linked_entity: {
    type: string;
    id: string;
  };
  recommended_action: string;
  primary_cta: {
    label: string;
    action: CTAAction;
    filter?: Record<string, string>;
  };
  urgency: {
    due_date: string | null;
    days_until_due: number | null;
    is_overdue: boolean;
  };
  score: number;
  reasons: string[];
  ai_reasoning: string | null;
  confidence: number;
  status: PlanItemStatus;
}

export interface WeeklyPlan {
  id: string;
  user_id: string;
  week_start_date: string;
  plan_json: WeeklyPlanItem[];
  generated_at: string;
  updated_at: string;
}
