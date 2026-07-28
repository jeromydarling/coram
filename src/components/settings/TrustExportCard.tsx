/**
 * TrustExportCard — Trust Export UI for tenant settings.
 *
 * WHAT: Allows tenants to export their relationship data as JSON or CSV.
 * WHERE: Tenant Settings page.
 * WHY: Customers must feel safe to leave anytime — data portability is trust.
 */
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Download, HelpCircle, Loader2, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/components/ui/sonner';

export function TrustExportCard() {
  const { tenant } = useTenant();
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!tenant?.id) return;

    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('tenant-export-spine', {
        body: { tenant_id: tenant.id, format },
      });

      if (error) throw error;

      // Download as file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cros-export-${tenant.slug || 'data'}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Your relationship data has been exported');
    } catch (err: any) {
      toast.error(err.message || 'Export could not be completed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Data & Trust
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
                <p><strong>What:</strong> Export all your relationship data - partners, people, activities, events.</p>
                <p><strong>Where:</strong> Downloads as a portable file you can keep.</p>
                <p><strong>Why:</strong> Your relationships belong to you. Always.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <CardDescription>
          Your data belongs to you. Export your relationships anytime.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3">
          <div className="space-y-2 flex-1">
            <p className="text-sm text-muted-foreground">Format</p>
            <Select value={format} onValueChange={(v) => setFormat(v as 'json' | 'csv')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">Narrative JSON</SelectItem>
                <SelectItem value="csv">CSV Bundle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleExport} disabled={exporting || !tenant?.id}>
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Preparing...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export My Relationships
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Includes partners, people, activities, events, and a reflections summary.
          Full reflection content is kept private and not included in exports.
        </p>
      </CardContent>
    </Card>
  );
}
