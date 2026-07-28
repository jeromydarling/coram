/**
 * CampaignsUpsellPanel — Gentle upgrade prompt for Relatio Campaigns™.
 *
 * WHAT: Shows when a tenant tries to access campaigns without the add-on.
 * WHERE: Rendered inside campaign route guards when campaigns_enabled is false.
 * WHY: Warm, narrative-first positioning — not a hard sell.
 */
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Check, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/components/ui/sonner';
import { useState } from 'react';

export function CampaignsUpsellPanel() {
  const { tenant } = useTenant();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        body: { tenant_id: tenant?.id },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch {
      toast.error('Unable to open billing portal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Card className="max-w-lg w-full">
        <CardContent className="pt-8 pb-6 space-y-6">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Mail className="h-7 w-7 text-primary" />
          </div>

          <div className="text-center space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              Relatio Campaigns™
            </h2>
            <p className="text-base text-muted-foreground italic">
              When you're ready to reach further.
            </p>
          </div>

          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            You don't need another marketing platform.
            Relatio Campaigns grows naturally from the relationships you already
            track inside CROS. Send thoughtful outreach through Gmail or Outlook
            without exporting lists, juggling tools, or treating people like
            data points.
          </p>

          <ul className="space-y-2 text-sm text-foreground">
            {[
              'Built on your real relationships',
              'Gmail & Outlook sending',
              'Narrative-safe outreach',
              'Migration-friendly',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <div className="text-center">
            <Button onClick={handleUpgrade} disabled={loading} className="gap-2">
              Add Campaigns to your plan
              <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground mt-2">$29/mo · Cancel anytime</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
