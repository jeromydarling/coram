// Core Types for PCs for People CRM

export type MetroStatus = 'Expansion Ready' | 'Anchor Build' | 'Ecosystem Dev';
export type Recommendation = 'Invest' | 'Build Anchors' | 'Hold' | 'Triage';

export interface Metro {
  metroId: string;
  metro: string;
  referralsPerMonth: number;
  partnerInquiriesPerMonth: number;
  waitlistSize: number;
  distributionPartnerYN: boolean;
  storageReadyYN: boolean;
  staffCoverage1to5: number;
  workforcePartners: number;
  housingRefugeePartners: number;
  schoolsLibraries: number;
  recommendation: Recommendation;
  notes: string;
  // Computed
  activeAnchors: number;
  anchorsInPipeline: number;
  anchorScore: number;
  demandScore: number;
  opsScore: number;
  metroReadinessIndex: number;
  metroStatus: MetroStatus;
}

export type OpportunityStage = 
  | 'Target Identified'
  | 'Contacted'
  | 'Discovery Scheduled'
  | 'Discovery Held'
  | 'Proposal Sent'
  | 'Agreement Pending'
  | 'Agreement Signed'
  | 'First Volume'
  | 'Stable Producer'
  | 'Closed - Not a Fit';

export type OpportunityStatus = 'Active' | 'On Hold' | 'Closed - Won' | 'Closed - Lost';
export type PartnerTier = 'Anchor' | 'Distribution' | 'Referral' | 'Workforce' | 'Housing' | 'Education' | 'Other';
export type GrantAlignment = 'Digital Equity' | 'Workforce Development' | 'Housing Stability' | 'Education' | 'Refugee Services';

export interface Opportunity {
  opportunityId: string;
  organization: string;
  metroId: string;
  metro?: string;
  stage: OpportunityStage;
  status: OpportunityStatus;
  partnerTier: PartnerTier;
  grantAlignment: GrantAlignment[];
  missionSnapshot: string;
  bestPartnershipAngle: string;
  primaryContactName: string;
  primaryContactTitle: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  lastContactDate: string;
  nextActionDue: string;
  nextStep: string;
  notes: string;
}

export interface Contact {
  contactId: string;
  opportunityId: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  isPrimary: boolean;
  notes: string;
}

export type ActivityType = 'Call' | 'Email' | 'Meeting' | 'Event' | 'Site Visit' | 'Intro' | 'Other';
export type ActivityOutcome = 'Connected' | 'No Response' | 'Follow-up Needed' | 'Moved Stage' | 'Not a Fit';

export interface Activity {
  activityId: string;
  opportunityId: string;
  metroId: string;
  activityDateTime: string;
  activityType: ActivityType;
  outcome: ActivityOutcome;
  notes: string;
  nextAction: string;
  nextActionDue: string;
  stageSuggested?: OpportunityStage;
}

export type GrantNarrativeValue = 'High' | 'Medium' | 'Low';

export interface Event {
  eventId: string;
  eventName: string;
  eventDate: string;
  metroId: string;
  hostOpportunityId?: string;
  eventType: string | null;
  staffDeployed: number;
  householdsServed: number;
  devicesDistributed: number;
  internetSignups: number;
  referralsGenerated: number;
  costEstimated: number;
  anchorIdentifiedYN: boolean;
  followupMeetingYN: boolean;
  grantNarrativeValue: GrantNarrativeValue;
  notes: string;
  // Computed
  householdsPerStaff: number;
}

export type PipelineStage = 
  | 'Target Identified'
  | 'Contacted'
  | 'Discovery Held'
  | 'Proposal Sent'
  | 'Agreement Pending'
  | 'Agreement Signed'
  | 'First Volume';

export interface AnchorPipeline {
  anchorPipelineId: string;
  opportunityId: string;
  metroId: string;
  owner: string;
  stage: PipelineStage;
  stageEntryDate: string;
  lastActivityDate: string;
  nextAction: string;
  nextActionDue: string;
  expectedAnchorYN: boolean;
  probability: number;
  targetFirstVolumeDate: string;
  estimatedMonthlyVolume: number;
  notes: string;
  // Computed
  daysInStage: number;
  // Joined
  organization?: string;
  metro?: string;
}

export type AnchorTier = 'Strategic' | 'Standard' | 'Pilot';
export type GrowthTrend = 'Up' | 'Flat' | 'Down';
export type RiskLevel = 'Low' | 'Medium' | 'High';
export type ProductionStatus = 'Pre-Production' | 'Ramp' | 'Stable' | 'Scale';

export interface Anchor {
  anchorId: string;
  opportunityId: string;
  metroId: string;
  anchorTier: AnchorTier;
  // Lifecycle Dates
  firstContactDate: string;
  discoveryDate: string;
  agreementSignedDate: string;
  firstVolumeDate: string;
  stableProducerDate?: string;
  // Production
  last30DayVolume: number;
  avgMonthlyVolume: number;
  peakMonthlyVolume: number;
  // Qualitative
  growthTrend: GrowthTrend;
  riskLevel: RiskLevel;
  strategicValue1to5: number;
  notes: string;
  // Computed
  monthsActive: number;
  productionStatus: ProductionStatus;
  daysContactToAgreement: number;
  daysAgreementToFirstVolume: number;
  daysFirstToStable?: number;
  // Joined
  organization?: string;
  metro?: string;
}

// Dashboard Types
export interface DashboardKPI {
  label: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export interface PipelineByStage {
  stage: PipelineStage;
  count: number;
  value: number;
}

export interface AnchorsByMonth {
  month: string;
  count: number;
}
