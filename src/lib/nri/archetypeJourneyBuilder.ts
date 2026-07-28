/**
 * archetypeJourneyBuilder — Assembles anchor essays per archetype.
 *
 * WHAT: Queries anchor essays filtered by archetype alignment and builds journey cards.
 * WHERE: /archetypes, /help/adoption, /onboarding contexts.
 * WHY: Anchor essays shape archetype journeys — living memory, not static content.
 */
import { supabase } from '@/integrations/supabase/client';

export interface AnchorEssay {
  id: string;
  title: string;
  slug: string;
  editorial_mode: string;
  gravity_score: number;
  anchor_reason: string | null;
  reflection_cycle: string | null;
  published_at: string | null;
  voice_origin: string | null;
}

export interface ArchetypeJourney {
  archetype: string;
  anchors: AnchorEssay[];
  reflections: AnchorEssay[];
  fieldNotes: AnchorEssay[];
}

/**
 * Fetch anchor essays aligned to a specific archetype key.
 */
export async function fetchArchetypeJourney(archetypeKey: string): Promise<ArchetypeJourney> {
  const { data, error } = await supabase
    .from('operator_content_drafts')
    .select('id, title, slug, editorial_mode, gravity_score, anchor_reason, reflection_cycle, published_at, voice_origin')
    .eq('status', 'published')
    .contains('anchor_archetypes', [archetypeKey])
    .order('gravity_score', { ascending: false })
    .limit(50);

  if (error) throw error;

  const essays: AnchorEssay[] = data || [];

  return {
    archetype: archetypeKey,
    anchors: essays.filter(e => e.editorial_mode === 'long_essay' || e.gravity_score >= 10),
    reflections: essays.filter(e => e.editorial_mode === 'monthly_reflection'),
    fieldNotes: essays.filter(e => e.editorial_mode === 'field_note'),
  };
}

/**
 * Fetch all published anchor essays (is_anchor = true), regardless of archetype.
 */
export async function fetchAllAnchors(): Promise<AnchorEssay[]> {
  const { data, error } = await supabase
    .from('operator_content_drafts')
    .select('id, title, slug, editorial_mode, gravity_score, anchor_reason, reflection_cycle, published_at, voice_origin, anchor_archetypes')
    .eq('status', 'published')
    .eq('is_anchor', true)
    .order('gravity_score', { ascending: false })
    .limit(30);

  if (error) throw error;
  return data || [];
}

/**
 * Gravity threshold for anchor promotion.
 * n8n updates gravity_score; operator confirms promotion via Nexus panel.
 */
export const ANCHOR_GRAVITY_THRESHOLD = 10;
