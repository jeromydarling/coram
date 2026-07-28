/**
 * buildTestimoniumPDF — Generates a narrative-first PDF from export sections.
 *
 * WHAT: Creates a warm, serif-styled PDF from structured export data.
 * WHERE: Called from TestimoniumExports page download button.
 * WHY: Leadership gets a printable witness report without writing.
 */

import jsPDF from 'jspdf';

interface ExportSection {
  key: string;
  title: string;
  body: {
    narrative?: string;
    highlights?: string[];
    [key: string]: any;
  };
}

interface ExportData {
  title: string;
  subtitle: string;
  export_type: string;
  metrics?: Record<string, number>;
  sections: ExportSection[];
}

export function buildTestimoniumPDF(data: ExportData): jsPDF {
  const doc = new jsPDF();
  let y = 28;

  // Title
  doc.setFontSize(22);
  doc.setTextColor(40, 40, 40);
  doc.text(data.title, 20, y);
  y += 10;

  // Subtitle / period
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(data.subtitle, 20, y);
  y += 6;

  // Export type badge
  doc.setFontSize(9);
  doc.text(`${data.export_type} narrative brief`, 20, y);
  y += 14;

  // Sections
  for (const section of data.sections) {
    if (y > 255) {
      doc.addPage();
      y = 24;
    }

    // Section title
    doc.setFontSize(14);
    doc.setTextColor(50, 50, 50);
    doc.text(section.title, 20, y);
    y += 8;

    // Narrative body
    if (section.body.narrative) {
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      const lines = doc.splitTextToSize(section.body.narrative, 170);
      doc.text(lines, 20, y);
      y += lines.length * 5 + 4;
    }

    // Highlights
    if (section.body.highlights?.length) {
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      for (const h of section.body.highlights.slice(0, 5)) {
        if (y > 270) {
          doc.addPage();
          y = 24;
        }
        const hLines = doc.splitTextToSize(`• ${h}`, 165);
        doc.text(hLines, 24, y);
        y += hLines.length * 4.5 + 2;
      }
    }

    y += 8;
  }

  // Metrics footer
  if (data.metrics && y < 260) {
    if (y > 250) {
      doc.addPage();
      y = 24;
    }
    doc.setDrawColor(200, 200, 200);
    doc.line(20, y, 190, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const metricStr = [
      `Moments: ${data.metrics.total_moments ?? 0}`,
      `Events: ${data.metrics.event_count ?? 0}`,
      `Growth: ${data.metrics.growth_count ?? 0}`,
      `Reconnections: ${data.metrics.reconnection_count ?? 0}`,
    ].join('  ·  ');
    doc.text(metricStr, 20, y);
  }

  return doc;
}
