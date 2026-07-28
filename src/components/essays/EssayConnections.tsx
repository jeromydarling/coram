/**
 * EssayConnections — Internal linking component for essay pages.
 *
 * WHAT: Shows related essays and key CROS pages for SEO authority.
 * WHERE: Bottom of every essay page.
 * WHY: Builds internal link graph without aggressive CTAs.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

interface Props {
  currentSlug: string;
  collection?: string | null;
}

const STATIC_LINKS = [
  { name: 'What is NRI?', url: '/nri' },
  { name: 'Mission Archetypes', url: '/archetypes' },
  { name: 'Ministry Roles', url: '/roles' },
  { name: 'Explore CROS', url: '/pricing' },
];

export function EssayConnections({ currentSlug, collection }: Props) {
  const { data: related } = useQuery({
    queryKey: ['related-essays', currentSlug],
    queryFn: async () => {
      let q = supabase.from('operator_content_drafts')
        .select('slug, title, draft_type')
        .eq('status', 'published')
        .neq('slug', currentSlug)
        .order('published_at', { ascending: false })
        .limit(3);

      if (collection) q = q.eq('collection', collection);

      const { data } = await q;
      return data || [];
    },
  });

  const hasRelated = related && related.length > 0;

  return (
    <nav className="mt-12 pt-8 border-t border-border" aria-label="Related content">
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
        Continue Reading
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {hasRelated && related.map((r: any) => (
          <Link key={r.slug} to={`/essays/${r.slug}`}>
            <Card className="hover:border-primary/20 transition-colors h-full">
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <span className="text-sm text-foreground">{r.title}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
        {STATIC_LINKS.slice(0, hasRelated ? 1 : 4).map(link => (
          <Link key={link.url} to={link.url}>
            <Card className="hover:border-primary/20 transition-colors h-full">
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <span className="text-sm text-foreground">{link.name}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </nav>
  );
}
