import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useHumanImpactData } from '@/hooks/useHumanImpactData';
import { generateImpactPDF } from '@/lib/impactReportPdf';
import { downloadPDF } from '@/lib/reportPdf';
import { ExecSummarySection } from '@/components/reports/ExecSummarySection';
import { CommunityImpactSection } from '@/components/reports/CommunityImpactSection';
import { JourneyGrowthSection } from '@/components/reports/JourneyGrowthSection';
import { SupportDeliveredSection } from '@/components/reports/SupportDeliveredSection';
import { MomentumSignalsSection } from '@/components/reports/MomentumSignalsSection';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Download, Loader2, Printer } from 'lucide-react';

export default function ImpactExport() {
  const { t } = useTranslation('reports');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();

  const initialRegion = searchParams.get('region') || 'all';
  const initialMetro = searchParams.get('metro') || 'all';

  const [selectedRegion, setSelectedRegion] = useState(initialRegion);
  const [selectedMetro, setSelectedMetro] = useState(initialMetro);
  const [isGenerating, setIsGenerating] = useState(false);

  const { isLoading, report, regions, metros } = useHumanImpactData({
    regionId: selectedRegion !== 'all' ? selectedRegion : undefined,
    metroId: selectedMetro !== 'all' ? selectedMetro : undefined,
  });

  const filteredMetros = selectedRegion !== 'all'
    ? metros?.filter(m => m.region_id === selectedRegion)
    : metros;

  const metroName = selectedMetro !== 'all'
    ? metros?.find(m => m.id === selectedMetro)?.metro
    : undefined;
  const regionName = selectedRegion !== 'all'
    ? regions?.find(r => r.id === selectedRegion)?.name
    : undefined;

  const scopeLabel = metroName || regionName || 'All Regions';

  const handleDownloadPDF = async () => {
    if (!report) return;
    setIsGenerating(true);
    try {
      await new Promise(r => setTimeout(r, 300));
      const doc = generateImpactPDF({
        report,
        metroName,
        regionName,
        generatedBy: profile?.display_name || 'System',
        dateRange: `As of ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      });
      const filename = `impact-report-${scopeLabel.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
      downloadPDF(doc, filename);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-background">
      {/* Toolbar — hidden when printing */}
      <div className="print:hidden sticky top-0 z-30 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              {t('impactExport.backToReports')}
            </Button>
            <div className="h-5 w-px bg-border" />
            <Select
              value={selectedRegion}
              onValueChange={(v) => { setSelectedRegion(v); setSelectedMetro('all'); }}
            >
              <SelectTrigger className="h-8 text-xs w-[140px]">
                <SelectValue placeholder={t('impactExport.allRegions')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('impactExport.allRegions')}</SelectItem>
                {regions?.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedMetro} onValueChange={setSelectedMetro}>
              <SelectTrigger className="h-8 text-xs w-[140px]">
                <SelectValue placeholder={t('impactExport.allMetros')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('impactExport.allMetros')}</SelectItem>
                {filteredMetros?.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.metro}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" />
              {t('impactExport.print')}
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadPDF}
              disabled={isLoading || isGenerating || !report}
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" />{t('impactExport.generating')}</>
              ) : (
                <><Download className="w-4 h-4 mr-1" />{t('impactExport.downloadPdf')}</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 print:py-0 print:px-0 space-y-8">
        {/* Cover header */}
        <div className="bg-[hsl(var(--foreground))] text-[hsl(var(--primary-foreground))] rounded-xl print:rounded-none p-8 sm:p-12">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {t('impactExport.coverTitle')}
          </h1>
          <p className="text-lg mt-2 opacity-80">{scopeLabel}</p>
          <p className="text-sm mt-1 opacity-60">
            {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            {' • '}{t('impactExport.preparedBy')} {profile?.display_name || 'System'}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        ) : report ? (
          <div className="space-y-6 print:space-y-4">
            <ExecSummarySection data={report.execSummary} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
              <SupportDeliveredSection data={report.supportDelivered} />
              <CommunityImpactSection data={report.communityImpact} />
            </div>

            <JourneyGrowthSection data={report.journeyGrowth} />
            <MomentumSignalsSection data={report.momentumSignals} />

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground pt-8 border-t print:pt-4">
              {t('impactExport.confidential')} • {t('impactExport.generated')} {new Date().toLocaleDateString()}
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <p>{t('impactExport.noData')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
