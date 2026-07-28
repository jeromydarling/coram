import jsPDF from 'jspdf';

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color: [number, number, number];
  }[];
}

interface PieChartData {
  label: string;
  value: number;
  color: [number, number, number];
}

// Color palette for charts
export const CHART_COLORS = {
  primary: [59, 130, 246] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
  warning: [234, 179, 8] as [number, number, number],
  danger: [239, 68, 68] as [number, number, number],
  purple: [168, 85, 247] as [number, number, number],
  cyan: [6, 182, 212] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  dark: [30, 41, 59] as [number, number, number],
  light: [248, 250, 252] as [number, number, number],
};

/**
 * Render a bar chart directly to PDF
 */
export function renderBarChart(
  doc: jsPDF,
  data: ChartData,
  x: number,
  y: number,
  width: number,
  height: number,
  title?: string
): number {
  const margin = 10;
  const chartX = x + margin + 15; // space for y-axis labels
  const chartY = y + (title ? 12 : 0);
  const chartWidth = width - margin * 2 - 15;
  const chartHeight = height - margin - (title ? 12 : 0) - 15; // space for x-axis labels

  // Draw title
  if (title) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(CHART_COLORS.dark[0], CHART_COLORS.dark[1], CHART_COLORS.dark[2]);
    doc.text(title, x + width / 2, y + 8, { align: 'center' });
  }

  // Calculate max value for scaling
  const maxValue = Math.max(...data.datasets.flatMap(ds => ds.data)) || 1;
  const roundedMax = Math.ceil(maxValue / 10) * 10;

  // Draw y-axis with labels
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(CHART_COLORS.muted[0], CHART_COLORS.muted[1], CHART_COLORS.muted[2]);
  
  const yAxisSteps = 5;
  for (let i = 0; i <= yAxisSteps; i++) {
    const yPos = chartY + chartHeight - (chartHeight / yAxisSteps) * i;
    const value = Math.round((roundedMax / yAxisSteps) * i);
    doc.text(String(value), chartX - 3, yPos + 1, { align: 'right' });
    
    // Grid lines
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.1);
    doc.line(chartX, yPos, chartX + chartWidth, yPos);
  }

  // Draw bars
  const numBars = data.labels.length;
  const numDatasets = data.datasets.length;
  const groupWidth = chartWidth / numBars;
  const barWidth = (groupWidth * 0.7) / numDatasets;
  const barGap = (groupWidth * 0.3) / 2;

  data.labels.forEach((label, i) => {
    const groupX = chartX + i * groupWidth;
    
    // Draw x-axis label
    doc.setFontSize(7);
    doc.setTextColor(CHART_COLORS.muted[0], CHART_COLORS.muted[1], CHART_COLORS.muted[2]);
    const truncatedLabel = label.length > 10 ? label.substring(0, 10) + '…' : label;
    doc.text(truncatedLabel, groupX + groupWidth / 2, chartY + chartHeight + 8, { align: 'center' });

    // Draw bars for each dataset
    data.datasets.forEach((dataset, j) => {
      const value = dataset.data[i];
      const barHeight = (value / roundedMax) * chartHeight;
      const barX = groupX + barGap + j * barWidth;
      const barY = chartY + chartHeight - barHeight;

      doc.setFillColor(dataset.color[0], dataset.color[1], dataset.color[2]);
      doc.roundedRect(barX, barY, barWidth * 0.9, barHeight, 1, 1, 'F');
    });
  });

  // Draw legend if multiple datasets
  if (data.datasets.length > 1) {
    let legendX = x + width - margin;
    const legendY = y + (title ? 10 : 0);
    
    data.datasets.reverse().forEach((dataset, i) => {
      doc.setFontSize(7);
      doc.setTextColor(CHART_COLORS.dark[0], CHART_COLORS.dark[1], CHART_COLORS.dark[2]);
      const textWidth = doc.getTextWidth(dataset.label);
      legendX -= textWidth + 8;
      doc.text(dataset.label, legendX + 6, legendY);
      doc.setFillColor(dataset.color[0], dataset.color[1], dataset.color[2]);
      doc.circle(legendX + 2, legendY - 1, 2, 'F');
    });
  }

  return y + height;
}

