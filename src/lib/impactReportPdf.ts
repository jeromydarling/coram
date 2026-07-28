import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { HumanImpactReport } from '@/hooks/useHumanImpactData';

// Print-friendly muted palette (RGB)
const C = {
  dark: [42, 50, 38],     // Forest dark
  text: [60, 65, 55],     // Body text
  muted: [120, 125, 115], // Captions
  light: [245, 243, 238], // Card backgrounds
  accent: [68, 115, 82],  // Primary green
  warm: [180, 155, 120],  // Warm stone accent
  white: [255, 255, 255],
} as const;

interface ImpactPdfOptions {
  report: HumanImpactReport;
  metroName?: string;
  regionName?: string;
  generatedBy: string;
  dateRange?: string;
}

export function generateImpactPDF(opts: ImpactPdfOptions): jsPDF {
  const { report, metroName, regionName, generatedBy, dateRange } = opts;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 22; // margin
  let y = 0;

  const addPage = () => { doc.addPage(); y = m; };
  const check = (h: number) => { if (y + h > ph - m) addPage(); };

  // ─── COVER PAGE ───
  doc.setFillColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.rect(0, 0, pw, ph, 'F');

  // Title block
  doc.setTextColor(C.white[0], C.white[1], C.white[2]);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('The Story of Our Impact', m, 70);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  const subtitle = [metroName, regionName].filter(Boolean).join(' — ') || 'All Regions';
  doc.text(subtitle, m, 85);

  if (dateRange) {
    doc.setFontSize(12);
    doc.text(dateRange, m, 95);
  }

  // Cover KPIs
  const coverMetrics = [
    { label: 'Active Partners', value: String(report.execSummary.partnersActive) },
    { label: 'Care Provided', value: report.execSummary.careProvided.toLocaleString() },
    { label: 'Events Attended', value: String(report.execSummary.eventsAttended) },
    { label: 'New Relationships', value: String(report.execSummary.newRelationships) },
  ];

  const cardW = (pw - m * 2 - 15) / 4;
  y = 130;
  coverMetrics.forEach((metric, i) => {
    const x = m + i * (cardW + 5);
    doc.setFillColor(255, 255, 255);
    doc.setGState(doc.GState({ opacity: 0.12 }));
    doc.roundedRect(x, y, cardW, 35, 3, 3, 'F');
    doc.setGState(doc.GState({ opacity: 1 }));

    doc.setTextColor(C.white[0], C.white[1], C.white[2]);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(metric.value, x + cardW / 2, y + 16, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(metric.label, x + cardW / 2, y + 26, { align: 'center' });
  });

  // Momentum trend
  const trendLabel =
    report.execSummary.momentumTrend === 'rising' ? '↑ Momentum building' :
    report.execSummary.momentumTrend === 'declining' ? '→ Quieter period' :
    '→ Holding steady';
  doc.setFontSize(11);
  doc.text(trendLabel, m, y + 50);

  // Footer on cover
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text(`Prepared by ${generatedBy} • ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, m, ph - 20);
  doc.text('PCs for People — Confidential', m, ph - 14);

  // ─── PAGE 2: EXECUTIVE SUMMARY ───
  addPage();

  const sectionTitle = (title: string) => {
    check(20);
    doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(title, m, y);
    y += 3;
    doc.setDrawColor(C.accent[0], C.accent[1], C.accent[2]);
    doc.setLineWidth(0.8);
    doc.line(m, y, m + 40, y);
    y += 10;
  };

  sectionTitle('Executive Summary');

  doc.setTextColor(C.text[0], C.text[1], C.text[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const narrative = doc.splitTextToSize(report.execSummary.narrativeSummary, pw - m * 2);
  doc.text(narrative, m, y);
  y += narrative.length * 6 + 8;

  // ─── SECTION: WHAT WE MADE POSSIBLE ───
  sectionTitle('What We Made Possible');

  const supportData = report.supportDelivered;
  const supportMetrics = [
    ['Care Provided', supportData.totalUnits.toLocaleString()],
    ['Provisions', String(supportData.totalProvisions)],
    ['Avg per Partner', String(supportData.avgUnitsPerPartner)],
  ];

  supportMetrics.forEach(([label, value]) => {
    doc.setFillColor(C.light[0], C.light[1], C.light[2]);
    doc.roundedRect(m, y, pw - m * 2, 14, 2, 2, 'F');

    doc.setTextColor(C.text[0], C.text[1], C.text[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(label, m + 6, y + 9);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(value, pw - m - 6, y + 9, { align: 'right' });
    y += 17;
  });

  // Status breakdown
  if (Object.keys(supportData.byStatus).length > 0) {
    y += 4;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
    const statusText = Object.entries(supportData.byStatus)
      .map(([s, c]) => `${s}: ${c}`)
      .join('  •  ');
    doc.text(statusText, m, y);
    y += 10;
  }

  // ─── SECTION: COMMUNITY STORY ───
  check(50);
  sectionTitle('Community Story');

  const ci = report.communityImpact;

  // Counts row
  const ciMetrics = [
    { label: 'Events Participated', value: ci.eventsParticipated },
    { label: 'Community Signals', value: ci.localPulseCount },
    { label: 'Themes Emerging', value: ci.signalCount },
  ];
  const ciW = (pw - m * 2 - 10) / 3;
  ciMetrics.forEach((met, i) => {
    const x = m + i * (ciW + 5);
    doc.setFillColor(C.light[0], C.light[1], C.light[2]);
    doc.roundedRect(x, y, ciW, 20, 2, 2, 'F');

    doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(String(met.value), x + ciW / 2, y + 10, { align: 'center' });

    doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(met.label, x + ciW / 2, y + 17, { align: 'center' });
  });
  y += 26;

  // Themes
  if (ci.themes.length > 0) {
    doc.setTextColor(C.text[0], C.text[1], C.text[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Key themes: ' + ci.themes.slice(0, 5).join(', '), m, y);
    y += 8;
  }

  // Headlines
  if (ci.narrativeSnippets.length > 0) {
    ci.narrativeSnippets.slice(0, 3).forEach(snippet => {
      check(10);
      doc.setFillColor(C.accent[0], C.accent[1], C.accent[2]);
      doc.rect(m, y, 2, 8, 'F');
      doc.setTextColor(C.text[0], C.text[1], C.text[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(snippet, pw - m * 2 - 10);
      doc.text(lines, m + 6, y + 5);
      y += lines.length * 5 + 4;
    });
  }

  y += 6;

  // ─── SECTION: RELATIONSHIP JOURNEY ───
  check(60);
  sectionTitle('Where Relationships Are Growing');

  const jg = report.journeyGrowth;
  const barMaxW = pw - m * 2 - 50;
  const maxCount = Math.max(...jg.chapters.map(c => c.count), 1);

  jg.chapters.forEach(({ chapter, count, color }) => {
    check(12);
    doc.setTextColor(C.text[0], C.text[1], C.text[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(chapter, m, y + 5);

    const barW = Math.max((count / maxCount) * barMaxW, count > 0 ? 8 : 0);

    // Parse HSL color to approximate RGB
    const rgb = hslStringToRgb(color);
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.roundedRect(m + 48, y, barW, 7, 1, 1, 'F');

    if (count > 0) {
      doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(String(count), m + 48 + barW + 3, y + 5);
    }
    y += 10;
  });

  y += 6;

  // ─── SECTION: MOMENTUM & SIGNALS ───
  check(50);
  sectionTitle('Momentum & Signals');

  const ms = report.momentumSignals;
  // Summary row
  const msMetrics = [
    { label: 'Rising', value: ms.risingCount },
    { label: 'Steady', value: ms.stableCount },
    { label: 'Quieter', value: ms.fallingCount },
  ];
  const msW = (pw - m * 2 - 10) / 3;
  msMetrics.forEach((met, i) => {
    const x = m + i * (msW + 5);
    doc.setFillColor(C.light[0], C.light[1], C.light[2]);
    doc.roundedRect(x, y, msW, 18, 2, 2, 'F');

    doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(String(met.value), x + msW / 2, y + 10, { align: 'center' });

    doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(met.label, x + msW / 2, y + 16, { align: 'center' });
  });
  y += 24;

  // Top signals table
  if (ms.topSignals.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Organization', 'Trend', 'Score']],
      body: ms.topSignals.map(s => [s.orgName, s.trend, String(s.score)]),
      margin: { left: m, right: m },
      headStyles: {
        fillColor: [C.dark[0], C.dark[1], C.dark[2]],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [C.text[0], C.text[1], C.text[2]],
      },
      alternateRowStyles: {
        fillColor: [C.light[0], C.light[1], C.light[2]],
      },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }

  // ─── FOOTERS ───
  const pages = doc.getNumberOfPages();
  for (let i = 2; i <= pages; i++) {
    doc.setPage(i);
    doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
    doc.setFontSize(7);
    doc.text(
      `Page ${i - 1} of ${pages - 1}  •  The Story of Our Impact  •  PCs for People — Confidential`,
      pw / 2, ph - 10, { align: 'center' }
    );
  }

  return doc;
}

/** Parse "hsl(H, S%, L%)" to [r, g, b] */
function hslStringToRgb(hsl: string): [number, number, number] {
  const match = hsl.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*\)/);
  if (!match) return [100, 120, 110]; // fallback sage
  const h = parseFloat(match[1]) / 360;
  const s = parseFloat(match[2]) / 100;
  const l = parseFloat(match[3]) / 100;

  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}
