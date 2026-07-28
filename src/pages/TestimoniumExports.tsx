/**
 * TestimoniumExports — Witnessed Stories export page.
 *
 * WHAT: Build + preview + download narrative exports from Testimonium signals.
 * WHERE: /:tenantSlug/testimonium/export
 * WHY: Leadership gets board-ready narrative briefs without writing reports.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, FileText, Sparkles, BookOpen, Eye } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { format, subMonths, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from 'date-fns';
import { cn } from '@/lib/utils';
import { buildTestimoniumPDF } from '@/lib/buildTestimoniumPDF';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

function SectionTooltip({ what, where, why, whatLabel = 'What:', whereLabel = 'Where:', whyLabel = 'Why:' }: { what: string; where: string; why: string; whatLabel?: string; whereLabel?: string; whyLabel?: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-4 w-4 text-muted-foreground inline ml-1 cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
          <p><strong>{whatLabel}</strong> {what}</p>
          <p><strong>{whereLabel}</strong> {where}</p>
          <p><strong>{whyLabel}</strong> {why}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function TestimoniumExports() {
  const { t } = useTranslation('reports');
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  const [exportType, setExportType] = useState<string>('quarterly');
  const [startDate, setStartDate] = useState<Date | undefined>(startOfQuarter(subMonths(new Date(), 3)));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfQuarter(subMonths(new Date(), 3)));
  const [previewData, setPreviewData] = useState<any>(null);

  // Fetch existing exports
  const { data: exports, isLoading } = useQuery({
    queryKey: ['testimonium-exports', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('testimonium_exports')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Build export mutation
  const buildMutation = useMutation({
    mutationFn: async () => {
      if (!startDate || !endDate || !tenantId) throw new Error('Missing fields');
      const { data, error } = await supabase.functions.invoke('testimonium-export-build', {
        body: {
          tenant_id: tenantId,
          period_start: format(startDate, 'yyyy-MM-dd'),
          period_end: format(endDate, 'yyyy-MM-dd'),
          export_type: exportType,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Build failed');
      return data;
    },
    onSuccess: () => {
      toast.success(t('testimoniumExports.toasts.generated'));
      queryClient.invalidateQueries({ queryKey: ['testimonium-exports', tenantId] });
    },
    onError: (e: any) => toast.error(e.message || t('testimoniumExports.toasts.buildFailed')),
  });

  // Preview / render
  const handlePreview = async (exportId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('testimonium-export-render', {
        body: { export_id: exportId },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error);
      setPreviewData(data);
    } catch (e: any) {
      toast.error(e.message || t('testimoniumExports.toasts.previewFailed'));
    }
  };

  // PDF download
  const handleDownloadPDF = () => {
    if (!previewData) return;
    const doc = buildTestimoniumPDF(previewData);
    doc.save(`witnessed-stories-${previewData.subtitle?.replace(/\s/g, '-')}.pdf`);
    toast.success(t('testimoniumExports.toasts.pdfDownloaded'));
  };

  // Type change auto-adjusts dates
  const handleTypeChange = (val: string) => {
    setExportType(val);
    const now = new Date();
    if (val === 'monthly') {
      setStartDate(startOfMonth(subMonths(now, 1)));
      setEndDate(endOfMonth(subMonths(now, 1)));
    } else if (val === 'quarterly') {
      setStartDate(startOfQuarter(subMonths(now, 3)));
      setEndDate(endOfQuarter(subMonths(now, 3)));
    }
  };

  return (
    <MainLayout
      title={t('testimoniumExports.title')}
      subtitle={t('testimoniumExports.subtitle')}
    >
      <div className="space-y-8 pb-12 max-w-4xl mx-auto">
        {/* Builder Panel */}
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base font-serif flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {t('testimoniumExports.builder.sectionTitle')}
              <SectionTooltip
                what={t('testimoniumExports.builder.tooltipWhat')}
                where={t('testimoniumExports.builder.tooltipWhere')}
                why={t('testimoniumExports.builder.tooltipWhy')}
              />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 items-end">
              {/* Export type */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">{t('testimoniumExports.builder.periodLabel')}</label>
                <Select value={exportType} onValueChange={handleTypeChange}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{t('testimoniumExports.builder.monthly')}</SelectItem>
                    <SelectItem value="quarterly">{t('testimoniumExports.builder.quarterly')}</SelectItem>
                    <SelectItem value="custom">{t('testimoniumExports.builder.custom')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Start date */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">{t('testimoniumExports.builder.fromLabel')}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {startDate ? format(startDate, 'MMM d, yyyy') : t('testimoniumExports.builder.startPlaceholder')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End date */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">{t('testimoniumExports.builder.toLabel')}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {endDate ? format(endDate, 'MMM d, yyyy') : t('testimoniumExports.builder.endPlaceholder')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>

              <Button
                onClick={() => buildMutation.mutate()}
                disabled={buildMutation.isPending || !startDate || !endDate}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {buildMutation.isPending ? t('testimoniumExports.builder.buildingButton') : t('testimoniumExports.builder.generateButton')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Export Timeline */}
        <section>
          <h2 className="text-lg font-serif font-semibold text-foreground mb-3">
            {t('testimoniumExports.previousReports.title')}
            <SectionTooltip
              what={t('testimoniumExports.previousReports.tooltipWhat')}
              where={t('testimoniumExports.previousReports.tooltipWhere')}
              why={t('testimoniumExports.previousReports.tooltipWhy')}
            />
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : exports && exports.length > 0 ? (
            <div className="space-y-3">
              {exports.map((ex: any) => (
                <Card key={ex.id} className="rounded-xl">
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="min-w-0">
                      <p className="text-sm font-serif font-medium text-foreground">
                        {ex.period_start} — {ex.period_end}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">{ex.export_type}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(ex.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => handlePreview(ex.id)}>
                        <Eye className="h-4 w-4 mr-1" /> {t('testimoniumExports.previousReports.previewButton')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-xl">
              <CardContent className="py-10 text-center">
                <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground font-serif italic">
                  {t('testimoniumExports.previousReports.empty')}
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Preview Panel */}
        {previewData && (
          <>
            <Separator />
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  {t('testimoniumExports.preview.title')}
                </h2>
                <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                  <Download className="h-4 w-4 mr-2" /> {t('testimoniumExports.preview.downloadPdf')}
                </Button>
              </div>
              <Card className="rounded-xl bg-muted/20">
                <CardContent className="py-8 px-6 space-y-8">
                  {/* Header */}
                  <div className="space-y-2 border-b border-border/40 pb-6">
                    <h1 className="text-2xl font-serif font-medium text-foreground">{previewData.title}</h1>
                    <p className="text-sm text-muted-foreground">{previewData.subtitle}</p>
                    <Badge variant="secondary" className="text-xs">{previewData.export_type} {t('testimoniumExports.preview.briefSuffix')}</Badge>
                  </div>

                  {/* Sections */}
                  {previewData.sections?.map((section: any, i: number) => (
                    <div key={section.key || i} className="space-y-3">
                      <h3 className="text-base font-serif font-medium text-foreground">
                        {section.title}
                      </h3>
                      {section.body?.narrative && (
                        <p className="text-sm text-muted-foreground font-serif leading-relaxed">
                          {section.body.narrative}
                        </p>
                      )}
                      {section.body?.highlights?.length > 0 && (
                        <ul className="space-y-1.5 pl-4">
                          {section.body.highlights.map((h: string, j: number) => (
                            <li key={j} className="text-sm text-foreground font-serif">
                              • {h}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}

                  {/* Metrics footer */}
                  {previewData.metrics && (
                    <div className="pt-6 border-t border-border/40 flex flex-wrap gap-6 text-sm text-muted-foreground">
                      <div>
                        <span className="text-xl font-serif font-medium text-foreground">
                          {previewData.metrics.total_moments ?? 0}
                        </span>
                        <span className="ml-1.5">{t('testimoniumExports.metrics.momentsWitnessed')}</span>
                      </div>
                      <div>
                        <span className="text-xl font-serif font-medium text-foreground">
                          {previewData.metrics.event_count ?? 0}
                        </span>
                        <span className="ml-1.5">{t('testimoniumExports.metrics.eventsAttended')}</span>
                      </div>
                      <div>
                        <span className="text-xl font-serif font-medium text-foreground">
                          {previewData.metrics.growth_count ?? 0}
                        </span>
                        <span className="ml-1.5">{t('testimoniumExports.metrics.growthSignals')}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </div>
    </MainLayout>
  );
}
