import { useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface PdfUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PdfUploadDialog({ open, onOpenChange }: PdfUploadDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isProcessingRef = useRef(false);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected || isProcessingRef.current) return;

    // Reset input so re-selecting the same file works
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (selected.type !== 'application/pdf') {
      toast({ title: 'Invalid file', description: 'Only PDF files are supported.', variant: 'destructive' });
      return;
    }
    if (selected.size > 20 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 20MB.', variant: 'destructive' });
      return;
    }

    // Auto-generate title and key from filename
    const title = selected.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');
    const key = selected.name
      .replace(/\.pdf$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    isProcessingRef.current = true;
    // Force re-render to show processing state
    onOpenChange(true);

    toast({ title: 'Uploading PDF…', description: `Processing "${title}"` });

    try {
      const storagePath = `${crypto.randomUUID()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('kb-uploads')
        .upload(storagePath, selected, { contentType: 'application/pdf' });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { data, error } = await supabase.functions.invoke('parse-pdf-to-kb', {
        body: { storage_path: storagePath, title, key },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'PDF imported to Knowledge Base',
        description: `"${title}" saved as v${data.version} (${Math.round((data.content_length || 0) / 1024)}KB of markdown).`,
      });

      queryClient.invalidateQueries({ queryKey: ['ai-kb-documents'] });
      onOpenChange(false);
    } catch (err) {
      console.error('[pdf-upload] Error:', err);
      toast({
        title: 'Import failed',
        description: (err as Error).message || 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      isProcessingRef.current = false;
    }
  }, [toast, queryClient, onOpenChange]);

  if (!open) return null;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start text-sm pointer-events-none"
        disabled={isProcessingRef.current}
      >
        {isProcessingRef.current ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" />
            Processing PDF…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2 shrink-0" />
            Tap to choose PDF file…
          </>
        )}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileChange}
        disabled={isProcessingRef.current}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        style={{ fontSize: '0' }}
      />
    </div>
  );
}
