import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Wifi, Check, X, HelpCircle } from 'lucide-react';
import {
  useHotspotProducts,
  useSubscriptionTerms,
  useHotspotPricingMutations,
  type HotspotProduct,
  type SubscriptionTerm,
} from '@/hooks/useHotspotPricing';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function parseDollars(str: string): number | null {
  const cleaned = str.replace(/[$,]/g, '').trim();
  const val = parseFloat(cleaned);
  if (isNaN(val) || val < 0) return null;
  return Math.round(val * 100);
}

function EditablePriceCell({ cents, onSave }: { cents: number; onSave: (c: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (!editing) {
    return (
      <button
        className="text-right w-full px-1 py-0.5 rounded hover:bg-muted/50 transition-colors min-h-[28px] text-sm tabular-nums"
        onClick={() => { setDraft((cents / 100).toFixed(2)); setEditing(true); }}
      >
        {formatCents(cents)}
      </button>
    );
  }

  const handleSave = () => {
    const parsed = parseDollars(draft);
    if (parsed !== null) onSave(parsed);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        className="h-7 text-sm w-24 text-right"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
        autoFocus
      />
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleSave}>
        <Check className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setEditing(false)}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

function ProductTermsTable({ product, terms }: { product: HotspotProduct; terms: SubscriptionTerm[] }) {
  const { upsertTerm, updateProduct } = useHotspotPricingMutations();

  return (
    <Card className={!product.active ? 'opacity-50' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{product.name}</CardTitle>
            {product.network_type && (
              <Badge variant="outline" className="text-xs">{product.network_type}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Active</Label>
            <Switch
              checked={product.active}
              onCheckedChange={(active) => updateProduct.mutate({ id: product.id, active })}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Months</TableHead>
                <TableHead className="text-right">Service Only</TableHead>
                <TableHead className="text-right">Service + Device</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {terms.map((term) => (
                <TableRow key={term.id}>
                  <TableCell className="font-medium text-sm">{term.months}mo</TableCell>
                  <TableCell className="text-right">
                    <EditablePriceCell
                      cents={term.service_price_cents}
                      onSave={(c) => upsertTerm.mutate({ id: term.id, product_id: term.product_id, months: term.months, service_price_cents: c, bundle_price_cents: term.bundle_price_cents })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <EditablePriceCell
                      cents={term.bundle_price_cents ?? 0}
                      onSave={(c) => upsertTerm.mutate({ id: term.id, product_id: term.product_id, months: term.months, service_price_cents: term.service_price_cents, bundle_price_cents: c })}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {terms.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-4">
                    No subscription terms configured.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function AddHotspotDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { createProduct } = useHotspotPricingMutations();
  const [name, setName] = useState('');
  const [networkType, setNetworkType] = useState('5G');

  const handleSubmit = () => {
    if (!name.trim()) return;
    createProduct.mutate(
      {
        name: name.trim(),
        category: 'Hotspots & Connectivity',
        product_type: 'hotspot_device',
        network_type: networkType,
        active: true,
        display_order: 50,
      },
      { onSuccess: () => { onOpenChange(false); setName(''); setNetworkType('5G'); } },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Hotspot Product</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Product Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 5G Hotspot — Ultra" />
          </div>
          <div>
            <Label>Network Type</Label>
            <Select value={networkType} onValueChange={setNetworkType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="5G">5G</SelectItem>
                <SelectItem value="4G">4G</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || createProduct.isPending}>
            {createProduct.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Add Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function HotspotPricingSection() {
  const [addOpen, setAddOpen] = useState(false);
  const { data: products, isLoading: productsLoading } = useHotspotProducts(true);
  const productIds = useMemo(() => (products || []).map(p => p.id), [products]);
  const { data: allTerms, isLoading: termsLoading } = useSubscriptionTerms(productIds);

  const isLoading = productsLoading || termsLoading;

  const termsByProduct = useMemo(() => {
    const map: Record<string, SubscriptionTerm[]> = {};
    for (const t of allTerms || []) {
      if (!map[t.product_id]) map[t.product_id] = [];
      map[t.product_id].push(t);
    }
    return map;
  }, [allTerms]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wifi className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Hotspots & Connectivity</h2>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Product
        </Button>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <HelpCircle className="h-3 w-3" />
        <span>Click any price to edit inline. Changes apply to future provisions only.</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !products || products.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Wifi className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No hotspot products configured.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {products.map((product) => (
            <ProductTermsTable
              key={product.id}
              product={product}
              terms={termsByProduct[product.id] || []}
            />
          ))}
        </div>
      )}

      <AddHotspotDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
