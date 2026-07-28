/**
 * buildProvidencePDF — Generates a branded CROS narrative PDF from a Providence report.
 *
 * WHAT: Creates a warm, branded PDF with CROS identity, season label, narrative, and footer.
 * WHERE: Called from ProvidenceSection export button.
 * WHY: Leadership gets a printable seasonal reflection with CROS branding.
 */

import jsPDF from 'jspdf';
import type { ProvidenceDirection } from './providenceEngine';

interface ProvidencePDFData {
  seasonLabel: string;
  classification: string;
  dominantDirection: ProvidenceDirection;
  narrative: string;
  periodStart: string;
  periodEnd: string;
  version: number;
}

const DIRECTION_LABELS: Record<ProvidenceDirection, string> = {
  care: 'Care',
  expansion: 'Expansion',
  restoration: 'Restoration',
  steadfastness: 'Steadfastness',
};

const DIRECTION_COLORS: Record<ProvidenceDirection, [number, number, number]> = {
  care: [76, 153, 102],        // warm green
  expansion: [90, 120, 200],   // calm blue
  restoration: [200, 160, 60], // golden amber
  steadfastness: [120, 120, 140], // quiet slate
};

export function generateProvidencePDF(data: ProvidencePDFData): jsPDF {
  const doc = new jsPDF();
  const dirColor = DIRECTION_COLORS[data.dominantDirection];
  let y = 20;

  // ── CROS Header ──
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 160);
  doc.text('CROS — Communal Relationship Operating System', 20, y);
  y += 5;

  // Accent line
  doc.setDrawColor(dirColor[0], dirColor[1], dirColor[2]);
  doc.setLineWidth(0.8);
  doc.line(20, y, 80, y);
  y += 12;

  // ── Providence label ──
  doc.setFontSize(8);
  doc.setTextColor(dirColor[0], dirColor[1], dirColor[2]);
  doc.text('PROVIDENCE REFLECTION', 20, y);
  y += 10;

  // ── Season title ──
  doc.setFontSize(22);
  doc.setTextColor(40, 40, 40);
  doc.text(data.seasonLabel, 20, y);
  y += 9;

  // ── Classification + direction + period ──
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `${data.classification} · ${DIRECTION_LABELS[data.dominantDirection]} · ${data.periodStart} — ${data.periodEnd}`,
    20,
    y
  );
  y += 14;

  // ── Narrative body ──
  doc.setFontSize(11);
  doc.setTextColor(55, 55, 55);
  const lines = doc.splitTextToSize(data.narrative, 170);
  for (const line of lines) {
    if (y > 265) {
      doc.addPage();
      y = 24;
    }
    doc.text(line, 20, y);
    y += 5.8;
  }

  // ── Footer ──
  y += 12;
  if (y > 270) { doc.addPage(); y = 24; }
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(20, y, 190, y);
  y += 6;
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.text(
    `CROS Providence · v${data.version} · Generated ${new Date().toLocaleDateString()} · Powered by Narrative Relational Intelligence`,
    20,
    y
  );

  return doc;
}
