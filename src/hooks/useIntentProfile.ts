import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface IntentProfile {
  id: string;
  module: string;
  required_all: string[];
  required_any: string[];
  blocked_patterns: string[];
  enforced_suffix: string;
  scope_mode: string;
}

// Hardcoded fallbacks matching DB seeds
const FALLBACK_PROFILES: Record<string, IntentProfile> = {
  people: {
    id: 'fallback-people',
    module: 'people',
    required_all: [],
    required_any: ['staff', 'team', 'leadership', 'people', 'board', 'about', 'director', 'founder', 'president'],
    blocked_patterns: ['-person', 'not people', 'exclude person'],
    enforced_suffix: '(staff OR team OR leadership OR "about us" OR "our people" OR board) -jobs -careers -hiring -"job board" -indeed -ziprecruiter -linkedin.com/jobs',
    scope_mode: 'national',
  },
  grant: {
    id: 'fallback-grant',
    module: 'grant',
    required_all: ['grant'],
    required_any: [],
    blocked_patterns: ['-grant', 'not grant', 'without grant', 'exclude grant', 'non-grant'],
    enforced_suffix: 'grant',
    scope_mode: 'national',
  },
  event: {
    id: 'fallback-event',
    module: 'event',
    required_all: [],
    required_any: ['event', 'conference', 'summit', 'webinar', 'workshop', 'expo', 'symposium', 'meeting', 'gathering', 'training'],
    blocked_patterns: ['-event', 'not event', 'without event', 'exclude conference'],
    enforced_suffix: '',
    scope_mode: 'national',
  },
  opportunity: {
    id: 'fallback-opportunity',
    module: 'opportunity',
    required_all: [],
    required_any: ['organization', 'company', 'nonprofit', 'foundation', 'employer', 'firm', 'startup'],
    blocked_patterns: ['-company', 'not nonprofit', 'exclude organization'],
    enforced_suffix: '(organization OR company OR nonprofit OR foundation OR employer OR firm OR startup)',
    scope_mode: 'national',
  },
};

export function useIntentProfile(module: string) {
  return useQuery({
    queryKey: ['intent-profile', module],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('search_intent_profiles')
        .select('*')
        .eq('module', module)
        .eq('active', true)
        .single();

      if (error || !data) {
        return FALLBACK_PROFILES[module] || FALLBACK_PROFILES.event;
      }
      return data as IntentProfile;
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}

export function checkBlockedPatternsClient(query: string, blocked: string[]): string | null {
  const lower = query.toLowerCase();
  for (const pat of blocked) {
    if (lower.includes(pat.toLowerCase())) return pat;
  }
  return null;
}

export function buildEnforcedQueryPreview(
  rawQuery: string,
  profile: IntentProfile,
  metroName: string | null,
  roleBias?: string | null,
): string {
  let enforced = rawQuery.trim();
  if (profile.enforced_suffix) {
    enforced = `${enforced} ${profile.enforced_suffix}`;
  }
  if (roleBias) {
    enforced = `${enforced} ${roleBias}`;
  }
  if (metroName) {
    enforced = `${enforced} ("in ${metroName}" OR "${metroName}" OR "${metroName} area")`;
  }
  return enforced;
}

// ── Role Focus definitions for opportunity (people) searches ──

export interface RoleFocusOption {
  key: string;
  label: string;
  clause: string;
}

export const ROLE_FOCUS_OPTIONS: RoleFocusOption[] = [
  {
    key: 'leadership',
    label: 'Executive / Leadership',
    clause: '(director OR vp OR "vice president" OR chief OR head)',
  },
  {
    key: 'development',
    label: 'Development / Advancement',
    clause: '(development OR advancement OR fundraising OR grants)',
  },
  {
    key: 'program',
    label: 'Program / Impact',
    clause: '(program OR impact OR initiatives OR services)',
  },
  {
    key: 'partnerships',
    label: 'Partnerships',
    clause: '(partnerships OR external OR alliances OR collaboration)',
  },
];

/**
 * Sanitize custom role text: strip everything except alpha, spaces, and commas.
 * Split on commas/spaces, join with OR for bias clause.
 */
export function buildCustomRoleBias(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z\s,]/g, '').trim();
  if (!cleaned) return '';
  const tokens = cleaned
    .split(/[\s,]+/)
    .filter(t => t.length > 0)
    .slice(0, 10); // cap at 10 tokens
  if (tokens.length === 0) return '';
  if (tokens.length === 1) return `(${tokens[0]})`;
  return `(${tokens.join(' OR ')})`;
}

export const SAMPLE_PHRASES_METRO = [
  'community impact director nonprofit',
  'development director foundation',
  'program officer community health',
  'grants manager nonprofit',
  'partnerships lead social impact',
];

export const SAMPLE_PHRASES_NATIONAL = [
  'community impact specialist foundation',
  'senior program officer nonprofit',
  'director of community investment',
  'philanthropy program manager',
  'mission impact vice president',
];
