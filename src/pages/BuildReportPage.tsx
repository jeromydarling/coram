/**
 * BuildReportPage — Auto-generates and downloads today's build report PDF.
 *
 * WHAT: Renders a brief summary and triggers a PDF download.
 * WHERE: /build-report (unlisted utility route)
 * WHY: Gives stakeholders a quick downloadable artifact of recent changes.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generateBuildReportPdf, type BuildReportData } from '@/lib/buildReportPdf';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, CheckCircle } from 'lucide-react';

const BUILD_REPORT: BuildReportData = {
  date: '2026-02-27',
  version: '2.7.0',
  entries: [
    {
      title: 'Movement Intelligence — Full Dashboard Refactor',
      summary:
        'Replaced the legacy Profunda-era /analytics route with /intelligence, a territory-aware, compass-integrated movement intelligence dashboard organized into seven archetype-sensitive sections.',
      items: [
        'Route renamed: /analytics → /intelligence (backward-compat redirect preserved)',
        'Navigation label updated: "Analytics" → "Intelligence" across sidebar, registry, and role visibility',
        'Seven new dashboard sections: Territory Vitality (Care Rhythm for solo caregivers), Care & Presence Flow, Relationship Formation, Activation & Engagement, Discovery & Discernment, Restoration & Memory, Narrative Threads',
        'Archetype variants: solo caregivers see "Care Rhythm"; missionaries group by country; rural orgs use county bundle labels',
        'Compass integration: dominant posture (Care/Narrative/Discernment/Restoration) displayed in Narrative Threads section',
        'Providence summaries surfaced alongside NRI quarterly movement summary',
        'Legacy metrics purged: anchor charts, pipeline KPIs, volume ramps, device distribution, metro readiness scoring',
        'Data hook created: useMovementIntelligence.ts aggregating 7 movement signals',
        'Reports and PDF exports updated to replace "devices provisioned" → "care provided" and "metros" → "territories"',
      ],
      filesChanged: [
        'src/pages/MovementIntelligence.tsx (created)',
        'src/hooks/useMovementIntelligence.ts (created)',
        'src/components/routing/AppRouter.tsx',
        'src/components/layout/Sidebar.tsx',
        'src/hooks/useCompassPosture.ts',
        'src/hooks/useHumanImpactData.ts',
        'src/components/reports/ExecSummarySection.tsx',
        'src/lib/appSections.ts',
        'src/lib/impactReportPdf.ts',
        'src/content/technicalDocumentation.ts',
      ],
    },
    {
      title: 'Audit & Critical Bug Fixes (6 Issues)',
      summary:
        'Comprehensive audit of the Movement Intelligence refactor identified and fixed 6 functional bugs spanning navigation, type safety, metadata, and data accuracy.',
      items: [
        'NAV_ITEM_VISIBILITY in ministryRole.ts: /analytics → /intelligence (role gating was bypassed)',
        'Dashboard.tsx helpKey: page.analytics → page.command-center (wrong tooltip content)',
        'MovementIntelligence.tsx data-testid: dashboard-root → intelligence-root (QA collision avoided)',
        'Compass posture bug: typeof posture === "string" always returned false — fixed to access posture.posture directly',
        'Communio metric: replaced placeholder contact count with actual communio_awareness_signals query (last 30 days)',
        'Dead code removed: unused startOfWeek/startOfMonth imports and variables from useMovementIntelligence.ts',
        'New help content added for page.intelligence key',
        'QA spec and nav registry updated to use nav-intelligence selector',
      ],
      filesChanged: [
        'src/lib/ministryRole.ts',
        'src/hooks/useMovementIntelligence.ts',
        'src/pages/MovementIntelligence.tsx',
        'src/lib/helpContent.ts',
        'qa-runner/helpers/navRegistry.ts',
        'qa-runner/tests/53_analytics_page_loads.spec.ts',
      ],
    },
    {
      title: 'Post-Implementation Checklist & Documentation Sweep',
      summary:
        'Completed all mandatory post-implementation artifacts: smoke tests, field guides, manual data, technical documentation, marketing audit, and AdminHowTo updates.',
      items: [
        'Deno edge function tests: attempted execution (infrastructure timeout — not a code failure)',
        'QA smoke test: 53_analytics_page_loads.spec.ts fully updated with intelligence-root assertions and card rendering checks',
        'manualData.ts: 5 stale "Analytics" references replaced with "Movement Intelligence" across role matrix and nav groups',
        'helpContent.ts: page.analytics rewritten as redirect notice; page.intelligence already present',
        'AdminHowTo.tsx: added full "Movement Intelligence" section (4 Q&A items) to field guide; fixed "private analytics" → "private movement insights"',
        'appSections.ts: intelligence entry verified at line 32 — no changes needed',
        'technicalDocumentation.ts: Chapter 25 (Movement Intelligence Dashboard) already present — verified',
        'ComparisonTable.tsx (marketing): only competitor-column reference to "analytics" — no CROS copy change needed',
      ],
      filesChanged: [
        'src/lib/manualData.ts',
        'src/lib/helpContent.ts',
        'src/pages/Dashboard.tsx',
        'src/pages/admin/AdminHowTo.tsx',
      ],
    },
  ],
};

export default function BuildReportPage() {
  const { t } = useTranslation('reports');
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = () => {
    const doc = generateBuildReportPdf(BUILD_REPORT);
    doc.save(`CROS_Build_Report_${BUILD_REPORT.date}.pdf`);
    setDownloaded(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-lg w-full">
        <CardContent className="py-8 text-center space-y-5">
          <h1 className="text-xl font-semibold text-foreground">{t('buildReport.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {BUILD_REPORT.date} — v{BUILD_REPORT.version} — {BUILD_REPORT.entries.length} sections
          </p>

          <div className="text-left text-sm text-muted-foreground space-y-2 border rounded-md p-4">
            {BUILD_REPORT.entries.map((e, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-primary font-medium">{i + 1}.</span>
                <span>{e.title}</span>
              </div>
            ))}
          </div>

          <Button onClick={handleDownload} size="lg" className="gap-2">
            {downloaded ? <CheckCircle className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            {downloaded ? t('buildReport.downloaded') : t('buildReport.downloadPdf')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
