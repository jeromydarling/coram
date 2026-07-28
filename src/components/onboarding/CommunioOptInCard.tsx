/**
 * CommunioOptInCard — Calm opt-in for Communio network participation.
 *
 * WHAT: Checkbox to join Communio so other organizations can discover this tenant.
 * WHERE: OnboardingOrgEnrichmentStep, Settings page.
 * WHY: Privacy-first consent mechanism — never auto-enabled.
 */

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Users } from 'lucide-react';

interface Props {
  optIn: boolean;
  onOptInChange: (checked: boolean) => void;
}

export default function CommunioOptInCard({ optIn, onOptInChange }: Props) {
  return (
    <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-1.5">
          <h4 className="text-sm font-medium text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Let your work be known to others walking a similar path
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Communio is a living network of organizations doing similar work. 
            When you opt in, other stewards can discover your mission and learn from your work. 
            You remain in control of what is shared.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 pl-[3.25rem]">
        <Checkbox
          id="communio-opt-in"
          checked={optIn}
          onCheckedChange={(checked) => onOptInChange(checked === true)}
        />
        <Label htmlFor="communio-opt-in" className="text-sm cursor-pointer">
          Join Communio so other organizations can connect with us
        </Label>
      </div>

      {optIn && (
        <p className="text-xs text-muted-foreground/60 pl-[3.25rem]">
          Your profile will be visible to other Communio members — never publicly — until you choose to publish.
        </p>
      )}
    </div>
  );
}
