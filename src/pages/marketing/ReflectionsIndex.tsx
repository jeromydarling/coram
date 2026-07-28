/**
 * ReflectionsIndex — Public listing of monthly reflections AND Living Library essays.
 *
 * WHAT: Displays published monthly reflections and library essays in one feed.
 * WHERE: /reflections or /reflections/:year/:month
 * WHY: Until monthly reflections populate, shows Living Library essays alongside them.
 */
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import { BookOpen } from 'lucide-react';

function formatMonthYear(year: string, month: string): string {
  const d = new Date(parseInt(year), parseInt(month) - 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

interface FeedItem {
  id: string;
  title: string;
  slug: string;
  published_at: string | null;
  excerpt: string;
  badge: string;
  isNri: boolean;
  linkTo: string;
}

export default function ReflectionsIndex() {
  const { year, month } = useParams<{ year?: string; month?: string }>();

  /* ── Monthly reflections from editorial pipeline ── */
  const { data: reflections, isLoading: loadingReflections } = useQuery({
    queryKey: ['published-reflections', year, month],
    queryFn: async () => {
      let query = supabase.from('operator_content_drafts')
        .select('id, title, slug, published_at, body, voice_origin, editorial_mode, reflection_cycle, month_tag')
        .eq('status', 'published')
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false });

      if (year && month) {
        query = query.eq('reflection_cycle', `${year}-${month.padStart(2, '0')}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  /* ── Living Library essays ── */
  const { data: essays, isLoading: loadingEssays } = useQuery({
    queryKey: ['published-library-essays'],
    queryFn: async () => {
      const { data, error } = await supabase.from('library_essays')
        .select('id, title, slug, excerpt, published_at, source_type')
        .eq('status', 'published')
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !year && !month, // only load essays on the main index, not filtered views
  });

  /* ── Merge into single feed ── */
  const feedItems: FeedItem[] = [];

  reflections?.forEach((r: any) => {
    feedItems.push({
      id: r.id,
      title: r.title,
      slug: r.slug,
      published_at: r.published_at,
      excerpt: r.body?.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 250) || '',
      badge: r.editorial_mode === 'monthly_reflection' ? 'Monthly Reflection' : 'Essay',
      isNri: r.voice_origin === 'nri',
      linkTo: `/essays/${r.slug}`,
    });
  });

  essays?.forEach((e: any) => {
    feedItems.push({
      id: e.id,
      title: e.title,
      slug: e.slug,
      published_at: e.published_at,
      excerpt: e.excerpt?.slice(0, 250) || '',
      badge: 'Living Library',
      isNri: e.source_type === 'nri_generated',
      linkTo: `/essays/${e.slug}`,
    });
  });

  // Sort merged feed by published_at descending
  feedItems.sort((a, b) => {
    const da = a.published_at ? new Date(a.published_at).getTime() : 0;
    const db = b.published_at ? new Date(b.published_at).getTime() : 0;
    return db - da;
  });

  const isLoading = loadingReflections || loadingEssays;

  const pageTitle = year && month
    ? `Reflections from ${formatMonthYear(year, month)}`
    : 'Reflections & Living Library';
  const canonical = year && month ? `/reflections/${year}/${month}` : '/reflections';

  return (
    <>
      <SeoHead
        title={`${pageTitle} — CROS`}
        description="Monthly reflections and narrative essays from across the CROS network — observing what moved, what shifted, and what leaders are noticing."
        canonical={canonical}
      />
      <SeoBreadcrumb items={[
        { label: 'Home', to: '/' },
        { label: 'Library', to: '/library' },
        { label: 'Reflections', to: '/reflections' },
        ...(year && month ? [{ label: formatMonthYear(year, month) }] : []),
      ]} />

      <main className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground font-serif mb-3">{pageTitle}</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Narrative essays and monthly reflections from across the CROS network — observing what moved, what shifted, and what leaders are noticing.
          </p>
        </header>

        {isLoading ? (
          <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
        ) : !feedItems.length ? (
          <div className="text-center py-16">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-serif">
              {year && month
                ? `No reflections published for ${formatMonthYear(year, month)} yet.`
                : 'Essays and reflections are being gathered. Check back soon.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {feedItems.map((item) => (
              <Link key={item.id} to={item.linkTo} className="block group">
                <article className="p-5 rounded-lg border border-border/50 hover:border-primary/20 transition-colors">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className="text-xs">{item.badge}</Badge>
                    {item.isNri && <Badge variant="secondary" className="text-xs">NRI</Badge>}
                  </div>
                  <h2 className="text-lg font-semibold text-foreground font-serif group-hover:text-primary transition-colors">
                    {item.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
                    {item.excerpt}
                  </p>
                  {item.published_at && (
                    <time className="text-xs text-muted-foreground mt-3 block" dateTime={item.published_at}>
                      {new Date(item.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </time>
                  )}
                </article>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
