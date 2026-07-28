/**
 * useVoiceNotes — Query hook for fetching voice notes.
 *
 * WHAT: Fetches voice notes for the current user, optionally filtered by subject.
 * WHERE: Used on Visits page and detail pages.
 * WHY: Provides recent transcript history for the visitor's note feed.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

interface UseVoiceNotesOptions {
  subjectType?: string;
  subjectId?: string;
  limit?: number;
}

export function useVoiceNotes({ subjectType, subjectId, limit = 10 }: UseVoiceNotesOptions = {}) {
  const { user } = useAuth();
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['voice-notes', tenantId, user?.id, subjectType, subjectId, limit],
    enabled: !!tenantId && !!user?.id,
    queryFn: async () => {
      let query = supabase
        .from('voice_notes')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('user_id', user!.id)
        .order('recorded_at', { ascending: false })
        .limit(limit);

      if (subjectType) query = query.eq('subject_type', subjectType);
      if (subjectId) query = query.eq('subject_id', subjectId);

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}
