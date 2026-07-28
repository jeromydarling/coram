import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Clock,
  Zap,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  useActiveIntent,
  useCreateSendIntent,
  useAcknowledgeSendIntent,
  useEvaluateCampaignRisk,
  type RiskEvalResult,
} from '@/hooks/useSendIntent';

interface SendIntentPanelProps {
  campaignId: string;
  audienceCount: number;
  canSend: boolean;
  onIntentReady: () => void;
}

const riskConfig = {
  low: {
    icon: ShieldCheck,
    label: 'Low Risk',
    className: 'text-green-600 bg-green-50 dark:bg-green-950/30 border-green-200',
    badgeVariant: 'outline' as const,
  },
  medium: {
    icon: ShieldAlert,
    label: 'Medium Risk',
    className: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200',
    badgeVariant: 'outline' as const,
  },
  high: {
    icon: Shield,
    label: 'High Risk',
    className: 'text-destructive bg-destructive/10 border-destructive/30',
    badgeVariant: 'destructive' as const,
  },
};

export function SendIntentPanel({
  campaignId,
  audienceCount,
  canSend,
  onIntentReady,
}: SendIntentPanelProps) {
  const [rationale, setRationale] = useState('');
  const [ackChecked, setAckChecked] = useState(false);
  const [riskPreview, setRiskPreview] = useState<RiskEvalResult | null>(null);

  const { data: activeIntent, isLoading: intentLoading } = useActiveIntent(campaignId);
  const createIntent = useCreateSendIntent();
  const ackIntent = useAcknowledgeSendIntent();
  const evalRisk = useEvaluateCampaignRisk();

  const handleEvaluateRisk = async () => {
    const result = await evalRisk.mutateAsync(campaignId);
    setRiskPreview(result);
  };

  const handleCreateIntent = async () => {
    const result = await createIntent.mutateAsync({
      campaignId,
      rationale: rationale.trim() || undefined,
    });

    // If low risk (auto-acknowledged), signal ready
    if (!result.intent.requires_ack) {
      onIntentReady();
    }
  };

  const handleAcknowledge = async () => {
    await ackIntent.mutateAsync(campaignId);
    onIntentReady();
  };

  // Already have a valid acknowledged intent
  const isReady =
    activeIntent?.intent_status === 'acknowledged' &&
    new Date(activeIntent.expires_at) > new Date();

  const needsAck = activeIntent?.intent_status === 'proposed' && activeIntent.requires_ack;

  const estimatedBatches = Math.ceil(audienceCount / 25);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4" />
          Send Gating
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step 1: Risk Preview */}
        {!activeIntent && !riskPreview && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Evaluate campaign risk before sending to {audienceCount.toLocaleString()} recipients.
            </p>
            <Button
              variant="outline"
              onClick={handleEvaluateRisk}
              disabled={evalRisk.isPending || !canSend}
              className="w-full"
            >
              {evalRisk.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Evaluating...</>
              ) : (
                <><Zap className="mr-2 h-4 w-4" />Run Send Preview</>
              )}
            </Button>
          </div>
        )}

        {/* Risk Preview Results */}
        {riskPreview && !activeIntent && (
          <div className="space-y-3">
            <RiskDisplay risk={riskPreview} audienceCount={audienceCount} />

            <div className="text-sm text-muted-foreground space-y-1">
              <p>• Estimated batches: ~{estimatedBatches} (25/batch)</p>
              <p>• Inter-batch delay: 300ms</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rationale" className="text-sm">
                Rationale (optional)
              </Label>
              <Input
                id="rationale"
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="Why are you sending this campaign?"
              />
            </div>

            <Button
              onClick={handleCreateIntent}
              disabled={createIntent.isPending || !canSend}
              className="w-full"
            >
              {createIntent.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating intent...</>
              ) : (
                'Create Send Intent'
              )}
            </Button>
          </div>
        )}

        {/* Needs Acknowledgement */}
        {needsAck && activeIntent && (
          <div className="space-y-3">
            <Alert className={riskConfig[activeIntent.risk_level as keyof typeof riskConfig]?.className}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium text-sm mb-1">
                  This send requires your acknowledgement
                </p>
                <ul className="text-xs space-y-0.5 list-disc list-inside">
                  {activeIntent.risk_reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>

            <div className="flex items-start gap-2">
              <Checkbox
                id="ack-checkbox"
                checked={ackChecked}
                onCheckedChange={(checked) => setAckChecked(checked === true)}
              />
              <Label htmlFor="ack-checkbox" className="text-sm leading-tight cursor-pointer">
                I understand the risks and want to proceed with sending this campaign.
              </Label>
            </div>

            <Button
              onClick={handleAcknowledge}
              disabled={!ackChecked || ackIntent.isPending}
              className="w-full"
            >
              {ackIntent.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Acknowledging...</>
              ) : (
                'Acknowledge & Authorize Send'
              )}
            </Button>

            <IntentExpiry expiresAt={activeIntent.expires_at} />
          </div>
        )}

        {/* Ready to send */}
        {isReady && activeIntent && (
          <div className="space-y-3">
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <p className="font-medium text-sm">Send intent authorized</p>
                {activeIntent.rationale && (
                  <p className="text-xs mt-1">Rationale: {activeIntent.rationale}</p>
                )}
              </AlertDescription>
            </Alert>

            <IntentExpiry expiresAt={activeIntent.expires_at} />

            <RiskBadgeInline riskLevel={activeIntent.risk_level} reasons={activeIntent.risk_reasons} />
          </div>
        )}

        {/* Loading */}
        {intentLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RiskDisplay({ risk, audienceCount }: { risk: RiskEvalResult; audienceCount: number }) {
  const config = riskConfig[risk.risk_level];
  const Icon = config.icon;

  return (
    <Alert className={config.className}>
      <Icon className="h-4 w-4" />
      <AlertDescription>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{config.label}</span>
          <Badge variant={config.badgeVariant} className="text-xs">
            {audienceCount} recipients
          </Badge>
        </div>
        {risk.risk_reasons.length > 0 ? (
          <ul className="text-xs space-y-0.5 list-disc list-inside">
            {risk.risk_reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs">No risk factors detected.</p>
        )}
      </AlertDescription>
    </Alert>
  );
}

function IntentExpiry({ expiresAt }: { expiresAt: string }) {
  const expiresDate = new Date(expiresAt);
  const now = new Date();
  const minutesLeft = Math.max(0, Math.round((expiresDate.getTime() - now.getTime()) / 60000));

  if (minutesLeft <= 0) {
    return (
      <p className="text-xs text-destructive flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Intent expired — create a new send intent
      </p>
    );
  }

  return (
    <p className="text-xs text-muted-foreground flex items-center gap-1">
      <Clock className="h-3 w-3" />
      Expires in {minutesLeft} minute{minutesLeft !== 1 ? 's' : ''}
    </p>
  );
}

function RiskBadgeInline({ riskLevel, reasons }: { riskLevel: string; reasons: string[] }) {
  if (reasons.length === 0) return null;
  return (
    <div className="text-xs text-muted-foreground">
      <p className="font-medium mb-0.5">Risk factors:</p>
      <ul className="list-disc list-inside space-y-0.5">
        {reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </div>
  );
}
