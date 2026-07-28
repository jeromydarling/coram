/**
 * NarrativeStudio — The living story workspace.
 *
 * WHAT: Displays emerging stories, value moment timeline, and outline previews.
 * WHERE: /:tenantSlug/story
 * WHY: Turns silent signals into organizational narrative — without AI generation.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { BookOpen, Sparkles, RefreshCw, ChevronRight, Feather, Compass, Heart, Users, FileText } from 'lucide-react';
import { useTenantPath } from '@/hooks/useTenantPath';
import { toast } from '@/components/ui/sonner';
import { format } from 'date-fns';
import { HelpTooltip } from '@/components/ui/help-tooltip';
const SectionTooltip = HelpTooltip;

const momentIcons: Record<string, React.ElementType> = {
  growth: Sparkles,
  momentum: ChevronRight,
  reconnection: Heart,
  community_presence: Compass,
  collaboration: Users,
};

// momentLabels are now resolved via t('narrativeStudio.momentLabels.*') inside the component

export default function NarrativeStudio() {
  const { t } = useTranslation('narrative');
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const [building, setBuilding] = useState(false);
  const navigate = useNavigate();
  const { tenantPath } = useTenantPath();

  const { data: drafts, isLoading: loadingDrafts, refetch: refetchDrafts } = useQuery({
    queryKey: ['narrative-drafts', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('narrative_story_drafts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: moments, isLoading: loadingMoments } = useQuery({
    queryKey: ['narrative-moments', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('narrative_value_moments')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('occurred_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const handleBuildOutline = async () => {
    if (!tenantId) return;
    setBuilding(true);
    try {
      const { data, error } = await supabase.functions.invoke('narrative-build-outline', {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success(t('narrativeStudio.toasts.outlineRefreshed'));
        refetchDrafts();
      } else {
        toast(data?.message || t('narrativeStudio.toasts.noMoments'));
      }
    } catch (e: any) {
      toast.error(e.message || t('narrativeStudio.toasts.couldNotBuild'));
    } finally {
      setBuilding(false);
    }
  };

  return (
    <MainLayout
      title={t('narrativeStudio.title')}
      subtitle={t('narrativeStudio.subtitle')}
    >
      <div className="space-y-8 pb-12 max-w-4xl mx-auto">
        {/* Action bar */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(tenantPath('/testimonium/export'))}>
            <FileText className="h-4 w-4 mr-2" />
            {t('narrativeStudio.actions.witnessReports')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleBuildOutline} disabled={building}>
            <RefreshCw className={`h-4 w-4 mr-2 ${building ? 'animate-spin' : ''}`} />
            {t('narrativeStudio.actions.refreshStories')}
          </Button>
        </div>

        {/* Section 1: Emerging Stories */}
        <section>
          <h2 className="text-lg font-serif font-semibold text-foreground mb-3">
            {t('narrativeStudio.emergingStories.heading')}
            <SectionTooltip
              what={t('narrativeStudio.emergingStories.tooltipWhat')}
              where={t('narrativeStudio.emergingStories.tooltipWhere')}
              why={t('narrativeStudio.emergingStories.tooltipWhy')}
            />
          </h2>
          {loadingDrafts ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          ) : drafts && drafts.length > 0 ? (
            <div className="space-y-4">
              {drafts.map((d: any) => (
                <Card key={d.id} className="rounded-xl border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-serif">{d.title}</CardTitle>
                      <Badge variant={d.status === 'ready' ? 'default' : 'secondary'} className="text-xs shrink-0">
                        {d.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(d.created_at), 'MMM d, yyyy')}
                    </p>
                  </CardHeader>
                  <CardContent>
                    {d.outline?.chapters?.length > 0 ? (
                      <div className="space-y-2">
                        {d.outline.chapters.map((ch: any, i: number) => (
                          <div key={i} className="flex items-start gap-2">
                            <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">{ch.title}</p>
                              {ch.highlights?.[0] && (
                                <p className="text-xs text-muted-foreground truncate">{ch.highlights[0]}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">{t('narrativeStudio.emergingStories.outlineForming')}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-xl">
              <CardContent className="py-12 text-center">
                <Feather className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground font-serif italic">
                  {t('narrativeStudio.emergingStories.emptyTitle')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('narrativeStudio.emergingStories.emptyMessage')}
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        <Separator />

        {/* Section 2: Story Threads (Value Moments Timeline) */}
        <section>
          <h2 className="text-lg font-serif font-semibold text-foreground mb-3">
            {t('narrativeStudio.storyThreads.heading')}
            <SectionTooltip
              what={t('narrativeStudio.storyThreads.tooltipWhat')}
              where={t('narrativeStudio.storyThreads.tooltipWhere')}
              why={t('narrativeStudio.storyThreads.tooltipWhy')}
            />
          </h2>
          {loadingMoments ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : moments && moments.length > 0 ? (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-3 pr-2">
                {moments.map((m: any) => {
                  const Icon = momentIcons[m.moment_type] || Sparkles;
                  return (
                    <div key={m.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge variant="outline" className="text-[10px] px-1.5">
                            {t(`narrativeStudio.momentLabels.${m.moment_type}`, { defaultValue: m.moment_type })}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(m.occurred_at), 'MMM d')}
                          </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{m.summary}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <Card className="rounded-xl">
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground italic">
                  {t('narrativeStudio.storyThreads.emptyMessage')}
                </p>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
