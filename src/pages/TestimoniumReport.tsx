/**
 * TestimoniumReport — Detail view for a single narrative report.
 *
 * WHAT: Displays headline, themes, chapters, quiet progress, community movements, metrics.
 * WHERE: Route /:tenantSlug/testimonium/:id
 * WHY: Editorial storytelling — no charts, no dashboards, just narrative.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantPath } from '@/hooks/useTenantPath';
import { toast } from '@/components/ui/sonner';
import { TestimoniumHeader } from '@/components/testimonium/TestimoniumHeader';
import { TestimoniumChapter } from '@/components/testimonium/TestimoniumChapter';

export default function TestimoniumReport() {
  const { t } = useTranslation('reports');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenantPath } = useTenantPath();

  const { data: report, isLoading } = useQuery({
    queryKey: ['testimonium-report', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('testimonium_reports')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const handleExportPdf = async () => {
    if (!report) return;
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const narrative = report.narrative_json as any;
      let y = 20;

      // Headline
      doc.setFontSize(18);
      doc.text(narrative?.headline || report.title, 14, y, { maxWidth: 180 });
      y += 14;

      // Period
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`${report.period_start} — ${report.period_end}`, 14, y);
      y += 8;

      // Themes
      if (narrative?.themes?.length > 0) {
        doc.setFontSize(9);
        doc.text(`Themes: ${narrative.themes.join(', ')}`, 14, y);
        y += 10;
      }

      // Chapters
      for (const ch of narrative?.chapters || []) {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFontSize(13);
        doc.setTextColor(40);
        doc.text(ch.title, 14, y);
        y += 7;
        doc.setFontSize(10);
        doc.setTextColor(80);
        const lines = doc.splitTextToSize(ch.summary, 180);
        doc.text(lines, 14, y);
        y += lines.length * 5 + 8;
      }

      // Metrics
      if (narrative?.metrics) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(10);
        doc.setTextColor(60);
        const m = narrative.metrics;
        doc.text(
          `Relationships: ${m.relationships_grown} · Events: ${m.events_attended} · Reflections: ${m.reflections_written}`,
          14,
          y
        );
      }

      doc.save(`testimonium-${report.period_start}-${report.period_end}.pdf`);
      toast.success(t('testimoniumReport.toasts.pdfDownloaded'));
    } catch {
      toast.error(t('testimoniumReport.toasts.pdfFailed'));
    }
  };

  if (isLoading) {
    return (
      <MainLayout title={t('testimoniumReport.loading')}>
        <div className="max-w-3xl space-y-6">
          <Skeleton className="h-10 w-64" />
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      </MainLayout>
    );
  }

  if (!report) {
    return (
      <MainLayout title={t('testimoniumReport.notFound')}>
        <div className="max-w-3xl text-center py-20">
          <p className="text-muted-foreground">{t('testimoniumReport.notFoundMessage')}</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate(tenantPath('/testimonium'))}>
            <ArrowLeft className="w-4 h-4 mr-2" /> {t('testimoniumReport.backToTestimonium')}
          </Button>
        </div>
      </MainLayout>
    );
  }

  const narrative = report.narrative_json as any;
  const chapters = narrative?.chapters || [];
  const quietProgress = narrative?.quiet_progress || [];
  const communityMovements = narrative?.community_movements || [];
  const metrics = narrative?.metrics || {};

  return (
    <MainLayout
      title=""
      headerActions={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(tenantPath('/testimonium'))}>
            <ArrowLeft className="w-4 h-4 mr-2" /> {t('testimoniumReport.back')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <Download className="w-4 h-4 mr-2" /> {t('testimoniumReport.generateStoryPdf')}
          </Button>
        </div>
      }
    >
      <div className="max-w-3xl space-y-10">
        {/* Header */}
        <TestimoniumHeader
          headline={narrative?.headline || report.title}
          themes={narrative?.themes || []}
          periodStart={report.period_start}
          periodEnd={report.period_end}
          driftSummary={narrative?.narrative_drift_summary}
        />

        {/* Chapters */}
        <div className="space-y-8">
          {chapters.map((ch: any, i: number) => (
            <TestimoniumChapter
              key={i}
              title={ch.title}
              summary={ch.summary}
              signals={ch.signals || []}
              index={i}
            />
          ))}
        </div>

        {/* Community Movements */}
        {communityMovements.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-border/40">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {t('testimoniumReport.sections.communityMovements')}
            </h3>
            <ul className="space-y-2 pl-4">
              {communityMovements.map((m: string, i: number) => (
                <li key={i} className="text-sm text-foreground font-serif">
                  • {m}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Quiet Progress */}
        {quietProgress.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-border/40">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {t('testimoniumReport.sections.quietProgress')}
            </h3>
            <ul className="space-y-2 pl-4">
              {quietProgress.map((p: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground font-serif italic">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Metrics footer */}
        <div className="pt-6 border-t border-border/40 flex flex-wrap gap-6 text-sm text-muted-foreground">
          <div>
            <span className="text-xl font-serif font-medium text-foreground">{metrics.relationships_grown || 0}</span>
            <span className="ml-1.5">{t('testimoniumReport.metrics.relationshipsGrown')}</span>
          </div>
          <div>
            <span className="text-xl font-serif font-medium text-foreground">{metrics.events_attended || 0}</span>
            <span className="ml-1.5">{t('testimoniumReport.metrics.eventsAttended')}</span>
          </div>
          <div>
            <span className="text-xl font-serif font-medium text-foreground">{metrics.reflections_written || 0}</span>
            <span className="ml-1.5">{t('testimoniumReport.metrics.reflectionsWritten')}</span>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
