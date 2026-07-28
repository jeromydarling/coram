import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';
import { OCRCaptureModal } from './OCRCaptureModal';

interface ExtractedContact {
  suggested_name?: string | null;
  suggested_email?: string | null;
  suggested_phone?: string | null;
  suggested_title?: string | null;
  suggested_organization?: string | null;
  confidence_score?: number | null;
}

interface OCRScanButtonProps {
  onExtracted: (data: ExtractedContact) => void;
}

export function OCRScanButton({ onExtracted }: OCRScanButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const handleExtracted = (data: ExtractedContact) => {
    onExtracted(data);
    setIsOpen(false);
  };
  
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-1"
      >
        <Camera className="h-4 w-4" />
        Scan Card
      </Button>
      
      <OCRCaptureModal 
        open={isOpen} 
        onOpenChange={setIsOpen}
        onExtracted={handleExtracted}
      />
    </>
  );
}
