/**
 * CivicGravityBlock — Aggregated civic patterns for metros and archetypes.
 *
 * WHAT: Shows active archetypes, narrative themes, and seasonal focus from published metro pages.
 * WHERE: /metros/:metroSlug, /archetypes/:archetypeSlug
 * WHY: Living ecosystem surface — civic gravity without tenant exposure.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Layers, Compass, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

interface Props {
  metroSlug?: string;
  archetypeSlug?: string;
}

export default function CivicGravityBlock({ metroSlug, archetypeSlug }: Props) {
  const { t } = useTranslation('marketing');
  const { data: pages } = useQuery({
    queryKey: ['civic-gravity', metroSlug, archetypeSlug],
    queryFn: async () => {
      let query = supabase
        .from('public_metro_pages')
        .select('display_name, slug, archetypes_active, momentum_summary, narrative_summary')
        .eq('status', 'published')
        .order('updated_at', { ascending: false })
        .limit(6);
      if (metroSlug) query = query.eq('slug', metroSlug);
      const { data } = await query;
      return data || [];
    },
    staleTime: 5 * 60_000,
  });

  if (!pages || pages.length === 0) return null;

  // Aggregate archetypes across metros
  const allArchetypes = new Set<string>();
  const themes: string[] = [];
  for (const p of pages) {
    if (Array.isArray(p.archetypes_active)) {
      p.archetypes_active.forEach((a: string) => allArchetypes.add(a));
    }
    if (p.narrative_summary) themes.push(p.narrative_summary);
  }

  // Filter by archetype if specified
  const filteredArchetypes = archetypeSlug
    ? [...allArchetypes].filter((a) =>
        a.toLowerCase().replace(/\s+/g, '-').includes(archetypeSlug)
      )
    : [...allArchetypes];

  // Seasonal focus (deterministic from current month)
  const month = new Date().getMonth();
  const seasonalFocus =
    month >= 2 && month <= 4
      ? t('civicGravityBlock.seasonal.spring')
      : month >= 5 && month <= 7
      ? t('civicGravityBlock.seasonal.summer')
      : month >= 8 && month <= 10
      ? t('civicGravityBlock.seasonal.autumn')
      : t('civicGravityBlock.seasonal.winter');

  return (
    <section className="py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-5">
        {/* Active archetypes */}
        {filteredArchetypes.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-[hsl(var(--marketing-blue))]" />
              <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)]">
                {t('civicGravityBlock.archetypesLabel')}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {filteredArchetypes.slice(0, 8).map((a) => (
                <span
                  key={a}
                  className="inline-block text-xs px-3 py-1.5 rounded-full bg-[hsl(var(--marketing-surface))] text-[hsl(var(--marketing-navy)/0.6)] border border-[hsl(var(--marketing-navy)/0.08)]"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Narrative themes */}
        {themes.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Compass className="h-4 w-4 text-[hsl(var(--marketing-blue))]" />
              <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)]">
                {t('civicGravityBlock.narrativeThemesLabel')}
              </p>
            </div>
            <div className="space-y-2">
              {themes.slice(0, 3).map((t, i) => (
                <p key={i} className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed" style={serif}>
                  {t}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Seasonal focus */}
        <div className="rounded-xl bg-[hsl(var(--marketing-surface))] px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <Sun className="h-4 w-4 text-[hsl(var(--marketing-blue))]" />
            <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)]">
              {t('civicGravityBlock.seasonalFocusLabel')}
            </p>
          </div>
          <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed" style={serif}>
            {seasonalFocus}
          </p>
        </div>
      </div>
    </section>
  );
}
