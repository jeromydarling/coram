import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { MapPin, Briefcase, Building2, Tag, Users } from 'lucide-react';

interface SearchResult {
  id: string;
  title: string;
  description: string | null;
  organization: string | null;
  location: string | null;
  contact_name: string | null;
  contact_email: string | null;
  raw_data: Record<string, unknown> | null;
  entity_created: boolean;
}

export interface Segment {
  key: string;
  label: string;
  type: 'metro' | 'title' | 'org' | 'tag';
  matchingIds: Set<string>;
  icon: typeof MapPin;
}

interface SuggestedSegmentsProps {
  results: SearchResult[];
  selectedIds: Set<string>;
  onSegmentClick: (segment: Segment) => void;
  activeSegmentKey: string | null;
}

/**
 * Analyze search results and generate natural groupings.
 * Only surfaces segments with ≥2 matching results.
 */
function buildSegments(results: SearchResult[]): Segment[] {
  const available = results.filter(r => !r.entity_created);
  if (available.length < 2) return [];

  const segments: Segment[] = [];

  // Group by location (metro)
  const byLocation = new Map<string, Set<string>>();
  for (const r of available) {
    if (!r.location) continue;
    // Normalize: trim, lowercase for grouping but keep original for display
    const key = r.location.trim().toLowerCase();
    if (!byLocation.has(key)) byLocation.set(key, new Set());
    byLocation.get(key)!.add(r.id);
  }
  for (const [loc, ids] of byLocation) {
    if (ids.size < 2) continue;
    const display = available.find(r => r.location?.trim().toLowerCase() === loc)?.location || loc;
    segments.push({
      key: `metro:${loc}`,
      label: display,
      type: 'metro',
      matchingIds: ids,
      icon: MapPin,
    });
  }

  // Group by organization
  const byOrg = new Map<string, Set<string>>();
  for (const r of available) {
    if (!r.organization) continue;
    const key = r.organization.trim().toLowerCase();
    if (!byOrg.has(key)) byOrg.set(key, new Set());
    byOrg.get(key)!.add(r.id);
  }
  for (const [org, ids] of byOrg) {
    if (ids.size < 2) continue;
    const display = available.find(r => r.organization?.trim().toLowerCase() === org)?.organization || org;
    segments.push({
      key: `org:${org}`,
      label: display,
      type: 'org',
      matchingIds: ids,
      icon: Building2,
    });
  }

  // Group by similar title keywords (extract meaningful words)
  const titleKeywords = new Map<string, Set<string>>();
  const STOP_WORDS = new Set(['the', 'of', 'and', 'a', 'an', 'in', 'at', 'for', 'to', 'or', 'is', 'on', 'with', 'by']);
  for (const r of available) {
    if (!r.title) continue;
    const words = r.title
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOP_WORDS.has(w));
    for (const w of words) {
      if (!titleKeywords.has(w)) titleKeywords.set(w, new Set());
      titleKeywords.get(w)!.add(r.id);
    }
  }
  // Only surface title keywords that match ≥ 3 results and aren't too generic
  const GENERIC_WORDS = new Set(['manager', 'senior', 'associate', 'assistant', 'lead', 'team']);
  for (const [word, ids] of titleKeywords) {
    if (ids.size < 3 || GENERIC_WORDS.has(word)) continue;
    segments.push({
      key: `title:${word}`,
      label: word.charAt(0).toUpperCase() + word.slice(1),
      type: 'title',
      matchingIds: ids,
      icon: Briefcase,
    });
  }

  // Group by tags from raw_data (partnership angles, mission keywords)
  const byTag = new Map<string, Set<string>>();
  for (const r of available) {
    const rd = r.raw_data;
    if (!rd) continue;
    const tags: string[] = [];
    if (Array.isArray(rd.tags)) tags.push(...(rd.tags as string[]));
    if (typeof rd.partnership_angle === 'string') tags.push(rd.partnership_angle);
    if (typeof rd.sector === 'string') tags.push(rd.sector);
    if (typeof rd.focus_area === 'string') tags.push(rd.focus_area);
    for (const tag of tags) {
      const key = tag.trim().toLowerCase();
      if (!key || key.length < 3) continue;
      if (!byTag.has(key)) byTag.set(key, new Set());
      byTag.get(key)!.add(r.id);
    }
  }
  for (const [tag, ids] of byTag) {
    if (ids.size < 2) continue;
    segments.push({
      key: `tag:${tag}`,
      label: tag.charAt(0).toUpperCase() + tag.slice(1),
      type: 'tag',
      matchingIds: ids,
      icon: Tag,
    });
  }

  // Sort by match count descending, cap at 8
  return segments.sort((a, b) => b.matchingIds.size - a.matchingIds.size).slice(0, 8);
}

const TYPE_COLORS: Record<Segment['type'], string> = {
  metro: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20 hover:bg-blue-500/20',
  org: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/20',
  title: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20 hover:bg-violet-500/20',
  tag: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 hover:bg-amber-500/20',
};

export function SuggestedSegments({ results, selectedIds, onSegmentClick, activeSegmentKey }: SuggestedSegmentsProps) {
  const segments = useMemo(() => buildSegments(results), [results]);

  if (segments.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="w-3.5 h-3.5" />
        <span className="font-medium">Suggested segments</span>
        {selectedIds.size > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">
            {selectedIds.size} selected
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {segments.map((segment) => {
          const Icon = segment.icon;
          const isActive = activeSegmentKey === segment.key;
          return (
            <button
              key={segment.key}
              type="button"
              onClick={() => onSegmentClick(segment)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                isActive
                  ? 'ring-2 ring-primary/30 shadow-sm ' + TYPE_COLORS[segment.type]
                  : TYPE_COLORS[segment.type]
              }`}
            >
              <Icon className="w-3 h-3" />
              {segment.label}
              <span className="opacity-60 ml-0.5">({segment.matchingIds.size})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
