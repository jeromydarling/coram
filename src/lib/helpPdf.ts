import jsPDF from 'jspdf';
import { brand } from '@/config/brand';

interface ChangelogEntry {
  date: string;
  type: string;
  title: string;
  changes: string[];
}

interface AppSection {
  id: string;
  title: string;
  description: string;
  content: string;
}

const PAGE_WIDTH = 210;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 5;

function addPageFooter(doc: jsPDF, pageNum: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`${brand.appName}™ — Help & Documentation • Page ${pageNum}`, PAGE_WIDTH / 2, pageHeight - 8, { align: 'center' });
  doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), PAGE_WIDTH - MARGIN, pageHeight - 8, { align: 'right' });
}

function checkPageBreak(doc: jsPDF, y: number, needed: number, pageNum: { current: number }): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 20) {
    addPageFooter(doc, pageNum.current);
    doc.addPage();
    pageNum.current++;
    return 25;
  }
  return y;
}

export function generateHelpPdf(changelog: ChangelogEntry[], sections: AppSection[]) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageNum = { current: 1 };
  let y = 20;

  // Title page
  doc.setFontSize(24);
  doc.setTextColor(30);
  doc.text(`${brand.appName}™`, MARGIN, y);
  y += 10;
  doc.setFontSize(14);
  doc.setTextColor(80);
  doc.text('Help & Documentation Reference', MARGIN, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(brand.fullName, MARGIN, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, MARGIN, y);
  y += 6;

  // Divider
  doc.setDrawColor(200);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 10;

  // ── CHANGELOG ──
  doc.setFontSize(16);
  doc.setTextColor(30);
  doc.text('Changelog', MARGIN, y);
  y += 8;

  for (const entry of changelog) {
    y = checkPageBreak(doc, y, 14, pageNum);

    // Entry header: date + type badge + title
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(entry.date, MARGIN, y);

    const typeLabel = entry.type === 'feature' ? '[Feature]' : entry.type === 'fix' ? '[Fix]' : `[${entry.type}]`;
    const dateWidth = doc.getTextWidth(entry.date);
    doc.setTextColor(entry.type === 'feature' ? 40 : entry.type === 'fix' ? 120 : 80);
    doc.text(` ${typeLabel}`, MARGIN + dateWidth, y);
    y += 4.5;

    doc.setFontSize(9.5);
    doc.setTextColor(30);
    const titleLines = doc.splitTextToSize(entry.title, CONTENT_WIDTH);
    doc.text(titleLines, MARGIN, y);
    y += titleLines.length * 4 + 2;

    // Changes list
    doc.setFontSize(7.5);
    doc.setTextColor(60);
    for (const change of entry.changes) {
      y = checkPageBreak(doc, y, 5, pageNum);
      const changeLines = doc.splitTextToSize(`• ${change}`, CONTENT_WIDTH - 4);
      doc.text(changeLines, MARGIN + 2, y);
      y += changeLines.length * 3.2;
    }

    y += 4;
  }

  // Divider between changelog and sections
  y = checkPageBreak(doc, y, 10, pageNum);
  doc.setDrawColor(200);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 10;

  // ── APP SECTIONS ──
  doc.setFontSize(16);
  doc.setTextColor(30);
  doc.text('Application Sections', MARGIN, y);
  y += 10;

  for (const section of sections) {
    y = checkPageBreak(doc, y, 20, pageNum);

    // Section title
    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.text(section.title, MARGIN, y);
    y += 5;

    doc.setFontSize(8);
    doc.setTextColor(100);
    const descLines = doc.splitTextToSize(section.description, CONTENT_WIDTH);
    doc.text(descLines, MARGIN, y);
    y += descLines.length * 3.5 + 3;

    // Content — render as plain text paragraphs
    doc.setFontSize(8.5);
    doc.setTextColor(50);
    const paragraphs = section.content.split('\n');
    for (const para of paragraphs) {
      if (!para.trim()) {
        y += 2;
        continue;
      }

      y = checkPageBreak(doc, y, 6, pageNum);

      const trimmed = para.trim();

      // Handle markdown-style headers
      if (trimmed.startsWith('## ')) {
        y += 2;
        doc.setFontSize(10);
        doc.setTextColor(30);
        doc.text(trimmed.replace('## ', ''), MARGIN, y);
        y += 5;
        doc.setFontSize(8.5);
        doc.setTextColor(50);
        continue;
      }

      // Bold lines
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        y += 1;
        doc.setFontSize(9);
        doc.setTextColor(40);
        const boldText = trimmed.replace(/\*\*/g, '');
        const boldLines = doc.splitTextToSize(boldText, CONTENT_WIDTH);
        doc.text(boldLines, MARGIN, y);
        y += boldLines.length * 4;
        doc.setFontSize(8.5);
        doc.setTextColor(50);
        continue;
      }

      // Bullet points
      if (trimmed.startsWith('- ')) {
        const bulletText = trimmed.replace(/^\- \*\*(.*?)\*\*/, '$1').replace(/\*\*/g, '');
        const bulletLines = doc.splitTextToSize(`• ${bulletText}`, CONTENT_WIDTH - 4);
        doc.text(bulletLines, MARGIN + 2, y);
        y += bulletLines.length * 3.8;
        continue;
      }

      // Regular text
      const cleanText = trimmed.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1');
      const textLines = doc.splitTextToSize(cleanText, CONTENT_WIDTH);
      doc.text(textLines, MARGIN, y);
      y += textLines.length * 3.8;
    }

    y += 6;

    // Divider between sections
    y = checkPageBreak(doc, y, 4, pageNum);
    doc.setDrawColor(220);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 6;
  }

  addPageFooter(doc, pageNum.current);
  doc.save('CROS-Help-Documentation.pdf');
}
