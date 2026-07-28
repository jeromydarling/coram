import { useState } from 'react';
import { useDocuments, useUploadDocument, useDeleteDocument, useDocumentUrl } from '@/hooks/useDocuments';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, 
  Upload, 
  Trash2, 
  Download, 
  Eye,
  File,
  FileImage,
  FileSpreadsheet,
  Search,
  FolderOpen
} from 'lucide-react';
import { format } from 'date-fns';
import { PDFViewer } from './PDFViewer';

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'training', label: 'Training Materials' },
  { value: 'templates', label: 'Templates' },
  { value: 'policies', label: 'Policies & Procedures' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'partner-resources', label: 'Partner Resources' },
  { value: 'contact-relations', label: 'Contact Relations' },
  { value: 'communication', label: 'Communication' },
];

function getFileIcon(fileType: string | null) {
  if (!fileType) return File;
  if (fileType.includes('pdf')) return FileText;
  if (fileType.includes('image')) return FileImage;
  if (fileType.includes('spreadsheet') || fileType.includes('excel')) return FileSpreadsheet;
  return File;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Helper to convert filename to readable document name
function fileNameToDocumentName(fileName: string): string {
  // Remove file extension
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
  // Replace underscores, dashes, and other special characters with spaces
  const cleaned = nameWithoutExt.replace(/[_\-\.]+/g, ' ').replace(/[^a-zA-Z0-9\s]/g, ' ');
  // Collapse multiple spaces and trim
  return cleaned.replace(/\s+/g, ' ').trim();
}

export function DocumentLibrary() {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<{ path: string; name: string } | null>(null);
  const [suggestedName, setSuggestedName] = useState('');
  
  const { data: documents, isLoading } = useDocuments(selectedCategory || undefined);
  const uploadDocument = useUploadDocument();
  const deleteDocument = useDeleteDocument();

  const filteredDocuments = documents?.filter(doc => 
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSuggestedName(fileNameToDocumentName(file.name));
    }
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;

    if (!file || !name) return;

    await uploadDocument.mutateAsync({ file, name, description, category });
    setUploadOpen(false);
    setSuggestedName('');
    (e.target as HTMLFormElement).reset();
  };

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 flex-shrink-0" />
              <span>Document Library</span>
            </CardTitle>
            <CardDescription>
              Store and organize work documents, training materials, and partner resources
            </CardDescription>
          </div>
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto flex-shrink-0">
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="file">File</Label>
                  <Input 
                    id="file" 
                    name="file" 
                    type="file" 
                    required 
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Document Name</Label>
                  <Input 
                    id="name" 
                    name="name" 
                    required 
                    placeholder="Enter a descriptive name"
                    value={suggestedName}
                    onChange={(e) => setSuggestedName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea 
                    id="description" 
                    name="description" 
                    placeholder="Brief description of the document"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select name="category" defaultValue="general">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={uploadDocument.isPending}>
                    {uploadDocument.isPending ? 'Uploading...' : 'Upload'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search documents..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        <Select 
          value={selectedCategory || "__all__"} 
          onValueChange={(val) => setSelectedCategory(val === "__all__" ? "" : val)}
        >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Document List */}
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : filteredDocuments?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No documents found</p>
              <p className="text-sm">Upload your first document to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDocuments?.map(doc => (
                <DocumentRow 
                  key={doc.id} 
                  document={doc} 
                  onView={() => setViewingDocument({ path: doc.file_path, name: doc.name })}
                  onDelete={() => deleteDocument.mutate(doc)}
                  isDeleting={deleteDocument.isPending}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* PDF Viewer Modal */}
        {viewingDocument && (
          <PDFViewer 
            filePath={viewingDocument.path} 
            fileName={viewingDocument.name}
            onClose={() => setViewingDocument(null)} 
          />
        )}
      </CardContent>
    </Card>
  );
}

function DocumentRow({ 
  document, 
  onView, 
  onDelete, 
  isDeleting 
}: { 
  document: any; 
  onView: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const FileIcon = getFileIcon(document.file_type);
  const { data: signedUrl } = useDocumentUrl(document.file_path);
  const isPDF = document.file_type?.includes('pdf');
  const categoryLabel = CATEGORIES.find(c => c.value === document.category)?.label || document.category;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <FileIcon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{document.name}</p>
          <Badge variant="outline" className="shrink-0 text-xs">
            {categoryLabel}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatFileSize(document.file_size)}</span>
          <span>•</span>
          <span>{format(new Date(document.created_at), 'MMM d, yyyy')}</span>
        </div>
        {document.description && (
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {document.description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isPDF && (
          <Button variant="ghost" size="icon" onClick={onView} title="View PDF">
            <Eye className="h-4 w-4" />
          </Button>
        )}
        {signedUrl && (
          <Button variant="ghost" size="icon" asChild title="Download">
            <a href={signedUrl} download={document.name} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
            </a>
          </Button>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onDelete}
          disabled={isDeleting}
          className="text-destructive hover:text-destructive"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
