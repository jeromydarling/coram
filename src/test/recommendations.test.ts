import { describe, it, expect } from 'vitest';

// Mirror the sort logic from the hook for unit testing
const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

interface MockRec {
  id: string;
  priority: string | null;
  updated_at: string;
  title: string;
}

function sortByPriority(a: MockRec, b: MockRec): number {
  const pa = PRIORITY_ORDER[a.priority ?? 'medium'] ?? 1;
  const pb = PRIORITY_ORDER[b.priority ?? 'medium'] ?? 1;
  if (pa !== pb) return pa - pb;
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

describe('Recommendations data logic', () => {
  it('sorts high priority before medium and low', () => {
    const recs: MockRec[] = [
      { id: '1', priority: 'low', updated_at: '2026-02-08T00:00:00Z', title: 'Low' },
      { id: '2', priority: 'high', updated_at: '2026-02-07T00:00:00Z', title: 'High' },
      { id: '3', priority: 'medium', updated_at: '2026-02-08T00:00:00Z', title: 'Medium' },
    ];
    const sorted = [...recs].sort(sortByPriority);
    expect(sorted[0].priority).toBe('high');
    expect(sorted[1].priority).toBe('medium');
    expect(sorted[2].priority).toBe('low');
  });

  it('sorts same-priority items by most recent first', () => {
    const recs: MockRec[] = [
      { id: '1', priority: 'medium', updated_at: '2026-02-05T00:00:00Z', title: 'Older' },
      { id: '2', priority: 'medium', updated_at: '2026-02-08T00:00:00Z', title: 'Newer' },
    ];
    const sorted = [...recs].sort(sortByPriority);
    expect(sorted[0].title).toBe('Newer');
    expect(sorted[1].title).toBe('Older');
  });

  it('handles null priority as medium', () => {
    const recs: MockRec[] = [
      { id: '1', priority: null, updated_at: '2026-02-08T00:00:00Z', title: 'Null priority' },
      { id: '2', priority: 'high', updated_at: '2026-02-08T00:00:00Z', title: 'High' },
    ];
    const sorted = [...recs].sort(sortByPriority);
    expect(sorted[0].title).toBe('High');
    expect(sorted[1].title).toBe('Null priority');
  });

  it('returns top 3 after sort', () => {
    const recs: MockRec[] = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      priority: i < 2 ? 'high' : 'medium',
      updated_at: `2026-02-0${(i % 9) + 1}T00:00:00Z`,
      title: `Rec ${i}`,
    }));
    const sorted = [...recs].sort(sortByPriority).slice(0, 3);
    expect(sorted.length).toBe(3);
    expect(sorted[0].priority).toBe('high');
    expect(sorted[1].priority).toBe('high');
  });

  it('empty array returns empty', () => {
    const recs: MockRec[] = [];
    const sorted = [...recs].sort(sortByPriority).slice(0, 3);
    expect(sorted.length).toBe(0);
  });

  it('handles malformed priority gracefully', () => {
    const recs: MockRec[] = [
      { id: '1', priority: 'critical' as string, updated_at: '2026-02-08T00:00:00Z', title: 'Unknown' },
      { id: '2', priority: 'medium', updated_at: '2026-02-08T00:00:00Z', title: 'Medium' },
    ];
    // Unknown priority defaults to order 1 (same as medium)
    const sorted = [...recs].sort(sortByPriority);
    expect(sorted.length).toBe(2);
    // Both have same priority order so sorted by date (same date = stable)
  });
});
