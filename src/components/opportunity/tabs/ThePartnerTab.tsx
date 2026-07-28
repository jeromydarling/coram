import { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { NeighborhoodInsightsCard } from '@/components/insights/NeighborhoodInsightsCard';
import { OrgInsightsPanel } from '@/components/insights/OrgInsightsPanel';
import { OrgKnowledgePanel } from '@/components/org-knowledge/OrgKnowledgePanel';
import { OpportunityEnrichmentTimeline } from '@/components/opportunity/OpportunityEnrichmentTimeline';
import { ProspectPackCard } from '@/components/opportunity/ProspectPackCard';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';

interface ThePartnerTabProps {
  opportunity: any;
  isAdmin: boolean;
}

export function ThePartnerTab({ opportunity, isAdmin }: ThePartnerTabProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const queryClient = useQueryClient();

  const handleRegenerateProspectPack = useCallback(async () => {
    setIsRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('opportunity-auto-enrich', {
        body: {
          opportunity_id: opportunity.id,
          source_url: opportunity.website_url || undefined,
          idempotency_key: `prospect-pack-${opportunity.id}-${Date.now()}`,
          steps: ['prospect_pack'],
        },
      });
      if (error) throw error;
      toast.success('Prospect Pack generation started');
      // Poll for results
      let pollCount = 0;
      const interval = setInterval(() => {
        pollCount++;
        queryClient.invalidateQueries({ queryKey: ['prospect-pack', opportunity.id] });
        if (pollCount >= 12) clearInterval(interval);
      }, 10_000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate Prospect Pack');
    } finally {
      setIsRegenerating(false);
    }
  }, [opportunity, queryClient]);
  return (
    <div className="space-y-4">
      {/* Mission Snapshot */}
      {opportunity.mission_snapshot && opportunity.mission_snapshot.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Mission Snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {opportunity.mission_snapshot.map((item: string, idx: number) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {item}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Best Partnership Angle */}
      {opportunity.best_partnership_angle && opportunity.best_partnership_angle.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Best Partnership Angle</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {opportunity.best_partnership_angle.map((item: string, idx: number) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {item}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grant Alignment */}
      {opportunity.grant_alignment && opportunity.grant_alignment.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Grant Alignment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {opportunity.grant_alignment.map((item: string, idx: number) => (
                <Badge key={idx} className="text-xs bg-success/15 text-success">
                  {item}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Org Knowledge (visible to all, admin sees extra) */}
      <OrgKnowledgePanel
        orgId={opportunity.id}
        orgName={opportunity.organization}
        websiteUrl={opportunity.website_url}
      />

      {/* Neighborhood Insights */}
      <NeighborhoodInsightsCard 
        orgId={opportunity.id} 
        hasLocation={!!(opportunity.zip || (opportunity.city && opportunity.state))} 
      />

      {/* Org Insights */}
      <OrgInsightsPanel orgId={opportunity.id} />

      {/* Prospect Pack */}
      <ProspectPackCard
        opportunityId={opportunity.id}
        onRegenerate={handleRegenerateProspectPack}
        isRegenerating={isRegenerating}
      />

      {/* Admin-only: Enrichment Pipeline Timeline */}
      {isAdmin && (
        <OpportunityEnrichmentTimeline
          opportunityId={opportunity.id}
        />
      )}
    </div>
  );
}
