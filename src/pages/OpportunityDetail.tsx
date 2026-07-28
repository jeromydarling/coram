import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useMetroIntelligence } from '@/hooks/useMetroIntelligence';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useTenantPath } from '@/hooks/useTenantPath';
import { parseISO, format, isPast, differenceInDays } from 'date-fns';
import { MainLayout } from '@/components/layout/MainLayout';
import { useOpportunities } from '@/hooks/useOpportunities';
import { useContacts } from '@/hooks/useContacts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Building2,
  Pencil,
  Clock,
  AlertTriangle,
  MapPin,
  Loader2,
  Sparkles,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toChapterLabel } from '@/lib/journeyChapters';
import { JourneyChapters } from '@/components/opportunity/JourneyChapters';
import { useGlobalModal } from '@/contexts/GlobalModalContext';
import { ConvertToAnchorModal } from '@/components/modals/ConvertToAnchorModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useUserRoles } from '@/hooks/useUsers';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import { HubSpotSyncButton } from '@/components/opportunity/HubSpotSyncButton';
import { useTranslation } from 'react-i18next';

import { ThePartnerTab } from '@/components/opportunity/tabs/ThePartnerTab';
import { TheStoryTab } from '@/components/opportunity/tabs/TheStoryTab';
import { ThePulseTab } from '@/components/opportunity/tabs/ThePulseTab';
import { ThePeopleTab } from '@/components/opportunity/tabs/ThePeopleTab';
import { TheImpactTab } from '@/components/opportunity/tabs/TheImpactTab';
import { TheNextMoveTab } from '@/components/opportunity/tabs/TheNextMoveTab';

function EnrichmentStatusBadge({ label, status }: { label: string; status?: string }) {
  if (!status || status === 'none') return null;
  const colorMap: Record<string, string> = {
    queued: 'bg-muted text-muted-foreground',
    processing: 'bg-primary/10 text-primary',
    completed: 'bg-green-500/10 text-green-700 dark:text-green-400',
    failed: 'bg-destructive/10 text-destructive',
  };
  return (
    <Badge variant="outline" className={cn('text-xs gap-1', colorMap[status] || '')}>
      {status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}
      {label}: {status}
    </Badge>
  );
}

type OpportunityStage = 'Target Identified' | 'Contacted' | 'Discovery Scheduled' | 'Discovery Held' | 'Proposal Sent' | 'Agreement Pending' | 'Agreement Signed' | 'First Volume' | 'Stable Producer' | 'Closed - Not a Fit';
type OpportunityStatus = 'Active' | 'On Hold' | 'Closed - Won' | 'Closed - Lost';
type PartnerTier = 'Anchor' | 'Distribution' | 'Referral' | 'Workforce' | 'Housing' | 'Education' | 'Other';

const TAB_VALUES = [
  { value: 'partner', labelKey: 'opportunityDetail.tabs.partner', subtitleKey: 'opportunityDetail.tabs.partnerSubtitle', helpKey: 'tab.the-partner' as const },
  { value: 'story', labelKey: 'opportunityDetail.tabs.story', subtitleKey: 'opportunityDetail.tabs.storySubtitle', helpKey: 'tab.the-story' as const },
  { value: 'pulse', labelKey: 'opportunityDetail.tabs.pulse', subtitleKey: 'opportunityDetail.tabs.pulseSubtitle', helpKey: 'tab.the-pulse' as const },
  { value: 'people', labelKey: 'opportunityDetail.tabs.people', subtitleKey: 'opportunityDetail.tabs.peopleSubtitle', helpKey: 'tab.the-people' as const },
  { value: 'impact', labelKey: 'opportunityDetail.tabs.impact', subtitleKey: 'opportunityDetail.tabs.impactSubtitle', helpKey: 'tab.the-impact' as const },
  { value: 'next', labelKey: 'opportunityDetail.tabs.next', subtitleKey: 'opportunityDetail.tabs.nextSubtitle', helpKey: 'tab.the-next-move' as const },
] as const;

