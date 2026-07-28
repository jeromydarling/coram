import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

export interface Document {
  id: string;
  name: string;
  description: string | null;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  category: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentAttachment {
  id: string;
  document_id: string;
  contact_id: string | null;
  opportunity_id: string | null;
  attached_by: string | null;
  created_at: string;
  document?: Document;
}

export function useDocuments(category?: string) {
  return useQuery({
    queryKey: ['documents', category],
    queryFn: async () => {
      let query = supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (category) {
        query = query.eq('category', category);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Document[];
    },
  });
}

export function useDocumentAttachments(entityType: 'contact' | 'opportunity', entityId: string) {
  return useQuery({
    queryKey: ['document-attachments', entityType, entityId],
    queryFn: async () => {
      const column = entityType === 'contact' ? 'contact_id' : 'opportunity_id';
      const { data, error } = await supabase
        .from('document_attachments')
        .select(`
          *,
          document:documents(*)
        `)
        .eq(column, entityId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as (DocumentAttachment & { document: Document })[];
    },
    enabled: !!entityId,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      file, 
      name, 
      description, 
      category 
    }: { 
      file: File; 
      name: string; 
      description?: string; 
      category: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;

      // Create document record
      const { data, error } = await supabase
        .from('documents')
        .insert({
          name,
          description,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          category,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document uploaded successfully');
    },
    onError: (error) => {
      toast.error('Failed to upload document: ' + error.message);
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (document: Document) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([document.file_path]);
      
      if (storageError) throw storageError;

      // Delete record
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', document.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete document: ' + error.message);
    },
  });
}

export function useAttachDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      documentId, 
      entityType, 
      entityId 
    }: { 
      documentId: string; 
      entityType: 'contact' | 'opportunity'; 
      entityId: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const payload = {
        document_id: documentId,
        attached_by: user.id,
        contact_id: entityType === 'contact' ? entityId : null,
        opportunity_id: entityType === 'opportunity' ? entityId : null,
      };

      const { data, error } = await supabase
        .from('document_attachments')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['document-attachments', variables.entityType, variables.entityId] 
      });
      toast.success('Document attached');
    },
    onError: (error) => {
      toast.error('Failed to attach document: ' + error.message);
    },
  });
}

export function useDetachDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      attachmentId, 
      entityType, 
      entityId 
    }: { 
      attachmentId: string; 
      entityType: 'contact' | 'opportunity'; 
      entityId: string;
    }) => {
      const { error } = await supabase
        .from('document_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['document-attachments', variables.entityType, variables.entityId] 
      });
      toast.success('Document detached');
    },
    onError: (error) => {
      toast.error('Failed to detach document: ' + error.message);
    },
  });
}

export function useDocumentUrl(filePath: string) {
  return useQuery({
    queryKey: ['document-url', filePath],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 3600); // 1 hour expiry
      
      if (error) throw error;
      return data.signedUrl;
    },
    enabled: !!filePath,
    staleTime: 1000 * 60 * 50, // 50 minutes
  });
}
