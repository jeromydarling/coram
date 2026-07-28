/**
 * buildTechnicalDocPdf — Generates the Gardener's technical architecture PDF.
 *
 * WHAT: Creates a comprehensive developer-reference PDF from techDocChapters.
 * WHERE: Called from Operator Console (MACHINA zone) or admin settings.
 * WHY: The Gardener needs a single living document covering the full platform.
 */

import jsPDF from 'jspdf';
import { techDocChapters, TECH_DOC_META, type TechDocChapter } from '@/content/technicalDocumentation';

const PAGE_W = 210;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;

function addFooter(doc: jsPDF, pageNum: number) {
  const h = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(
    `CROS™ Technical Architecture Reference • v${TECH_DOC_META.version} • Page ${pageNum}`,
    PAGE_W / 2,
    h - 8,
    { align: 'center' },
  );
}

function checkBreak(doc: jsPDF, y: number, needed: number, pg: { n: number }): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 18) {
    addFooter(doc, pg.n);
    doc.addPage();
    pg.n++;
    return 24;
  }
  return y;
}

function renderMarkdownBlock(doc: jsPDF, text: string, startY: number, pg: { n: number }): number {
  let y = startY;
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      y += 2.5;
      continue;
    }

    y = checkBreak(doc, y, 6, pg);

    // Bold lines (**text**)
    if (trimmed.startsWith('**') && trimmed.includes('**', 2)) {
      const parts = trimmed.split(/\*\*/);
      doc.setFontSize(8.5);
      let x = MARGIN;
      for (let i = 0; i < parts.length; i++) {
        if (!parts[i]) continue;
        if (i % 2 === 1) {
          // Bold segment
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(60);
        }
        const segLines = doc.splitTextToSize(parts[i], CONTENT_W);
        doc.text(segLines, x, y);
        // Only advance x for inline, advance y for wrapped
        if (segLines.length > 1) {
          y += segLines.length * 3.6;
        } else {
          x += doc.getTextWidth(parts[i]);
        }
      }
      doc.setFont('helvetica', 'normal');
      y += 3.8;
      continue;
    }

    // Bullet points
    if (trimmed.startsWith('- ')) {
      doc.setFontSize(8);
      doc.setTextColor(50);
      const bulletText = trimmed.slice(2).replace(/\*\*/g, '');
      const wrapped = doc.splitTextToSize(`• ${bulletText}`, CONTENT_W - 6);
      y = checkBreak(doc, y, wrapped.length * 3.5, pg);
      doc.text(wrapped, MARGIN + 3, y);
      y += wrapped.length * 3.5 + 1;
      continue;
    }

    // Numbered items (1. 2. etc.)
    if (/^\d+\.\s/.test(trimmed)) {
      doc.setFontSize(8);
      doc.setTextColor(50);
      const clean = trimmed.replace(/\*\*/g, '');
      const wrapped = doc.splitTextToSize(clean, CONTENT_W - 4);
      y = checkBreak(doc, y, wrapped.length * 3.5, pg);
      doc.text(wrapped, MARGIN + 2, y);
      y += wrapped.length * 3.5 + 1;
      continue;
    }

    // Regular paragraph
    doc.setFontSize(8.5);
    doc.setTextColor(50);
    doc.setFont('helvetica', 'normal');
    const clean = trimmed.replace(/\*\*/g, '');
    const wrapped = doc.splitTextToSize(clean, CONTENT_W);
    y = checkBreak(doc, y, wrapped.length * 3.6, pg);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 3.6 + 1.5;
  }

  return y;
}

function renderChapter(doc: jsPDF, chapter: TechDocChapter, startY: number, pg: { n: number }): number {
  let y = startY;

  // Chapter title
  y = checkBreak(doc, y, 14, pg);
  doc.setFontSize(14);
  doc.setTextColor(25);
  doc.setFont('helvetica', 'bold');
  doc.text(chapter.title, MARGIN, y);
  y += 8;

  for (const section of chapter.sections) {
    y = checkBreak(doc, y, 12, pg);

    // Section title
    doc.setFontSize(10.5);
    doc.setTextColor(40);
    doc.setFont('helvetica', 'bold');
    doc.text(section.title, MARGIN, y);
    y += 5.5;

    // Section content
    doc.setFont('helvetica', 'normal');
    y = renderMarkdownBlock(doc, section.content, y, pg);
    y += 4;
  }

  // Chapter divider
  y = checkBreak(doc, y, 6, pg);
  doc.setDrawColor(210);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  return y;
}

export function buildTechnicalDocPdf(): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pg = { n: 1 };
  let y = 28;

  // ── Title page ──
  doc.setFontSize(26);
  doc.setTextColor(25);
  doc.setFont('helvetica', 'bold');
  doc.text('CROS™', MARGIN, y);
  y += 10;

  doc.setFontSize(13);
  doc.setTextColor(70);
  doc.setFont('helvetica', 'normal');
  doc.text('Technical Architecture Reference', MARGIN, y);
  y += 6;

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text('Communal Relationship Operating System', MARGIN, y);
  y += 5;
  doc.text(`Version ${TECH_DOC_META.version} • Updated ${TECH_DOC_META.lastUpdated}`, MARGIN, y);
  y += 5;
  doc.text(`Audience: ${TECH_DOC_META.audience}`, MARGIN, y);
  y += 10;

  // Divider
  doc.setDrawColor(180);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;

  // ── Table of Contents ──
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.setFont('helvetica', 'bold');
  doc.text('Table of Contents', MARGIN, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60);
  for (const chapter of techDocChapters) {
    doc.text(chapter.title, MARGIN + 2, y);
    y += 4.5;
    for (const section of chapter.sections) {
      doc.text(`  ${section.title}`, MARGIN + 6, y);
      y += 3.8;
    }
    y += 1;
  }

  addFooter(doc, pg.n);
  doc.addPage();
  pg.n++;
  y = 24;

  // ── Chapters ──
  for (const chapter of techDocChapters) {
    y = renderChapter(doc, chapter, y, pg);
  }

  addFooter(doc, pg.n);
  return doc;
}

export function downloadTechnicalDocPdf() {
  const doc = buildTechnicalDocPdf();
  doc.save('CROS-Technical-Architecture-Reference.pdf');
}
