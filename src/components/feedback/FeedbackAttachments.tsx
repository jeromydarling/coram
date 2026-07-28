import { useState } from 'react';
import { FeedbackAttachment, useFeedback } from '@/hooks/useFeedback';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FileText, Image, Video, ExternalLink, Loader2 } from 'lucide-react';

interface FeedbackAttachmentsProps {
  attachments: FeedbackAttachment[];
}

export function FeedbackAttachments({ attachments }: FeedbackAttachmentsProps) {
  const { getAttachmentUrl } = useFeedback();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) return null;

  const getFileIcon = (fileType: string | null) => {
    if (fileType?.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (fileType?.startsWith('video/')) return <Video className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleViewFile = async (attachment: FeedbackAttachment) => {
    setLoadingId(attachment.id);
    try {
      const url = await getAttachmentUrl(attachment.file_path);
      
      // For images and videos, show in modal
      if (attachment.file_type?.startsWith('image/') || attachment.file_type?.startsWith('video/')) {
        setPreviewUrl(url);
        setPreviewType(attachment.file_type);
      } else {
        // For other files, open in new tab
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Failed to load attachment:', error);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-2">
        {attachments.map((attachment) => (
          <Button
            key={attachment.id}
            variant="outline"
            size="sm"
            className="h-auto py-1 px-2 text-xs"
            onClick={() => handleViewFile(attachment)}
            disabled={loadingId === attachment.id}
          >
            {loadingId === attachment.id ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              getFileIcon(attachment.file_type)
            )}
            <span className="ml-1 max-w-[100px] truncate">{attachment.file_name}</span>
            {attachment.file_size && (
              <span className="ml-1 text-muted-foreground">
                ({formatFileSize(attachment.file_size)})
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Preview Modal */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-2">
          <div className="relative w-full h-full flex items-center justify-center">
            {previewType?.startsWith('image/') && previewUrl && (
              <img
                src={previewUrl}
                alt="Attachment preview"
                className="max-w-full max-h-[80vh] object-contain rounded"
              />
            )}
            {previewType?.startsWith('video/') && previewUrl && (
              <video
                src={previewUrl}
                controls
                className="max-w-full max-h-[80vh] rounded"
              />
            )}
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => window.open(previewUrl!, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Open
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}