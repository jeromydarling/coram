import { useState, useRef } from 'react';
import { 
  useDocuments, 
  useDocumentAttachments, 
  useAttachDocument, 
  useDetachDocument,
  useDocumentUrl,
  useUploadDocument
} from '@/hooks/useDocuments';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Paperclip, 
  Plus, 
  X, 
  FileText, 
  Download,
  Eye,
  Upload,
  Loader2
} from 'lucide-react';

import { PDFViewer } from './PDFViewer';
import { toast } from '@/components/ui/sonner';

interface DocumentAttachmentsPanelProps {
  entityType: 'contact' | 'opportunity';
  entityId: string;
  entityName: string;
}

const DOCUMENT_CATEGORIES = [
  'General',
  'Training Materials',
  'Templates',
  'Policies & Procedures',
  'Marketing',
  'Partner Resources',
  'Contact Relations',
  'Communication',
];

export function DocumentAttachmentsPanel({ 
  entityType, 
  entityId,
  entityName 
}: DocumentAttachmentsPanelProps) {
  const [attachOpen, setAttachOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [viewingDocument, setViewingDocument] = useState<{ path: string; name: string } | null>(null);
  
  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<string>('Other');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: attachments, isLoading } = useDocumentAttachments(entityType, entityId);
  const { data: allDocuments } = useDocuments();
  const attachDocument = useAttachDocument();
  const detachDocument = useDetachDocument();
  const uploadDocument = useUploadDocument();

  // Filter out already attached documents
  const attachedIds = new Set(attachments?.map(a => a.document_id) || []);
  const availableDocuments = allDocuments?.filter(d => !attachedIds.has(d.id)) || [];

  const handleAttach = async () => {
    if (!selectedDocId) return;
    await attachDocument.mutateAsync({
      documentId: selectedDocId,
      entityType,
      entityId,
    });
    setSelectedDocId('');
    setAttachOpen(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const cleanFileName = (fileName: string): string => {
    // Remove extension and replace special chars with spaces
    return fileName
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[_\-\.]/g, ' ') // Replace underscores, dashes, dots with spaces
      .replace(/\s+/g, ' ') // Normalize multiple spaces
      .trim();
  };

  const handleUploadAndAttach = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    try {
      // First upload the document
      const uploadedDoc = await uploadDocument.mutateAsync({
        file: selectedFile,
        name: cleanFileName(selectedFile.name),
        category: uploadCategory,
      });
      
      // Then attach it to the entity
      await attachDocument.mutateAsync({
        documentId: uploadedDoc.id,
        entityType,
        entityId,
      });
      
      // Reset state and close
      setSelectedFile(null);
      setUploadCategory('Other');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setAttachOpen(false);
      toast.success('Document uploaded and attached');
    } catch (error) {
      // Error handling is done in the hooks
    } finally {
      setIsUploading(false);
    }
  };

  const resetDialog = () => {
    setSelectedDocId('');
    setSelectedFile(null);
    setUploadCategory('Other');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3 overflow-hidden">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Attached Documents
        </h4>
        <Dialog open={attachOpen} onOpenChange={(open) => {
          setAttachOpen(open);
          if (!open) resetDialog();
        }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-3 w-3 mr-1" />
              Attach
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle>Attach Document to {entityName}</DialogTitle>
            </DialogHeader>
            
            <Tabs defaultValue="upload" className="mt-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload" className="gap-2">
                  <Upload className="h-3 w-3" />
                  Upload New
                </TabsTrigger>
                <TabsTrigger value="existing" className="gap-2">
                  <FileText className="h-3 w-3" />
                  Select Existing
                </TabsTrigger>
              </TabsList>
              
              {/* Upload New Tab */}
              <TabsContent value="upload" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="file-upload">Choose File</Label>
                  <Input
                    id="file-upload"
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg"
                  />
                  {selectedFile && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={uploadCategory} onValueChange={setUploadCategory}>
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setAttachOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleUploadAndAttach} 
                    disabled={!selectedFile || isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload & Attach
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
              
              {/* Select Existing Tab */}
              <TabsContent value="existing" className="space-y-4 mt-4">
                <Select value={selectedDocId} onValueChange={setSelectedDocId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a document..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDocuments.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        No documents available. Use the "Upload New" tab or go to Help → Document Library.
                      </div>
                    ) : (
                      availableDocuments.map(doc => (
                        <SelectItem key={doc.id} value={doc.id}>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span>{doc.name}</span>
                            <Badge variant="outline" className="text-xs ml-2">
                              {doc.category}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setAttachOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAttach} 
                    disabled={!selectedDocId || attachDocument.isPending}
                  >
                    {attachDocument.isPending ? 'Attaching...' : 'Attach Document'}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
        </div>
      ) : attachments?.length === 0 ? (
        <p className="text-sm text-muted-foreground py-1">
          No documents attached yet
        </p>
      ) : (
        <div className="space-y-1">
          {attachments.length > 3 && (
            <p className="text-xs text-muted-foreground mb-1">
              {attachments.length} documents attached
            </p>
          )}
          <ScrollArea className="max-h-[120px] w-full">
            <div className="space-y-1.5 pr-2 overflow-hidden">
              {attachments?.map(attachment => (
                <AttachmentRow
                  key={attachment.id}
                  attachment={attachment}
                  onView={() => setViewingDocument({ 
                    path: attachment.document.file_path, 
                    name: attachment.document.name 
                  })}
                  onDetach={() => detachDocument.mutate({
                    attachmentId: attachment.id,
                    entityType,
                    entityId,
                  })}
                  isDetaching={detachDocument.isPending}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {viewingDocument && (
        <PDFViewer 
          filePath={viewingDocument.path} 
          fileName={viewingDocument.name}
          onClose={() => setViewingDocument(null)} 
        />
      )}
    </div>
  );
}

function AttachmentRow({ 
  attachment, 
  onView, 
  onDetach,
  isDetaching 
}: { 
  attachment: any;
  onView: () => void;
  onDetach: () => void;
  isDetaching: boolean;
}) {
  const { data: signedUrl } = useDocumentUrl(attachment.document.file_path);
  const isPDF = attachment.document.file_type?.includes('pdf');

  const truncateName = (name: string, maxLength = 35) => {
    return name.length > maxLength ? name.slice(0, maxLength) + '…' : name;
  };

  return (
    <div className="flex items-center gap-2 p-1.5 rounded-md bg-muted/50 text-sm">
      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <p className="font-medium text-xs" title={attachment.document.name}>
        {truncateName(attachment.document.name)}
      </p>
      <div className="flex items-center shrink-0">
        {isPDF && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onView}>
            <Eye className="h-3 w-3" />
          </Button>
        )}
        {signedUrl && (
          <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
            <a href={signedUrl} download target="_blank" rel="noopener noreferrer">
              <Download className="h-3 w-3" />
            </a>
          </Button>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={onDetach}
          disabled={isDetaching}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
