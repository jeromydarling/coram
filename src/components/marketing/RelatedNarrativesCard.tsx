/**
 * RelatedNarrativesCard — "Continue the story" related reading section.
 *
 * WHAT: Renders 3-4 related narrative links based on the content graph.
 * WHERE: Bottom of week pages, archetype pages, roles page, NRI page.
 * WHY: Creates internal linking for SEO authority without manual editing.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getRelatedContent } from '@/lib/contentGraph';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

interface Props {
  currentPath: string;
  max?: number;
}

export default function RelatedNarrativesCard({ currentPath, max = 4 }: Props) {
  const { t } = useTranslation('marketing');
  const related = getRelatedContent(currentPath, max);
  if (related.length === 0) return null;

  return (
    <section className="py-8">
      <p
        className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.35)] mb-4"
      >
        {t('relatedNarrativesCard.heading')}
      </p>
      <div className="space-y-2">
        {related.map((node) => (
          <Link
            key={node.path}
            to={node.path}
            className="flex items-center justify-between rounded-xl bg-[hsl(var(--marketing-surface))] p-4 hover:bg-white transition-colors group"
          >
            <div className="min-w-0">
              <span className="text-sm font-medium text-[hsl(var(--marketing-navy))]" style={serif}>
                {node.title}
              </span>
              {node.subtitle && (
                <span className="text-xs text-[hsl(var(--marketing-navy)/0.4)] ml-2 hidden sm:inline">
                  {node.subtitle}
                </span>
              )}
              <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.3)] ml-2">
                {t(`relatedNarrativesCard.categoryLabels.${node.category}`, { defaultValue: node.category })}
              </span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-[hsl(var(--marketing-navy)/0.25)] group-hover:text-[hsl(var(--marketing-navy)/0.5)] transition-colors flex-shrink-0" />
          </Link>
        ))}
      </div>
    </section>
  );
}
