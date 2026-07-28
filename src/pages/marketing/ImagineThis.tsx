/**
 * ImagineThis — Narrative possibility page for nonprofit and ministry leaders.
 *
 * WHAT: Helps leaders imagine how daily work could feel different with CROS.
 * WHERE: /imagine-this (public marketing route).
 * WHY: Builds narrative authority through Ignatian reflection, not feature comparison.
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDiscernmentSignal } from '@/hooks/useDiscernmentSignal';
import { Button } from '@/components/ui/button';
import { ArrowRight, ChevronDown } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import { articleSchema, breadcrumbSchema } from '@/lib/seo/seoConfig';
import ImagineScenarioCard from '@/components/marketing/ImagineScenarioCard';
import QuietComparisonGrid from '@/components/marketing/QuietComparisonGrid';
import {
  imagineHero,
  scenarios,
  possibilityBlock,
  reflections,
  closing,
} from '@/content/imagineThis';

const ImagineThis = React.forwardRef<HTMLDivElement>(function ImagineThis(_props, ref) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const emit = useDiscernmentSignal('imagine-this');

  useEffect(() => { emit('page_view'); }, [emit]);

  const toggle = (i: number) => {
    const opening = expandedIdx !== i;
    setExpandedIdx(expandedIdx === i ? null : i);
    if (opening) emit('question_expanded', `imagine-q-${i}`);
  };

  return (
    <div ref={ref} className="bg-white" data-testid="imagine-this-root">
      <SeoHead
        title="Imagine This — A Different Rhythm of Care"
        description="What if your work felt less like managing systems and more like walking alongside people? A reflective page for nonprofit and ministry leaders."
        keywords={[
          'nonprofit CRM alternatives',
          'ministry software reflection',
          'church management systems',
          'relational nonprofit technology',
          'imagine better nonprofit tools',
        ]}
        canonical="/imagine-this"
        jsonLd={[
          articleSchema({
            headline: 'Imagine This — A Different Rhythm of Care',
            description:
              'What if your work felt less like managing systems and more like walking alongside people? A reflective page for nonprofit and ministry leaders.',
            url: '/imagine-this',
          }),
          breadcrumbSchema([
            { name: 'Home', url: '/' },
            { name: 'Imagine This', url: '/imagine-this' },
          ]),
        ]}
      />

      {/* ─── HERO ─── */}
      <section className="max-w-[720px] mx-auto px-4 sm:px-6 pt-20 sm:pt-28 pb-16 text-center">
        <h1
          className="text-3xl sm:text-4xl md:text-5xl text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-6"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {imagineHero.heading}
        </h1>
        <p className="text-base sm:text-lg text-[hsl(var(--marketing-navy)/0.6)] whitespace-pre-line leading-relaxed max-w-lg mx-auto">
          {imagineHero.subtext}
        </p>
      </section>

      {/* ─── SCENARIOS ─── */}
      <section className="max-w-[780px] mx-auto px-4 sm:px-6 pb-16 sm:pb-20 space-y-6">
        {scenarios.map((s, i) => (
          <ImagineScenarioCard key={s.label} scenario={s} index={i} />
        ))}
      </section>

      {/* ─── QUIET COMPARISON ─── */}
      <div className="bg-[hsl(var(--marketing-surface))]">
        <QuietComparisonGrid />
      </div>

      {/* ─── POSSIBILITY BLOCK ─── */}
      <section className="max-w-[680px] mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <h2
          className="text-2xl sm:text-3xl text-[hsl(var(--marketing-navy))] text-center mb-10 leading-snug"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {possibilityBlock.heading}
        </h2>
        <ul className="space-y-5">
          {possibilityBlock.reflections.map((r, i) => (
            <li
              key={i}
              className="flex items-start gap-3 text-base text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[hsl(var(--marketing-blue)/0.4)] shrink-0" />
              {r}
            </li>
          ))}
        </ul>
      </section>

      {/* ─── REFLECTION QUESTIONS ─── */}
      <section className="bg-[hsl(var(--marketing-surface))] py-16 sm:py-24">
        <div className="max-w-[780px] mx-auto px-4 sm:px-6">
          <div className="h-px bg-[hsl(var(--marketing-border))] max-w-xs mx-auto mb-12" />
          <h2
            className="text-2xl sm:text-3xl text-[hsl(var(--marketing-navy))] text-center mb-10"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            A Moment of Reflection
          </h2>
          <div className="space-y-3">
            {reflections.map((q, i) => {
              const open = expandedIdx === i;
              return (
                <button
                  key={i}
                  onClick={() => toggle(i)}
                  className={`w-full text-left rounded-2xl border p-5 sm:p-6 transition-all ${
                    open
                      ? 'border-[hsl(var(--marketing-blue)/0.3)] bg-white'
                      : 'border-[hsl(var(--marketing-border))] bg-white/60 hover:border-[hsl(var(--marketing-blue)/0.15)]'
                  }`}
                  data-testid={`imagine-reflection-${i}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p
                      className="text-base sm:text-lg text-[hsl(var(--marketing-navy))] leading-relaxed"
                      style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                    >
                      {q.question}
                    </p>
                    <ChevronDown
                      className={`h-4 w-4 mt-1.5 shrink-0 text-[hsl(var(--marketing-navy)/0.3)] transition-transform ${
                        open ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                  {open && (
                    <p className="mt-4 text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed">
                      {q.followUp}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── CLOSING ─── */}
      <section className="max-w-[640px] mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <p
          className="text-xl sm:text-2xl text-[hsl(var(--marketing-navy))] whitespace-pre-line leading-relaxed mb-10"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {closing.body}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {closing.links.map((l) => (
            <Link key={l.to} to={l.to}>
              <Button
                variant="outline"
                className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))] hover:bg-[hsl(var(--marketing-surface))] px-6"
              >
                {l.label} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
});

export default ImagineThis;
