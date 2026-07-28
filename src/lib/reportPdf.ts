import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportData {
  title: string;
  subtitle: string;
  generatedBy: string;
  generatedAt: Date;
  region?: string;
  metro?: string;
  sections: ReportSection[];
}

export interface ReportSection {
  type: 'kpi' | 'table' | 'text' | 'highlight';
  title: string;
  data: KPIData[] | TableData | string | HighlightData[];
}

export interface KPIData {
  label: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'flat';
}

export interface TableData {
  headers: string[];
  rows: (string | number)[][];
}

export interface HighlightData {
  title: string;
  description: string;
  metric?: string;
}

// Color palette - using HSL values converted to RGB
const COLORS = {
  primary: [59, 130, 246], // Blue
  success: [34, 197, 94], // Green
  warning: [234, 179, 8], // Yellow
  muted: [100, 116, 139], // Gray
  dark: [30, 41, 59], // Dark gray
  light: [248, 250, 252], // Light gray
};

export function generatePDF(report: ReportData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  // Helper functions
  const addPage = () => {
    doc.addPage();
    yPos = margin;
  };

  const checkPageBreak = (requiredHeight: number) => {
    if (yPos + requiredHeight > pageHeight - margin) {
      addPage();
      return true;
    }
    return false;
  };

  // Header
  doc.setFillColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(report.title, margin, 22);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(report.subtitle, margin, 32);

  // Meta info
  doc.setFontSize(9);
  doc.text(`Generated: ${report.generatedAt.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}`, pageWidth - margin - 60, 22);
  doc.text(`By: ${report.generatedBy}`, pageWidth - margin - 60, 28);
  if (report.region) {
    doc.text(`Region: ${report.region}`, pageWidth - margin - 60, 34);
  }

  yPos = 55;

  // Process sections
  for (const section of report.sections) {
    checkPageBreak(30);

    // Section title
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(section.title, margin, yPos);
    yPos += 8;

    // Section content based on type
    switch (section.type) {
      case 'kpi':
        yPos = renderKPIs(doc, section.data as KPIData[], margin, yPos, pageWidth);
        break;
      case 'table':
        yPos = renderTable(doc, section.data as TableData, margin, yPos, pageWidth);
        break;
      case 'text':
        yPos = renderText(doc, section.data as string, margin, yPos, pageWidth);
        break;
      case 'highlight':
        yPos = renderHighlights(doc, section.data as HighlightData[], margin, yPos, pageWidth);
        break;
    }

    yPos += 10;
  }

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount} | PCs for People - Confidential`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  return doc;
}

function renderKPIs(
  doc: jsPDF,
  data: KPIData[],
  margin: number,
  yPos: number,
  pageWidth: number
): number {
  const cardWidth = (pageWidth - margin * 2 - 15) / 4;
  const cardHeight = 28;

  data.forEach((kpi, index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const x = margin + col * (cardWidth + 5);
    const y = yPos + row * (cardHeight + 5);

    // Card background
    doc.setFillColor(COLORS.light[0], COLORS.light[1], COLORS.light[2]);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'F');

    // Label
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(kpi.label, x + 4, y + 8);

    // Value
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(String(kpi.value), x + 4, y + 18);

    // Change indicator
    if (kpi.change) {
      const color = kpi.trend === 'up' ? COLORS.success : kpi.trend === 'down' ? COLORS.warning : COLORS.muted;
      doc.setTextColor(color[0], color[1], color[2]);
      doc.setFontSize(8);
      doc.text(kpi.change, x + 4, y + 24);
    }
  });

  const rows = Math.ceil(data.length / 4);
  return yPos + rows * (cardHeight + 5);
}

function renderTable(
  doc: jsPDF,
  data: TableData,
  margin: number,
  yPos: number,
  pageWidth: number
): number {
  autoTable(doc, {
    startY: yPos,
    head: [data.headers],
    body: data.rows.map(row => row.map(cell => String(cell))),
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]],
    },
    alternateRowStyles: {
      fillColor: [COLORS.light[0], COLORS.light[1], COLORS.light[2]],
    },
    tableWidth: 'auto',
  });

  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
}

function renderText(
  doc: jsPDF,
  text: string,
  margin: number,
  yPos: number,
  pageWidth: number
): number {
  doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
  doc.text(lines, margin, yPos);
  
  return yPos + lines.length * 5;
}

function renderHighlights(
  doc: jsPDF,
  data: HighlightData[],
  margin: number,
  yPos: number,
  pageWidth: number
): number {
  const cardWidth = pageWidth - margin * 2;
  
  data.forEach((highlight, index) => {
    const cardHeight = 20;
    const y = yPos + index * (cardHeight + 4);

    // Card with left accent
    doc.setFillColor(COLORS.light[0], COLORS.light[1], COLORS.light[2]);
    doc.roundedRect(margin, y, cardWidth, cardHeight, 2, 2, 'F');
    
    doc.setFillColor(COLORS.success[0], COLORS.success[1], COLORS.success[2]);
    doc.rect(margin, y, 3, cardHeight, 'F');

    // Title
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(highlight.title, margin + 8, y + 7);

    // Description
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.text(highlight.description, margin + 8, y + 14);

    // Metric
    if (highlight.metric) {
      doc.setTextColor(COLORS.success[0], COLORS.success[1], COLORS.success[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(highlight.metric, cardWidth - 10, y + 10, { align: 'right' });
    }
  });

  return yPos + data.length * 24;
}

export function downloadPDF(doc: jsPDF, filename: string): void {
  doc.save(filename);
}
