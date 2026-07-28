/**
 * howToPdf — PDF export for the Operator How-To Guide.
 *
 * WHAT: Generates a structured PDF from the how-to guide sections.
 * WHERE: Called from OperatorHowToPage download button.
 * WHY: Operators need an offline reference they can print or share.
 */
import jsPDF from 'jspdf';
import { brand } from '@/config/brand';

interface HowToSection {
  title: string;
  route: string;
  zone: string;
  summary: string;
  tabs?: string[];
  whatYouSee: string[];
  whatToDo: string[];
  tips?: string[];
}

const PAGE_WIDTH = 210;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const ZONE_NAMES: Record<string, string> = {
  praesentia: 'Praesentia — Narrative Stewardship',
  initium: 'Initium — Activation Presence',
  crescere: 'Crescere — Business Operations',
  machina: 'Machina — Mechanical Operations',
};

function addPageFooter(doc: jsPDF, pageNum: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`${brand.appName}™ — Operator How-To Guide • Page ${pageNum}`, PAGE_WIDTH / 2, pageHeight - 8, { align: 'center' });
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

export function generateHowToPdf(sections: HowToSection[]) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageNum = { current: 1 };
  let y = 20;

  // ── Title page ──
  doc.setFontSize(24);
  doc.setTextColor(30);
  doc.text(`${brand.appName}™ Operator How-To Guide`, MARGIN, y);
  y += 10;
  doc.setFontSize(12);
  doc.setTextColor(80);
  doc.text(brand.fullName, MARGIN, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, MARGIN, y);
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text('A complete reference for every section of the Operator Console.', MARGIN, y);
  y += 8;

  doc.setDrawColor(200);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 10;

  // ── Quick reference ──
  doc.setFontSize(14);
  doc.setTextColor(30);
  doc.text('Quick Reference', MARGIN, y);
  y += 7;

  const routines = [
    ['Daily', 'Dashboard → Error Desk → Automation Results → System Health → Intake'],
    ['Weekly', 'Testimonium rollups → Communio privacy → Usage trends → Partners → Activation → Adoption'],
    ['Pre-release', 'System → System Sweep tab → QA Hub → Tour Runner screenshots'],
    ['Outreach', 'Outreach links → Scheduling demos → Convert partners → Activation progress'],
  ];

  for (const [label, desc] of routines) {
    doc.setFontSize(9);
    doc.setTextColor(30);
    doc.text(`${label}:`, MARGIN, y);
    doc.setTextColor(60);
    const descLines = doc.splitTextToSize(desc, CONTENT_WIDTH - 20);
    doc.text(descLines, MARGIN + 20, y);
    y += descLines.length * 4 + 2;
  }

  y += 4;
  doc.setDrawColor(200);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 10;

  // ── Sections by zone ──
  const zones = ['praesentia', 'initium', 'crescere', 'machina'];

  for (const zone of zones) {
    const zoneSections = sections.filter(s => s.zone === zone);
    if (zoneSections.length === 0) continue;

    y = checkPageBreak(doc, y, 20, pageNum);

    // Zone header
    doc.setFontSize(14);
    doc.setTextColor(30);
    doc.text(ZONE_NAMES[zone] || zone, MARGIN, y);
    y += 3;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`${zoneSections.length} sections`, MARGIN, y);
    y += 8;

    for (const section of zoneSections) {
      y = checkPageBreak(doc, y, 30, pageNum);

      // Section title + route
      doc.setFontSize(11);
      doc.setTextColor(30);
      doc.text(section.title, MARGIN, y);
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(section.route, MARGIN + doc.getTextWidth(section.title + '  ') * (11 / 7), y);
      y += 5;

      // Tabs badges
      if (section.tabs && section.tabs.length > 0) {
        doc.setFontSize(7);
        doc.setTextColor(80);
        doc.text(`Tabs: ${section.tabs.join(' • ')}`, MARGIN + 2, y);
        y += 4;
      }

      // Summary
      doc.setFontSize(8.5);
      doc.setTextColor(50);
      const summaryLines = doc.splitTextToSize(section.summary, CONTENT_WIDTH);
      doc.text(summaryLines, MARGIN, y);
      y += summaryLines.length * 3.8 + 3;

      // What You'll See
      y = checkPageBreak(doc, y, 8, pageNum);
      doc.setFontSize(8);
      doc.setTextColor(30);
      doc.text('WHAT YOU\'LL SEE', MARGIN, y);
      y += 4;
      doc.setFontSize(7.5);
      doc.setTextColor(60);
      for (const item of section.whatYouSee) {
        y = checkPageBreak(doc, y, 5, pageNum);
        const lines = doc.splitTextToSize(`• ${item}`, CONTENT_WIDTH - 4);
        doc.text(lines, MARGIN + 2, y);
        y += lines.length * 3.2;
      }
      y += 2;

      // What To Do
      y = checkPageBreak(doc, y, 8, pageNum);
      doc.setFontSize(8);
      doc.setTextColor(30);
      doc.text('WHAT TO DO', MARGIN, y);
      y += 4;
      doc.setFontSize(7.5);
      doc.setTextColor(60);
      for (const item of section.whatToDo) {
        y = checkPageBreak(doc, y, 5, pageNum);
        const lines = doc.splitTextToSize(`→ ${item}`, CONTENT_WIDTH - 4);
        doc.text(lines, MARGIN + 2, y);
        y += lines.length * 3.2;
      }
      y += 2;

      // Tips
      if (section.tips && section.tips.length > 0) {
        y = checkPageBreak(doc, y, 8, pageNum);
        doc.setFontSize(8);
        doc.setTextColor(30);
        doc.text('TIPS', MARGIN, y);
        y += 4;
        doc.setFontSize(7.5);
        doc.setTextColor(80);
        for (const tip of section.tips) {
          y = checkPageBreak(doc, y, 5, pageNum);
          const lines = doc.splitTextToSize(`💡 ${tip}`, CONTENT_WIDTH - 4);
          doc.text(lines, MARGIN + 2, y);
          y += lines.length * 3.2;
        }
        y += 2;
      }

      // Section divider
      y = checkPageBreak(doc, y, 4, pageNum);
      doc.setDrawColor(220);
      doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
      y += 6;
    }

    y += 4;
  }

  addPageFooter(doc, pageNum.current);
  doc.save('CROS-Operator-How-To-Guide.pdf');
}
