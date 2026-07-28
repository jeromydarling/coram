import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useProvisionCatalogAdmin, useCatalogMutations, CatalogItem, CatalogItemInsert } from '@/hooks/useProvisionCatalogAdmin';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2, Plus, Search, Check, X, Tag, HelpCircle } from 'lucide-react';
import { HotspotPricingSection } from '@/components/admin/HotspotPricingSection';

const TIERS = ['Good', 'Better', 'Best'];

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function parseDollars(str: string): number | null {
  const cleaned = str.replace(/[$,]/g, '').trim();
  const val = parseFloat(cleaned);
  if (isNaN(val) || val < 0) return null;
  return Math.round(val * 100);
}

/** Select with an "Add new…" option that reveals a text input */
function CategorySelect({
  value,
  knownCategories,
  onChange,
}: {
  value: string;
  knownCategories: string[];
  onChange: (val: string) => void;
}) {
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');

  if (isCustom) {
    return (
      <div className="flex items-center gap-1">
        <Input
          className="h-9 text-sm"
          placeholder="New category name"
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && customValue.trim()) {
              onChange(customValue.trim());
              setIsCustom(false);
              setCustomValue('');
            }
            if (e.key === 'Escape') {
              setIsCustom(false);
              setCustomValue('');
            }
          }}
          autoFocus
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => {
            if (customValue.trim()) {
              onChange(customValue.trim());
              setIsCustom(false);
              setCustomValue('');
            }
          }}
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => { setIsCustom(false); setCustomValue(''); }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v === '__new__') {
          setIsCustom(true);
        } else {
          onChange(v);
        }
      }}
    >
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {knownCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        {knownCategories.length > 0 && <SelectSeparator />}
        <SelectItem value="__new__">+ Add new…</SelectItem>
      </SelectContent>
    </Select>
  );
}

// Inline editable cell
function EditableCell({
  value,
  onSave,
  type = 'text',
  placeholder,
}: {
  value: string;
  onSave: (val: string) => void;
  type?: 'text' | 'price';
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const displayValue = type === 'price' ? formatCents(parseInt(value) || 0) : value;

  const handleSave = () => {
    if (type === 'price') {
      const cents = parseDollars(draft);
      if (cents === null) return;
      onSave(String(cents));
    } else {
      onSave(draft);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        className="text-left w-full px-1 py-0.5 rounded hover:bg-muted/50 transition-colors min-h-[28px] text-sm"
        onClick={() => {
          setDraft(type === 'price' ? (parseInt(value) / 100).toFixed(2) : value);
          setEditing(true);
        }}
      >
        {displayValue || <span className="text-muted-foreground italic">{placeholder || '—'}</span>}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        className="h-7 text-sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') handleCancel();
        }}
        autoFocus
      />
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleSave}>
        <Check className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleCancel}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

/** Inline editable cell that shows a category dropdown with "Add new…" */
function EditableCategoryCell({
  value,
  knownCategories,
  onSave,
}: {
  value: string;
  knownCategories: string[];
  onSave: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        className="text-left w-full px-1 py-0.5 rounded hover:bg-muted/50 transition-colors min-h-[28px] text-sm"
        onClick={() => setEditing(true)}
      >
        {value || <span className="text-muted-foreground italic">—</span>}
      </button>
    );
  }

  return (
    <CategorySelect
      value={value}
      knownCategories={knownCategories}
      onChange={(v) => {
        onSave(v);
        setEditing(false);
      }}
    />
  );
}

