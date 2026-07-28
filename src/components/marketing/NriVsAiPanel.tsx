import { Brain, HeartHandshake } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function NriVsAiPanel() {
  const { t } = useTranslation('marketing');

  const aiPoints = [
    t('nriVsAiPanel.aiPoints.p1'),
    t('nriVsAiPanel.aiPoints.p2'),
    t('nriVsAiPanel.aiPoints.p3'),
  ];

  const nriPoints = [
    t('nriVsAiPanel.nriPoints.p1'),
    t('nriVsAiPanel.nriPoints.p2'),
    t('nriVsAiPanel.nriPoints.p3'),
  ];

  return (
    <section className="max-w-[960px] mx-auto px-4 sm:px-6">
      <div className="grid sm:grid-cols-2 gap-6">
        {/* AI column */}
        <div className="bg-[hsl(var(--marketing-surface))] rounded-2xl border border-[hsl(var(--marketing-border))] p-8">
          <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--marketing-navy)/0.06)] flex items-center justify-center mb-5">
            <Brain className="h-5 w-5 text-[hsl(var(--marketing-navy)/0.5)]" />
          </div>
          <h3
            className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-4"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {t('nriVsAiPanel.aiTitle')}
          </h3>
          <ul className="space-y-3">
            {aiPoints.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[hsl(var(--marketing-navy)/0.2)] shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* NRI™ column */}
        <div className="bg-white rounded-2xl border border-[hsl(var(--marketing-blue)/0.2)] p-8 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--marketing-blue)/0.08)] flex items-center justify-center mb-5">
            <HeartHandshake className="h-5 w-5 text-[hsl(var(--marketing-blue))]" />
          </div>
          <h3
            className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-4"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {t('nriVsAiPanel.nriTitle')}
          </h3>
          <ul className="space-y-3">
            {nriPoints.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-[hsl(var(--marketing-navy)/0.75)] leading-relaxed">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[hsl(var(--marketing-blue))] shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p
        className="text-center mt-8 text-[hsl(var(--marketing-navy)/0.6)] italic"
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
      >
        {t('nriVsAiPanel.tagline')}
      </p>
    </section>
  );
}
