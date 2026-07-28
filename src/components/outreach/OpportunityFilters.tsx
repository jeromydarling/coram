import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { useMetros } from '@/hooks/useMetros';
import { useMetroIntelligence } from '@/hooks/useMetroIntelligence';
import type { SegmentDefinition } from '@/hooks/useEmailSegments';

const PARTNER_TIERS = ['Anchor', 'Distribution', 'Staff Referral', 'Community', 'Event'];

interface OpportunityFiltersProps {
  value: SegmentDefinition;
  onChange: (value: SegmentDefinition) => void;
}

export function OpportunityFilters({ value, onChange }: OpportunityFiltersProps) {
  const { data: metros = [] } = useMetros();
  const { enabled: metroEnabled } = useMetroIntelligence();

  const metroOptions = metros.map((m) => ({ label: m.metro, value: m.id }));
  const tierOptions = PARTNER_TIERS.map((t) => ({ label: t, value: t }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Partner Tiers</Label>
        <MultiSelect options={tierOptions} selected={value.partner_tiers || []} onChange={(tiers) => onChange({ ...value, partner_tiers: tiers })} placeholder="Select partner tiers..." />
      </div>
      {metroEnabled && (
        <div className="space-y-2">
          <Label>Metros</Label>
          <MultiSelect options={metroOptions} selected={value.metro_ids || []} onChange={(ids) => onChange({ ...value, metro_ids: ids })} placeholder="Select metros..." />
        </div>
      )}
    </div>
  );
}
