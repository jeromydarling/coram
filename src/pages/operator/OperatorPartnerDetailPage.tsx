/**
 * OperatorPartnerDetailPage — Full institution-focused partner detail for the Gardener.
 *
 * WHAT: Complete partner profile with tabs mirroring the tenant flow: The Partner, The Story, The Pulse, The People, The Impact, The Next Move.
 * WHERE: /operator/partners/:id (CRESCERE zone)
 * WHY: The gardener needs full enrichment, org knowledge, and relationship intelligence for their own pipeline.
 */
import { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Loader2, ArrowLeft, Building2, Users as UsersIcon, Globe,
  StickyNote, Pencil, Sparkles, ExternalLink, MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { format } from 'date-fns';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { cn } from '@/lib/utils';
import { OrgKnowledgePanel } from '@/components/org-knowledge/OrgKnowledgePanel';
import { NeighborhoodInsightsCard } from '@/components/insights/NeighborhoodInsightsCard';
import { OrgInsightsPanel } from '@/components/insights/OrgInsightsPanel';
import { OpportunityEnrichmentTimeline } from '@/components/opportunity/OpportunityEnrichmentTimeline';

const STAGES = [
  'Researching', 'Contacted', 'Discovery Scheduled', 'Discovery Held',
  'Proposal Sent', 'Agreement Pending', 'Agreement Signed', 'Onboarding',
  'Active Customer', 'Closed - Not a Fit',
];

const TAB_CONFIG = [
  { value: 'partner', label: 'The Partner', subtitle: 'Who they are' },
  { value: 'story', label: 'The Story', subtitle: 'Journey & notes' },
  { value: 'pulse', label: 'The Pulse', subtitle: "What's happening around them" },
  { value: 'people', label: 'The People', subtitle: 'Contacts' },
  { value: 'impact', label: 'The Impact', subtitle: "What we've done together" },
  { value: 'next', label: 'The Next Move', subtitle: 'Gentle guidance' },
];

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

export default function OperatorPartnerDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');
  const [activeTab, setActiveTab] = useState('partner');
  const [isEnriching, setIsEnriching] = useState(false);
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [enrichUrl, setEnrichUrl] = useState('');
  const enrichPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch opportunity
  const { data: opp, isLoading } = useQuery({
    queryKey: ['operator-opportunity', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_opportunities')
        .select('*, primary_contact:operator_contacts!operator_opportunities_primary_contact_id_fkey(id, name, email, phone, title)')
        .eq('id', slug!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Fetch linked contacts
  const { data: linkedContacts } = useQuery({
    queryKey: ['operator-opp-contacts', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_opportunity_contacts')
        .select('*, contact:operator_contacts(id, name, email, title, organization)')
        .eq('opportunity_id', slug!);
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Fetch journey notes
  const { data: journeyNotes } = useQuery({
    queryKey: ['operator-journey-notes', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_journey_notes')
        .select('*')
        .eq('opportunity_id', slug!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Update stage
  const stageMutation = useMutation({
    mutationFn: async (newStage: string) => {
      const { error } = await supabase
        .from('operator_opportunities')
        .update({ stage: newStage })
        .eq('id', slug!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator-opportunity', slug] });
      queryClient.invalidateQueries({ queryKey: ['operator-opportunities'] });
      toast.success('Stage updated');
    },
  });

  // Add journey note
  const noteMutation = useMutation({
    mutationFn: async (note: string) => {
      const { error } = await supabase.from('operator_journey_notes').insert({
        opportunity_id: slug!,
        stage: opp?.stage || 'Researching',
        note: note.trim(),
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator-journey-notes', slug] });
      setNewNote('');
      toast.success('Note added');
    },
  });

  // Enrichment handler
  const handleEnrich = useCallback(async (urlOverride?: string) => {
    const targetUrl = urlOverride || opp?.website_url || opp?.website;
    if (!targetUrl) {
      setEnrichUrl('');
      setShowUrlDialog(true);
      return;
    }

    setIsEnriching(true);
    setShowUrlDialog(false);
    try {
      const { data, error } = await supabase.functions.invoke('operator-partner-enrich', {
        body: { opportunity_id: slug!, source_url: targetUrl },
      });
      if (error) throw error;
      if (!data?.ok) {
        toast.error(data?.error || 'Enrichment failed');
        return;
      }
      toast.success(`Enriched ${(data.fields_updated || []).length} fields from website`);
      queryClient.invalidateQueries({ queryKey: ['operator-opportunity', slug] });
      // Poll for org knowledge updates
      let polls = 0;
      if (enrichPollRef.current) clearInterval(enrichPollRef.current);
      enrichPollRef.current = setInterval(() => {
        polls++;
        queryClient.invalidateQueries({ queryKey: ['org-knowledge', slug] });
        queryClient.invalidateQueries({ queryKey: ['operator-opportunity', slug] });
        if (polls >= 6) {
          if (enrichPollRef.current) clearInterval(enrichPollRef.current);
        }
      }, 5000);
    } catch (err: any) {
      toast.error(err?.message || 'Enrichment failed');
    } finally {
      setIsEnriching(false);
    }
  }, [opp, slug, queryClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!opp) {
    return (
      <div className="text-center py-12 space-y-4">
        <Building2 className="w-12 h-12 mx-auto text-muted-foreground" />
        <p className="text-muted-foreground">Opportunity not found</p>
        <Button variant="outline" onClick={() => navigate('/operator/partners')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Partners
        </Button>
      </div>
    );
  }

  const hasUrl = !!(opp.website_url || opp.website);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/operator/partners')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground truncate flex items-center gap-2">
            {opp.organization}
            <HelpTooltip
              what="Full partner profile — enrichment, org knowledge, journey, contacts, and intelligence."
              where="Operator Console → Partners → Detail (CRESCERE)"
              why="Manage the complete lifecycle of your gardener pipeline opportunities."
            />
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="secondary">{opp.stage}</Badge>
            <Badge variant="outline">{opp.status}</Badge>
            {opp.metro && <Badge variant="outline"><MapPin className="w-3 h-3 mr-1" />{opp.metro}</Badge>}
            {opp.city && <Badge variant="outline" className="text-xs">{opp.city}{opp.state ? `, ${opp.state}` : ''}</Badge>}
            <EnrichmentStatusBadge label="Knowledge" status={opp.org_knowledge_status} />
            <EnrichmentStatusBadge label="Enrichment" status={opp.org_enrichment_status} />
            <EnrichmentStatusBadge label="Neighborhood" status={opp.neighborhood_status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasUrl && (
            <Button variant="outline" size="sm" onClick={() => window.open(opp.website_url || opp.website, '_blank')}>
              <Globe className="w-4 h-4 mr-1" /> Website
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            className="gap-1.5"
            onClick={() => handleEnrich()}
            disabled={isEnriching}
          >
            {isEnriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isEnriching ? 'Enriching…' : hasUrl ? 'Enrich' : 'Enrich from URL'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start h-auto flex-wrap">
          {TAB_CONFIG.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex flex-col items-start gap-0 py-2 px-4">
              <span className="text-sm font-medium">{tab.label}</span>
              <span className="text-[10px] text-muted-foreground">{tab.subtitle}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* The Partner Tab */}
        <TabsContent value="partner" className="space-y-4 mt-4">
          {/* Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground">Metro / City</p>
                  <p className="font-medium">{opp.metro || opp.city || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Website</p>
                  {(opp.website_url || opp.website) ? (
                    <a href={opp.website_url || opp.website} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline flex items-center gap-1">
                      <Globe className="w-3 h-3" /> {(() => { try { return new URL(opp.website_url || opp.website).hostname; } catch { return opp.website_url || opp.website; } })()}
                    </a>
                  ) : (
                    <p className="font-medium">—</p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground">Source</p>
                  <p className="font-medium">{opp.source || 'manual'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">{format(new Date(opp.created_at), 'MMM d, yyyy')}</p>
                </div>
                {opp.partner_tier && (
                  <div>
                    <p className="text-muted-foreground">Tier</p>
                    <p className="font-medium">{opp.partner_tier}</p>
                  </div>
                )}
                {opp.zip && (
                  <div>
                    <p className="text-muted-foreground">ZIP</p>
                    <p className="font-medium">{opp.zip}</p>
                  </div>
                )}
              </div>
              {opp.description && (
                <div className="pt-3 border-t border-border">
                  <p className="text-muted-foreground mb-1">Description</p>
                  <p className="whitespace-pre-wrap text-sm">{opp.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mission Snapshot */}
          {opp.mission_snapshot && opp.mission_snapshot.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Mission Snapshot</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {opp.mission_snapshot.map((item: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-xs">{item}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Best Partnership Angle */}
          {opp.best_partnership_angle && opp.best_partnership_angle.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Best Partnership Angle</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {opp.best_partnership_angle.map((item: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-xs">{item}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Grant Alignment */}
          {opp.grant_alignment && opp.grant_alignment.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Grant Alignment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {opp.grant_alignment.map((item: string, idx: number) => (
                    <Badge key={idx} className="text-xs bg-success/15 text-success">{item}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Partner Tiers */}
          {opp.partner_tiers && opp.partner_tiers.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Partner Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {opp.partner_tiers.map((item: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-xs">{item}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {opp.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{opp.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Org Knowledge (was in intel tab) */}
          <OrgKnowledgePanel
            orgId={opp.id}
            orgName={opp.organization}
            websiteUrl={opp.website_url || opp.website}
          />

          {/* Neighborhood Insights */}
          <NeighborhoodInsightsCard
            orgId={opp.id}
            hasLocation={!!(opp.zip || (opp.city && opp.state))}
          />
        </TabsContent>

        {/* The Story Tab */}
        <TabsContent value="story" className="space-y-4 mt-4">
          {/* Journey Stage */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Journey</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {STAGES.map((stage) => (
                  <Badge
                    key={stage}
                    variant={opp.stage === stage ? 'default' : 'outline'}
                    className={cn(
                      'cursor-pointer transition-opacity',
                      opp.stage === stage ? '' : 'opacity-40 hover:opacity-70'
                    )}
                    onClick={() => { if (stage !== opp.stage) stageMutation.mutate(stage); }}
                  >
                    {stage}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Click a stage to move the opportunity forward.</p>
            </CardContent>
          </Card>

          {/* Journey Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <StickyNote className="w-4 h-4" /> Journey Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a note about this relationship…"
                  rows={2}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  className="self-end"
                  disabled={!newNote.trim() || noteMutation.isPending}
                  onClick={() => noteMutation.mutate(newNote)}
                >
                  {noteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                </Button>
              </div>

              {(journeyNotes || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No notes yet. Start documenting the journey.</p>
              ) : (
                <div className="space-y-3">
                  {journeyNotes!.map((jn: any) => (
                    <div key={jn.id} className="border border-border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{jn.stage}</Badge>
                        <span className="text-xs text-muted-foreground">{format(new Date(jn.created_at), 'MMM d, yyyy h:mm a')}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{jn.note}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* The People Tab */}
        <TabsContent value="people" className="space-y-4 mt-4">
          {/* Primary Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UsersIcon className="w-4 h-4" /> Primary Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {opp.primary_contact ? (
                <div className="space-y-1">
                  <p className="font-medium">{(opp.primary_contact as any).name}</p>
                  {(opp.primary_contact as any).title && <p className="text-muted-foreground">{(opp.primary_contact as any).title}</p>}
                  {(opp.primary_contact as any).email && (
                    <a href={`mailto:${(opp.primary_contact as any).email}`} className="text-primary hover:underline text-xs block">{(opp.primary_contact as any).email}</a>
                  )}
                  {(opp.primary_contact as any).phone && (
                    <p className="text-xs text-muted-foreground">{(opp.primary_contact as any).phone}</p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">No primary contact set</p>
              )}
            </CardContent>
          </Card>

          {/* Linked Contacts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Linked People</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {(linkedContacts || []).length === 0 ? (
                <p className="text-muted-foreground">No linked contacts yet.</p>
              ) : (
                <div className="space-y-2">
                  {linkedContacts!.map((lc: any) => (
                    <div key={lc.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{lc.contact?.name}</p>
                        {lc.contact?.title && <p className="text-xs text-muted-foreground truncate">{lc.contact.title}</p>}
                        {lc.contact?.email && <p className="text-xs text-primary truncate">{lc.contact.email}</p>}
                      </div>
                      {lc.role !== 'contact' && <Badge variant="outline" className="text-xs">{lc.role}</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* The Pulse Tab */}
        <TabsContent value="pulse" className="space-y-4 mt-4">
          <OrgInsightsPanel orgId={opp.id} />
          <OpportunityEnrichmentTimeline opportunityId={opp.id} />
        </TabsContent>

        {/* The Impact Tab */}
        <TabsContent value="impact" className="space-y-4 mt-4">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground text-sm">
                Impact tracking for this partner will appear here as the relationship grows.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* The Next Move Tab */}
        <TabsContent value="next" className="space-y-4 mt-4">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground text-sm">
                Gentle guidance and next steps will surface here as signals emerge.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* URL Dialog */}
      <Dialog open={showUrlDialog} onOpenChange={setShowUrlDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enter Website URL</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="enrichUrl">Website URL</Label>
            <Input
              id="enrichUrl"
              type="url"
              value={enrichUrl}
              onChange={(e) => setEnrichUrl(e.target.value)}
              placeholder="https://example.org"
            />
            <p className="text-xs text-muted-foreground">
              We'll scrape this website to extract organizational intelligence, mission focus, leadership, and partnership angles.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUrlDialog(false)}>Cancel</Button>
            <Button
              onClick={() => handleEnrich(enrichUrl)}
              disabled={!enrichUrl.trim() || isEnriching}
              className="gap-1.5"
            >
              {isEnriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Enrich
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
