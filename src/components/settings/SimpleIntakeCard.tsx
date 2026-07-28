/**
 * SimpleIntakeCard — Settings card for Simple Intake (Email Notes).
 *
 * WHAT: Displays intake status, address, and share-copy buttons.
 * WHERE: /:tenantSlug/settings
 * WHY: Stewards discover and manage email intake from their natural settings flow.
 */
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/contexts/TenantContext';
import { Mail, Copy, Check } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import {
  getIntakeAddress,
  getEmailIntakeCopy,
  INTAKE_COPY_LABELS,
  type IntakeCopyKey,
} from '@/content/emailIntakeShareCopy';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

export function SimpleIntakeCard() {
  const { tenant } = useTenant();
  const slug = tenant?.slug ?? '';
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // For now, intake is always "enabled" once the tenant exists — 
  // future: check tenant_email_intake_settings table
  const isEnabled = !!slug;
  const address = slug ? getIntakeAddress(slug) : '';
  const copy = slug ? getEmailIntakeCopy(slug) : null;

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error('Could not copy — please select and copy manually');
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-2 font-serif">
            <Mail className="h-5 w-5 text-primary" />
            Simple Intake (Email Notes)
          </CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              Accept notes by email from anyone on your team. People who prefer email can send visit notes, reflections, or updates without logging in.
            </TooltipContent>
          </Tooltip>
        </div>
        <CardDescription>
          Accept notes from staff, visitors, partners, or volunteers — no login required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          {isEnabled ? (
            <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
              Enabled
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">Not Enabled</Badge>
          )}
        </div>

        {isEnabled && address && (
          <>
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Your intake address</p>
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

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Share with your team</p>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
