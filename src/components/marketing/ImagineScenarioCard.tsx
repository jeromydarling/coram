/**
 * ImagineScenarioCard — Narrative scenario card for the Imagine This page.
 *
 * WHAT: Renders a single mission scenario with warm, editorial styling.
 * WHERE: /imagine-this page, Sections 1-3.
 * WHY: Helps leaders picture daily work with CROS without feature lists.
 */
import type { ImagineScenario } from '@/content/imagineThis';

interface Props {
  scenario: ImagineScenario;
  index: number;
}

export default function ImagineScenarioCard({ scenario, index }: Props) {
  return (
    <article
      className="rounded-2xl border border-[hsl(var(--marketing-border))] bg-white p-6 sm:p-8"
      data-testid={`imagine-scenario-${index}`}
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-blue))] mb-3 block">
        {scenario.label}
      </span>
      <h3
        className="text-xl sm:text-2xl text-[hsl(var(--marketing-navy))] leading-snug mb-5"
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
      >
        {scenario.title}
      </h3>
      <div className="space-y-4">
        {scenario.paragraphs.map((p, i) => (
          <p
            key={i}
            className="text-base text-[hsl(var(--marketing-navy)/0.65)] leading-[1.8]"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {p}
          </p>
        ))}
      </div>
    </article>
  );
}
