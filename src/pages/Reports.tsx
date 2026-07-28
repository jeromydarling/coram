import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useReportData } from '@/hooks/useReportData';
import { useHumanImpactData } from '@/hooks/useHumanImpactData';
import { generatePDF, downloadPDF } from '@/lib/reportPdf';
import { 
  useReportTemplates, 
  useReportSchedules,
  useCreateTemplate,
  useCreateSchedule,
  useDeleteSchedule,
  useToggleSchedule,
} from '@/hooks/useReportTemplates';
import { ReportBuilder } from '@/components/reports/ReportBuilder';
import { ScheduleModal } from '@/components/reports/ScheduleModal';
import { ExecSummarySection } from '@/components/reports/ExecSummarySection';
import { CommunityImpactSection } from '@/components/reports/CommunityImpactSection';
import { JourneyGrowthSection } from '@/components/reports/JourneyGrowthSection';
import { SupportDeliveredSection } from '@/components/reports/SupportDeliveredSection';
import { MomentumSignalsSection } from '@/components/reports/MomentumSignalsSection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, 
  Download, 
  Building2, 
  Loader2,
  FileBarChart,
  Plus,
  Calendar,
  Mail,
  Clock,
  Trash2,
  Heart,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMetroIntelligence } from '@/hooks/useMetroIntelligence';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function Reports() {
  const { t } = useTranslation('reports');
  const navigate = useNavigate();
  const { profile, isAdmin, hasRole } = useAuth();
  const { enabled: metroEnabled } = useMetroIntelligence();
  const canSchedule = isAdmin || hasRole('staff');
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedMetro, setSelectedMetro] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const { activeTab, setActiveTab } = useTabPersistence('impact');

  const { data: templates, isLoading: templatesLoading } = useReportTemplates();
  const { data: schedules } = useReportSchedules();
  const createTemplate = useCreateTemplate();
  const createSchedule = useCreateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const toggleSchedule = useToggleSchedule();

  const selectedTemplate = templates?.find(t => t.id === selectedTemplateId) || templates?.[0];
  const reportType = (selectedTemplate?.report_type || 'executive') as 'executive' | 'regional' | 'forecast';

  // Human Impact data (for the main Impact tab)
  const { isLoading: impactLoading, report: impactReport, regions, metros } = useHumanImpactData({
    regionId: selectedRegion !== 'all' ? selectedRegion : undefined,
    metroId: selectedMetro !== 'all' ? selectedMetro : undefined,
  });

  // Legacy report data (for PDF export on the Export tab)
  const { isLoading: legacyLoading, reportData } = useReportData({
    regionId: selectedRegion !== 'all' ? selectedRegion : undefined,
    metroId: selectedMetro !== 'all' ? selectedMetro : undefined,
    reportType,
  });

  const filteredMetros = selectedRegion !== 'all'
    ? metros?.filter(m => m.region_id === selectedRegion)
    : metros;

  const handleGenerateReport = async () => {
    if (!reportData) return;
    setIsGenerating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const doc = generatePDF({
        ...reportData,
        generatedBy: profile?.display_name || 'System',
        generatedAt: new Date(),
      });
      const filename = `${reportType}-report-${new Date().toISOString().split('T')[0]}.pdf`;
      downloadPDF(doc, filename);
    } finally {
      setIsGenerating(false);
    }
  };

  if (showBuilder) {
    return (
      <MainLayout title={t('reports.builder.title')} subtitle={t('reports.builder.subtitle')} data-testid="reports-root">
        <ReportBuilder
          onSave={(template) => {
            createTemplate.mutate(template);
            setShowBuilder(false);
          }}
          onCancel={() => setShowBuilder(false)}
        />
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title={t('reports.title')}
      subtitle={t('reports.subtitle')}
      data-testid="reports-root"
      helpKey="page.reports"
      headerActions={
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <HelpCircle className="w-3.5 h-3.5" />
                {t('reports.whatYoureSeeing')}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              <p>{t('reports.whatYoureSeingTooltip')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="space-y-3">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="w-max">
              <TabsTrigger value="impact" className="gap-1.5">
                <Heart className="w-3.5 h-3.5" />
                {t('reports.tabs.impactView')}
              </TabsTrigger>
              <TabsTrigger value="export" className="gap-1.5">
                <Download className="w-3.5 h-3.5" />
                {t('reports.tabs.exportPdf')}
              </TabsTrigger>
              <TabsTrigger value="templates">{t('reports.tabs.templates')}</TabsTrigger>
              {canSchedule && <TabsTrigger value="schedules">{t('reports.tabs.scheduled')}</TabsTrigger>}
            </TabsList>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const params = new URLSearchParams();
                if (selectedRegion !== 'all') params.set('region', selectedRegion);
                if (selectedMetro !== 'all') params.set('metro', selectedMetro);
                navigate(`/reports/impact-export${params.toString() ? `?${params}` : ''}`);
              }}
            >
              <FileText className="w-4 h-4" />
              {t('reports.actions.exportImpactReport')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate('/reports/those-who-gave')}
            >
              {t('reports.actions.thoseWhoGave')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                import('@/lib/reports/integrationAuditPdf').then(m => m.generateIntegrationAuditPdf());
              }}
            >
              <FileBarChart className="w-4 h-4" />
              {t('reports.actions.integrationAudit')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowBuilder(true)}>
              <Plus className="w-4 h-4 mr-1" />
              {t('reports.actions.newTemplate')}
            </Button>
            {canSchedule && (
              <Button variant="outline" size="sm" onClick={() => setShowScheduleModal(true)}>
                <Calendar className="w-4 h-4 mr-1" />
                {t('reports.actions.schedule')}
              </Button>
            )}
          </div>
        </div>

        {/* Scope filter — only shown when metros are enabled */}
        {(activeTab === 'impact' || activeTab === 'export') && metroEnabled && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                {t('reports.scope.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Select 
                    value={selectedRegion} 
                    onValueChange={(value) => {
                      setSelectedRegion(value);
                      setSelectedMetro('all');
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder={t('reports.scope.allRegions')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('reports.scope.allRegions')}</SelectItem>
                      {regions?.map(region => (
                        <SelectItem key={region.id} value={region.id}>
                          {region.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Select value={selectedMetro} onValueChange={setSelectedMetro}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder={t('reports.scope.allMetros')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('reports.scope.allMetros')}</SelectItem>
                      {filteredMetros?.map(metro => (
                        <SelectItem key={metro.id} value={metro.id}>
                          {metro.metro}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══ IMPACT VIEW ═══ */}
        <TabsContent value="impact" className="space-y-4">
          {impactLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-48 w-full rounded-lg" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-40 rounded-lg" />
                <Skeleton className="h-40 rounded-lg" />
              </div>
              <Skeleton className="h-36 w-full rounded-lg" />
            </div>
          ) : impactReport ? (
            <div className="space-y-4">
              <ExecSummarySection data={impactReport.execSummary} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CommunityImpactSection data={impactReport.communityImpact} />
                <JourneyGrowthSection data={impactReport.journeyGrowth} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SupportDeliveredSection data={impactReport.supportDelivered} />
                <MomentumSignalsSection data={impactReport.momentumSignals} />
              </div>
            </div>
          ) : null}
        </TabsContent>

        {/* ═══ EXPORT PDF (legacy report preview) ═══ */}
        <TabsContent value="export" className="space-y-6">
          {/* Template Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates?.filter(t => t.is_default).map((template) => (
              <Card
                key={template.id}
                className={cn(
                  'cursor-pointer transition-all duration-200 hover:shadow-md',
                  selectedTemplateId === template.id && 'ring-2 ring-primary'
                )}
                onClick={() => setSelectedTemplateId(template.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileBarChart className="w-5 h-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{template.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Preview & Generate */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  {t('reports.preview.title')}
                </CardTitle>
                <Button
                  size="lg"
                  className="gap-2"
                  onClick={handleGenerateReport}
                  disabled={legacyLoading || isGenerating || !reportData}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('reports.preview.generating')}
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      {t('reports.preview.downloadPdf')}
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {legacyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : reportData ? (
                <div className="space-y-6">
                  <div className="bg-muted/50 rounded-lg p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-foreground">{reportData.title}</h2>
                        <p className="text-muted-foreground">{reportData.subtitle}</p>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <p>{t('reports.preview.generatedLabel')} {new Date().toLocaleDateString()}</p>
                        <p>{t('reports.preview.byLabel')} {profile?.display_name || 'System'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {reportData.sections.map((section, idx) => (
                      <div key={idx} className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <h3 className="font-semibold">{section.title}</h3>
                          <Badge variant="secondary" className="text-xs">{section.type}</Badge>
                        </div>

                        {section.type === 'kpi' && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {(section.data as { label: string; value: string | number }[]).map((kpi, i) => (
                              <div key={i} className="bg-muted/30 rounded p-3">
                                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                                <p className="text-lg font-bold">{kpi.value}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {section.type === 'table' && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  {(section.data as { headers: string[] }).headers.map((h, i) => (
                                    <th key={i} className="text-left py-2 px-3 font-medium">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(section.data as { rows: (string | number)[][] }).rows.slice(0, 5).map((row, i) => (
                                  <tr key={i} className="border-b border-border/50">
                                    {row.map((cell, j) => (
                                      <td key={j} className="py-2 px-3">{cell}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {section.type === 'highlight' && (
                          <div className="space-y-2">
                            {(section.data as { title: string; description: string; metric?: string }[]).map((h, i) => (
                              <div key={i} className="flex items-center justify-between bg-primary/5 border-l-2 border-primary rounded p-3">
                                <div>
                                  <p className="font-medium text-sm">{h.title}</p>
                                  <p className="text-xs text-muted-foreground">{h.description}</p>
                                </div>
                                {h.metric && <Badge variant="secondary">{h.metric}</Badge>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TEMPLATES ═══ */}
        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates?.map(template => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    {template.is_default && <Badge>{t('reports.templates.defaultBadge')}</Badge>}
                  </div>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {template.sections.length} sections
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ═══ SCHEDULES ═══ */}
        {canSchedule && (
          <TabsContent value="schedules" className="space-y-4">
            {schedules?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Mail className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">{t('reports.schedules.noSchedules')}</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">{t('reports.schedules.noSchedulesSubtitle')}</p>
                  <Button className="mt-4" onClick={() => setShowScheduleModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('reports.schedules.createSchedule')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {schedules?.map(schedule => (
                  <Card key={schedule.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Switch
                            checked={schedule.is_active}
                            onCheckedChange={(checked) => 
                              toggleSchedule.mutate({ id: schedule.id, is_active: checked })
                            }
                          />
                          <div>
                            <p className="font-medium">{schedule.name}</p>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {schedule.frequency} at {schedule.time_of_day.slice(0, 5)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {t('reports.schedules.recipientsCount', { count: schedule.recipients.length })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteSchedule.mutate(schedule.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      <ScheduleModal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        templates={templates || []}
        onSave={(schedule) => {
          createSchedule.mutate(schedule);
          setShowScheduleModal(false);
        }}
        isLoading={createSchedule.isPending}
      />
    </MainLayout>
  );
}
