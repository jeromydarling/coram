/**
 * useEssayPublish — Publish/unpublish Living Library essays with SEO + insight generation.
 *
 * WHAT: Updates library_essays status, generates SEO metadata, and creates gardener_insights on review-ready.
 * WHERE: Used in Gardener Content Studio for essay management.
 * WHY: Ensures SEO gating (noindex for drafts, index for published) and wires essay-ready notifications.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { generateLibraryEssaySeo } from '@/lib/seo/librarySeo';
import {
  generateEssayReadyInsight,
  type InsightCandidate,
} from '@/lib/operator/gardenerInsightGenerator';
import { toast } from '@/components/ui/sonner';
import { triggerEssayImageGeneration } from '@/lib/essays/triggerEssayImageGeneration';

async function upsertInsight(insight: InsightCandidate) {
  await supabase
    .from('gardener_insights')
    .upsert(
      {
        type: insight.type,
        severity: insight.severity,
        title: insight.title,
        body: insight.body,
        suggested_next_steps: insight.suggested_next_steps,
        related_links: insight.related_links,
        dedupe_key: insight.dedupe_key,
      },
      { onConflict: 'dedupe_key' }
    );
}

export function usePublishLibraryEssay() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'publish' | 'unpublish' | 'ready_for_review' }) => {
      // Fetch current essay
      const { data: essay, error: fetchErr } = await supabase
        .from('library_essays')
        .select('*')
        .eq('id', id)
        .single();
      if (fetchErr || !essay) throw new Error('Essay not found');

      if (action === 'publish') {
        const seo = generateLibraryEssaySeo(essay, true);
        // schema_json cast needed due to Json type mismatch
        const { error } = await supabase
          .from('library_essays')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            meta_robots: 'index,follow',
            seo_title: seo.seo_title,
            seo_description: seo.seo_description,
            canonical_url: seo.canonical_url,
            schema_json: seo.schema_json as any,
          })
          .eq('id', id);
        if (error) throw error;
      } else if (action === 'unpublish') {
        const { error } = await supabase
          .from('library_essays')
          .update({
            status: 'draft',
            meta_robots: 'noindex,nofollow',
            published_at: null,
          })
          .eq('id', id);
        if (error) throw error;
      } else if (action === 'ready_for_review') {
        const seo = generateLibraryEssaySeo(essay, false);
        // schema_json cast needed due to Json type mismatch
        const { error } = await supabase
          .from('library_essays')
          .update({
            status: 'ready_for_review',
            seo_title: seo.seo_title,
            seo_description: seo.seo_description,
            canonical_url: seo.canonical_url,
            schema_json: seo.schema_json as any,
          })
          .eq('id', id);
        if (error) throw error;

        // Wire Check #9: Create gardener insight notification
        const insight = generateEssayReadyInsight(essay.title, essay.slug);
        await upsertInsight(insight);
      }
    },
    onSuccess: (_, { action }) => {
      qc.invalidateQueries({ queryKey: ['library-essays'] });
      qc.invalidateQueries({ queryKey: ['gardener-insights'] });
      const msg = action === 'publish'
        ? 'Essay published with full SEO'
        : action === 'unpublish'
          ? 'Essay unpublished (noindex applied)'
          : 'Essay marked ready for review';
      toast.success(msg);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Something unexpected happened');
    },
  });
}
