/**
 * leadershipBriefPdf — Generates a PDF of the Leadership Brief.
 *
 * WHAT: Builds a branded PDF from the weekly report JSON.
 * WHERE: Called from the LeadershipBriefCard download button.
 * WHY: Leaders can share the brief offline or in meetings.
 */

import jsPDF from 'jspdf';
import { brand } from '@/config/brand';
import type { WeeklyReportJson } from '@/hooks/useWeeklyReport';

const MARGIN = 18;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;

interface BriefPdfOptions {
  report: WeeklyReportJson;
  weekLabel: string;
}

export function downloadLeadershipBriefPdf({ report, weekLabel }: BriefPdfOptions) {
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = 22;

  const tenantName = report._tenant_name || brand.appName;

  // ── Title ──
  doc.setFontSize(18);
  doc.setTextColor(30, 30, 50);
  doc.text('Leadership Weekly Brief', MARGIN, y);
  y += 7;

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Week of ${weekLabel} · ${tenantName}`, MARGIN, y);
  y += 4;
  doc.text(`${brand.appName}™ — Communal Relationship Operating System`, MARGIN, y);
  y += 8;

  // Divider
  doc.setDrawColor(200);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  // ── Headline ──
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 50);
  const headlineLines = doc.splitTextToSize(report.headline, CONTENT_W);
  doc.text(headlineLines, MARGIN, y);
  y += headlineLines.length * 5 + 4;

  // ── Executive Summary ──
  doc.setFontSize(9);
  doc.setTextColor(70);
  const summaryLines = doc.splitTextToSize(report.executive_summary, CONTENT_W);
  doc.text(summaryLines, MARGIN, y);
  y += summaryLines.length * 4 + 6;

  // Section helper
  const addSection = (title: string, items: (string | null)[] | undefined) => {
    const filtered = (items || []).filter(Boolean) as string[];
    if (filtered.length === 0) return;

    if (y > 255) { doc.addPage(); y = 22; }

    doc.setFontSize(10);
    doc.setTextColor(50, 80, 130);
    doc.text(title.toUpperCase(), MARGIN, y);
    y += 5;

    doc.setFontSize(9);
    doc.setTextColor(40, 40, 60);
    for (const item of filtered) {
      if (y > 265) { doc.addPage(); y = 22; }
      const lines = doc.splitTextToSize(`• ${item}`, CONTENT_W - 4);
      doc.text(lines, MARGIN + 2, y);
      y += lines.length * 4 + 1.5;
    }
    y += 3;
  };

  addSection('Key Wins', report.key_wins);
  addSection('Relationship Growth', report.relationship_growth);
  addSection('Journey Movement', report.journey_movement);
  addSection('Outreach Report', report.outreach_report);
  addSection('Provisions Delivered', report.provisions_delivered);
  addSection('Engagement Signals', report.engagement_signals);
  addSection('Upcoming Focus', report.upcoming_focus);

  // Risks section (special color)
  const risks = (report.risks_or_concerns || report.risks_or_blockers || []).filter(Boolean) as string[];
  if (risks.length > 0) {
    if (y > 255) { doc.addPage(); y = 22; }
    doc.setFontSize(10);
    doc.setTextColor(180, 60, 60);
    doc.text('CONCERNS', MARGIN, y);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(120, 40, 40);
    for (const item of risks) {
      if (y > 265) { doc.addPage(); y = 22; }
      const lines = doc.splitTextToSize(`• ${item}`, CONTENT_W - 4);
      doc.text(lines, MARGIN + 2, y);
      y += lines.length * 4 + 1.5;
    }
    y += 3;
  }

  addSection('Calendar & Tasks Ahead', report.calendar_preview);

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(160);
    doc.text(
      `${brand.appName}™ • Leadership Brief • Page ${i} of ${pageCount}`,
      PAGE_W / 2, h - 8, { align: 'center' }
    );
  }

  doc.save(`CROS-Leadership-Brief-${weekLabel.replace(/[, ]+/g, '-')}.pdf`);
}
