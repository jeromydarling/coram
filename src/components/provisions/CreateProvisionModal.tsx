import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Minus, Package, Loader2, ClipboardPaste, AlertTriangle, Check, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useProvisionCatalog, useProvisionMutations } from '@/hooks/useProvisions';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

interface CreateProvisionModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  preselectedOpportunityId?: string;
}

interface InvoiceDetails {
  invoice_type: string;
  invoice_date: string;
  business_unit: string;
  client_id: string;
  business_name: string;
  business_address: string;
  business_city: string;
  business_state: string;
  business_zip: string;
  contact_name: string;
  contact_email: string;
  payment_due_date: string;
}

const defaultInvoiceDetails = (): InvoiceDetails => ({
  invoice_type: 'Due',
  invoice_date: format(new Date(), 'yyyy-MM-dd'),
  business_unit: '',
  client_id: '',
  business_name: '',
  business_address: '',
  business_city: '',
  business_state: '',
  business_zip: '',
  contact_name: '',
  contact_email: '',
  payment_due_date: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
});

interface ItemOverrides {
  product_name: string;
  gl_account: string;
}

export function CreateProvisionModal({ open, onClose, onCreated, preselectedOpportunityId }: CreateProvisionModalProps) {
  const { t } = useTranslation('provisions');
  const { data: catalog, isLoading: catalogLoading } = useProvisionCatalog();
  const { createProvision, parseProvision } = useProvisionMutations();
  const { user } = useAuth();

  const [tab, setTab] = useState<string>('catalog');
  const [opportunityId, setOpportunityId] = useState(preselectedOpportunityId || '');
  const [notes, setNotes] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceDetails>(defaultInvoiceDetails());
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [itemOverrides, setItemOverrides] = useState<Record<string, ItemOverrides>>({});

  // Paste & parse state
  const [rawText, setRawText] = useState('');
  const [parsedResult, setParsedResult] = useState<any>(null);
  const [isParsing, setIsParsing] = useState(false);

  // Simple opportunity search
  const [oppSearch, setOppSearch] = useState('');
  const { data: opportunities } = useQuery({
    queryKey: ['opportunities-search', oppSearch],
    queryFn: async () => {
      let q = supabase
        .from('opportunities')
        .select('id, organization, metro_id, address_line1, city, state, zip')
        .order('organization')
        .limit(20);

      if (oppSearch.trim()) {
        q = q.ilike('organization', `%${oppSearch.trim()}%`);
      }

      const { data } = await q;
      return data || [];
    },
    enabled: oppSearch.trim().length >= 1,
  });

  // Autofill from selected opportunity
  const selectedOpp = opportunities?.find((o: any) => o.id === opportunityId);

  useEffect(() => {
    if (selectedOpp && open) {
      setInvoiceDetails(prev => ({
        ...prev,
        business_name: selectedOpp.organization || prev.business_name,
        business_address: selectedOpp.address_line1 || prev.business_address,
        business_city: selectedOpp.city || prev.business_city,
        business_state: selectedOpp.state || prev.business_state,
        business_zip: selectedOpp.zip || prev.business_zip,
      }));

      // Autofill primary contact
      supabase
        .from('contacts')
        .select('name, email')
        .eq('opportunity_id', selectedOpp.id)
        .eq('is_primary', true)
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setInvoiceDetails(prev => ({
              ...prev,
              contact_name: data[0].name || prev.contact_name,
              contact_email: data[0].email || prev.contact_email,
            }));
          }
        });
    }
  }, [selectedOpp?.id, open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTab('catalog');
      setOpportunityId(preselectedOpportunityId || '');
      setNotes('');
      setQuantities({});
      setInvoiceDetails(defaultInvoiceDetails());
      setInvoiceOpen(false);
      setItemOverrides({});
      setRawText('');
      setParsedResult(null);
      setOppSearch('');
    }
  }, [open, preselectedOpportunityId]);

  const setQty = (id: string, delta: number) => {
    setQuantities(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  const updateItemOverride = (itemId: string, field: keyof ItemOverrides, value: string) => {
    setItemOverrides(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  const updateInvoice = (field: keyof InvoiceDetails, value: string) => {
    setInvoiceDetails(prev => ({ ...prev, [field]: value }));
  };

  const selectedItems = Object.entries(quantities).filter(([, qty]) => qty > 0);

  const totalCents = selectedItems.reduce((sum, [id, qty]) => {
    const item = catalog?.find((c: any) => c.id === id);
    return sum + (item ? item.unit_price_cents * qty : 0);
  }, 0);

  const handleCreate = async () => {
    if (!opportunityId || selectedItems.length === 0) return;

    const items = selectedItems.map(([catalog_item_id, quantity]) => {
      const override = itemOverrides[catalog_item_id];
      return {
        catalog_item_id,
        quantity,
        product_name: override?.product_name || undefined,
        gl_account: override?.gl_account || undefined,
      };
    });

    const result = await createProvision.mutateAsync({
      opportunity_id: opportunityId,
      items,
      notes: notes.trim() || undefined,
      ...invoiceDetails,
    });

    if (result?.provision?.id) {
      onCreated(result.provision.id);
    }
  };

  const handleParse = async () => {
    if (!rawText.trim() || !opportunityId) return;
    setIsParsing(true);
    try {
      const result = await parseProvision.mutateAsync({
        raw_text: rawText.trim(),
        opportunity_id: opportunityId,
      });
      setParsedResult(result);
    } finally {
      setIsParsing(false);
    }
  };

  const handleCreateFromParsed = async () => {
    if (!parsedResult?.parsed?.items || !opportunityId) return;

    const items = parsedResult.parsed.items.map((item: any) => ({
      catalog_item_id: item.catalog_item_id || undefined,
      quantity: item.quantity || 1,
      item_name: item.name,
      unit_price_cents: item.unit_price_cents || 0,
      product_name: item.product_name || item.name || undefined,
      gl_account: item.gl_account || undefined,
    }));

    const result = await createProvision.mutateAsync({
      opportunity_id: opportunityId,
      items,
      notes: parsedResult.parsed.notes || notes.trim() || undefined,
      ...invoiceDetails,
      // Override with parsed fields if present
      ...(parsedResult.parsed.client_id && { client_id: parsedResult.parsed.client_id }),
      ...(parsedResult.parsed.business_name && { business_name: parsedResult.parsed.business_name }),
      ...(parsedResult.parsed.contact_name && { contact_name: parsedResult.parsed.contact_name }),
      ...(parsedResult.parsed.contact_email && { contact_email: parsedResult.parsed.contact_email }),
      ...(parsedResult.parsed.invoice_date && { invoice_date: parsedResult.parsed.invoice_date }),
      ...(parsedResult.parsed.payment_due_date && { payment_due_date: parsedResult.parsed.payment_due_date }),
    });

    if (result?.provision?.id) {
      onCreated(result.provision.id);
    }
  };

  const groupedCatalog = (catalog || []).reduce((acc: Record<string, any[]>, item: any) => {
    const key = item.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {t('createModal.title')}
          </DialogTitle>
        </DialogHeader>

        {/* Opportunity selection */}
        {!preselectedOpportunityId && (
          <div className="space-y-2">
            <Label>{t('createModal.organizationLabel')}</Label>
            <Input
              placeholder={t('createModal.organizationPlaceholder')}
              value={oppSearch}
              onChange={e => setOppSearch(e.target.value)}
            />
            {opportunities && opportunities.length > 0 && !opportunityId && (
              <div className="border rounded-md max-h-32 overflow-y-auto">
                {opportunities.map((opp: any) => (
                  <button
                    key={opp.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                    onClick={() => {
                      setOpportunityId(opp.id);
                      setOppSearch(opp.organization);
                    }}
                  >
                    {opp.organization}
                  </button>
                ))}
              </div>
            )}
            {opportunityId && (
              <p className="text-xs text-muted-foreground">
                Selected. <button className="text-primary underline" onClick={() => { setOpportunityId(''); setOppSearch(''); }}>{t('createModal.selectedChange')}</button>
              </p>
            )}
          </div>
        )}

        {/* Invoice Details (collapsible) */}
        <Collapsible open={invoiceOpen} onOpenChange={setInvoiceOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between gap-2 text-sm font-medium">
              <span className="flex items-center gap-2">
                {t('createModal.invoiceDetails')}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-xs">
                        <strong>What:</strong> {t('createModal.invoiceTooltipWhat')}<br />
                        <strong>Where:</strong> {t('createModal.invoiceTooltipWhere')}<br />
                        <strong>Why:</strong> {t('createModal.invoiceTooltipWhy')}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
              {invoiceOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{t('createModal.invoiceDateLabel')}</Label>
                <Input type="date" value={invoiceDetails.invoice_date} onChange={e => updateInvoice('invoice_date', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{t('createModal.paymentDueLabel')}</Label>
                <Input type="date" value={invoiceDetails.payment_due_date} onChange={e => updateInvoice('payment_due_date', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{t('createModal.businessUnitLabel')}</Label>
                <Input value={invoiceDetails.business_unit} onChange={e => updateInvoice('business_unit', e.target.value)} placeholder={t('createModal.businessUnitPlaceholder')} />
              </div>
              <div>
                <Label className="text-xs">{t('createModal.clientIdLabel')}</Label>
                <Input value={invoiceDetails.client_id} onChange={e => updateInvoice('client_id', e.target.value)} placeholder={t('createModal.clientIdPlaceholder')} />
              </div>
            </div>
            <div>
              <Label className="text-xs">{t('createModal.businessNameLabel')}</Label>
              <Input value={invoiceDetails.business_name} onChange={e => updateInvoice('business_name', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t('createModal.addressLabel')}</Label>
              <Input value={invoiceDetails.business_address} onChange={e => updateInvoice('business_address', e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">{t('createModal.cityLabel')}</Label>
                <Input value={invoiceDetails.business_city} onChange={e => updateInvoice('business_city', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{t('createModal.stateLabel')}</Label>
                <Input value={invoiceDetails.business_state} onChange={e => updateInvoice('business_state', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{t('createModal.zipLabel')}</Label>
                <Input value={invoiceDetails.business_zip} onChange={e => updateInvoice('business_zip', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{t('createModal.contactNameLabel')}</Label>
                <Input value={invoiceDetails.contact_name} onChange={e => updateInvoice('contact_name', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{t('createModal.contactEmailLabel')}</Label>
                <Input value={invoiceDetails.contact_email} onChange={e => updateInvoice('contact_email', e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('createModal.requestedByLabel', { email: user?.email || 'Unknown' })}</p>
          </CollapsibleContent>
        </Collapsible>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="catalog">{t('createModal.tabCatalog')}</TabsTrigger>
            <TabsTrigger value="paste">{t('createModal.tabPaste')}</TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="space-y-4 mt-3">
            {catalogLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <>
                {Object.entries(groupedCatalog).map(([category, items]) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold text-foreground mb-2">{category}s</h3>
                    <div className="space-y-1">
                      {(items as any[]).map((item: any) => {
                        const qty = quantities[item.id] || 0;
                        const override = itemOverrides[item.id];
                        return (
                          <div key={item.id}>
                            <div className="flex items-start justify-between gap-2 py-1.5 px-2 rounded hover:bg-muted/50">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm break-words">{item.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  ${(item.unit_price_cents / 100).toFixed(2)}
                                  {item.tier && ` · ${item.tier}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {qty > 0 && (
                                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(item.id, -1)}>
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                )}
                                {qty > 0 && (
                                  <span className="w-6 text-center text-sm font-medium">{qty}</span>
                                )}
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(item.id, 1)}>
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            {qty > 0 && (
                              <div className="flex gap-2 px-2 pb-1">
                                <Input
                                  className="h-7 text-xs flex-1"
                                  placeholder="Product name override"
                                  value={override?.product_name || ''}
                                  onChange={e => updateItemOverride(item.id, 'product_name', e.target.value)}
                                />
                                <Input
                                  className="h-7 text-xs w-24"
                                  placeholder="G/L Acct"
                                  value={override?.gl_account || ''}
                                  onChange={e => updateItemOverride(item.id, 'gl_account', e.target.value)}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <Separator className="my-2" />
                  </div>
                ))}

                {selectedItems.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm font-semibold">
                      {selectedItems.reduce((s, [, q]) => s + q, 0)} items · ${(totalCents / 100).toFixed(2)}
                    </p>
                  </div>
                )}

                <Textarea placeholder={t('createModal.contextPlaceholder')} value={notes} onChange={e => setNotes(e.target.value)} rows={2} />

                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={!opportunityId || selectedItems.length === 0 || createProvision.isPending}
                >
                  {createProvision.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {t('createModal.saveAsDraft')}
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="paste" className="space-y-4 mt-3">
            {!parsedResult ? (
              <>
                <Textarea
                  placeholder={t('createModal.pastePlaceholder')}
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  rows={8}
                  className="font-mono text-xs"
                />
                <Button
                  className="w-full gap-2"
                  onClick={handleParse}
                  disabled={!rawText.trim() || !opportunityId || isParsing}
                >
                  {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardPaste className="w-4 h-4" />}
                  {t('createModal.parseOrder')}
                </Button>
              </>
            ) : (
              <>
                {parsedResult.warnings?.length > 0 && (
                  <div className="bg-muted/50 border border-border rounded-md p-3">
                    <p className="text-sm font-medium text-foreground flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" /> {t('createModal.parseWarnings')}
                    </p>
                    <ul className="mt-1 text-xs text-muted-foreground list-disc pl-4">
                      {parsedResult.warnings.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">{t('createModal.extractedItems')}</h3>
                  {(parsedResult.parsed?.items || []).map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2 px-2 rounded border">
                      <div className="flex items-center gap-2">
                        {item.catalog_item_id ? (
                          item.catalog_match_fuzzy ? (
                            <HelpCircle className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <Check className="w-4 h-4 text-primary" />
                          )
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                        )}
                        <div>
                          <p className="text-sm">{item.name}</p>
                          {item.catalog_match_name && item.catalog_match_name !== item.name && (
                            <p className="text-xs text-muted-foreground">→ {item.catalog_match_name}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <p>×{item.quantity}</p>
                        {item.unit_price_cents && (
                          <p className="text-xs text-muted-foreground">${(item.unit_price_cents / 100).toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setParsedResult(null)}>
                    {t('createModal.reParse')}
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleCreateFromParsed}
                    disabled={createProvision.isPending}
                  >
                    {t('createModal.confirmAndSave')}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
