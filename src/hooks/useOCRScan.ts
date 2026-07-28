import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

interface OCRResult {
  success: boolean;
  ocr_batch_id: string;
  suggestions: Array<{
    id: string;
    name?: string;
    email?: string;
    phone?: string;
    title?: string;
    organization?: string;
    confidence: number;
  }>;
  extraction_method: string;
  warning?: string;
}

export function useOCRScan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (images: File[]): Promise<OCRResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const formData = new FormData();
      for (const image of images) {
        formData.append('images', image);
      }
      
      // Use fetch directly for FormData
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/profunda-ai?mode=ocr`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'OCR failed');
      }
      
      const data = await response.json() as OCRResult;
      if (!data.success) throw new Error('OCR extraction failed');
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] });
      
      if (data.suggestions.length === 0) {
        toast.warning('No contact information could be extracted');
      } else if (data.warning) {
        toast.warning(data.warning);
      } else {
        toast.success(`Extracted ${data.suggestions.length} contact(s) from image(s)`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to scan image');
    },
  });
}
