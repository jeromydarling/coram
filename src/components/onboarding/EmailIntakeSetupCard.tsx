/**
 * EmailIntakeSetupCard — Optional onboarding step for enabling Simple Intake.
 *
 * WHAT: One-click enable card with immediate confirmation and share-copy buttons.
 * WHERE: Onboarding wizard, Guided Activation flow.
 * WHY: Reduces adoption friction — stewards enable in under 10 seconds.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/contexts/TenantContext';
import { Mail, Copy, Check, ArrowRight } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import {
  getIntakeAddress,
  getEmailIntakeCopy,
  INTAKE_COPY_LABELS,
  type IntakeCopyKey,
} from '@/content/emailIntakeShareCopy';

interface Props {
  onSkip?: () => void;
  onComplete?: () => void;
}

export function EmailIntakeSetupCard({ onSkip, onComplete }: Props) {
  const { tenant } = useTenant();
  const slug = tenant?.slug ?? '';
  const [enabled, setEnabled] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const address = slug ? getIntakeAddress(slug) : '';
  const copy = slug ? getEmailIntakeCopy(slug) : null;

  const handleEnable = () => {
    setEnabled(true);
    toast.success('Simple Intake is now active');
  };

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error('Could not copy');
    }
  };

  if (!enabled) {
    return (
      <Card className="border-border/50 bg-card/80 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mail className="h-4.5 w-4.5" />
            </div>
            <CardTitle className="text-lg font-serif">Let people send notes by email</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-[0.925rem] text-muted-foreground leading-relaxed">
            Not everyone wants to use an app — and that's okay.
            Team members, social workers, or partners can email notes directly into your workspace,
            and CROS will log them automatically.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleEnable} size="sm">
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              Enable Simple Intake
            </Button>
            {onSkip && (
              <Button variant="ghost" size="sm" onClick={onSkip}>
                Skip for now
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Post-enable confirmation
  return (
    <Card className="border-primary/20 bg-primary/5 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Check className="h-4.5 w-4.5" />
          </div>
          <CardTitle className="text-lg font-serif">Simple Intake is ready</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Address display */}
        <div className="rounded-lg border border-border bg-background/80 px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">Your Email Intake Address</p>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-sm font-mono text-foreground break-all">{address}</code>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => handleCopy(address, 'address')}
            >
              {copiedKey === 'address' ? (
                <Check className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Share buttons */}
        <div>
          <p className="text-sm font-medium text-foreground mb-2">Share this with your team</p>
          <div className="flex flex-wrap gap-2">
            {copy && (Object.keys(INTAKE_COPY_LABELS) as IntakeCopyKey[]).map((key) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                onClick={() => handleCopy(copy[key], key)}
                className="text-xs"
              >
                {copiedKey === key ? (
                  <Check className="mr-1.5 h-3 w-3 text-primary" />
                ) : (
                  <Copy className="mr-1.5 h-3 w-3" />
                )}
                {INTAKE_COPY_LABELS[key]}
              </Button>
            ))}
          </div>
        </div>

        {onComplete && (
          <div className="pt-1">
            <Button size="sm" onClick={onComplete}>
              Continue <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
