/**
 * RelationalFocusStep — Onboarding step for selecting relational orientation.
 *
 * WHAT: Three radio cards: Human-Focused, Institution-Focused, Hybrid.
 * WHERE: Onboarding flow, after archetype selection.
 * WHY: Orientation determines entity richness defaults and compass weighting.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Building2, Blend, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/components/ui/sonner';
import { HelpTooltip } from '@/components/ui/help-tooltip';

interface Props {
  onComplete: () => void;
}

const OPTIONS = [
  {
    value: 'human_focused',
    label: 'Human-Focused',
    icon: Users,
    description: 'Your mission centers on people — individuals, families, or communities. Relationships with people carry the richest narrative detail.',
  },
  {
    value: 'institution_focused',
    label: 'Institution-Focused',
    icon: Building2,
    description: 'Your mission centers on organizations — partners, agencies, or churches. Partner relationships carry the richest detail; people are tracked more lightly.',
  },
  {
    value: 'hybrid',
    label: 'Hybrid',
    icon: Blend,
    description: 'Your mission engages both people and organizations with equal depth. Both carry rich narrative detail.',
  },
] as const;

export function RelationalFocusStep({ onComplete }: Props) {
  const { tenantId } = useTenant();
  const [selected, setSelected] = useState<string>('institution_focused');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!tenantId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('set_relational_orientation', {
        p_tenant_id: tenantId,
        p_orientation: selected,
        p_auto_manage: true,
      });
      if (error) throw error;
      onComplete();
    } catch (err) {
      toast.error('Could not save orientation');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          What is the primary focus of your work?
          <HelpTooltip
            what="Relational orientation determines whether your workspace emphasizes people, organizations, or both."
            where="Onboarding flow"
            why="This shapes how entity detail pages, compass weighting, and narrative richness behave across your workspace."
          />
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          This shapes how your workspace presents relationships. You can change it later in Settings.
        </p>
      </div>

      <div className="grid gap-3">
        {OPTIONS.map(opt => {
          const Icon = opt.icon;
          const isSelected = selected === opt.value;
          return (
            <Card
              key={opt.value}
              className={`p-4 cursor-pointer transition-all border-2 ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40'
              }`}
              onClick={() => setSelected(opt.value)}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  isSelected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Button onClick={handleSave} disabled={isSaving} className="w-full">
        {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Continue
      </Button>
    </div>
  );
}
