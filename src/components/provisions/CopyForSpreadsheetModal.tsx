import { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Copy, ClipboardCheck, HelpCircle } from 'lucide-react';
import { buildProvisionTSV, HEADERS, type ProvisionForTSV, type ProvisionItemForTSV } from '@/utils/buildProvisionTSV';
import { supabase } from '@/integrations/supabase/client';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CopyForSpreadsheetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provision: ProvisionForTSV & { id: string; export_count?: number };
  items: ProvisionItemForTSV[];
  requestedByLabel: string;
}

export function CopyForSpreadsheetModal({
  open,
  onOpenChange,
  provision,
  items,
  requestedByLabel,
}: CopyForSpreadsheetModalProps) {
  const { t } = useTranslation('provisions');
  const { toast } = useToast();
  const [copied, setCopied] = useState<'header' | 'rows' | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const tsvWithHeader = useMemo(
    () => buildProvisionTSV(provision, items, requestedByLabel, { includeHeader: true }),
    [provision, items, requestedByLabel],
  );

  const tsvRowsOnly = useMemo(
    () => buildProvisionTSV(provision, items, requestedByLabel, { includeHeader: false }),
    [provision, items, requestedByLabel],
  );

  const previewRows = useMemo(() => {
    return items.map((item) => {
      const qty = item.quantity;
      const unitCents = item.unit_price_cents;
      return {
        productName: item.product_name || item.item_name || '',
        glAccount: item.gl_account || '',
        quantity: qty,
        costPerUnit: (unitCents / 100).toFixed(2),
        total: ((qty * unitCents) / 100).toFixed(2),
      };
    });
  }, [items]);

  const recordExport = async () => {
    try {
      await supabase
        .from('provisions' as any)
        .update({
          exported_at: new Date().toISOString(),
          export_count: (provision.export_count || 0) + 1,
        })
        .eq('id', provision.id);
    } catch {
      // best-effort, swallow
    }
  };

  const handleCopy = async (variant: 'header' | 'rows') => {
    const text = variant === 'header' ? tsvWithHeader : tsvRowsOnly;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(variant);
      toast({ title: t('copySpreadsheet.toastCopiedTitle'), description: t('copySpreadsheet.toastCopiedDesc') });
      recordExport();
      setTimeout(() => setCopied(null), 2500);
    } catch {
      toast({ title: t('copySpreadsheet.toastFailTitle'), description: t('copySpreadsheet.toastFailDesc'), variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="copy-tsv-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('copySpreadsheet.title')}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">
                    <strong>What:</strong> {t('copySpreadsheet.tooltipWhat')}<br />
                    <strong>Where:</strong> {t('copySpreadsheet.tooltipWhere')}<br />
                    <strong>Why:</strong> {t('copySpreadsheet.tooltipWhy')}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {t('copySpreadsheet.pasteInstructions')}
        </p>

        {/* Preview table */}
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-2 py-1.5 text-left font-medium whitespace-nowrap">Product Name</th>
                <th className="px-2 py-1.5 text-left font-medium whitespace-nowrap">G/L Account</th>
                <th className="px-2 py-1.5 text-right font-medium whitespace-nowrap">Qty</th>
                <th className="px-2 py-1.5 text-right font-medium whitespace-nowrap">Cost/Unit</th>
                <th className="px-2 py-1.5 text-right font-medium whitespace-nowrap">Total</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-2 py-1.5 whitespace-nowrap">{row.productName}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{row.glAccount || '—'}</td>
                  <td className="px-2 py-1.5 text-right">{row.quantity}</td>
                  <td className="px-2 py-1.5 text-right">${row.costPerUnit}</td>
                  <td className="px-2 py-1.5 text-right font-medium">${row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* TSV text area */}
        <Textarea
          ref={textareaRef}
          readOnly
          value={tsvWithHeader}
          rows={Math.min(items.length + 2, 10)}
          className="font-mono text-[10px] leading-tight resize-none"
          onClick={() => textareaRef.current?.select()}
          data-testid="copy-tsv-raw"
        />

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => handleCopy('rows')}
            className="gap-2"
          >
            {copied === 'rows' ? <ClipboardCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {t('copySpreadsheet.copyRowsOnly')}
          </Button>
          <Button
            onClick={() => handleCopy('header')}
            className="gap-2"
          >
            {copied === 'header' ? <ClipboardCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {t('copySpreadsheet.copyWithHeader')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
