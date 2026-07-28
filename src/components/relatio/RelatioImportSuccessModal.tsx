/**
 * RelatioImportSuccessModal — Tenant-facing import summary with calm language.
 *
 * WHAT: Shows what data was received and what was not, in gentle tone.
 * WHERE: Displayed after a Relatio import completes.
 * WHY: Tenants deserve honest, non-alarming feedback about their import.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Info } from 'lucide-react';
import type { CoverageResult } from '@/lib/relatio/coverageMode';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: CoverageResult;
  connectorName?: string;
}

export default function RelatioImportSuccessModal({ open, onOpenChange, result, connectorName }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Import Complete
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {connectorName && (
            <p className="text-sm text-muted-foreground">
              Data received from <span className="font-medium text-foreground">{connectorName}</span>.
            </p>
          )}

          {/* What we received */}
          <div>
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">
              What we received
            </h4>
            <div className="space-y-1.5">
              {result.contactCount > 0 && (
                <ReceivedItem label="People" value={`${result.contactCount} recognized`} />
              )}
              {result.partnerCount > 0 && (
                <ReceivedItem label="Partners" value={`${result.partnerCount} organizations`} />
              )}
              {result.householdCount > 0 && (
                <ReceivedItem label="Households" value={`${result.householdCount} detected`} />
              )}
              {result.hasNotes && <ReceivedItem label="Notes & touchpoints" value="Present" />}
              {result.hasEvents && <ReceivedItem label="Events" value="Historical events detected" />}
              {result.hasActivities && <ReceivedItem label="Activities" value="Activity history found" />}
            </div>
          </div>

          {/* What we did NOT receive (calm tone) */}
          {(result.coverageMode === 'A' || result.coverageMode === 'B') && (
            <div>
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">
                Not included in this import
              </h4>
              <div className="space-y-1.5">
                {!result.hasEvents && (
                  <MissingItem label="We didn't receive historical events from this source. You can connect an integration later if you wish." />
                )}
                {!result.hasActivities && result.coverageMode === 'A' && (
                  <MissingItem label="No activity history was included. You'll build this naturally as you use CROS." />
                )}
                {!result.hasNotes && result.coverageMode === 'A' && (
                  <MissingItem label="No notes or touchpoints were included. You can add reflections at any time." />
                )}
              </div>
            </div>
          )}

          {/* Coverage badge */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">Data coverage</span>
            <Badge variant="outline" className="text-xs">
              {result.coverageMode === 'A' && 'Structure — your story begins now'}
              {result.coverageMode === 'B' && 'Legacy relationships — ready to reawaken'}
              {result.coverageMode === 'C' && 'Full rhythm — momentum recognized'}
            </Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReceivedItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
      <span className="text-foreground font-medium">{label}</span>
      <span className="text-muted-foreground">— {value}</span>
    </div>
  );
}

function MissingItem({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
