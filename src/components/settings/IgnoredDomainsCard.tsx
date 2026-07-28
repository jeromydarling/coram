import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Ban, Plus, X } from 'lucide-react';
import { useAIUserSettings, useUpdateAISettings } from '@/hooks/useAIUserSettings';
import { toast } from '@/components/ui/sonner';

export function IgnoredDomainsCard() {
  const { data: settings, isLoading } = useAIUserSettings();
  const { mutate: updateSettings, isPending } = useUpdateAISettings();
  const [newDomain, setNewDomain] = useState('');

  const ignoredDomains = (settings?.ignored_email_domains as string[]) || [];

  const handleAddDomain = () => {
    const domain = newDomain.trim().toLowerCase().replace(/^@/, '');
    if (!domain) return;
    
    if (ignoredDomains.includes(domain)) {
      toast.error('Domain already in list');
      return;
    }
    
    if (!/^[\w.-]+\.\w+$/.test(domain)) {
      toast.error('Invalid domain format');
      return;
    }
    
    updateSettings({ 
      ignored_email_domains: [...ignoredDomains, domain] 
    } as any);
    setNewDomain('');
  };

  const handleRemoveDomain = (domain: string) => {
    updateSettings({ 
      ignored_email_domains: ignoredDomains.filter(d => d !== domain) 
    } as any);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddDomain();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5" />
            Ignored Email Domains
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ban className="h-5 w-5 text-muted-foreground" />
          Ignored Email Domains
        </CardTitle>
        <CardDescription>
          Emails from these domains will be skipped during sync and analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current domains */}
        <div className="space-y-2">
          <Label>Ignored domains</Label>
          <div className="flex flex-wrap gap-2">
            {ignoredDomains.length === 0 ? (
              <p className="text-sm text-muted-foreground">No domains ignored</p>
            ) : (
              ignoredDomains.map(domain => (
                <Badge key={domain} variant="secondary" className="pl-2 pr-1 py-1">
                  @{domain}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1 hover:bg-destructive/20"
                    onClick={() => handleRemoveDomain(domain)}
                    disabled={isPending}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))
            )}
          </div>
        </div>

        {/* Add new domain */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="example.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isPending}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleAddDomain}
            disabled={isPending || !newDomain.trim()}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Internal emails from your own organization are typically ignored to focus on external partner communications.
        </p>
      </CardContent>
    </Card>
  );
}
