/**
 * ImpactDimensionsPanel — Compact impact inputs for entity forms.
 *
 * WHAT: Renders active dimensions as optional inputs on events/activities/provisions.
 * WHERE: Entity create/edit forms.
 * WHY: Structured data capture feeds reports, NRI, and movement sharing.
 */

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Loader2, Save, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  useActiveImpactDimensions,
  useImpactValues,
  useSaveImpactValues,
  type ImpactDimension,
} from '@/hooks/useImpactDimensions';

interface Props {
  entityType: 'event' | 'activity' | 'provision';
  entityId: string | undefined;
}

export function ImpactDimensionsPanel({ entityType, entityId }: Props) {
  const { data: dimensions = [] } = useActiveImpactDimensions(entityType);
  const { data: existingValues = [] } = useImpactValues(entityId);
  const save = useSaveImpactValues();
  const navigate = useNavigate();

  const [localValues, setLocalValues] = useState<Record<string, { numeric?: string; boolean?: boolean }>>({});
  const [dirty, setDirty] = useState(false);

  // Seed from existing values
  useEffect(() => {
    if (existingValues.length > 0) {
      const map: typeof localValues = {};
      for (const v of existingValues) {
        map[v.dimension_id] = {
          numeric: v.value_numeric?.toString() ?? '',
          boolean: v.value_boolean ?? false,
        };
      }
      setLocalValues(map);
      setDirty(false);
    }
  }, [existingValues]);

  const updateValue = useCallback((dimId: string, field: 'numeric' | 'boolean', val: string | boolean) => {
    setLocalValues(prev => ({
      ...prev,
      [dimId]: { ...prev[dimId], [field]: val },
    }));
    setDirty(true);
  }, []);

  const handleSave = () => {
    if (!entityId) return;
    const values = dimensions.map(dim => {
      const local = localValues[dim.id];
      return {
        dimensionId: dim.id,
        valueNumeric: dim.value_type !== 'boolean'
          ? (local?.numeric ? parseFloat(local.numeric) : null)
          : null,
        valueBoolean: dim.value_type === 'boolean'
          ? (local?.boolean ?? null)
          : null,
      };
    }).filter(v => v.valueNumeric !== null || v.valueBoolean !== null);

    if (values.length > 0) {
      save.mutate({ entityId, values });
      setDirty(false);
    }
  };

  if (dimensions.length === 0) {
    return (
      <div className="text-center py-3">
        <p className="text-xs text-muted-foreground/60 italic">
          No impact fields yet.{' '}
          <button
            onClick={() => navigate('/settings/impact')}
            className="underline hover:text-foreground transition-colors"
          >
            Add a few
          </button>
          {' '}if you want.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Heart className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-muted-foreground">Impact (optional)</span>
        <HelpTooltip
          what="Record impact metrics defined by your organization."
          where="This entity form."
          why="Feeds reports, narrative rollups, and optional public movement sharing."
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {dimensions.map(dim => (
          <DimensionInput
            key={dim.id}
            dim={dim}
            value={localValues[dim.id]}
            onChange={(field, val) => updateValue(dim.id, field, val)}
          />
        ))}
      </div>
      {dirty && entityId && (
        <Button size="sm" onClick={handleSave} disabled={save.isPending} className="gap-1.5">
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Impact
        </Button>
      )}
    </div>
  );
}

function DimensionInput({
  dim,
  value,
  onChange,
}: {
  dim: ImpactDimension;
  value?: { numeric?: string; boolean?: boolean };
  onChange: (field: 'numeric' | 'boolean', val: string | boolean) => void;
}) {
  if (dim.value_type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={value?.boolean ?? false}
          onCheckedChange={c => onChange('boolean', !!c)}
        />
        {dim.label}
      </label>
    );
  }

  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{dim.label}</label>
      <Input
        type="number"
        step={dim.value_type === 'integer' ? '1' : '0.01'}
        min={0}
        placeholder="—"
        value={value?.numeric ?? ''}
        onChange={e => onChange('numeric', e.target.value)}
        className="h-9"
      />
    </div>
  );
}
