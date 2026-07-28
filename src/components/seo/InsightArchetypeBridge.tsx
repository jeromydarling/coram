/**
 * InsightArchetypeBridge — Archetype CTA block for insight essays.
 *
 * WHAT: Shows a suggested archetype with a link to the archetypes page.
 * WHERE: Inside /insights/:slug pages, after essay body.
 * WHY: Bridges narrative content to archetype selection for deeper funnel movement.
 */
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { archetypes, type ArchetypeKey } from '@/config/brand';

interface InsightArchetypeBridgeProps {
  archetypeKey?: string;
}

export default function InsightArchetypeBridge({ archetypeKey }: InsightArchetypeBridgeProps) {
  if (!archetypeKey) return null;

  const arch = archetypes[archetypeKey as ArchetypeKey];
  if (!arch) return null;

  return (
    <div className="mt-10 rounded-2xl border border-[hsl(var(--marketing-border))] p-6 bg-[hsl(var(--marketing-surface))]">
      <p className="text-xs font-medium text-[hsl(var(--marketing-navy)/0.5)] uppercase tracking-wider mb-2">
        Suggested archetype
      </p>
      <h3 className="text-lg font-semibold text-[hsl(var(--marketing-navy))]">
        {arch.name}
      </h3>
      <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] mt-1 mb-4 leading-relaxed">
        {arch.tagline}
      </p>
      <Link to="/archetypes">
        <Button
          variant="outline"
          className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))] hover:bg-white px-5"
        >
          See all archetypes <ArrowRight className="ml-2 h-3.5 w-3.5" />
        </Button>
      </Link>
    </div>
  );
}
