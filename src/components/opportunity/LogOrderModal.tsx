import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Minus, Wifi } from 'lucide-react';
import { useProvisionCatalog } from '@/hooks/useProvisions';
import { useHotspotProducts, useSubscriptionTerms, type SubscriptionTerm } from '@/hooks/useHotspotPricing';

interface LogOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (orderDate: string, items: { catalog_item_id: string; quantity: number; unit_price_cents: number; product_name?: string }[], overrideTotalCents?: number) => Promise<void>;
  isSubmitting: boolean;
}

interface HotspotSelection {
  productId: string;
  productName: string;
  termId: string;
  months: number;
  priceCents: number;
  quantity: number;
  bundleType: 'service' | 'bundle';
}

export function LogOrderModal({ open, onOpenChange, onSubmit, isSubmitting }: LogOrderModalProps) {
  const [orderDate, setOrderDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customTotal, setCustomTotal] = useState<string>('');
  const [isCustomTotal, setIsCustomTotal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hotspotSelections, setHotspotSelections] = useState<HotspotSelection[]>([]);

  const { data: catalog, isLoading: catalogLoading } = useProvisionCatalog();
  const { data: hotspotProducts, isLoading: hotspotLoading } = useHotspotProducts();
  const hotspotIds = useMemo(() => (hotspotProducts || []).map(p => p.id), [hotspotProducts]);
  const { data: allTerms } = useSubscriptionTerms(hotspotIds);

  const termsByProduct = useMemo(() => {
    const map: Record<string, SubscriptionTerm[]> = {};
    for (const t of allTerms || []) {
      if (!map[t.product_id]) map[t.product_id] = [];
      map[t.product_id].push(t);
    }
    return map;
  }, [allTerms]);

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

  const addHotspot = (productId: string, productName: string, term: SubscriptionTerm, bundleType: 'service' | 'bundle') => {
    const priceCents = bundleType === 'bundle' ? (term.bundle_price_cents ?? term.service_price_cents) : term.service_price_cents;
    setHotspotSelections(prev => {
      const existing = prev.find(s => s.termId === term.id && s.bundleType === bundleType);
      if (existing) {
        return prev.map(s => s === existing ? { ...s, quantity: s.quantity + 1 } : s);
      }
      return [...prev, { productId, productName, termId: term.id, months: term.months, priceCents, quantity: 1, bundleType }];
    });
  };

  const updateHotspotQty = (index: number, delta: number) => {
    setHotspotSelections(prev => {
      const next = [...prev];
      next[index] = { ...next[index], quantity: Math.max(0, next[index].quantity + delta) };
      return next.filter(s => s.quantity > 0);
    });
  };

  const selectedCatalogItems = Object.entries(quantities).filter(([, qty]) => qty > 0);

  const catalogCents = selectedCatalogItems.reduce((sum, [id, qty]) => {
    const item = catalog?.find((c: any) => c.id === id);
    return sum + (item ? item.unit_price_cents * qty : 0);
  }, 0);

  const hotspotCents = hotspotSelections.reduce((sum, s) => sum + s.priceCents * s.quantity, 0);
  const calculatedCents = catalogCents + hotspotCents;

  const effectiveCents = isCustomTotal && customTotal !== ''
    ? Math.round(parseFloat(customTotal) * 100)
    : calculatedCents;

  const totalCatalogUnits = selectedCatalogItems.reduce((s, [, q]) => s + q, 0);
  const totalHotspotUnits = hotspotSelections.reduce((s, h) => s + h.quantity, 0);
  const totalUnits = totalCatalogUnits + totalHotspotUnits;

  const groupedCatalog = (catalog || []).reduce((acc: Record<string, any[]>, item: any) => {
    const key = item.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!orderDate) { setError('Please select an order date'); return; }
    if (totalUnits === 0) { setError('Please select at least one item'); return; }

    const items: { catalog_item_id: string; quantity: number; unit_price_cents: number; product_name?: string }[] = [];

    // Catalog items
    for (const [catalog_item_id, quantity] of selectedCatalogItems) {
      const item = catalog?.find((c: any) => c.id === catalog_item_id);
      items.push({ catalog_item_id, quantity, unit_price_cents: item?.unit_price_cents || 0 });
    }

    // Hotspot items — use empty catalog_item_id and set product_name for TSV
    for (const hs of hotspotSelections) {
      const typeLabel = hs.bundleType === 'bundle' ? 'Device + Service' : 'Service Only';
      items.push({
        catalog_item_id: '',
        quantity: hs.quantity,
        unit_price_cents: hs.priceCents,
        product_name: `${hs.productName} — ${hs.months}mo (${typeLabel})`,
      });
    }

    await onSubmit(orderDate, items, isCustomTotal ? effectiveCents : undefined);

    // Reset
    setOrderDate(format(new Date(), 'yyyy-MM-dd'));
    setQuantities({});
    setCustomTotal('');
    setIsCustomTotal(false);
    setHotspotSelections([]);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setError(null);
      setOrderDate(format(new Date(), 'yyyy-MM-dd'));
      setQuantities({});
      setCustomTotal('');
      setIsCustomTotal(false);
      setHotspotSelections([]);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Order</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="order-date">Order Date</Label>
            <Input
              id="order-date"
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          <Separator />

          <Tabs defaultValue="computers" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="computers">Computers</TabsTrigger>
              <TabsTrigger value="hotspots" className="gap-1.5">
                <Wifi className="h-3 w-3" />
                Hotspots
              </TabsTrigger>
            </TabsList>

            {/* Computer / Accessory catalog tab */}
            <TabsContent value="computers" className="mt-3">
              <div className="space-y-1">
                <Label>What we provided</Label>
                {catalogLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                    {Object.entries(groupedCatalog).map(([category, items]) => (
                      <div key={category}>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{category}s</h3>
                        <div className="space-y-0.5">
                          {(items as any[]).map((item: any) => {
                            const qty = quantities[item.id] || 0;
                            return (
                              <div key={item.id} className="flex items-start justify-between gap-2 py-1.5 px-2 rounded hover:bg-muted/50">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm break-words">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    ${(item.unit_price_cents / 100).toFixed(2)}
                                    {item.tier && ` · ${item.tier}`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {qty > 0 && (
                                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(item.id, -1)}>
                                      <Minus className="w-3 h-3" />
                                    </Button>
                                  )}
                                  {qty > 0 && (
                                    <span className="w-6 text-center text-sm font-medium">{qty}</span>
                                  )}
                                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(item.id, 1)}>
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <Separator className="my-2" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Hotspots tab */}
            <TabsContent value="hotspots" className="mt-3">
              <div className="space-y-1">
                <Label>Select hotspot & term</Label>
                {hotspotLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : !hotspotProducts || hotspotProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No hotspot products available.</p>
                ) : (
                  <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                    {hotspotProducts.map((product) => {
                      const terms = termsByProduct[product.id] || [];
                      return (
                        <div key={product.id}>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{product.name}</h3>
                            {product.network_type && (
                              <Badge variant="outline" className="text-[10px] h-4">{product.network_type}</Badge>
                            )}
                          </div>
                          <div className="space-y-0.5">
                            {terms.map((term) => (
                              <div key={term.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-muted/50">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm">{term.months}mo</p>
                                  <p className="text-xs text-muted-foreground">
                                    Service: ${(term.service_price_cents / 100).toFixed(2)}
                                    {term.bundle_price_cents != null && ` · Bundle: $${(term.bundle_price_cents / 100).toFixed(2)}`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => addHotspot(product.id, product.name, term, 'service')}
                                  >
                                    + Service
                                  </Button>
                                  {term.bundle_price_cents != null && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => addHotspot(product.id, product.name, term, 'bundle')}
                                    >
                                      + Bundle
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          <Separator className="my-2" />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Selected hotspots summary */}
                {hotspotSelections.length > 0 && (
                  <div className="mt-2 space-y-1 bg-muted/30 rounded p-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Selected Hotspots</p>
                    {hotspotSelections.map((hs, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">{hs.productName} — {hs.months}mo ({hs.bundleType === 'bundle' ? 'Bundle' : 'Service'})</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => updateHotspotQty(idx, -1)}>
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-5 text-center text-xs font-medium">{hs.quantity}</span>
                          <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => updateHotspotQty(idx, 1)}>
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {totalUnits > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <p className="text-sm font-semibold">
                {totalUnits} {totalUnits === 1 ? 'item' : 'items'} · ${(effectiveCents / 100).toFixed(2)}
              </p>
              {isCustomTotal && calculatedCents !== effectiveCents && (
                <p className="text-xs text-muted-foreground line-through">
                  Catalog total: ${(calculatedCents / 100).toFixed(2)}
                </p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    if (!isCustomTotal) {
                      setCustomTotal((calculatedCents / 100).toFixed(2));
                    } else {
                      setCustomTotal('');
                    }
                    setIsCustomTotal(!isCustomTotal);
                  }}
                >
                  {isCustomTotal ? 'Use catalog pricing' : 'Adjust total (discount)'}
                </button>
              </div>
              {isCustomTotal && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={customTotal}
                    onChange={(e) => setCustomTotal(e.target.value)}
                    className="h-8 w-32"
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || totalUnits === 0}>
              {isSubmitting ? 'Logging...' : 'Log Order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
