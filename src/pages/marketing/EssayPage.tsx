/**
 * EssayPage — Single published essay with full SEO via Narrative SEO Engine.
 *
 * WHAT: Renders a published essay with auto-generated JSON-LD, meta tags, semantic keywords, and internal links.
 * WHERE: /essays/:slug
 * WHY: Narrative authority page — not a blog post. SEO artifacts generated systemically.
 */
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDiscernmentSignal } from '@/hooks/useDiscernmentSignal';
import { sanitizeHtml } from '@/lib/sanitize';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import SeoHead from '@/components/seo/SeoHead';
import { generateNarrativeSEO } from '@/lib/narrativeSEO';
import { EssayConnections } from '@/components/essays/EssayConnections';

function formatCycleLabel(cycle: string | null): string | null {
  if (!cycle) return null;
  const [year, month] = cycle.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + ' Reflections';
}

export default function EssayPage() {
  const emit = useDiscernmentSignal('essays');
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => { if (slug) emit('essay_read_start', slug); }, [slug, emit]);
  const { data: essay, isLoading } = useQuery({
    queryKey: ['essay', slug],
    queryFn: async () => {
      const { data, error } = await supabase.from('operator_content_drafts')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return <div className="max-w-3xl mx-auto px-4 py-16"><Skeleton className="h-96" /></div>;
  }

  if (!essay) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-serif text-foreground mb-2">Essay not found</h1>
        <p className="text-muted-foreground">This essay may not be published yet.</p>
      </div>
    );
  }

  const description = (essay.seo_description || essay.body?.replace(/[#*_]/g, '').slice(0, 155)) || '';
  const canonical = `/essays/${essay.slug}`;
  const cycleLabel = formatCycleLabel(essay.reflection_cycle);

  const seo = generateNarrativeSEO({
    title: essay.seo_title || essay.title,
    summary: description,
    canonical,
    publishDate: essay.published_at,
    updatedDate: essay.updated_at,
    voiceOrigin: essay.voice_origin as any,
    essayType: essay.editorial_mode || essay.essay_type,
    collection: essay.collection,
    ogImage: essay.og_image,
    reflectionText: essay.body,
    pageType: 'essay',
  });

  const isHtml = essay.body?.startsWith('<') && essay.body?.includes('>');

  function stripLeadingH1(html: string): string {
    return html.replace(/^\s*<h1[^>]*>.*?<\/h1>\s*/i, '');
  }

  const renderedBody = isHtml ? stripLeadingH1(essay.body) : essay.body;

  return (
    <>
      <SeoHead
        title={essay.seo_title || essay.title}
        description={description}
        canonical={canonical}
        ogImage={essay.og_image}
        ogType="article"
        keywords={seo.semanticKeywords}
        jsonLd={seo.schemaJSONLD}
      />

      <article
        className="max-w-3xl mx-auto px-4 py-16"
        data-origin={essay.is_interim_content ? 'interim' : 'tenant'}
        data-anchor={essay.is_anchor ? 'true' : undefined}
        data-gravity={essay.is_anchor ? essay.gravity_score : undefined}
      >
        {/* Hero image */}
        {essay.hero_image_url && (
          <div className="mb-8 rounded-lg overflow-hidden border border-border/30">
            <img
              src={essay.hero_image_url}
              alt=""
              className="w-full h-auto object-cover max-h-[360px] opacity-90"
              loading="eager"
            />
          </div>
        )}

        <header className="mb-8">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Badge variant="outline">{essay.editorial_mode === 'field_note' ? 'Field Note' : essay.editorial_mode === 'monthly_reflection' ? 'Monthly Reflection' : essay.essay_type || essay.draft_type}</Badge>
            {essay.voice_origin === 'nri' && <Badge variant="secondary">NRI</Badge>}
            {essay.is_anchor && <Badge variant="default" className="text-xs">Anchor Essay</Badge>}
            {essay.is_interim_content && <Badge variant="outline" className="text-xs">Gardener Curated</Badge>}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground font-serif leading-tight mb-3">
            {essay.title}
          </h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {cycleLabel && (
              <span className="font-serif italic">{cycleLabel}</span>
            )}
            {essay.published_at && cycleLabel && <span>·</span>}
            {essay.published_at && (
              <time dateTime={essay.published_at}>
                {new Date(essay.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
              </time>
            )}
          </div>
        </header>

        {isHtml ? (
          <section
            className="prose prose-neutral dark:prose-invert max-w-none
              [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
              prose-headings:font-serif prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
              prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2
              prose-p:text-base prose-p:leading-relaxed prose-p:mb-4
              prose-blockquote:border-l-primary prose-blockquote:italic
              prose-strong:text-foreground prose-em:text-foreground
              prose-li:text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderedBody) }}
          />
        ) : (
          <section className="prose prose-neutral dark:prose-invert max-w-none">
            {(renderedBody?.split('\n').filter((l: string) => l.trim()) || []).map((line: string, i: number) => {
              if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-semibold text-foreground font-serif mt-6 mb-2">{line.replace('### ', '')}</h3>;
              if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-semibold text-foreground font-serif mt-8 mb-3">{line.replace('## ', '')}</h2>;
              if (line.startsWith('# ')) return null;
              if (line.startsWith('---')) return <hr key={i} className="my-6 border-border" />;
              return <p key={i} className="text-base text-muted-foreground leading-relaxed mb-4">{line}</p>;
            })}
          </section>
        )}


        <EssayConnections currentSlug={essay.slug} collection={essay.collection} />
      </article>
    </>
  );
}
