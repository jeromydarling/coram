/**
 * OperatorManualsPage — PDF export for both physical reference manuals.
 *
 * WHAT: Generates two downloadable PDFs: CROS Field Guide (Tenant) and Operator Steward Manual.
 * WHERE: /operator/manuals
 * WHY: Supports creation of physical reference books for training and stewardship.
 */
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Download, BookOpen, Shield, HelpCircle, Loader2, Code2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ROUTE_INVENTORY, ROLE_MATRIX, MODULE_ANATOMY, CORE_WORKFLOWS,
  SIDEBAR_STRUCTURE, SIGNAL_TYPES, NEXUS_WORKFLOWS, AI_DISCERNMENT_CONTENT,
  type RouteEntry, type RoleEntry, type ModuleEntry, type WorkflowEntry,
  type SidebarGroup, type SignalEntry, type NexusWorkflowEntry,
} from '@/lib/manualData';
import { downloadTechnicalDocPdf } from '@/lib/buildTechnicalDocPdf';

// ── PDF helpers ──

function addTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(40, 40, 40);
  doc.text(text, 20, y);
  return y + 12;
}

function addSection(doc: jsPDF, text: string, y: number): number {
  if (y > 260) { doc.addPage(); y = 25; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(60, 60, 60);
  doc.text(text, 20, y);
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y + 2, 190, y + 2);
  return y + 10;
}

function addParagraph(doc: jsPDF, text: string, y: number, maxWidth = 170): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const lines = doc.splitTextToSize(text, maxWidth);
  if (y + lines.length * 4 > 280) { doc.addPage(); y = 25; }
  doc.text(lines, 20, y);
  return y + lines.length * 4 + 3;
}