function AddItemDialog({
  open,
  onOpenChange,
  knownCategories,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  knownCategories: string[];
}) {
  const { createItem } = useCatalogMutations();
  const [form, setForm] = useState<CatalogItemInsert>({
    category: knownCategories[0] || '',
    tier: null,
    name: '',
    description: null,
    unit_price_cents: 0,
    default_gl_account: null,
    active: true,
  });
  const [priceStr, setPriceStr] = useState('');

  const handleSubmit = () => {
    if (!form.name.trim() || !form.category.trim()) return;
    const cents = parseDollars(priceStr);
    if (cents === null || cents < 0) return;
    createItem.mutate({ ...form, name: form.name.trim(), unit_price_cents: cents }, {
      onSuccess: () => {
        onOpenChange(false);
        setForm({ category: knownCategories[0] || '', tier: null, name: '', description: null, unit_price_cents: 0, default_gl_account: null, active: true });
        setPriceStr('');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Catalog Item</DialogTitle>
          <DialogDescription>Add a new item to the pricing catalog. It will be available for future provisions.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category *</Label>
              <CategorySelect
                value={form.category}
                knownCategories={knownCategories}
                onChange={(v) => setForm(f => ({ ...f, category: v }))}
              />
            </div>
            <div>
              <Label>Tier</Label>
              <Select value={form.tier || '_none'} onValueChange={(v) => setForm(f => ({ ...f, tier: v === '_none' ? null : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {TIERS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Dell OptiPlex 3000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unit Price ($)</Label>
              <Input value={priceStr} onChange={(e) => setPriceStr(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>GL Account</Label>
              <Input value={form.default_gl_account || ''} onChange={(e) => setForm(f => ({ ...f, default_gl_account: e.target.value || null }))} placeholder="Optional" />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Input value={form.description || ''} onChange={(e) => setForm(f => ({ ...f, description: e.target.value || null }))} placeholder="Optional notes" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.active} onCheckedChange={(c) => setForm(f => ({ ...f, active: c }))} />
            <Label>Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!form.name.trim() || !form.category.trim() || createItem.isPending}>
            {createItem.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Add Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PricingGuide() {
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);

  // Fetch with showInactive=true so we derive ALL known categories (including inactive items)
  const { data: allItems, isLoading: allLoading } = useProvisionCatalogAdmin(true);
  const { data: items, isLoading } = useProvisionCatalogAdmin(showInactive);
  const { updateItem, toggleActive } = useCatalogMutations();

  const knownCategories = useMemo(() => {
    if (!allItems) return [];
    return [...new Set(allItems.map(i => i.category))].sort();
  }, [allItems]);

  const categories = useMemo(() => {
    if (!items) return [];
    return [...new Set(items.map(i => i.category))].sort();
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter(item => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [items, categoryFilter, search]);

  return (
    <MainLayout title="Pricing Guide" subtitle="What we provide — and what it costs (for internal ordering).">
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-2 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 h-9"
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} id="show-inactive" />
              <Label htmlFor="show-inactive" className="text-sm whitespace-nowrap">Show inactive</Label>
            </div>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" />
            Add Item
          </Button>
        </div>

        {/* Help tooltip */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <HelpCircle className="h-3 w-3" />
          <span>Click any value to edit inline. Prices here set the default for new provisions — existing ones keep their original price.</span>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No catalog items found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Active</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead>GL Account</TableHead>
                      <TableHead className="hidden lg:table-cell">Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((item) => (
                      <TableRow key={item.id} className={!item.active ? 'opacity-50' : ''}>
                        <TableCell>
                          <Switch
                            checked={item.active}
                            onCheckedChange={(checked) => toggleActive.mutate({ id: item.id, active: checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <EditableCategoryCell
                            value={item.category}
                            knownCategories={knownCategories}
                            onSave={(v) => updateItem.mutate({ id: item.id, category: v })}
                          />
                        </TableCell>
                        <TableCell>
                          <EditableCell
                            value={item.tier || ''}
                            onSave={(v) => updateItem.mutate({ id: item.id, tier: v || null })}
                            placeholder="—"
                          />
                        </TableCell>
                        <TableCell>
                          <EditableCell
                            value={item.name}
                            onSave={(v) => {
                              if (v.trim()) updateItem.mutate({ id: item.id, name: v.trim() });
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <EditableCell
                            value={String(item.unit_price_cents)}
                            onSave={(v) => updateItem.mutate({ id: item.id, unit_price_cents: parseInt(v) })}
                            type="price"
                          />
                        </TableCell>
                        <TableCell>
                          <EditableCell
                            value={item.default_gl_account || ''}
                            onSave={(v) => updateItem.mutate({ id: item.id, default_gl_account: v || null } as any)}
                            placeholder="—"
                          />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell max-w-[200px]">
                          <EditableCell
                            value={item.description || ''}
                            onSave={(v) => updateItem.mutate({ id: item.id, description: v || null })}
                            placeholder="—"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          {filtered.length} item{filtered.length !== 1 ? 's' : ''} shown
          {!showInactive && items && items.length > filtered.length ? ` (${items.length - filtered.length} inactive hidden)` : ''}
        </p>

        {/* Hotspots & Connectivity Section */}
        <Separator className="my-6" />
        <HotspotPricingSection />
      </div>

      <AddItemDialog open={addOpen} onOpenChange={setAddOpen} knownCategories={knownCategories} />
    </MainLayout>
  );
}
