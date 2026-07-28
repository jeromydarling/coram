/**
 * seePeopleReflectionPdf — Generates a printable one-page reflection guide.
 *
 * WHAT: Builds a PDF from the See People reflection content.
 * WHERE: Called from the SeePeople marketing page download button.
 * WHY: Leaders can bring the reflection to their team without needing an account.
 */

import jsPDF from 'jspdf';
import { reflectionQuestions, ignatianExamen } from '@/content/seePeople';
import { brand } from '@/config/brand';

const MARGIN = 18;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;

export function downloadSeePeopleReflectionPdf() {
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = 22;

  // ── Title ──
  doc.setFontSize(20);
  doc.setTextColor(30, 30, 50);
  doc.text('Do Your Tools Help You See People?', MARGIN, y);
  y += 8;

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('A printable team reflection guide', MARGIN, y);
  y += 4;
  doc.text(`${brand.appName}\u2122 — ${brand.fullName}`, MARGIN, y);
  y += 8;

  // Divider
  doc.setDrawColor(200);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  // ── Instructions ──
  doc.setFontSize(9);
  doc.setTextColor(80);
  const intro = doc.splitTextToSize(
    'Use this guide in a team meeting, one-on-one, or personal reflection. Read each question aloud, pause, and let the follow-up thought sit for a moment before moving on. There are no right answers — only honest ones.',
    CONTENT_W,
  );
  doc.text(intro, MARGIN, y);
  y += intro.length * 4 + 6;

  // ── Reflection Questions by Category ──
  const categories = [...new Set(reflectionQuestions.map((q) => q.category))];

  for (const cat of categories) {
    // Page-break safety
    if (y > 255) { doc.addPage(); y = 22; }

    doc.setFontSize(10);
    doc.setTextColor(50, 80, 130);
    doc.text(cat.toUpperCase(), MARGIN, y);
    y += 5;

    const qs = reflectionQuestions.filter((q) => q.category === cat);
    for (const q of qs) {
      if (y > 260) { doc.addPage(); y = 22; }

      doc.setFontSize(9.5);
      doc.setTextColor(30, 30, 50);
      const qLines = doc.splitTextToSize(q.question, CONTENT_W - 4);
      doc.text(qLines, MARGIN + 2, y);
      y += qLines.length * 4.2;

      doc.setFontSize(8);
      doc.setTextColor(100);
      const fLines = doc.splitTextToSize(q.followUp, CONTENT_W - 6);
      doc.text(fLines, MARGIN + 4, y);
      y += fLines.length * 3.6 + 3;
    }

    y += 3;
  }

  // ── Ignatian Examen ──
  if (y > 230) { doc.addPage(); y = 22; }

  doc.setDrawColor(200);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  doc.setFontSize(12);
  doc.setTextColor(30, 30, 50);
  doc.text('A Quiet Examen for Your Systems', MARGIN, y);
  y += 7;

  for (const s of ignatianExamen.sections) {
    if (y > 250) { doc.addPage(); y = 22; }

    doc.setFontSize(9);
    doc.setTextColor(50, 80, 130);
    doc.text(s.label, MARGIN, y);
    y += 4.5;

    doc.setFontSize(8.5);
    doc.setTextColor(60);
    const bLines = doc.splitTextToSize(s.body, CONTENT_W);
    doc.text(bLines, MARGIN, y);
    y += bLines.length * 3.8 + 5;
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(160);
    doc.text(`${brand.appName}\u2122 • thecros.lovable.app • Page ${i} of ${pageCount}`, PAGE_W / 2, h - 8, { align: 'center' });
  }

  doc.save('CROS-See-People-Reflection-Guide.pdf');
}
