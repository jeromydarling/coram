import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Upload, X, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

function fileNameToKey(fileName: string): string {
  return fileName
    .replace(/\.pdf$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function fileNameToTitle(fileName: string): string {
  return fileName
    .replace(/\.pdf$/i, '')
    .replace(/[_\-\.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Module-level pending file store.
 * 
 * When the mobile OS file picker opens, the browser may kill + remount
 * the entire React tree. State setters captured in the closure become stale.
 * 
 * Instead, the imperative onChange writes to this module-level variable.
 * On every render, the component checks for a pending file and consumes it.
 */
let pendingFile: File | null = null;
let pendingFileVersion = 0; // bump to trigger effect

export function PdfUploadButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [key, setKey] = useState('');
  const [, setTick] = useState(0); // force re-render to consume pending file
  const consumedVersion = useRef(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Consume pending file on mount/re-render
  useEffect(() => {
    if (pendingFile && pendingFileVersion > consumedVersion.current) {
      const file = pendingFile;
      consumedVersion.current = pendingFileVersion;
      pendingFile = null;
      setSelectedFile(file);
      setTitle(fileNameToTitle(file.name));
      setKey(fileNameToKey(file.name));
      setIsOpen(true);
    }
  });

  // Also poll briefly after mount in case the effect ran before the file was ready
  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingFile && pendingFileVersion > consumedVersion.current) {
        setTick(t => t + 1); // trigger re-render to run the effect above
      }
    }, 300);
    return () => clearInterval(interval);
  }, []);

  const openFilePicker = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) {
        // Write to module-level store — survives React remounts
        pendingFile = file;
        pendingFileVersion++;
        // Also try direct state update in case component is still alive
        setSelectedFile(file);
        setTitle(fileNameToTitle(file.name));
        setKey(fileNameToKey(file.name));
        setIsOpen(true);
      }
      try { document.body.removeChild(input); } catch {}
    });

    const handleFocusBack = () => {
      setTimeout(() => {
        if (!input.files?.length) {
          try { document.body.removeChild(input); } catch {}
        }
        window.removeEventListener('focus', handleFocusBack);
      }, 500);
    };
    window.addEventListener('focus', handleFocusBack);

    input.click();
  }, []);

  const resetForm = () => {
    setSelectedFile(null);
    setTitle('');
    setKey('');
    setIsOpen(false);
    pendingFile = null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !title || !key) return;

    if (selectedFile.type !== 'application/pdf') {
      toast({ title: 'Invalid file', description: 'Only PDF files are supported.', variant: 'destructive' });
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum 5 MB. Please compress the PDF and try again.', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);

    try {
      const storagePath = `${crypto.randomUUID()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('kb-uploads')
        .upload(storagePath, selectedFile, { contentType: 'application/pdf' });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { data, error } = await supabase.functions.invoke('parse-pdf-to-kb', {
        body: { storage_path: storagePath, title, key },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'PDF imported!',
        description: `"${title}" saved as v${data.version} (${Math.round((data.content_length || 0) / 1024)}KB).`,
      });
      resetForm();
    } catch (err) {
      console.error('[pdf-upload] Error:', err);
      toast({
        title: 'Import may still be processing',
        description: 'The PDF was uploaded. If it doesn\'t appear shortly, refresh the page.',
      });
      resetForm();
    } finally {
      setIsProcessing(false);
      // Always refetch — the edge function may have succeeded even if the client timed out
      queryClient.invalidateQueries({ queryKey: ['ai-kb-documents'] });
    }
  };

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={openFilePicker}>
        <Upload className="h-4 w-4 mr-2" />
        Import PDF
      </Button>
    );
  }

  return (
    <Card className="w-full border-dashed">
      <CardContent className="pt-4 pb-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium">Import PDF to Knowledge Base</h4>
            <p className="text-xs text-muted-foreground">Max 5 MB · Compress large PDFs first</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetForm} disabled={isProcessing}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {selectedFile && (
          <div className={`flex items-center gap-2 p-2 rounded-md text-sm ${selectedFile.size > 5 * 1024 * 1024 ? 'bg-destructive/10 border border-destructive/30' : 'bg-muted'}`}>
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{selectedFile.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              ({(selectedFile.size / 1024).toFixed(0)} KB)
            </span>
            {selectedFile.size > 5 * 1024 * 1024 && (
              <span className="text-xs text-destructive shrink-0 font-medium">Too large</span>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pdf-title" className="text-xs">Title</Label>
            <Input
              id="pdf-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Document title"
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pdf-key" className="text-xs">Key</Label>
            <Input
              id="pdf-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
              placeholder="unique_key"
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Unique identifier for versioning
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={resetForm} disabled={isProcessing}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isProcessing || !title || !key}>
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Importing…</>
              ) : (
                'Import'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
