/**
 * ImpactDimensionsPage — Tenant-configurable structured impact metrics.
 *
 * WHAT: Manage impact dimensions (create, edit, toggle, deactivate).
 * WHERE: Settings > Impact Dimensions.
 * WHY: Lets tenants measure what matters without custom fields bloat.
 */

import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Ruler, Loader2 } from 'lucide-react';
import {
  useImpactDimensions,
  useCreateImpactDimension,
  useUpdateImpactDimension,
  type ImpactDimension,
} from '@/hooks/useImpactDimensions';

const ENTITY_LABELS: Record<string, string> = {
  event: 'Events',
  activity: 'Visits & Activities',
  provision: 'Prōvīsiō Orders',
};

const VALUE_TYPE_LABELS: Record<string, string> = {
  integer: 'Whole number',
  decimal: 'Decimal',
  currency: 'Currency',
  boolean: 'Yes / No',
};

const AGG_LABELS: Record<string, string> = {
  sum: 'Sum',
  avg: 'Average',
  count: 'Count',
  max: 'Maximum',
};

export default function ImpactDimensionsPage() {
  const { data: dimensions = [], isLoading } = useImpactDimensions();
  const create = useCreateImpactDimension();
  const update = useUpdateImpactDimension();
  const [open, setOpen] = useState(false);

  // Form state
  const [label, setLabel] = useState('');
  const [desc, setDesc] = useState('');
  const [entityType, setEntityType] = useState('activity');
  const [valueType, setValueType] = useState('integer');
  const [aggType, setAggType] = useState('sum');
  const [publicEligible, setPublicEligible] = useState(false);

  const resetForm = () => {
    setLabel(''); setDesc(''); setEntityType('activity');
    setValueType('integer'); setAggType('sum'); setPublicEligible(false);
  };

  const handleCreate = () => {
    create.mutate({
      entityType, label, description: desc,
      valueType, aggregationType: aggType,
      isPublicEligible: publicEligible,
    }, {
      onSuccess: () => { resetForm(); setOpen(false); },
    });
  };

  const grouped = Object.entries(ENTITY_LABELS).map(([type, typeLabel]) => ({
    type, typeLabel,
    items: dimensions.filter(d => d.entity_type === type),
  }));

  return (
    <MainLayout
      title="Impact Dimensions"
      subtitle="Measure what matters in your work"
      helpKey="page.settings"
    >
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Ruler className="h-4 w-4 text-primary" />
              Your Dimensions
              <HelpTooltip
                what="Structured metrics you define for your organization."
                where="Settings > Impact Dimensions"
                why="These appear on event, activity, and provision forms and feed your reports."
              />
            </CardTitle>
            <CardDescription>
              Define how your organization measures impact — without changing how CROS stays simple.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="mb-4 gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Add Dimension
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Impact Dimension</DialogTitle>
                  <DialogDescription>
                    This will appear as an optional field on the relevant forms.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label>Applies to</Label>
                    <Select value={entityType} onValueChange={setEntityType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Label (max 60 characters)</Label>
                    <Input value={label} onChange={e => setLabel(e.target.value.slice(0, 60))} placeholder="e.g. Devices distributed" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description (optional)</Label>
                    <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="What does this measure?" rows={2} className="resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Value type</Label>
                      <Select value={valueType} onValueChange={setValueType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(VALUE_TYPE_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Aggregation</Label>
                      <Select value={aggType} onValueChange={setAggType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(AGG_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={publicEligible} onCheckedChange={setPublicEligible} />
                    <div>
                      <Label className="text-sm">Eligible for public movement sharing</Label>
                      <p className="text-[11px] text-muted-foreground">Counts only, never names or details.</p>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreate} disabled={!label.trim() || create.isPending}>
                    {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : dimensions.length === 0 ? (
              <p className="text-sm text-muted-foreground/60 text-center py-6 italic">
                No dimensions yet. Add one to start measuring your impact.
              </p>
            ) : (
              <div className="space-y-6">
                {grouped.filter(g => g.items.length > 0).map(group => (
                  <div key={group.type} className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{group.typeLabel}</h4>
                    <div className="space-y-2">
                      {group.items.map(dim => (
                        <DimensionRow key={dim.id} dim={dim} onUpdate={update.mutate} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

function DimensionRow({ dim, onUpdate }: { dim: ImpactDimension; onUpdate: (input: any) => void }) {
  return (
    <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${!dim.is_active ? 'opacity-50' : ''}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{dim.label}</span>
          <Badge variant="outline" className="text-[10px] shrink-0">{VALUE_TYPE_LABELS[dim.value_type] || dim.value_type}</Badge>
          {dim.is_public_eligible && <Badge variant="secondary" className="text-[10px] shrink-0">Public</Badge>}
        </div>
        {dim.description && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{dim.description}</p>}
      </div>
      <Switch
        checked={dim.is_active}
        onCheckedChange={checked => onUpdate({ id: dim.id, isActive: checked })}
      />
    </div>
  );
}
