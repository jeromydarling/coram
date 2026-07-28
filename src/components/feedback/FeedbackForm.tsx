import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useFeedback, FeedbackType, FeedbackPriority } from '@/hooks/useFeedback';
import { Bug, Lightbulb, Plus, Paperclip, X, FileText, Image, Info, Video } from 'lucide-react';
import { ScreenRecorder } from './ScreenRecorder';

interface FeedbackFormProps {
  defaultType?: FeedbackType;
  trigger?: React.ReactNode;
}

interface PendingFile {
  file: File;
  preview?: string;
}

export function FeedbackForm({ defaultType, trigger }: FeedbackFormProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>(defaultType || 'bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<FeedbackPriority>('medium');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { createFeedback, uploadAttachment } = useFeedback();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPendingFiles: PendingFile[] = files.map(file => {
      const isImage = file.type.startsWith('image/');
      return {
        file,
        preview: isImage ? URL.createObjectURL(file) : undefined
      };
    });
    setPendingFiles(prev => [...prev, ...newPendingFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setPendingFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Create the feedback request first
      const feedback = await createFeedback.mutateAsync({
        type,
        title,
        description,
        priority,
      });

      // Upload any attachments
      for (const { file } of pendingFiles) {
        await uploadAttachment.mutateAsync({
          feedbackId: feedback.id,
          file,
        });
      }

      // Cleanup previews
      pendingFiles.forEach(({ preview }) => {
        if (preview) URL.revokeObjectURL(preview);
      });

      // Reset form and close
      setTitle('');
      setDescription('');
      setPriority('medium');
      setPendingFiles([]);
      setOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (file.type.startsWith('video/')) return <Video className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const handleRecordingComplete = (file: File) => {
    const preview = URL.createObjectURL(file);
    setPendingFiles(prev => [...prev, { file, preview }]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const bugInstructions = [
    "What were you trying to do?",
    "What did you expect to happen?",
    "What actually happened?",
    "Steps to reproduce the issue",
  ];

  const featureInstructions = [
    "What problem would this solve?",
    "How would you use this feature?",
    "Any specific requirements or preferences?",
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Submit Feedback
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto"
        // Native file pickers temporarily move focus out of the dialog; Radix can interpret
        // this as an outside interaction and close the modal. Prevent those close signals.
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === 'bug' ? (
              <Bug className="w-5 h-5 text-destructive" />
            ) : (
              <Lightbulb className="w-5 h-5 text-warning" />
            )}
            Submit {type === 'bug' ? 'Bug Report' : 'Feature Request'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as FeedbackType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">
                  <div className="flex items-center gap-2">
                    <Bug className="w-4 h-4" />
                    Bug Report
                  </div>
                </SelectItem>
                <SelectItem value="feature">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" />
                    Feature Request
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Instructions */}
          <Alert className="bg-muted/50 border-muted">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium text-sm mb-2">
                {type === 'bug' ? 'For a great bug report, include:' : 'For a great feature request, include:'}
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {(type === 'bug' ? bugInstructions : featureInstructions).map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === 'bug' ? 'Brief description of the issue' : 'What feature would you like?'}
              required
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground text-right">{title.length}/200</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                type === 'bug'
                  ? 'Steps to reproduce, expected behavior, what actually happened...'
                  : 'Describe the feature, how it would help you, any specific requirements...'
              }
              rows={5}
              required
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground text-right">{description.length}/5000</p>
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as FeedbackPriority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low - Nice to have</SelectItem>
                <SelectItem value="medium">Medium - Affects my work</SelectItem>
                <SelectItem value="high">High - Blocking my work</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <Label>Attachments (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Screenshots and screen recordings help us understand issues faster
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,text/plain,video/mp4,video/quicktime"
              multiple
              onChange={(e) => {
                e.stopPropagation();
                handleFileSelect(e);
              }}
              onClick={(e) => e.stopPropagation()}
              className="hidden"
            />

            {pendingFiles.length > 0 && (
              <div className="space-y-2 mt-2">
                {pendingFiles.map((pf, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                    {pf.preview ? (
                      <img src={pf.preview} alt="" className="w-10 h-10 object-cover rounded" />
                    ) : (
                      <div className="w-10 h-10 flex items-center justify-center bg-background rounded">
                        {getFileIcon(pf.file)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{pf.file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(pf.file.size)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="w-4 h-4 mr-2" />
                Add Files
              </Button>
              <ScreenRecorder 
                onRecordingComplete={handleRecordingComplete}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}