export default function OpportunityDetail() {
  const { t } = useTranslation('relationships');
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { tenantPath } = useTenantPath();
  const { enabled: metroEnabled } = useMetroIntelligence();
  const queryClient = useQueryClient();
  const { data: opportunities, isLoading } = useOpportunities();
  const { data: contacts } = useContacts();
  const { data: userRoles } = useUserRoles();
  const isAdmin = userRoles?.some((r: any) => ['admin', 'leadership', 'regional_lead'].includes(r.role)) ?? false;

  const { openOpportunityModal } = useGlobalModal();
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [enrichUrl, setEnrichUrl] = useState('');
  const { activeTab, setActiveTab } = useTabPersistence('partner');
  const enrichPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll enrichment-related queries for ~2 minutes after triggering enrichment
  useEffect(() => {
    return () => {
      if (enrichPollRef.current) clearInterval(enrichPollRef.current);
    };
  }, []);

  const opportunity = opportunities?.find(o => o.slug === slug || o.id === slug);

  // When the slug changes after an edit (e.g. org name changed), update the URL
  useEffect(() => {
    if (opportunity?.slug && slug && opportunity.slug !== slug && opportunity.id !== slug) {
      navigate(tenantPath(`/opportunities/${opportunity.slug}`), { replace: true });
    }
  }, [opportunity?.slug, slug, navigate, opportunity?.id]);

  // Full enrichment chain: Org Knowledge → Neighborhood → Partner Enrich → Prospect Pack
  const runFullEnrichChain = useCallback(async (sourceUrl?: string) => {
    if (!opportunity) return;
    setIsEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke('opportunity-auto-enrich', {
        body: {
          opportunity_id: opportunity.id,
          source_url: sourceUrl || opportunity.website_url || undefined,
          idempotency_key: `enrich-${opportunity.id}-${Date.now()}`,
        },
      });
      if (error) throw error;
      if (data?.ok) {
        const steps = data.steps || {};
        const skipped = Object.entries(steps)
          .filter(([, v]) => typeof v === 'string' && (v as string).startsWith('skipped'))
          .map(([k]) => k);
        if (skipped.length > 0) {
          toast.info(`Enrichment started. Skipped: ${skipped.join(', ')} (no URL or data)`);
        } else {
          toast.success('Full enrichment chain started — Org Knowledge → Neighborhood → Enrich → Prospect Pack');
        }
      }
      // Start polling for enrichment results (n8n runs async)
      if (enrichPollRef.current) clearInterval(enrichPollRef.current);
      let pollCount = 0;
      const maxPolls = 12; // ~2 minutes at 10s intervals
      enrichPollRef.current = setInterval(() => {
        pollCount++;
        const oid = opportunity.id;
        queryClient.invalidateQueries({ queryKey: ['opportunities'] });
        queryClient.invalidateQueries({ queryKey: ['org-knowledge', oid] });
        queryClient.invalidateQueries({ queryKey: ['neighborhood-insight', oid] });
        queryClient.invalidateQueries({ queryKey: ['enrichment-status', oid] });
        queryClient.invalidateQueries({ queryKey: ['enrichment-timeline', oid] });
        queryClient.invalidateQueries({ queryKey: ['contact-suggestions', 'opportunity', oid] });
        queryClient.invalidateQueries({ queryKey: ['prospect-pack', oid] });
        queryClient.invalidateQueries({ queryKey: ['story-chapters', oid] });
        if (pollCount >= maxPolls && enrichPollRef.current) {
          clearInterval(enrichPollRef.current);
          enrichPollRef.current = null;
        }
      }, 10_000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Enrichment failed');
    } finally {
      setIsEnriching(false);
    }
  }, [opportunity, queryClient]);

  const opportunityContacts = useMemo(() => {
    if (!contacts || !opportunity) return [];
    return contacts.filter(c => c.opportunity_id === opportunity.id);
  }, [contacts, opportunity]);

  const getStageBadge = (stage: OpportunityStage) => {
    const stageStyles: Record<string, string> = {
      'Target Identified': 'stage-target',
      'Contacted': 'stage-contacted',
      'Discovery Scheduled': 'stage-discovery',
      'Discovery Held': 'stage-discovery',
      'Proposal Sent': 'stage-proposal',
      'Agreement Pending': 'stage-agreement',
      'Agreement Signed': 'stage-signed',
      'First Volume': 'stage-volume',
      'Stable Producer': 'stage-volume',
      'Closed - Not a Fit': 'bg-muted text-muted-foreground'
    };
    return stageStyles[stage] || 'stage-target';
  };

  const getStatusBadge = (status: OpportunityStatus) => {
    const styles = {
      'Active': 'bg-success/15 text-success',
      'On Hold': 'bg-warning/15 text-warning',
      'Closed - Won': 'bg-primary/15 text-primary',
      'Closed - Lost': 'bg-muted text-muted-foreground'
    };
    return styles[status] || 'bg-muted text-muted-foreground';
  };

  const getTierBadge = (tier: PartnerTier) => {
    const styles: Record<string, string> = {
      'Anchor': 'bg-accent/15 text-accent border border-accent/30',
      'Distribution': 'bg-primary/15 text-primary',
      'Referral': 'bg-info/15 text-info',
      'Workforce': 'bg-warning/15 text-warning',
      'Housing': 'bg-success/15 text-success',
      'Education': 'bg-chart-5/15 text-[hsl(var(--chart-5))]',
      'Other': 'bg-muted text-muted-foreground'
    };
    return styles[tier] || 'bg-muted text-muted-foreground';
  };

  if (isLoading) {
    return (
      <MainLayout title={t('opportunityDetail.organizationTitle')} subtitle={t('opportunityDetail.loading')}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!opportunity) {
    return (
      <MainLayout title={t('opportunityDetail.notFound')} subtitle={t('opportunityDetail.notFoundSubtitle')}>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">{t('opportunityDetail.notFoundMessage')}</p>
          <Button onClick={() => navigate(tenantPath('/opportunities'))}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('opportunityDetail.backToOpportunities')}
          </Button>
        </div>
      </MainLayout>
    );
  }

  const isOverdue = opportunity.next_action_due && isPast(parseISO(opportunity.next_action_due));
  const daysUntilDue = opportunity.next_action_due
    ? differenceInDays(parseISO(opportunity.next_action_due), new Date())
    : null;

  const partnerTiers = opportunity.partner_tiers?.length
    ? opportunity.partner_tiers
    : opportunity.partner_tier
      ? [opportunity.partner_tier]
      : [];

  return (
    <MainLayout
      title={opportunity.organization}
      subtitle={opportunity.metros?.metro || t('opportunityDetail.opportunityDetails')}
      mobileTitle={opportunity.organization.split(' ').slice(0, 2).join(' ')}
      data-testid="opportunity-detail-root"
    >
      <div className="space-y-4">
        {/* Back Button & Actions */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <Button variant="ghost" onClick={() => navigate(tenantPath('/opportunities'))} className="gap-2 self-start">
            <ArrowLeft className="w-4 h-4" />
            {t('opportunityDetail.backToOpportunities')}
          </Button>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              className="gap-2"
              disabled={isEnriching}
              onClick={() => {
                if (!opportunity) return;
                if (!opportunity.website_url) {
                  setEnrichUrl('');
                  setShowUrlDialog(true);
                } else {
                  runFullEnrichChain();
                }
              }}
            >
              {isEnriching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {t('opportunityDetail.enrichOrg')}
            </Button>
            {(opportunity.stage === 'Stable Producer' || (opportunity.stage as string) === 'Growing Together') && (
              <Button variant="outline" className="gap-2" onClick={() => setIsConvertModalOpen(true)}>
                {t('opportunityDetail.convertToAnchor')}
              </Button>
            )}
            <HubSpotSyncButton opportunityId={opportunity.id} />
            <Button className="gap-2" onClick={() => openOpportunityModal(opportunity)}>
              <Pencil className="w-4 h-4" />
              {t('opportunityDetail.edit')}
            </Button>
          </div>
        </div>

        {/* Header Card — always visible above tabs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <span>{opportunity.organization}</span>
                {opportunity.metros?.metro && metroEnabled && (
                  <p className="text-sm font-normal text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {opportunity.metros.metro}
                  </p>
                )}
                {opportunity.website_url && (
                  <a
                    href={opportunity.website_url.startsWith('http') ? opportunity.website_url : `https://${opportunity.website_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-normal text-primary hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {opportunity.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge className={cn('font-medium', getStatusBadge(opportunity.status as OpportunityStatus))}>
                {opportunity.status}
              </Badge>
              {partnerTiers.map((tier: string) => (
                <Badge key={tier} className={cn('font-medium', getTierBadge(tier as PartnerTier))}>
                  {tier}
                </Badge>
              ))}
            </div>

            {isAdmin && (opportunity.org_knowledge_status && opportunity.org_knowledge_status !== 'none') && (
              <div className="flex flex-wrap gap-2 items-center">
                <EnrichmentStatusBadge label={t('opportunityDetail.enrichment.orgKnowledge')} status={opportunity.org_knowledge_status} />
                <EnrichmentStatusBadge label={t('opportunityDetail.enrichment.neighborhood')} status={opportunity.neighborhood_status} />
                <EnrichmentStatusBadge label={t('opportunityDetail.enrichment.enrichment')} status={opportunity.org_enrichment_status} />
              </div>
            )}

            {/* Journey Chapter Selector */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{t('opportunityDetail.chapter')}</p>
              <div data-tour="opp-journey-chapters"><JourneyChapters opportunityId={opportunity.id} currentStage={opportunity.stage} /></div>
            </div>

            {opportunity.next_action_due && (
              <div className={cn(
                "flex items-center gap-2 p-3 rounded-lg",
                isOverdue ? "bg-destructive/10 text-destructive" : "bg-muted/50"
              )}>
                {isOverdue ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                <div>
                  <span className="font-medium">{t('opportunityDetail.nextActionDue')}</span>
                  <span>{format(parseISO(opportunity.next_action_due), 'MMM d, yyyy')}</span>
                  {daysUntilDue !== null && (
                    <span className="ml-2 text-sm">
                      ({isOverdue
                        ? t('opportunityDetail.daysOverdue', { count: Math.abs(daysUntilDue) })
                        : t('opportunityDetail.inDays', { count: daysUntilDue })})
                    </span>
                  )}
                </div>
              </div>
            )}

            {opportunity.next_step && (
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm font-medium text-muted-foreground mb-1">{t('opportunityDetail.nextStep')}</p>
                <p className="text-sm">{opportunity.next_step}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full h-auto flex-wrap justify-start gap-1 bg-transparent p-0" data-tour="opp-tab-bar">
            {TAB_VALUES.map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                data-testid={tab.value === 'story' ? 'opportunity-tab-story' : undefined}
                className="flex flex-col items-start gap-0 px-3 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg border border-transparent data-[state=active]:border-primary/20 text-left"
              >
                <span className="text-sm font-medium">
                  {t(tab.labelKey)}
                </span>
                <span className="text-[10px] text-muted-foreground font-normal hidden sm:block">{t(tab.subtitleKey)}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="partner" className="mt-4">
            <ThePartnerTab opportunity={opportunity} isAdmin={isAdmin} />
          </TabsContent>

          <TabsContent value="story" className="mt-4">
            <TheStoryTab opportunityId={opportunity.id} isAdmin={isAdmin} organizationName={opportunity.organization} />
          </TabsContent>

          <TabsContent value="pulse" className="mt-4">
            <ThePulseTab opportunity={opportunity} isAdmin={isAdmin} />
          </TabsContent>

          <TabsContent value="people" className="mt-4">
            <ThePeopleTab
              opportunity={opportunity}
              opportunityContacts={opportunityContacts}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="impact" className="mt-4">
            <TheImpactTab
              opportunity={opportunity}
              isAdmin={isAdmin}
              onStageUpdateRequest={() => openOpportunityModal(opportunity)}
            />
          </TabsContent>

          <TabsContent value="next" className="mt-4">
            <TheNextMoveTab opportunityId={opportunity.id} isAdmin={isAdmin} />
          </TabsContent>
        </Tabs>
      </div>

      <ConvertToAnchorModal
        open={isConvertModalOpen}
        onOpenChange={setIsConvertModalOpen}
        opportunity={opportunity}
      />

      {/* URL Dialog for Enrich when no website_url is set */}
      <Dialog open={showUrlDialog} onOpenChange={setShowUrlDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              {t('opportunityDetail.urlDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('opportunityDetail.urlDialog.description', { org: opportunity.organization })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="enrich-url">{t('opportunityDetail.urlDialog.webPageUrl')}</Label>
            <Input
              id="enrich-url"
              placeholder={t('opportunityDetail.urlDialog.placeholder')}
              value={enrichUrl}
              onChange={(e) => setEnrichUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && enrichUrl.trim()) {
                  const finalUrl = enrichUrl.trim().match(/^https?:\/\//i) ? enrichUrl.trim() : `https://${enrichUrl.trim()}`;
                  setShowUrlDialog(false);
                  runFullEnrichChain(finalUrl);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUrlDialog(false)}>
              {t('opportunityDetail.urlDialog.cancel')}
            </Button>
            <Button
              disabled={!enrichUrl.trim()}
              onClick={() => {
                const finalUrl = enrichUrl.trim().match(/^https?:\/\//i) ? enrichUrl.trim() : `https://${enrichUrl.trim()}`;
                setShowUrlDialog(false);
                runFullEnrichChain(finalUrl);
              }}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {t('opportunityDetail.urlDialog.startEnrichment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
