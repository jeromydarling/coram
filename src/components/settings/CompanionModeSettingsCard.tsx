/**
 * CompanionModeSettingsCard — Detailed companion mode control in Settings.
 *
 * WHAT: Card with big toggle, micro-copy, snooze, and sample preview.
 * WHERE: Settings page, top of integrations section.
 * WHY: Users need a clear, detailed place to understand and control guidance.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sparkles, Clock } from 'lucide-react';
import { useCompanionMode } from '@/hooks/useCompanionMode';
import { MicroGuidanceCard } from '@/components/companion/MicroGuidanceCard';
import { MICRO_GUIDANCE_REGISTRY } from '@/content/microGuidanceRegistry';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

export function CompanionModeSettingsCard() {
  const { t } = useTranslation('settings');
  const { enabled, allowedByTenant, toggle, isToggling, isSnoozed, snoozeForToday, isSnoozingToday } = useCompanionMode();
  const [showSample, setShowSample] = useState(false);

  const sampleGuide = MICRO_GUIDANCE_REGISTRY.find(g => g.key === 'universal_simple_start') ?? MICRO_GUIDANCE_REGISTRY[0];

  return (
    <Card data-testid="companion-settings-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-base" style={serif}>{t('companion.title')}</CardTitle>
            <CardDescription>
              {t('companion.description')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!allowedByTenant ? (
          <p className="text-sm text-muted-foreground italic">
            {t('companion.pausedByTenant')}
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">{t('companion.enableLabel')}</Label>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {t('companion.enableDescription')}
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={toggle}
                disabled={isToggling}
                data-testid="companion-settings-toggle"
              />
            </div>

            <p className="text-[11px] text-muted-foreground/70">
              {t('companion.privacyNote')}
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => setShowSample(!showSample)}
              >
                <Sparkles className="w-3 h-3" />
                {showSample ? t('companion.hideSample') : t('companion.previewSample')}
              </Button>
              {enabled && !isSnoozed && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1.5 text-muted-foreground"
                  onClick={snoozeForToday}
                  disabled={isSnoozingToday}
                >
                  <Clock className="w-3 h-3" />
                  {t('companion.snoozeForToday')}
                </Button>
              )}
              {isSnoozed && (
                <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {t('companion.snoozedUntilTomorrow')}
                </span>
              )}
            </div>

            {showSample && sampleGuide && (
              <div className="pt-2">
                <MicroGuidanceCard
                  guide={sampleGuide}
                  onAccept={() => setShowSample(false)}
                  onDismiss={() => setShowSample(false)}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
