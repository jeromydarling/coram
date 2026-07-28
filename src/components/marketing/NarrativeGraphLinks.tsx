/**
 * NarrativeGraphLinks — Semantic internal links from the narrative knowledge graph.
 *
 * WHAT: Renders "You may also explore" links based on archetype/role/concept graph.
 * WHERE: Bottom of archetype deep pages, role pages, NRI page.
 * WHY: Deterministic semantic linking for SEO authority and narrative discovery.
 */
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, Layers, BookOpen } from 'lucide-react';
import type { GraphNode } from '@/content/narrativeGraph';
import { useTranslation } from 'react-i18next';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  role: Compass,
  archetype: Layers,
  concept: BookOpen,
};

interface Props {
  nodes: GraphNode[];
  heading?: string;
  max?: number;
}

export default function NarrativeGraphLinks({
  nodes,
  heading,
  max = 6,
}: Props) {
  const { t } = useTranslation('marketing');
  const resolvedHeading = heading ?? t('narrativeGraphLinks.defaultHeading');
  const typeLabels: Record<string, string> = {
    role: t('narrativeGraphLinks.typeLabels.role'),
    archetype: t('narrativeGraphLinks.typeLabels.archetype'),
    concept: t('narrativeGraphLinks.typeLabels.concept'),
    signal: t('narrativeGraphLinks.typeLabels.signal'),
  };
  const visible = nodes.slice(0, max);
  if (visible.length === 0) return null;

  return (
    <section className="py-8">
      <p
        className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.35)] mb-4"
      >
        {resolvedHeading}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {visible.map((node) => {
          const Icon = typeIcons[node.type] || BookOpen;
          return (
            <Link
              key={node.path}
              to={node.path}
              className="flex items-center gap-3 rounded-xl bg-[hsl(var(--marketing-surface))] p-4 hover:bg-white transition-colors group border border-transparent hover:border-[hsl(var(--marketing-border))]"
            >
              <Icon className="h-4 w-4 text-[hsl(var(--marketing-blue)/0.5)] shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-[hsl(var(--marketing-navy))]" style={serif}>
                  {node.label}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.3)] ml-2">
                  {typeLabels[node.type]}
                </span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-[hsl(var(--marketing-navy)/0.2)] group-hover:text-[hsl(var(--marketing-navy)/0.5)] transition-colors shrink-0" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
