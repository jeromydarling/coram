/**
 * MetroDiscoveryCard — Progressive reveal card for Metro Intelligence.
 *
 * WHAT: Shows a calm suggestion to enable Metro Intelligence for single-region tenants.
 * WHERE: Command Center / Dashboard sidebar.
 * WHY: Progressive discovery — tenants see the capability when they're ready to grow.
 */
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ArrowRight, Loader2 } from 'lucide-react';
import { useMetroIntelligence } from '@/hooks/useMetroIntelligence';
import { useEnableMetroIntelligence } from '@/hooks/useEnableMetroIntelligence';

export function MetroDiscoveryCard() {
  const { t } = useTranslation('dashboard');
  const { enabled, loading } = useMetroIntelligence();
  const enableMutation = useEnableMetroIntelligence();

  // Don't show if already enabled or still loading
  if (loading || enabled) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground">{t('metroDiscovery.title')}</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('metroDiscovery.description')}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => enableMutation.mutate()}
          disabled={enableMutation.isPending}
        >
          {enableMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
          ) : (
            <ArrowRight className="w-3 h-3 mr-1" />
          )}
          {t('metroDiscovery.explore')}
        </Button>
      </CardContent>
    </Card>
  );
}