function addAutoTable(doc: jsPDF, head: string[][], body: string[][], startY: number): number {
  autoTable(doc, {
    startY,
    head,
    body,
    margin: { left: 20, right: 20 },
    styles: { fontSize: 7, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: [60, 60, 60], textColor: 255, fontSize: 7.5 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    theme: 'grid',
  });
  return (doc as any).lastAutoTable.finalY + 8;
}

// ── Cover page ──

function addCoverPage(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(35, 35, 40);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(36);
  doc.setTextColor(255, 255, 255);
  doc.text('CROS™', 105, 100, { align: 'center' });
  doc.setFontSize(18);
  doc.text(title, 105, 120, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(180, 180, 180);
  doc.text(subtitle, 105, 135, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 105, 260, { align: 'center' });
  doc.text('Communal Relationship Operating System', 105, 268, { align: 'center' });
  doc.addPage();
}

// ── Manual 1: CROS Field Guide ──

function generateFieldGuide(): jsPDF {
  const doc = new jsPDF();
  addCoverPage(doc, 'CROS Field Guide', 'The Tenant Reference Book');
  let y = 25;

  // TOC
  y = addTitle(doc, 'Table of Contents', y);
  const tocItems = ['A. Page & Route Inventory', 'B. Role Matrix', 'C. Module Anatomy', 'D. Core Workflows', 'E. Sidebar Structure by Role', 'F. NRI & Testimonium Signals', 'G. AI & Discernment'];
  tocItems.forEach((item, i) => { y = addParagraph(doc, `${i + 1}. ${item}`, y); });
  doc.addPage(); y = 25;

  // Section A — Tenant routes only
  y = addSection(doc, 'A. Page & Route Inventory', y);
  const tenantRoutes = ROUTE_INVENTORY.filter(r => !r.sidebar_group.startsWith('Operator'));
  y = addAutoTable(doc,
    [['Route', 'Name', 'Group', 'Latin Module', 'Primary Action', 'Access']],
    tenantRoutes.map(r => [r.route_path, r.display_name, r.sidebar_group, r.latin_module || '—', r.description_of_primary_action, r.roles_with_access.join(', ')]),
    y
  );

  // Section B
  y = addSection(doc, 'B. Role Matrix', y);
  const tenantRoles = ROLE_MATRIX.filter(r => r.role !== 'Operator (Admin)');
  tenantRoles.forEach(role => {
    if (y > 240) { doc.addPage(); y = 25; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    doc.text(role.role, 20, y); y += 6;
    y = addParagraph(doc, `Navigation: ${role.visible_navigation_groups.join(', ')}`, y);
    y = addParagraph(doc, `Visible Modules: ${role.visible_modules.join(', ')}`, y);
    y = addParagraph(doc, `Hidden: ${role.hidden_modules.join(', ') || 'None'}`, y);
    y = addParagraph(doc, `Actions: ${role.allowed_actions.join(', ')}`, y);
    y = addParagraph(doc, `Entry Point: ${role.onboarding_entry_point}`, y);
    y += 4;
  });

  // Section C
  if (y > 200) { doc.addPage(); y = 25; }
  y = addSection(doc, 'C. Module Anatomy', y);
  MODULE_ANATOMY.filter(m => m.primary_role !== 'Operator').forEach(mod => {
    if (y > 220) { doc.addPage(); y = 25; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    doc.text(`${mod.system_module}${mod.latin_name && mod.latin_name !== mod.system_module ? ` (${mod.latin_name})` : ''}`, 20, y); y += 5;
    y = addParagraph(doc, `Metaphor: ${mod.body_part_metaphor}`, y);
    y = addParagraph(doc, mod.narrative_purpose, y);
    y = addParagraph(doc, `Tables: ${mod.core_tables.join(', ')}`, y);
    y = addParagraph(doc, `Testimonium Events: ${mod.core_events.join(', ')}`, y);
    y += 3;
  });

  // Section D
  if (y > 200) { doc.addPage(); y = 25; }
  y = addSection(doc, 'D. Core Workflows', y);
  CORE_WORKFLOWS.filter(w => !w.roles.includes('Operator')).forEach(w => {
    if (y > 230) { doc.addPage(); y = 25; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    doc.text(w.flow_name, 20, y); y += 5;
    y = addParagraph(doc, `${w.entry_page} → ${w.exit_page}`, y);
    y = addParagraph(doc, `Roles: ${w.roles.join(', ')}`, y);
    y = addParagraph(doc, `Signals: ${w.signals_generated.join(', ')}`, y);
    y = addParagraph(doc, `Automation: ${w.automation_points.join(', ')}`, y);
    y += 3;
  });

  // Section E
  if (y > 200) { doc.addPage(); y = 25; }
  y = addSection(doc, 'E. Sidebar Structure by Role', y);
  y = addAutoTable(doc,
    [['Group', 'Items', 'Visible To']],
    SIDEBAR_STRUCTURE.map(s => [s.group, s.items.join(', '), s.visible_to.join(', ')]),
    y
  );

  // Section F
  if (y > 200) { doc.addPage(); y = 25; }
  y = addSection(doc, 'F. NRI & Testimonium Signal Types', y);
  const tenantSignals = SIGNAL_TYPES.filter(s => s.visible_surface !== 'N/A (operator only)' && s.visible_surface !== 'N/A (telemetry)');
  y = addAutoTable(doc,
    [['Signal', 'Trigger', 'Visible In']],
    tenantSignals.map(s => [s.signal_type, s.trigger_event, s.visible_surface]),
    y
  );

  // Section G — AI & Discernment
  if (y > 200) { doc.addPage(); y = 25; }
  y = addSection(doc, 'G. AI & Discernment in CROS', y);
  y = addParagraph(doc, 'A calm, grounded guide to how Narrative Relational Intelligence (NRI) works — and what it means for your team.', y);
  y += 4;

  AI_DISCERNMENT_CONTENT.forEach(section => {
    if (y > 220) { doc.addPage(); y = 25; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(40, 40, 40);
    doc.text(section.heading, 20, y); y += 6;

    // Body paragraphs
    const bodyLines = doc.splitTextToSize(section.body, 170);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    bodyLines.forEach((line: string) => {
      if (y > 270) { doc.addPage(); y = 25; }
      doc.text(line, 20, y); y += 4.5;
    });
    y += 2;

    // Bullets
    if (section.bullets) {
      section.bullets.forEach(bullet => {
        if (y > 270) { doc.addPage(); y = 25; }
        const bulletLines = doc.splitTextToSize(`• ${bullet}`, 165);
        bulletLines.forEach((line: string) => {
          doc.text(line, 24, y); y += 4.5;
        });
      });
      y += 2;
    }
    y += 3;
  });

  return doc;
}

// ── Manual 2: Gardener Steward Manual ──

function generateOperatorManual(): jsPDF {
  const doc = new jsPDF();
  addCoverPage(doc, 'Gardener Steward Manual', 'The Platform Governance Reference');
  let y = 25;

  // TOC
  y = addTitle(doc, 'Table of Contents', y);
  const tocItems = ['A. Complete Route Inventory', 'B. Full Role Matrix', 'C. Module Anatomy (All)', 'D. All Workflows', 'E. Sidebar Structure', 'F. Signal Types (Complete)', 'G. Gardener Nexus Workflows'];
  tocItems.forEach((item, i) => { y = addParagraph(doc, `${i + 1}. ${item}`, y); });
  doc.addPage(); y = 25;

  // Section A — ALL routes
  y = addSection(doc, 'A. Complete Route Inventory', y);
  y = addAutoTable(doc,
    [['Route', 'Name', 'Group', 'Latin', 'Action', 'Access', 'Tables']],
    ROUTE_INVENTORY.map(r => [r.route_path, r.display_name, r.sidebar_group, r.latin_module || '—', r.description_of_primary_action, r.roles_with_access.join(', '), r.related_tables.slice(0, 3).join(', ') || '—']),
    y
  );

  // Section B — ALL roles
  y = addSection(doc, 'B. Full Role Matrix', y);
  ROLE_MATRIX.forEach(role => {
    if (y > 230) { doc.addPage(); y = 25; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    doc.text(role.role, 20, y); y += 6;
    y = addParagraph(doc, `Navigation: ${role.visible_navigation_groups.join(', ')}`, y);
    y = addParagraph(doc, `Visible Modules: ${role.visible_modules.join(', ')}`, y);
    y = addParagraph(doc, `Hidden: ${role.hidden_modules.join(', ') || 'None'}`, y);
    y = addParagraph(doc, `Actions: ${role.allowed_actions.join(', ')}`, y);
    y = addParagraph(doc, `Entry Point: ${role.onboarding_entry_point}`, y);
    y += 4;
  });

  // Section C — ALL modules
  if (y > 200) { doc.addPage(); y = 25; }
  y = addSection(doc, 'C. Module Anatomy (All Modules)', y);
  MODULE_ANATOMY.forEach(mod => {
    if (y > 220) { doc.addPage(); y = 25; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    doc.text(`${mod.system_module}${mod.latin_name && mod.latin_name !== mod.system_module ? ` (${mod.latin_name})` : ''}`, 20, y); y += 5;
    y = addParagraph(doc, `Metaphor: ${mod.body_part_metaphor}`, y);
    y = addParagraph(doc, `Primary Role: ${mod.primary_role}`, y);
    y = addParagraph(doc, mod.narrative_purpose, y);
    y = addParagraph(doc, `Tables: ${mod.core_tables.join(', ')}`, y);
    y = addParagraph(doc, `Testimonium Events: ${mod.core_events.join(', ')}`, y);
    y += 3;
  });

  // Section D — ALL workflows
  if (y > 200) { doc.addPage(); y = 25; }
  y = addSection(doc, 'D. All Workflows', y);
  CORE_WORKFLOWS.forEach(w => {
    if (y > 230) { doc.addPage(); y = 25; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    doc.text(w.flow_name, 20, y); y += 5;
    y = addParagraph(doc, `${w.entry_page} → ${w.exit_page}`, y);
    y = addParagraph(doc, `Roles: ${w.roles.join(', ')}`, y);
    y = addParagraph(doc, `Signals: ${w.signals_generated.join(', ')}`, y);
    y = addParagraph(doc, `Automation: ${w.automation_points.join(', ')}`, y);
    y += 3;
  });

  // Section E
  if (y > 200) { doc.addPage(); y = 25; }
  y = addSection(doc, 'E. Sidebar Structure', y);
  y = addAutoTable(doc,
    [['Group', 'Items', 'Visible To']],
    SIDEBAR_STRUCTURE.map(s => [s.group, s.items.join(', '), s.visible_to.join(', ')]),
    y
  );

  // Section F — ALL signals
  if (y > 200) { doc.addPage(); y = 25; }
  y = addSection(doc, 'F. Signal Types (Complete)', y);
  y = addAutoTable(doc,
    [['Signal', 'Trigger', 'Tenant Surface', 'Gardener Surface']],
    SIGNAL_TYPES.map(s => [s.signal_type, s.trigger_event, s.visible_surface, s.operator_visibility]),
    y
  );

  // Section G — Nexus workflows
  if (y > 200) { doc.addPage(); y = 25; }
  y = addSection(doc, 'G. Gardener Nexus Workflows', y);
  NEXUS_WORKFLOWS.forEach(nw => {
    if (y > 220) { doc.addPage(); y = 25; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(40, 40, 40);
    doc.text(nw.workflow, 20, y); y += 5;
    y = addParagraph(doc, nw.purpose, y);
    y = addParagraph(doc, `Data Sources: ${nw.data_sources.join(', ')}`, y);
    y = addParagraph(doc, `Primary Actions: ${nw.primary_actions.join(', ')}`, y);
    y = addParagraph(doc, `Alerts/Signals: ${nw.alerts_or_signals.join(', ') || 'None'}`, y);
    y += 4;
  });

  return doc;
}

// ── Component ──

export default function OperatorManualsPage() {
  const [generating, setGenerating] = useState<string | null>(null);

  const handleDownload = async (manual: 'field-guide' | 'operator' | 'technical') => {
    setGenerating(manual);
    await new Promise(r => setTimeout(r, 50));
    try {
      if (manual === 'technical') {
        downloadTechnicalDocPdf();
      } else {
        const doc = manual === 'field-guide' ? generateFieldGuide() : generateOperatorManual();
        const filename = manual === 'field-guide'
          ? `CROS-Field-Guide-${new Date().toISOString().split('T')[0]}.pdf`
          : `CROS-Gardener-Steward-Manual-${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
      }
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="manuals-root">
      <div>
        <h1 className="text-xl font-semibold text-foreground font-serif">Reference Manuals</h1>
        <p className="text-sm text-muted-foreground">
          Generate structured PDF exports for physical printing. Each manual contains the full system inventory.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Field Guide */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif">
              <BookOpen className="h-5 w-5 text-primary" />
              CROS Field Guide
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
                    <p><strong>What:</strong> Tenant-facing reference book covering routes, roles, modules, and workflows.</p>
                    <p><strong>Where:</strong> For printing as a physical field guide for tenant admins and users.</p>
                    <p><strong>Why:</strong> Reduces imagination burden — teams can flip through pages to learn the system.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>
              The Tenant Reference Book — everything a Shepherd, Companion, or Visitor needs to understand the system.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-xs">Routes</Badge>
              <Badge variant="secondary" className="text-xs">Roles</Badge>
              <Badge variant="secondary" className="text-xs">Modules</Badge>
              <Badge variant="secondary" className="text-xs">Workflows</Badge>
              <Badge variant="secondary" className="text-xs">Navigation</Badge>
              <Badge variant="secondary" className="text-xs">Signals</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Excludes Gardener-only routes and Nexus workflows. Focused on the tenant experience.
            </p>
            <Button
              onClick={() => handleDownload('field-guide')}
              disabled={!!generating}
              className="w-full"
            >
              {generating === 'field-guide' ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
              ) : (
                <><Download className="mr-2 h-4 w-4" />Download Field Guide PDF</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Operator Manual */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif">
              <Shield className="h-5 w-5 text-primary" />
              Gardener Steward Manual
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
                    <p><strong>What:</strong> Complete platform reference including all Gardener workflows, signals, and system architecture.</p>
                    <p><strong>Where:</strong> For printing as a physical Gardener governance manual.</p>
                    <p><strong>Why:</strong> Platform stewards need a comprehensive reference for all systems under their care.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>
              The Platform Governance Reference — everything a Gardener needs to steward the entire CROS™ network.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-xs">All Routes</Badge>
              <Badge variant="secondary" className="text-xs">All Roles</Badge>
              <Badge variant="secondary" className="text-xs">All Modules</Badge>
              <Badge variant="secondary" className="text-xs">All Workflows</Badge>
              <Badge variant="secondary" className="text-xs">All Signals</Badge>
              <Badge variant="secondary" className="text-xs">Nexus Workflows</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Includes all sections from the Field Guide plus Gardener-only routes, Nexus workflows, and complete signal catalog.
            </p>
            <Button
              onClick={() => handleDownload('operator')}
              disabled={!!generating}
              className="w-full"
            >
              {generating === 'operator' ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
              ) : (
                <><Download className="mr-2 h-4 w-4" />Download Gardener Manual PDF</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Technical Architecture */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif">
              <Code2 className="h-5 w-5 text-primary" />
              Technical Architecture
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
                    <p><strong>What:</strong> Developer-level reference covering stack, data model, edge functions, security, and integrations.</p>
                    <p><strong>Where:</strong> For the Gardener or any developer onboarding to the platform.</p>
                    <p><strong>Why:</strong> A living document that evolves with the codebase — the single source of architectural truth.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>
              The Developer Reference — comprehensive technical documentation of the entire CROS™ architecture.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-xs">Stack</Badge>
              <Badge variant="secondary" className="text-xs">Data Model</Badge>
              <Badge variant="secondary" className="text-xs">Edge Functions</Badge>
              <Badge variant="secondary" className="text-xs">Security</Badge>
              <Badge variant="secondary" className="text-xs">Integrations</Badge>
              <Badge variant="secondary" className="text-xs">Testing</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              9 chapters covering platform overview, data model, edge functions, Gardener console, testing, integrations, marketing, security, and performance.
            </p>
            <Button
              onClick={() => handleDownload('technical')}
              disabled={!!generating}
              className="w-full"
            >
              {generating === 'technical' ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
              ) : (
                <><Download className="mr-2 h-4 w-4" />Download Technical Architecture PDF</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Preview section */}
      <Tabs defaultValue="routes" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="routes" className="text-xs">Routes</TabsTrigger>
          <TabsTrigger value="roles" className="text-xs">Roles</TabsTrigger>
          <TabsTrigger value="modules" className="text-xs">Modules</TabsTrigger>
          <TabsTrigger value="workflows" className="text-xs">Workflows</TabsTrigger>
          <TabsTrigger value="sidebar" className="text-xs">Sidebar</TabsTrigger>
          <TabsTrigger value="signals" className="text-xs">Signals</TabsTrigger>
          <TabsTrigger value="nexus" className="text-xs">Nexus</TabsTrigger>
        </TabsList>

        <TabsContent value="routes">
          <Card>
            <CardHeader><CardTitle className="text-sm">A. Route Inventory ({ROUTE_INVENTORY.length} routes)</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {ROUTE_INVENTORY.map((r, i) => (
                    <div key={i} className="text-xs border-b border-border/40 pb-2">
                      <code className="text-primary font-mono">{r.route_path}</code>
                      <span className="ml-2 text-foreground font-medium">{r.display_name}</span>
                      {r.latin_module && <Badge variant="outline" className="ml-2 text-[10px]">{r.latin_module}</Badge>}
                      <p className="text-muted-foreground mt-0.5">{r.description_of_primary_action}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader><CardTitle className="text-sm">B. Role Matrix</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {ROLE_MATRIX.map((r, i) => (
                    <div key={i} className="border border-border/40 rounded-lg p-3">
                      <h4 className="font-semibold text-sm text-foreground">{r.role}</h4>
                      <p className="text-xs text-muted-foreground mt-1"><strong>Navigation:</strong> {r.visible_navigation_groups.join(', ')}</p>
                      <p className="text-xs text-muted-foreground"><strong>Visible:</strong> {r.visible_modules.join(', ')}</p>
                      <p className="text-xs text-muted-foreground"><strong>Hidden:</strong> {r.hidden_modules.join(', ') || 'None'}</p>
                      <p className="text-xs text-muted-foreground"><strong>Entry:</strong> {r.onboarding_entry_point}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules">
          <Card>
            <CardHeader><CardTitle className="text-sm">C. Module Anatomy ({MODULE_ANATOMY.length} modules)</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {MODULE_ANATOMY.map((m, i) => (
                    <div key={i} className="border border-border/40 rounded-lg p-3">
                      <h4 className="font-semibold text-sm text-foreground">{m.system_module}</h4>
                      {m.latin_name && m.latin_name !== m.system_module && <Badge variant="outline" className="text-[10px]">{m.latin_name}</Badge>}
                      <p className="text-xs text-muted-foreground italic mt-1">{m.body_part_metaphor}</p>
                      <p className="text-xs text-muted-foreground mt-1">{m.narrative_purpose}</p>
                      <p className="text-xs text-muted-foreground"><strong>Tables:</strong> {m.core_tables.join(', ')}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows">
          <Card>
            <CardHeader><CardTitle className="text-sm">D. Core Workflows ({CORE_WORKFLOWS.length} flows)</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {CORE_WORKFLOWS.map((w, i) => (
                    <div key={i} className="border border-border/40 rounded-lg p-3">
                      <h4 className="font-semibold text-sm text-foreground">{w.flow_name}</h4>
                      <p className="text-xs text-muted-foreground"><code>{w.entry_page}</code> → <code>{w.exit_page}</code></p>
                      <p className="text-xs text-muted-foreground"><strong>Roles:</strong> {w.roles.join(', ')}</p>
                      <p className="text-xs text-muted-foreground"><strong>Signals:</strong> {w.signals_generated.join(', ')}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sidebar">
          <Card>
            <CardHeader><CardTitle className="text-sm">E. Sidebar Structure</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {SIDEBAR_STRUCTURE.map((s, i) => (
                    <div key={i} className="border border-border/40 rounded-lg p-3">
                      <h4 className="font-semibold text-sm text-foreground">{s.group}</h4>
                      <p className="text-xs text-muted-foreground">{s.items.join(' • ')}</p>
                      <p className="text-xs text-muted-foreground"><strong>Visible to:</strong> {s.visible_to.join(', ')}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signals">
          <Card>
            <CardHeader><CardTitle className="text-sm">F. Signal Types ({SIGNAL_TYPES.length} signals)</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {SIGNAL_TYPES.map((s, i) => (
                    <div key={i} className="text-xs border-b border-border/40 pb-2">
                      <Badge variant="outline" className="text-[10px]">{s.signal_type}</Badge>
                      <p className="text-muted-foreground mt-1">{s.trigger_event}</p>
                      <p className="text-muted-foreground"><strong>Tenant:</strong> {s.visible_surface} | <strong>Gardener:</strong> {s.operator_visibility}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nexus">
          <Card>
            <CardHeader><CardTitle className="text-sm">G. Nexus Workflows ({NEXUS_WORKFLOWS.length} workflows)</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {NEXUS_WORKFLOWS.map((nw, i) => (
                    <div key={i} className="border border-border/40 rounded-lg p-3">
                      <h4 className="font-semibold text-sm text-foreground">{nw.workflow}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{nw.purpose}</p>
                      <p className="text-xs text-muted-foreground"><strong>Sources:</strong> {nw.data_sources.join(', ')}</p>
                      <p className="text-xs text-muted-foreground"><strong>Actions:</strong> {nw.primary_actions.join(', ')}</p>
                      <p className="text-xs text-muted-foreground"><strong>Alerts:</strong> {nw.alerts_or_signals.join(', ') || 'None'}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
