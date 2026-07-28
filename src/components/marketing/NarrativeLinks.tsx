/**
 * NarrativeLinks — Auto-rendered internal links from the content graph.
 *
 * WHAT: Reads CONTENT_GRAPH and renders 3-4 contextual narrative links.
 * WHERE: Inline within any marketing page that passes its current path.
 * WHY: Ensures SEO internal linking authority without manual editing per page.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { getRelatedContent } from '@/lib/contentGraph';

interface Props {
  currentPath: string;
  max?: number;
  className?: string;
}

export default function NarrativeLinks({ currentPath, max = 3, className = '' }: Props) {
  const related = getRelatedContent(currentPath, max);
  if (related.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {related.map((node) => (
        <Link
          key={node.path}
          to={node.path}
          className="inline-flex items-center gap-1.5 bg-[hsl(var(--marketing-surface))] text-[hsl(var(--marketing-navy)/0.6)] hover:text-[hsl(var(--marketing-navy))] px-3 py-1.5 rounded-full text-xs font-medium transition-colors border border-[hsl(var(--marketing-navy)/0.06)]"
        >
          {node.title}
          <ArrowRight className="h-3 w-3" />
        </Link>
      ))}
    </div>
  );
}
