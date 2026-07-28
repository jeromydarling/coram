/**
 * EssaysIndex — Public index of published CROS essays.
 *
 * WHAT: Lists published narrative essays grouped by Reflection Cycle.
 * WHERE: /essays or /essays?cycle=YYYY-MM
 * WHY: Monthly pagination with canonical URLs for SEO authority. Each cycle is crawlable.
 */
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import ReflectionCycleCard from '@/components/essays/ReflectionCycleCard';
import { Button } from '@/components/ui/button';

function formatCycleLabel(cycle: string): string {
  const [year, month] = cycle.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function EssaysIndex() {
  const [searchParams] = useSearchParams();
  const selectedCycle = searchParams.get('cycle');

  // Fetch all distinct cycles for navigation
  const { data: allEssays, isLoading } = useQuery({
    queryKey: ['published-essays'],
    queryFn: async () => {
      const { data, error } = await supabase.from('operator_content_drafts')
        .select('id, title, slug, draft_type, voice_origin, is_interim_content, published_at, body, collection, reflection_cycle, essay_type')
        .eq('status', 'published')
        .order('published_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Group essays by reflection_cycle
  const cycleGroups: Record<string, any[]> = {};
  allEssays?.forEach((essay: any) => {
    const cycle = essay.reflection_cycle || (essay.published_at ? essay.published_at.slice(0, 7) : 'undated');
    if (!cycleGroups[cycle]) cycleGroups[cycle] = [];
    cycleGroups[cycle].push(essay);
  });

  // Sort cycles descending
  const sortedCycles = Object.keys(cycleGroups).sort((a, b) => b.localeCompare(a));

  // Determine active cycle
  const activeCycle = selectedCycle && sortedCycles.includes(selectedCycle)
    ? selectedCycle
    : sortedCycles[0] || null;

  const activeIndex = activeCycle ? sortedCycles.indexOf(activeCycle) : -1;
  const prevCycle = activeIndex > 0 ? sortedCycles[activeIndex - 1] : null;
  const nextCycle = activeIndex < sortedCycles.length - 1 ? sortedCycles[activeIndex + 1] : null;

  const activeEssays = activeCycle ? cycleGroups[activeCycle] || [] : [];
  const pageTitle = activeCycle ? `${formatCycleLabel(activeCycle)} — Essays` : 'Essays';
  const canonical = activeCycle && selectedCycle ? `/essays?cycle=${activeCycle}` : '/essays';

  // JSON-LD CollectionPage
  const jsonLd = activeCycle ? {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: pageTitle,
    description: `Reflections from the ${formatCycleLabel(activeCycle)} cycle.`,
    url: `https://thecros.lovable.app${canonical}`,
    isPartOf: { '@type': 'WebSite', name: 'CROS™', url: 'https://thecros.lovable.app' },
  } : undefined;

  return (
    <>
      <SeoHead
        title={pageTitle}
        description={activeCycle
          ? `Reflections from the ${formatCycleLabel(activeCycle)} cycle — essays on community work, relational intelligence, and the people who show up.`
          : 'Reflections on community work, relational intelligence, and the people who show up every day.'}
        canonical={canonical}
        jsonLd={jsonLd}
      />

      <main className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <SeoBreadcrumb items={[
          { label: 'Home', to: '/' },
          { label: 'Essays', to: '/essays' },
          ...(activeCycle && selectedCycle ? [{ label: formatCycleLabel(activeCycle) }] : []),
        ]} />
        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground font-serif mb-3">Essays</h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            We don't publish content for algorithms. We publish reflections that help people see their work more clearly.
          </p>
        </header>

        {isLoading ? (
          <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
        ) : sortedCycles.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-serif">Essays are being written. Check back soon.</p>
          </div>
        ) : (
          <>
            {/* Cycle selector — horizontal scrollable list */}
            <nav aria-label="Reflection cycles" className="mb-8 -mx-4 px-4 overflow-x-auto">
              <div className="flex gap-2 pb-2 min-w-max">
                {sortedCycles.map((cycle) => (
                  <Link
                    key={cycle}
                    to={cycle === sortedCycles[0] ? '/essays' : `/essays?cycle=${cycle}`}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                      cycle === activeCycle
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    {formatCycleLabel(cycle)}
                    <span className="ml-1.5 text-xs opacity-70">({cycleGroups[cycle].length})</span>
                  </Link>
                ))}
              </div>
            </nav>

            {/* Active cycle essays */}
            {activeCycle && (
              <ReflectionCycleCard cycle={activeCycle} essays={activeEssays} />
            )}

            {/* Prev / Next navigation */}
            <nav aria-label="Cycle pagination" className="flex items-center justify-between mt-10 pt-6 border-t border-border/50">
              {nextCycle ? (
                <Link to={`/essays?cycle=${nextCycle}`} className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                  <div className="text-left">
                    <span className="block text-xs text-muted-foreground">Older</span>
                    <span className="font-medium">{formatCycleLabel(nextCycle)}</span>
                  </div>
                </Link>
              ) : <div />}
              {prevCycle ? (
                <Link to={prevCycle === sortedCycles[0] ? '/essays' : `/essays?cycle=${prevCycle}`} className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors text-right">
                  <div>
                    <span className="block text-xs text-muted-foreground">Newer</span>
                    <span className="font-medium">{formatCycleLabel(prevCycle)}</span>
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : <div />}
            </nav>
          </>
        )}
      </main>
    </>
  );
}
