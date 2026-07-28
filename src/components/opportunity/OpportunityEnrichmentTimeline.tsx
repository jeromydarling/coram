import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'none' | 'processing';

interface TimelineStep {
  label: string;
  key: string;
  status: StepStatus;
  timestamp?: string;
  error?: string;
}

interface OpportunityEnrichmentTimelineProps {
  opportunityId: string;
}

const PIPELINE_STEPS = [
  { label: 'URL Bootstrap', key: 'org_knowledge' },
  { label: 'Organizational Knowledge', key: 'org_knowledge' },
  { label: 'Neighborhood Insights', key: 'neighborhood' },
  { label: 'Contact Enrichment', key: 'org_enrichment' },
  { label: 'Prospect Pack', key: 'prospect_pack' },
];

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-muted-foreground', label: 'Pending' },
  queued: { icon: Clock, color: 'text-muted-foreground', label: 'Queued' },
  running: { icon: Loader2, color: 'text-primary', label: 'Running' },
  processing: { icon: Loader2, color: 'text-primary', label: 'Processing' },
  completed: { icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', label: 'Done' },
  failed: { icon: XCircle, color: 'text-destructive', label: 'Failed' },
  none: { icon: Clock, color: 'text-muted-foreground/40', label: 'Not started' },
};

export function OpportunityEnrichmentTimeline({
  opportunityId,
}: OpportunityEnrichmentTimelineProps) {
  // Fetch live opportunity statuses (polled alongside runs)
  const { data: oppStatus } = useQuery({
    queryKey: ['enrichment-status', opportunityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunities')
        .select('org_knowledge_status, neighborhood_status, org_enrichment_status')
        .eq('id', opportunityId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  // Fetch automation_runs for this opportunity to get timeline data
  // Order descending so .find() returns the LATEST run for each workflow_key
  const { data: runs, dataUpdatedAt } = useQuery({
    queryKey: ['enrichment-timeline', opportunityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_runs')
        .select('run_id, workflow_key, status, created_at, processed_at, error_message')
        .eq('org_id', opportunityId)
        .in('workflow_key', ['org_knowledge_bootstrap', 'neighborhood_insights', 'partner_enrich', 'contact_enrich', 'prospect_pack', 'opportunity_auto_enrich', 'opportunity_enrich_chain'])
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  // Helper: find the latest (most recent) run for a given workflow key
  // Since runs are ordered descending, .find() returns the newest
  const latestRun = (key: string) => runs?.find(r => r.workflow_key === key);
  const latestErrorRun = (key: string) => runs?.find(r => r.workflow_key === key && ['error', 'failed_timeout'].includes(r.status));

  // Build timeline steps from live opportunity status + automation_runs
  const steps: TimelineStep[] = [
    {
      label: 'Org Knowledge Bootstrap',
      key: 'org_knowledge',
      status: normalizeStatus(oppStatus?.org_knowledge_status),
      timestamp: latestRun('org_knowledge_bootstrap')?.processed_at || latestRun('org_knowledge_bootstrap')?.created_at || undefined,
      error: latestErrorRun('org_knowledge_bootstrap')?.error_message || undefined,
    },
    {
      label: 'Neighborhood Insights',
      key: 'neighborhood',
      status: normalizeStatus(oppStatus?.neighborhood_status),
      timestamp: latestRun('neighborhood_insights')?.processed_at || latestRun('neighborhood_insights')?.created_at || undefined,
      error: latestErrorRun('neighborhood_insights')?.error_message || undefined,
    },
    {
      label: 'Partner Enrichment',
      key: 'org_enrichment',
      status: normalizeStatus(oppStatus?.org_enrichment_status),
      timestamp: latestRun('partner_enrich')?.processed_at || latestRun('partner_enrich')?.created_at || undefined,
      error: latestErrorRun('partner_enrich')?.error_message || undefined,
    },
    {
      label: 'Contact Enrichment',
      key: 'contact_enrich',
      status: normalizeStatus(latestRun('contact_enrich')?.status),
      timestamp: latestRun('contact_enrich')?.processed_at || latestRun('contact_enrich')?.created_at || undefined,
      error: latestErrorRun('contact_enrich')?.error_message || undefined,
    },
    {
      label: 'Prospect Pack',
      key: 'prospect_pack',
      status: normalizeStatus(latestRun('prospect_pack')?.status),
      timestamp: latestRun('prospect_pack')?.processed_at || latestRun('prospect_pack')?.created_at || undefined,
      error: latestErrorRun('prospect_pack')?.error_message || undefined,
    },
  ];

  // Only show if at least one step has started
  const hasAnyActivity = steps.some(s => s.status !== 'none');
  if (!hasAnyActivity) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Enrichment Pipeline
          <span className="text-xs text-muted-foreground font-normal ml-auto">
            Updated {new Date(dataUpdatedAt || Date.now()).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative pl-6">
          {/* Vertical line */}
          <div className="absolute left-[11px] top-1 bottom-1 w-px bg-border" />

          <div className="space-y-3">
            {steps.map((step, i) => {
              const config = STATUS_CONFIG[step.status] || STATUS_CONFIG.none;
              const Icon = config.icon;
              const isAnimated = step.status === 'running' || step.status === 'processing';

              return (
                <div key={step.key + i} className="relative flex items-start gap-3">
                  {/* Dot */}
                  <div className={cn('absolute -left-6 mt-0.5 w-[22px] h-[22px] rounded-full border-2 bg-background flex items-center justify-center',
                    step.status === 'completed' ? 'border-green-500' :
                    step.status === 'failed' ? 'border-destructive' :
                    isAnimated ? 'border-primary' :
                    'border-muted-foreground/30'
                  )}>
                    <Icon className={cn('w-3 h-3', config.color, isAnimated && 'animate-spin')} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{step.label}</span>
                      <Badge variant="outline" className={cn('text-[10px] py-0', config.color)}>
                        {config.label}
                      </Badge>
                    </div>
                    {step.timestamp && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(step.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    )}
                    {step.error && (
                      <p className="text-xs text-destructive mt-0.5 line-clamp-2">{step.error}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function normalizeStatus(status?: string | null): TimelineStep['status'] {
  if (!status) return 'none';
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'processed') return 'completed';
  if (s === 'failed' || s === 'error' || s === 'failed_timeout') return 'failed';
  if (s === 'running' || s === 'processing' || s === 'dispatched') return 'running';
  if (s === 'pending' || s === 'queued') return 'pending';
  if (s === 'none') return 'none';
  return 'none';
}
