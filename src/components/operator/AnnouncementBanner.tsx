/**
 * AnnouncementBanner — Displays active operator announcements to tenant users.
 *
 * WHAT: Soft neutral banner at top of tenant layout.
 * WHERE: Inside MainLayout, above page content.
 * WHY: Communicate platform changes to reduce support tickets.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { X, Megaphone } from 'lucide-react';
import { useState } from 'react';

export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data: announcements } = useQuery({
    queryKey: ['active-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_announcements')
        .select('id, title, body')
        .or('active_until.is.null,active_until.gt.' + new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const visible = announcements?.filter((a) => !dismissed.has(a.id)) ?? [];

  if (!visible.length) return null;

  return (
    <div className="space-y-1">
      {visible.map((a) => (
        <div
          key={a.id}
          className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-4 py-2.5 flex items-start gap-3"
        >
          <Megaphone className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{a.title}</p>
            <p className="text-xs text-amber-700 dark:text-amber-400">{a.body}</p>
          </div>
          <button
            onClick={() => setDismissed((prev) => new Set(prev).add(a.id))}
            className="text-amber-600 dark:text-amber-400 hover:text-amber-800 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
