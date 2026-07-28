import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Upload, X, Loader2, Check } from 'lucide-react';
import { useOCRScan } from '@/hooks/useOCRScan';
import { ConfidenceBadge } from './ConfidenceBadge';
import { toast } from '@/components/ui/sonner';

interface ExtractedContact {
  suggested_name?: string | null;
  suggested_email?: string | null;
  suggested_phone?: string | null;
  suggested_title?: string | null;
  suggested_organization?: string | null;
  confidence_score?: number | null;
}

interface OCRCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExtracted: (data: ExtractedContact) => void;
}

export function OCRCaptureModal({ open, onOpenChange, onExtracted }: OCRCaptureModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedContact | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const ocrScan = useOCRScan();
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setExtractedData(null);
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleScan = async () => {
    if (!selectedFile) return;
    
    try {
      const result = await ocrScan.mutateAsync([selectedFile]);
      
      if (result.suggestions && result.suggestions.length > 0) {
        const s = result.suggestions[0];
        const extracted: ExtractedContact = {
          suggested_name: s.name || null,
          suggested_email: s.email || null,
          suggested_phone: s.phone || null,
          suggested_title: s.title || null,
          suggested_organization: s.organization || null,
          confidence_score: s.confidence || null,
        };
        setExtractedData(extracted);
      } else {
        toast.error('Could not extract contact information from image');
      }
    } catch (error) {
      console.error('OCR failed:', error);
    }
  };
  
  const handleUseContact = () => {
    if (extractedData) {
      onExtracted(extractedData);
      handleClose();
    }
  };
  
  const handleClose = () => {
    setSelectedFile(null);
    setPreview(null);
    setExtractedData(null);
    onOpenChange(false);
  };
  
  const handleClear = () => {
    setSelectedFile(null);
    setPreview(null);
    setExtractedData(null);
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Scan Business Card
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!selectedFile ? (
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium">Upload an image</p>
              <p className="text-sm text-muted-foreground mt-1">
                Take a photo or upload a business card image
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <>
              <div className="relative">
                <img
                  src={preview!}
                  alt="Business card preview"
                  className="w-full h-48 object-contain rounded-lg bg-muted"
                />
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={handleClear}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {!extractedData && (
                <Button
                  className="w-full"
                  onClick={handleScan}
                  disabled={ocrScan.isPending}
                >
                  {ocrScan.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      Extract Contact
                    </>
                  )}
                </Button>
              )}
              
              {extractedData && (
                <Card className="bg-success/5 border-success/20">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-success">Extracted Successfully</span>
                      {extractedData.confidence_score && (
                        <ConfidenceBadge score={extractedData.confidence_score} />
                      )}
                    </div>
                    
                    <div className="space-y-1 text-sm">
                      {extractedData.suggested_name && (
                        <p><span className="text-muted-foreground">Name:</span> {extractedData.suggested_name}</p>
                      )}
                      {extractedData.suggested_title && (
                        <p><span className="text-muted-foreground">Title:</span> {extractedData.suggested_title}</p>
                      )}
                      {extractedData.suggested_organization && (
                        <p><span className="text-muted-foreground">Organization:</span> {extractedData.suggested_organization}</p>
                      )}
                      {extractedData.suggested_email && (
                        <p><span className="text-muted-foreground">Email:</span> {extractedData.suggested_email}</p>
                      )}
                      {extractedData.suggested_phone && (
                        <p><span className="text-muted-foreground">Phone:</span> {extractedData.suggested_phone}</p>
                      )}
                    </div>
                    
                    <Button className="w-full mt-3" onClick={handleUseContact}>
                      <Check className="h-4 w-4 mr-2" />
                      Use This Contact
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
