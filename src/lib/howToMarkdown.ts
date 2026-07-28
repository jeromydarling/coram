/**
 * howToMarkdown — Markdown export for the Gardener Guide.
 *
 * WHAT: Generates a comprehensive markdown file from the nav registry.
 * WHERE: Called from OperatorHowToPage download button.
 * WHY: Portable knowledge transfer — paste into any project context.
 */

import { ZONE_LABELS, type GardenerZone } from '@/lib/gardenerNavRegistry';
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

const ZONE_ORDER: GardenerZone[] = ['cura', 'machina', 'crescere', 'scientia', 'silentium'];

export function downloadHowToMarkdown(sections: HowToSection[]) {
  const lines: string[] = [];

  lines.push(`# ${brand.appName}™ — Gardener Guide`);
  lines.push('');
  lines.push(`> ${brand.fullName}`);
  lines.push(`> Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Zone overview
  lines.push('## What is the Gardener Console?');
  lines.push('');
  lines.push('The Gardener Console is the ecosystem stewardship layer for CROS, organized into five zones:');
  lines.push('');
  for (const key of ZONE_ORDER) {
    const z = ZONE_LABELS[key];
    lines.push(`- **${z.label}** — ${z.description}`);
  }
  lines.push('');

  // Routines
  lines.push('### Daily Routine');
  lines.push('Check Dashboard → review Error Desk → scan Automation Results → glance at System Health → triage Intake.');
  lines.push('');
  lines.push('### Weekly Routine');
  lines.push('Review Testimonium rollups → audit Communio privacy → check tenant usage trends → review Partner pipeline → check Activation readiness → review Adoption depth.');
  lines.push('');
  lines.push('### Pre-Release');
  lines.push('System Health → Walk the Garden tab → run full sweep → review scoreboard → QA Hub tests → Tour for screenshots.');
  lines.push('');
  lines.push('### Outreach Cycle');
  lines.push('Create tracking links in Outreach → schedule demos → convert partners → monitor Activation progress.');
  lines.push('');
  lines.push('---');
  lines.push('');

  // Sections by zone
  for (const zone of ZONE_ORDER) {
    const zoneSections = sections.filter(s => s.zone === zone);
    if (zoneSections.length === 0) continue;

    const zoneInfo = ZONE_LABELS[zone];
    lines.push(`## ${zoneInfo.label}`);
    lines.push(`*${zoneInfo.description}* — ${zoneSections.length} sections`);
    lines.push('');

    for (const s of zoneSections) {
      lines.push(`### ${s.title}`);
      lines.push(`**Route:** \`${s.route}\``);
      if (s.tabs && s.tabs.length > 0) {
        lines.push(`**Tabs:** ${s.tabs.join(', ')}`);
      }
      lines.push('');
      lines.push(s.summary);
      lines.push('');

      if (s.whatYouSee.length > 0 && s.whatYouSee[0] !== 'This page!') {
        lines.push("#### What You'll See");
        for (const item of s.whatYouSee) {
          lines.push(`- ${item}`);
        }
        lines.push('');
      }

      if (s.whatToDo.length > 0) {
        lines.push('#### What To Do');
        for (const item of s.whatToDo) {
          lines.push(`- ${item}`);
        }
        lines.push('');
      }

      if (s.tips && s.tips.length > 0) {
        lines.push('#### Tips');
        for (const tip of s.tips) {
          lines.push(`- 💡 ${tip}`);
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }
  }

  // Stats
  lines.push(`*${sections.length} sections across ${ZONE_ORDER.length} zones.*`);

  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'CROS-Gardener-Guide.md';
  a.click();
  URL.revokeObjectURL(url);
}