/**
 * Render a pie/donut chart directly to PDF
 */
export function renderPieChart(
  doc: jsPDF,
  data: PieChartData[],
  x: number,
  y: number,
  size: number,
  title?: string,
  donut = false
): number {
  const centerX = x + size / 2;
  const centerY = y + (title ? 12 : 0) + size / 2;
  const radius = (size - 20) / 2;
  const innerRadius = donut ? radius * 0.5 : 0;

  // Draw title
  if (title) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(CHART_COLORS.dark[0], CHART_COLORS.dark[1], CHART_COLORS.dark[2]);
    doc.text(title, x + size / 2, y + 8, { align: 'center' });
  }

  // Calculate total
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
    doc.setFontSize(10);
    doc.setTextColor(CHART_COLORS.muted[0], CHART_COLORS.muted[1], CHART_COLORS.muted[2]);
    doc.text('No data', centerX, centerY, { align: 'center' });
    return y + size + (title ? 12 : 0);
  }

  // Draw pie slices
  let startAngle = -Math.PI / 2; // Start from top
  
  data.forEach((item) => {
    const sliceAngle = (item.value / total) * Math.PI * 2;
    const endAngle = startAngle + sliceAngle;

    // Draw slice using path approximation
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    
    // Create arc path points
    const steps = Math.max(12, Math.ceil(sliceAngle * 20));
    const points: [number, number][] = [];
    
    if (!donut) {
      points.push([centerX, centerY]);
    }
    
    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + (sliceAngle * i) / steps;
      const px = centerX + Math.cos(angle) * radius;
      const py = centerY + Math.sin(angle) * radius;
      points.push([px, py]);
    }
    
    if (donut) {
      for (let i = steps; i >= 0; i--) {
        const angle = startAngle + (sliceAngle * i) / steps;
        const px = centerX + Math.cos(angle) * innerRadius;
        const py = centerY + Math.sin(angle) * innerRadius;
        points.push([px, py]);
      }
    }

    // Draw filled polygon
    if (points.length >= 3) {
      const pathData = points.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' ') + ' Z';
      // Use simple triangles for approximation since jsPDF doesn't have native arc support
      drawPolygon(doc, points, item.color);
    }

    startAngle = endAngle;
  });

  // Draw legend
  const legendY = y + size + (title ? 16 : 8);
  const legendItemHeight = 8;
  const maxLegendItems = 6;
  const displayItems = data.slice(0, maxLegendItems);
  
  displayItems.forEach((item, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const itemX = x + (col * size / 2);
    const itemY = legendY + row * legendItemHeight;
    
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.circle(itemX + 4, itemY, 2, 'F');
    
    doc.setFontSize(7);
    doc.setTextColor(CHART_COLORS.dark[0], CHART_COLORS.dark[1], CHART_COLORS.dark[2]);
    const label = item.label.length > 15 ? item.label.substring(0, 15) + '…' : item.label;
    doc.text(`${label} (${item.value})`, itemX + 8, itemY + 1);
  });

  const legendRows = Math.ceil(displayItems.length / 2);
  return legendY + legendRows * legendItemHeight + 5;
}

/**
 * Render a line chart directly to PDF
 */
