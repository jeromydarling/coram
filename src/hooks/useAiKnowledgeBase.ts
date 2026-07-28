import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface KbDocument {
  id: string;
  key: string;
  title: string;
  content_markdown: string;
  content_json: unknown;
  active: boolean;
  version: number;
  source_urls: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface KbDocumentVersion {
  id: string;
  document_id: string;
  version: number;
  content_markdown: string;
  content_json: unknown;
  source_urls: string[];
  created_by: string;
  created_at: string;
}

export function useKbDocuments() {
  return useQuery({
    queryKey: ['ai-kb-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_knowledge_documents')
        .select('*')
        .order('key');
      if (error) throw error;
      return data as KbDocument[];
    },
  });
}

export function useKbDocument(id: string | null) {
  return useQuery({
    queryKey: ['ai-kb-document', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('ai_knowledge_documents')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as KbDocument;
    },
    enabled: !!id,
  });
}

export function useKbDocumentVersions(documentId: string | null) {
  return useQuery({
    queryKey: ['ai-kb-versions', documentId],
    queryFn: async () => {
      if (!documentId) return [];
      const { data, error } = await supabase
        .from('ai_knowledge_document_versions')
        .select('*')
        .eq('document_id', documentId)
        .order('version', { ascending: false });
      if (error) throw error;
      return data as KbDocumentVersion[];
    },
    enabled: !!documentId,
  });
}

export function useUpdateKbDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      content_markdown,
      source_urls,
      active,
    }: {
      id: string;
      content_markdown?: string;
      source_urls?: string[];
      active?: boolean;
    }) => {
      // Load current doc
      const { data: current, error: fetchErr } = await supabase
        .from('ai_knowledge_documents')
        .select('*')
        .eq('id', id)
        .single();
      if (fetchErr || !current) throw fetchErr || new Error('Document not found');

      const newVersion = (current as KbDocument).version + 1;
      const newMarkdown = content_markdown ?? (current as KbDocument).content_markdown;
      const newUrls = source_urls ?? (current as KbDocument).source_urls;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create version record
      const { error: verErr } = await supabase
        .from('ai_knowledge_document_versions')
        .insert({
          document_id: id,
          version: newVersion,
          content_markdown: newMarkdown,
          source_urls: newUrls,
          created_by: user.id,
        });
      if (verErr) throw verErr;

      // Update main document
      const updateData: Record<string, unknown> = {
        version: newVersion,
        content_markdown: newMarkdown,
        source_urls: newUrls,
      };
      if (active !== undefined) updateData.active = active;

      const { error: updateErr } = await supabase
        .from('ai_knowledge_documents')
        .update(updateData)
        .eq('id', id);
      if (updateErr) throw updateErr;

      return { id, version: newVersion };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-kb-documents'] });
      queryClient.invalidateQueries({ queryKey: ['ai-kb-document'] });
      queryClient.invalidateQueries({ queryKey: ['ai-kb-versions'] });
      toast({ title: 'Knowledge base updated', description: 'New version saved successfully.' });
    },
    onError: (err) => {
      toast({ title: 'Error updating KB', description: (err as Error).message, variant: 'destructive' });
    },
  });
}

export function useToggleKbDocActive() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('ai_knowledge_documents')
        .update({ active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-kb-documents'] });
      toast({ title: 'Document status updated' });
    },
    onError: (err) => {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    },
  });
}
