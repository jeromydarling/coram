/**
 * ConstellationEmbedSection — Marketing homepage section showing living constellation.
 *
 * WHAT: Four calm embed windows (Atlas, Constellation, Providence, Compass) with narrative copy.
 * WHERE: Homepage / marketing pages.
 * WHY: Trust signal showing the living ecosystem without exposing private data.
 *
 * Now wired to live data from public-communio-signals edge function.
 * Falls back to gentle illustrative mockups when no real data exists yet.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Map, Sparkles, Link2, Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CompassEmbedIndicator } from '@/components/operator/GardenerCompassOverlay';
import { usePublicMovementData, type PublicMovementTheme } from '@/hooks/usePublicMovementData';
import { useTranslation } from 'react-i18next';

/** Maps theme intensity to visual pulse speed */
function intensityDelay(intensity: string, index: number): string {
  const base = intensity === 'strong' ? 0.15 : intensity === 'growing' ? 0.25 : 0.4;
  return `${index * base}s`;
}

/** Maps theme intensity to opacity */
function intensityOpacity(intensity: string): number {
  return intensity === 'strong' ? 0.7 : intensity === 'growing' ? 0.5 : 0.3;
}

function AtlasWindow({ activeMetros }: { activeMetros: number }) {
  const { t } = useTranslation('marketing');
  const hasLive = activeMetros > 0;
  return (
    <Card className="bg-white border-[hsl(var(--marketing-border))] hover:border-[hsl(var(--marketing-blue)/0.3)] transition-all">
      <CardContent className="p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--marketing-blue)/0.08)] flex items-center justify-center mx-auto">
          <Map className="h-5 w-5 text-[hsl(var(--marketing-blue))]" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-center gap-2">
            {(hasLive
              ? Array.from({ length: Math.min(activeMetros, 6) })
              : Array.from({ length: 4 })
            ).map((_, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full bg-primary/40 animate-pulse"
                style={{ animationDelay: `${i * 0.3}s` }}
              />
            ))}
          </div>
          <p
            className="text-sm text-[hsl(var(--marketing-navy)/0.55)] italic"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {hasLive
              ? t('constellationEmbed.atlas.liveLabel', { count: activeMetros })
              : t('constellationEmbed.atlas.fallback')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ConstellationWindow({ themes, signalCount }: { themes: PublicMovementTheme[]; signalCount: number }) {
  const { t } = useTranslation('marketing');
  const hasLive = themes.length > 0;
  return (
    <Card className="bg-white border-[hsl(var(--marketing-border))] hover:border-[hsl(var(--marketing-blue)/0.3)] transition-all">
      <CardContent className="p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--marketing-blue)/0.08)] flex items-center justify-center mx-auto">
          <Sparkles className="h-5 w-5 text-[hsl(var(--marketing-blue))]" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-center gap-1.5 flex-wrap max-w-[120px] mx-auto">
            {(hasLive
              ? themes.map((t, i) => (
                  <div
                    key={t.theme}
                    className="w-2.5 h-2.5 rounded-full bg-primary/30 animate-pulse"
                    style={{
                      animationDelay: intensityDelay(t.intensity, i),
                      opacity: intensityOpacity(t.intensity),
                    }}
                  />
                ))
              : Array.from({ length: 9 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full bg-primary/30 animate-pulse"
                    style={{
                      animationDelay: `${i * 0.2}s`,
                      opacity: 0.3 + Math.random() * 0.5,
                    }}
                  />
                ))
            )}
          </div>
          <p
            className="text-sm text-[hsl(var(--marketing-navy)/0.55)] italic"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {hasLive
              ? t('constellationEmbed.constellation.liveLabel', { count: signalCount })
              : t('constellationEmbed.constellation.fallback')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ProvidenceWindow({ patterns }: { patterns: string[] }) {
  const { t } = useTranslation('marketing');
  const hasLive = patterns.length > 0;
  return (
    <Card className="bg-white border-[hsl(var(--marketing-border))] hover:border-[hsl(var(--marketing-blue)/0.3)] transition-all">
      <CardContent className="p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-100/60 flex items-center justify-center mx-auto">
          <Link2 className="h-5 w-5 text-amber-600/70" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            {/* Thread visual — more nodes when patterns exist */}
            {Array.from({ length: hasLive ? Math.min(patterns.length + 2, 5) : 3 }).map((_, i, arr) => (
              <span key={i} className="contents">
                <div className="h-px w-8 bg-amber-300/40" />
                {i < arr.length - 1 && (
                  <div className="w-2 h-2 rounded-full bg-amber-400/50" />
                )}
              </span>
            ))}
          </div>
          <p
            className="text-sm text-[hsl(var(--marketing-navy)/0.55)] italic"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {hasLive ? patterns[0] : t('constellationEmbed.providence.fallback')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function CompassWindow({ signalCount, activeMetros }: { signalCount: number; activeMetros: number }) {
  const { t } = useTranslation('marketing');
  // Derive simple directional weights from available aggregate data
  // Real compass uses signal kinds; public surface uses rough proxies
  const weights = {
    north: Math.min(10, Math.ceil(signalCount * 0.3)),   // Narrative
    east: Math.min(10, Math.ceil(activeMetros * 1.5)),    // Discernment
    south: Math.min(10, Math.ceil(signalCount * 0.4)),    // Care
    west: Math.min(10, Math.ceil(signalCount * 0.1) + 1), // Restoration
  };

  const total = weights.north + weights.east + weights.south + weights.west;
  if (total === 0) return null;

  return (
    <Card className="bg-white border-[hsl(var(--marketing-border))] hover:border-[hsl(var(--marketing-blue)/0.3)] transition-all">
      <CardContent className="p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--marketing-blue)/0.08)] flex items-center justify-center mx-auto">
          <Compass className="h-5 w-5 text-[hsl(var(--marketing-blue))]" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-center">
            <CompassEmbedIndicator weights={weights} />
          </div>
          <p
            className="text-sm text-[hsl(var(--marketing-navy)/0.55)] italic"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            title={t('constellationEmbed.compass.tooltip')}
          >
            {t('constellationEmbed.compass.label')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ConstellationEmbedSection() {
  const { t } = useTranslation('marketing');
  const { data } = usePublicMovementData();

  const themes = data?.themes ?? [];
  const patterns = data?.patterns ?? [];
  const signalCount = data?.signal_count ?? 0;
  const activeMetros = data?.active_metros ?? 0;

  return (
    <section className="py-14 sm:py-20 bg-[hsl(var(--marketing-surface))]">
      <div className="max-w-[960px] mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2
            className="text-2xl sm:text-3xl font-semibold text-[hsl(var(--marketing-navy))] mb-3"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {t('constellationEmbed.heading')}
          </h2>
          <p className="text-[hsl(var(--marketing-navy)/0.55)] max-w-lg mx-auto leading-relaxed">
            {t('constellationEmbed.subheading')}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <AtlasWindow activeMetros={activeMetros} />
          <ConstellationWindow themes={themes} signalCount={signalCount} />
          <ProvidenceWindow patterns={patterns} />
          <CompassWindow signalCount={signalCount} activeMetros={activeMetros} />
        </div>

        <div className="text-center">
          <Link to="/features">
            <Button
              variant="outline"
              className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))] hover:bg-white px-6"
            >
              {t('constellationEmbed.seeHowItWorks')} <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
