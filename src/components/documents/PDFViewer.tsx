import { useEffect, useRef, useState } from 'react';
import { useDocumentUrl } from '@/hooks/useDocuments';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PDFViewerProps {
  filePath: string;
  fileName: string;
  onClose: () => void;
}

export function PDFViewer({ filePath, fileName, onClose }: PDFViewerProps) {
  const { data: signedUrl, isLoading: isLoadingUrl } = useDocumentUrl(filePath);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load PDF document
  useEffect(() => {
    if (!signedUrl) return;

    let cancelled = false;
    setIsLoadingPdf(true);
    setError(null);

    const loadPdf = async () => {
      try {
        // Fetch as blob to avoid CORS/blocking issues
        const response = await fetch(signedUrl);
        if (!response.ok) throw new Error('Failed to fetch PDF');
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        if (!cancelled) {
          setPdfDoc(pdf);
          setTotalPages(pdf.numPages);
          setCurrentPage(1);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading PDF:', err);
          setError('Failed to load PDF. Try downloading instead.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPdf(false);
        }
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [signedUrl]);

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let cancelled = false;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;
      } catch (err) {
        console.error('Error rendering page:', err);
      }
    };

    renderPage();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage, scale]);

  const goToPrevPage = () => setCurrentPage((p) => Math.max(1, p - 1));
  const goToNextPage = () => setCurrentPage((p) => Math.min(totalPages, p + 1));
  const zoomIn = () => setScale((s) => Math.min(3, s + 0.2));
  const zoomOut = () => setScale((s) => Math.max(0.5, s - 0.2));

  const handleDownload = async () => {
    if (!signedUrl) return;
    try {
      const response = await fetch(signedUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const isLoading = isLoadingUrl || isLoadingPdf;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 shrink-0 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="truncate pr-4">{fileName}</DialogTitle>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={!signedUrl} className="mr-6">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </DialogHeader>

        {/* PDF Controls */}
        {pdfDoc && (
          <div className="flex items-center justify-center gap-4 px-4 py-2 border-b bg-muted/30">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={goToPrevPage} disabled={currentPage <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm min-w-[80px] text-center">
                Page {currentPage} of {totalPages}
              </span>
              <Button variant="ghost" size="icon" onClick={goToNextPage} disabled={currentPage >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={zoomOut} disabled={scale <= 0.5}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm min-w-[50px] text-center">{Math.round(scale * 100)}%</span>
              <Button variant="ghost" size="icon" onClick={zoomIn} disabled={scale >= 3}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* PDF Canvas */}
        <div className="flex-1 min-h-0 overflow-auto bg-muted/20 flex items-start justify-center p-4">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <Skeleton className="w-[400px] h-[500px]" />
              <p className="text-sm text-muted-foreground">Loading PDF...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <p className="text-muted-foreground">{error}</p>
              <Button onClick={handleDownload} disabled={!signedUrl}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="shadow-lg rounded border bg-white"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
