/**
 * triggerEssayImageGeneration — Fire-and-forget image generation for essays.
 *
 * WHAT: Invokes the generate-essay-image edge function to create a B&W Americana sketch.
 * WHERE: Called from publish flows in StudioLibraryTab and OperatorContentStudio.
 * WHY: Ensures every published essay gets a unique hero image without blocking the publish action.
 */
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export async function triggerEssayImageGeneration(
  essayId: string,
  title: string,
  excerpt: string | null | undefined,
  tableName: 'library_essays' | 'operator_content_drafts'
) {
  try {
    const { data, error } = await supabase.functions.invoke('generate-essay-image', {
      body: {
        essay_id: essayId,
        title,
        excerpt: excerpt?.slice(0, 300) || '',
        table_name: tableName,
      },
    });
    if (error) throw error;
    if (data?.ok) {
      toast.success('Essay image generated');
    } else {
      console.warn('Image generation returned non-ok:', data);
    }
  } catch (err) {
    // Non-blocking — log but don't interrupt publish flow
    console.error('Essay image generation failed (non-blocking):', err);
    toast.info('Essay published. Image generation will be retried.');
  }
}
