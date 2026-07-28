import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useTenantPath } from '@/hooks/useTenantPath';
import { MainLayout } from '@/components/layout/MainLayout';
import { useMetrosWithComputed, useUpdateMetro, MetroWithComputed } from '@/hooks/useMetros';
import { useRegions } from '@/hooks/useRegions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowLeft, MapPin, TrendingUp, Users, Building2, Save, Globe,
  BookOpen, Loader2, Newspaper, Tags, Sprout,
} from 'lucide-react';
import { MetroExpansionPlanTab } from '@/components/metro/MetroExpansionPlanTab';
import { ActivationPanel } from '@/components/expansion/ActivationPanel';
import { cn } from '@/lib/utils';
import { MetroNarrativePanel } from '@/components/metro/MetroNarrativePanel';
import { MetroNewsSourcesTab } from '@/components/metro/MetroNewsSourcesTab';
import { MetroKeywordsTab } from '@/components/metro/MetroKeywordsTab';
import { MetroNewsPulseCard } from '@/components/metro/MetroNewsPulseCard';
import { HelpTooltip } from '@/components/ui/help-tooltip';

export default function MetroDetail() {
  const { t } = useTranslation('metros');
  const { metroId } = useParams<{ metroId: string }>();
  const navigate = useNavigate();
  const { tenantPath } = useTenantPath();
  const { data: metros, isLoading } = useMetrosWithComputed();
  const { data: regions } = useRegions();
  const updateMetro = useUpdateMetro();

  const metro = metros?.find(m => m.id === metroId) ?? null;

  const [formData, setFormData] = useState({
    region_id: null as string | null,
    referrals_per_month: 0,
    partner_inquiries_per_month: 0,
    waitlist_size: 0,
    distribution_partner_yn: false,
    storage_ready_yn: false,
    staff_coverage_1to5: 1,
    workforce_partners: 0,
    housing_refugee_partners: 0,
    schools_libraries: 0,
    recommendation: 'Hold' as 'Invest' | 'Build Anchors' | 'Hold' | 'Triage',
    notes: '',
    quarterly_target: 500,
  });

  useEffect(() => {
    if (metro) {
      setFormData({
        region_id: metro.region_id || null,
        referrals_per_month: metro.referrals_per_month || 0,
        partner_inquiries_per_month: metro.partner_inquiries_per_month || 0,
        waitlist_size: metro.waitlist_size || 0,
        distribution_partner_yn: metro.distribution_partner_yn || false,
        storage_ready_yn: metro.storage_ready_yn || false,
        staff_coverage_1to5: metro.staff_coverage_1to5 || 1,
        workforce_partners: metro.workforce_partners || 0,
        housing_refugee_partners: metro.housing_refugee_partners || 0,
        schools_libraries: metro.schools_libraries || 0,
        recommendation: metro.recommendation || 'Hold',
        notes: metro.notes || '',
        quarterly_target: (metro as any).quarterly_target ?? 500,
      });
    }
  }, [metro]);

  const handleSave = async () => {
    if (!metro) return;
    await updateMetro.mutateAsync({
      id: metro.id,
      _previousData: metro as unknown as Record<string, unknown>,
      ...formData,
    });
  };

  if (isLoading) {
    return (
      <MainLayout title={t('metroDetail.loading')} subtitle="">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!metro) {
    return (
      <MainLayout title={t('metroDetail.notFound')} subtitle="">
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('metroDetail.notFoundMessage')}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(tenantPath('/metros'))}>
            <ArrowLeft className="w-4 h-4 mr-2" /> {t('metroDetail.backToMetros')}
          </Button>
        </div>
      </MainLayout>
    );
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Expansion Ready': return 'bg-primary/10 text-primary border-primary/20';
      case 'Anchor Build': return 'bg-warning/10 text-warning border-warning/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-primary';
    if (score >= 50) return 'text-warning';
    return 'text-muted-foreground';
  };

  return (
    <MainLayout
      title={metro.metro}
      subtitle={t('metroDetail.subtitle')}
    >
      <div className="space-y-6">
        {/* Back + Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(tenantPath('/metros'))}>
            <ArrowLeft className="w-4 h-4 mr-1" /> {t('metros.title')}
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{metro.metro}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className={getStatusBadgeClass(metro.metroStatus)}>
                  {metro.metroStatus}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {t('metroDetail.readiness')}<strong className={getScoreColor(metro.metroReadinessIndex)}>{metro.metroReadinessIndex}</strong>
                </span>
              </div>
            </div>
          </div>
          <Button onClick={handleSave} disabled={updateMetro.isPending} size="sm">
            {updateMetro.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            {t('metroDetail.save')}
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">{t('metroDetail.tabs.details')}</TabsTrigger>
            <TabsTrigger value="operations">{t('metroDetail.tabs.operations')}</TabsTrigger>
            <TabsTrigger value="story" className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" /> {t('metroDetail.tabs.story')}
            </TabsTrigger>
            <TabsTrigger value="news" className="flex items-center gap-1">
              <Newspaper className="w-3 h-3" /> {t('metroDetail.tabs.newsSources')}
            </TabsTrigger>
            <TabsTrigger value="expansion" className="flex items-center gap-1">
              <Sprout className="w-3 h-3" /> {t('metroDetail.tabs.expansionPlan')}
            </TabsTrigger>
            <TabsTrigger value="activation" className="flex items-center gap-1">
              <Sprout className="w-3 h-3" /> {t('metroDetail.tabs.activation')}
            </TabsTrigger>
            <TabsTrigger value="keywords" className="flex items-center gap-1">
              <Tags className="w-3 h-3" /> {t('metroDetail.tabs.keywords')}
            </TabsTrigger>
            <TabsTrigger value="notes">{t('metroDetail.tabs.notes')}</TabsTrigger>
          </TabsList>

          {/* ─── Details ─── */}
          <TabsContent value="details" className="space-y-6 mt-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Globe className="w-4 h-4" /> {t('metroDetail.details.region')}</Label>
              <Select
                value={formData.region_id || 'unassigned'}
                onValueChange={(v) => setFormData(prev => ({ ...prev, region_id: v === 'unassigned' ? null : v }))}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder={t('metroDetail.details.regionUnassigned')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">{t('metroDetail.details.regionUnassigned')}</SelectItem>
                  {(regions || []).map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color || 'hsl(var(--muted-foreground))' }} />
                        {r.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-3 gap-4">
              {([
                { label: t('metroDetail.details.scores.anchorScore'), value: metro.anchorScore, icon: Users },
                { label: t('metroDetail.details.scores.demandScore'), value: metro.demandScore, icon: TrendingUp },
                { label: t('metroDetail.details.scores.opsScore'), value: metro.opsScore, icon: Building2 },
              ] as const).map(s => (
                <Card key={s.label}>
                  <CardContent className="pt-4 text-center">
                    <s.icon className="w-5 h-5 mx-auto mb-2 text-primary" />
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className={cn('text-2xl font-bold', getScoreColor(s.value))}>{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Demand Metrics */}
            <div className="space-y-4">
              <h4 className="font-medium">{t('metroDetail.details.demandMetrics')}</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t('metroDetail.details.referralsPerMonth')}</Label>
                  <Input type="number" value={formData.referrals_per_month} onChange={e => setFormData(p => ({ ...p, referrals_per_month: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('metroDetail.details.partnerInquiriesPerMonth')}</Label>
                  <Input type="number" value={formData.partner_inquiries_per_month} onChange={e => setFormData(p => ({ ...p, partner_inquiries_per_month: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('metroDetail.details.waitlistSize')}</Label>
                  <Input type="number" value={formData.waitlist_size} onChange={e => setFormData(p => ({ ...p, waitlist_size: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
            </div>

            {/* Partner Network */}
            <div className="space-y-4">
              <h4 className="font-medium">{t('metroDetail.details.partnerNetwork')}</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t('metroDetail.details.workforcePartners')}</Label>
                  <Input type="number" value={formData.workforce_partners} onChange={e => setFormData(p => ({ ...p, workforce_partners: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('metroDetail.details.housingRefugeePartners')}</Label>
                  <Input type="number" value={formData.housing_refugee_partners} onChange={e => setFormData(p => ({ ...p, housing_refugee_partners: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('metroDetail.details.schoolsLibraries')}</Label>
                  <Input type="number" value={formData.schools_libraries} onChange={e => setFormData(p => ({ ...p, schools_libraries: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
            </div>

            {/* Recommendation */}
            <div className="space-y-2">
              <Label>{t('metroDetail.details.recommendation')}</Label>
              <Select value={formData.recommendation} onValueChange={v => setFormData(p => ({ ...p, recommendation: v as typeof formData.recommendation }))}>
                <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Invest">{t('metroDetail.details.recommendations.invest')}</SelectItem>
                  <SelectItem value="Build Anchors">{t('metroDetail.details.recommendations.buildAnchors')}</SelectItem>
                  <SelectItem value="Hold">{t('metroDetail.details.recommendations.hold')}</SelectItem>
                  <SelectItem value="Triage">{t('metroDetail.details.recommendations.triage')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* ─── Operations ─── */}
          <TabsContent value="operations" className="space-y-6 mt-4">
            <div className="space-y-2">
              <Label>{t('metroDetail.operations.staffCoverage')}</Label>
              <Select value={formData.staff_coverage_1to5.toString()} onValueChange={v => setFormData(p => ({ ...p, staff_coverage_1to5: parseInt(v) }))}>
                <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t('metroDetail.operations.coverageOptions.1')}</SelectItem>
                  <SelectItem value="2">{t('metroDetail.operations.coverageOptions.2')}</SelectItem>
                  <SelectItem value="3">{t('metroDetail.operations.coverageOptions.3')}</SelectItem>
                  <SelectItem value="4">{t('metroDetail.operations.coverageOptions.4')}</SelectItem>
                  <SelectItem value="5">{t('metroDetail.operations.coverageOptions.5')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">{t('metroDetail.operations.operationalReadiness')}</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('metroDetail.operations.distributionPartner')}</Label>
                    <p className="text-sm text-muted-foreground">{t('metroDetail.operations.distributionPartnerDesc')}</p>
                  </div>
                  <Switch checked={formData.distribution_partner_yn} onCheckedChange={c => setFormData(p => ({ ...p, distribution_partner_yn: c }))} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('metroDetail.operations.storageReady')}</Label>
                    <p className="text-sm text-muted-foreground">{t('metroDetail.operations.storageReadyDesc')}</p>
                  </div>
                  <Switch checked={formData.storage_ready_yn} onCheckedChange={c => setFormData(p => ({ ...p, storage_ready_yn: c }))} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('metroDetail.operations.quarterlyTarget')}</Label>
              <Input type="number" value={formData.quarterly_target} onChange={e => setFormData(p => ({ ...p, quarterly_target: parseInt(e.target.value) || 0 }))} placeholder="500" className="max-w-xs" />
              <p className="text-xs text-muted-foreground">{t('metroDetail.operations.quarterlyTargetHint')}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg max-w-sm">
              <div>
                <p className="text-sm text-muted-foreground">{t('metroDetail.operations.activeAnchors')}</p>
                <p className="text-2xl font-bold text-primary">{metro.activeAnchors}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('metroDetail.operations.inPipeline')}</p>
                <p className="text-2xl font-bold">{metro.anchorsInPipeline}</p>
              </div>
            </div>
          </TabsContent>

          {/* ─── Story ─── */}
          <TabsContent value="story" className="mt-4">
            <MetroNarrativePanel metroId={metro.id} metroName={metro.metro} />
          </TabsContent>

          {/* ─── News Sources ─── */}
          <TabsContent value="news" className="mt-4 space-y-4">
            <MetroNewsPulseCard metroId={metro.id} showManualRun />
            <MetroNewsSourcesTab metroId={metro.id} metroName={metro.metro} />
          </TabsContent>

          {/* ─── Expansion Plan ─── */}
          <TabsContent value="expansion" className="mt-4">
            <MetroExpansionPlanTab metroId={metro.id} metroName={metro.metro} />
          </TabsContent>

          {/* ─── Activation ─── */}
          <TabsContent value="activation" className="mt-4">
            <ActivationPanel metroId={metro.id} metroName={metro.metro} />
          </TabsContent>

          {/* ─── Keywords ─── */}
          <TabsContent value="keywords" className="mt-4">
            <MetroKeywordsTab metroId={metro.id} metroName={metro.metro} />
          </TabsContent>

          {/* ─── Notes ─── */}
          <TabsContent value="notes" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>{t('metroDetail.notes.label')}</Label>
              <Textarea
                value={formData.notes}
                onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                placeholder={t('metroDetail.notes.placeholder')}
                className="min-h-[100px]"
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground text-right">{t('metroDetail.notes.charCount', { count: formData.notes.length })}</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
