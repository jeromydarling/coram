import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export interface StoryChapter {
  id: string;
  opportunity_id: string;
  family: string;
  chapter_title: string;
  chapter_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoryUpdate {
  id: string;
  chapter_id: string;
  opportunity_id: string;
  generated_at: string;
  window_start: string;
  window_end: string;
  delta_type: 'reinforcement' | 'shift' | 'new_signal' | 'correction' | 'noop';
  confidence: number;
  summary_md: string;
  evidence: Array<{
    type: string;
    ts: string;
    url: string | null;
    snippet: string;
    source: string;
    id: string;
  }>;
  ai_used: boolean;
  version: string;
  created_at: string;
}

export function useStoryChapters(opportunityId: string | null) {
  return useQuery({
    queryKey: ['story-chapters', opportunityId],
    queryFn: async () => {
      if (!opportunityId) return [];
      const { data, error } = await supabase
        .from('relationship_story_chapters')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .order('chapter_order', { ascending: true });
      if (error) throw error;
      return data as StoryChapter[];
    },
    enabled: !!opportunityId,
  });
}

export function useLatestStoryUpdates(opportunityId: string | null) {
  return useQuery({
    queryKey: ['story-updates-latest', opportunityId],
    queryFn: async () => {
      if (!opportunityId) return [];
      // Fetch latest update per chapter
      const { data, error } = await supabase
        .from('relationship_story_updates')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .order('generated_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as StoryUpdate[];
    },
    enabled: !!opportunityId,
  });
}

export function useChapterTimeline(chapterId: string | null, page = 0, pageSize = 5) {
  return useQuery({
    queryKey: ['story-timeline', chapterId, page],
    queryFn: async () => {
      if (!chapterId) return [];
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from('relationship_story_updates')
        .select('*')
        .eq('chapter_id', chapterId)
        .order('generated_at', { ascending: false })
        .range(from, to);
      if (error) throw error;
      return data as StoryUpdate[];
    },
    enabled: !!chapterId,
  });
}

export function useGenerateStory(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (force: boolean = true) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/relationship-story-generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            opportunity_id: opportunityId,
            force,
            mode: 'single',
          }),
        },
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(err.message || `HTTP ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story-chapters', opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['story-updates-latest', opportunityId] });
      toast.success('Story updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to generate story: ${error.message}`);
    },
  });
}
