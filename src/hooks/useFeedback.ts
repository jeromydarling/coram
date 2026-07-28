import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

export type FeedbackType = 'bug' | 'feature';
export type FeedbackPriority = 'low' | 'medium' | 'high';
export type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'declined';

export interface FeedbackAttachment {
  id: string;
  feedback_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface FeedbackRequest {
  id: string;
  user_id: string;
  type: FeedbackType;
  title: string;
  description: string;
  priority: FeedbackPriority;
  status: FeedbackStatus;
  admin_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  attachments?: FeedbackAttachment[];
}

export interface CreateFeedbackInput {
  type: FeedbackType;
  title: string;
  description: string;
  priority: FeedbackPriority;
}

export interface UpdateFeedbackInput {
  id: string;
  status?: FeedbackStatus;
  admin_notes?: string;
}

export function useFeedback() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's own feedback requests with attachments
  const { data: userFeedback = [], isLoading: isLoadingUserFeedback } = useQuery({
    queryKey: ['feedback', 'user', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback_requests')
        .select('*, attachments:feedback_attachments(*)')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as FeedbackRequest[];
    },
    enabled: !!user?.id,
  });

  // Fetch all feedback requests (for admins)
  const { data: allFeedback = [], isLoading: isLoadingAllFeedback } = useQuery({
    queryKey: ['feedback', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback_requests')
        .select('*, attachments:feedback_attachments(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as FeedbackRequest[];
    },
  });

  // Create new feedback request
  const createFeedback = useMutation({
    mutationFn: async (input: CreateFeedbackInput) => {
      const { data, error } = await supabase
        .from('feedback_requests')
        .insert({
          user_id: user?.id,
          type: input.type,
          title: input.title,
          description: input.description,
          priority: input.priority,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      toast.success('Feedback submitted successfully');
    },
    onError: (error) => {
      toast.error('Failed to submit feedback: ' + error.message);
    },
  });

  // Upload attachment
  const uploadAttachment = useMutation({
    mutationFn: async ({ feedbackId, file }: { feedbackId: string; file: File }) => {
      // Upload to storage
      const filePath = `${user?.id}/${feedbackId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('feedback-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create attachment record
      const { data, error } = await supabase
        .from('feedback_attachments')
        .insert({
          feedback_id: feedbackId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
    onError: (error) => {
      toast.error('Failed to upload attachment: ' + error.message);
    },
  });

  // Get signed URL for an attachment
  const getAttachmentUrl = async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from('feedback-attachments')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) throw error;
    return data.signedUrl;
  };

  // Update feedback request (admin only)
  const updateFeedback = useMutation({
    mutationFn: async (input: UpdateFeedbackInput) => {
      const updateData: Partial<FeedbackRequest> = {};
      if (input.status !== undefined) updateData.status = input.status;
      if (input.admin_notes !== undefined) updateData.admin_notes = input.admin_notes;

      const { data, error } = await supabase
        .from('feedback_requests')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      toast.success('Feedback updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update feedback: ' + error.message);
    },
  });

  // Delete feedback request (admin only)
  const deleteFeedback = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('feedback_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      toast.success('Feedback deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete feedback: ' + error.message);
    },
  });

  return {
    userFeedback,
    allFeedback,
    isLoadingUserFeedback,
    isLoadingAllFeedback,
    createFeedback,
    uploadAttachment,
    getAttachmentUrl,
    updateFeedback,
    deleteFeedback,
  };
}