export function renderLineChart(
  doc: jsPDF,
  data: ChartData,
  x: number,
  y: number,
  width: number,
  height: number,
  title?: string
): number {
  const margin = 10;
  const chartX = x + margin + 15;
  const chartY = y + (title ? 12 : 0);
  const chartWidth = width - margin * 2 - 15;
  const chartHeight = height - margin - (title ? 12 : 0) - 15;

  // Draw title
  if (title) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(CHART_COLORS.dark[0], CHART_COLORS.dark[1], CHART_COLORS.dark[2]);
    doc.text(title, x + width / 2, y + 8, { align: 'center' });
  }

  // Calculate max value
  const maxValue = Math.max(...data.datasets.flatMap(ds => ds.data)) || 1;
  const roundedMax = Math.ceil(maxValue / 10) * 10;

  // Draw y-axis
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(CHART_COLORS.muted[0], CHART_COLORS.muted[1], CHART_COLORS.muted[2]);
  
  const yAxisSteps = 5;
  for (let i = 0; i <= yAxisSteps; i++) {
    const yPos = chartY + chartHeight - (chartHeight / yAxisSteps) * i;
    const value = Math.round((roundedMax / yAxisSteps) * i);
    doc.text(String(value), chartX - 3, yPos + 1, { align: 'right' });
    
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.1);
    doc.line(chartX, yPos, chartX + chartWidth, yPos);
  }

  // Draw x-axis labels
  const numPoints = data.labels.length;
  data.labels.forEach((label, i) => {
    const labelX = chartX + (chartWidth / (numPoints - 1 || 1)) * i;
    const truncatedLabel = label.length > 8 ? label.substring(0, 8) + '…' : label;
    doc.text(truncatedLabel, labelX, chartY + chartHeight + 8, { align: 'center' });
  });

  // Draw lines
  data.datasets.forEach((dataset) => {
    doc.setDrawColor(dataset.color[0], dataset.color[1], dataset.color[2]);
    doc.setLineWidth(1);

    const points = dataset.data.map((value, i) => ({
      x: chartX + (chartWidth / (numPoints - 1 || 1)) * i,
      y: chartY + chartHeight - (value / roundedMax) * chartHeight,
    }));

    // Draw line segments
    for (let i = 0; i < points.length - 1; i++) {
      doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }

    // Draw points
    doc.setFillColor(dataset.color[0], dataset.color[1], dataset.color[2]);
    points.forEach((point) => {
      doc.circle(point.x, point.y, 1.5, 'F');
    });
  });

  // Draw legend if multiple datasets
  if (data.datasets.length > 1) {
    let legendX = x + width - margin;
    const legendY = y + (title ? 10 : 0);
    
    [...data.datasets].reverse().forEach((dataset) => {
      doc.setFontSize(7);
      doc.setTextColor(CHART_COLORS.dark[0], CHART_COLORS.dark[1], CHART_COLORS.dark[2]);
      const textWidth = doc.getTextWidth(dataset.label);
      legendX -= textWidth + 8;
      doc.text(dataset.label, legendX + 6, legendY);
      doc.setFillColor(dataset.color[0], dataset.color[1], dataset.color[2]);
      doc.circle(legendX + 2, legendY - 1, 2, 'F');
    });
  }

  return y + height;
}

// Helper function to draw a filled polygon
function drawPolygon(doc: jsPDF, points: [number, number][], color: [number, number, number]): void {
  if (points.length < 3) return;
  
  doc.setFillColor(color[0], color[1], color[2]);
  
  // Use triangles from center for better rendering
  const centroid = points.reduce(
    (acc, p) => [acc[0] + p[0] / points.length, acc[1] + p[1] / points.length],
    [0, 0]
  );
  
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    
    doc.triangle(
      centroid[0], centroid[1],
      p1[0], p1[1],
      p2[0], p2[1],
      'F'
    );
  }
}

/**
 * Get color for chart based on index
 */
export function getChartColor(index: number): [number, number, number] {
  const colors: [number, number, number][] = [
    CHART_COLORS.primary,
    CHART_COLORS.success,
    CHART_COLORS.warning,
    CHART_COLORS.purple,
    CHART_COLORS.cyan,
    CHART_COLORS.danger,
  ];
  return colors[index % colors.length];
}
