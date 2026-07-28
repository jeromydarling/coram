/**
 * buildReportPdf — Generates a CROS Build Report PDF.
 *
 * WHAT: Creates a downloadable PDF summarizing recent build changes.
 * WHERE: Called from any page or utility that needs a build report.
 * WHY: Operators need offline build summaries for review and stakeholder sharing.
 */

import jsPDF from 'jspdf';
import { brand } from '@/config/brand';

export interface BuildReportEntry {
  title: string;
  summary: string;
  items: string[];
  filesChanged?: string[];
}

export interface BuildReportData {
  date: string;
  version: string;
  entries: BuildReportEntry[];
}

export function generateBuildReportPdf(data: BuildReportData): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 50;
  const contentW = pageW - margin * 2;
  let y = margin;

  const addPage = () => {
    doc.addPage();
    y = margin;
  };
  const checkPage = (need: number) => {
    if (y + need > doc.internal.pageSize.getHeight() - margin) addPage();
  };

  // ── Header ──
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text(`${brand.appName} — Build Report`, margin, y);
  y += 28;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`${brand.fullName}`, margin, y);
  y += 16;
  doc.text(`Date: ${data.date}  •  Version: ${data.version}`, margin, y);
  y += 10;

  // divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 24;

  // ── Entries ──
  data.entries.forEach((entry, idx) => {
    checkPage(80);

    // Section number + title
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(`${idx + 1}. ${entry.title}`, margin, y);
    y += 18;

    // Summary
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(80, 80, 80);
    const summaryLines = doc.splitTextToSize(entry.summary, contentW);
    checkPage(summaryLines.length * 14);
    doc.text(summaryLines, margin, y);
    y += summaryLines.length * 14 + 8;

    // Bullet items
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    entry.items.forEach((item) => {
      const lines = doc.splitTextToSize(`•  ${item}`, contentW - 12);
      checkPage(lines.length * 13 + 4);
      doc.text(lines, margin + 8, y);
      y += lines.length * 13 + 4;
    });

    // Files changed
    if (entry.filesChanged && entry.filesChanged.length > 0) {
      y += 6;
      checkPage(20);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(120, 120, 120);
      doc.text('Files touched:', margin + 8, y);
      y += 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      entry.filesChanged.forEach((f) => {
        checkPage(12);
        doc.text(`  ${f}`, margin + 12, y);
        y += 11;
      });
    }

    y += 18;
  });

  // ── Footer on every page ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 160, 160);
    doc.text(
      `${brand.appName} Build Report  •  ${data.date}  •  Page ${i} of ${totalPages}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 30,
      { align: 'center' }
    );
  }

  return doc;
}
