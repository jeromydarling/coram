import { forwardRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useTranslation } from 'react-i18next';

interface GardenerNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GardenerNoteModal = forwardRef<HTMLDivElement, GardenerNoteModalProps>(function GardenerNoteModal({ open, onOpenChange }, _ref) {
  const { t } = useTranslation('marketing');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[hsl(var(--marketing-surface))] border-[hsl(var(--marketing-border))]">
        <DialogHeader>
          <DialogTitle
            className="text-lg text-[hsl(var(--marketing-navy))] font-normal"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {t('gardenerNoteModal.title')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('gardenerNoteModal.srDescription')}
          </DialogDescription>
        </DialogHeader>

        <div
          className="space-y-4 text-sm text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          <p>{t('gardenerNoteModal.p1')}</p>
          <p>{t('gardenerNoteModal.p2')}</p>
          <p>{t('gardenerNoteModal.p3')}</p>
          <p className="italic text-[hsl(var(--marketing-navy)/0.5)] text-xs pt-2">
            {t('gardenerNoteModal.footnote')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
});

export default GardenerNoteModal;
