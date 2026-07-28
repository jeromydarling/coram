/**
 * Testimonium — Executive narrative dashboard with Drift Detection.
 *
 * WHAT: Lists past narrative reports + surfaces relationship drift signals.
 * WHERE: Route /:tenantSlug/testimonium
 * WHY: Calm editorial entry point for leadership storytelling and relational awareness.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Calendar, FileText, Eye } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useTenantPath } from '@/hooks/useTenantPath';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import DriftDetectionSection from '@/components/testimonium/DriftDetectionSection';

export default function Testimonium() {
  const { t } = useTranslation('reports');
  const { tenant } = useTenant();
  const { tenantPath } = useTenantPath();
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);

  const { data: reports, isLoading } = useQuery({
    queryKey: ['testimonium-reports', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('testimonium_reports')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const generateReport = async () => {
    if (!tenant?.id) return;
    setGenerating(true);
    try {
      const now = new Date();
      const start = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
      const end = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');

      const { data, error } = await supabase.functions.invoke('testimonium-build', {
        body: { tenant_id: tenant.id, period_start: start, period_end: end },
      });

      if (error) throw error;
      toast.success(t('testimonium.toasts.generated'));

      if (data?.report_id) {
        navigate(tenantPath(`/testimonium/${data.report_id}`));
      }
    } catch (err: any) {
      toast.error(err.message || t('testimonium.toasts.failed'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <MainLayout
      title={t('testimonium.title')}
      subtitle={t('testimonium.subtitle')}
      data-testid="testimonium-root"
      headerActions={
        <HelpTooltip
          content={t('testimonium.helpContent')}
        />
      }
    >
      <Tabs defaultValue="reports" className="max-w-3xl">
        <div className="flex items-center justify-between gap-4 mb-6">
          <TabsList>
            <TabsTrigger value="reports" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              {t('testimonium.tabs.reports')}
            </TabsTrigger>
            <TabsTrigger value="drift" className="gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              {t('testimonium.tabs.driftDetection')}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="reports" className="mt-0">
          <div className="flex justify-end mb-4">
            <Button onClick={generateReport} disabled={generating} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              {generating ? t('testimonium.generating') : t('testimonium.generateReport')}
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          ) : reports && reports.length > 0 ? (
            <div className="space-y-4">
              {reports.map((report: any) => {
                const narrative = report.narrative_json as any;
                const themes = narrative?.themes || [];
                return (
                  <Card
                    key={report.id}
                    className="cursor-pointer hover:shadow-md transition-shadow rounded-xl border-border/50"
                    onClick={() => navigate(tenantPath(`/testimonium/${report.id}`))}
                  >
                    <CardContent className="py-5 px-6 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="text-lg font-serif font-medium text-foreground leading-snug">
                          {narrative?.headline || report.title}
                        </h3>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          <Calendar className="w-3 h-3 mr-1" />
                          {format(new Date(report.created_at), 'MMM d, yyyy')}
                        </Badge>
                      </div>
                      {themes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {themes.slice(0, 5).map((t: string) => (
                            <Badge key={t} variant="outline" className="text-xs font-normal">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="rounded-xl border-dashed">
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-serif font-medium text-foreground mb-2">
                  {t('testimonium.noStories.title')}
                </h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
                  {t('testimonium.noStories.description')}
                </p>
                <Button onClick={generateReport} disabled={generating} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('testimonium.noStories.button')}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="drift" className="mt-0">
          <DriftDetectionSection />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
