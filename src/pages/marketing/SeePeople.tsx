/**
 * SeePeople — Ignatian discernment page for nonprofit leaders.
 *
 * WHAT: A calm reflection experience helping leaders ask whether their tools help them see people.
 * WHERE: /see-people (public marketing route).
 * WHY: Builds narrative authority and trust without selling; Ignatian tone.
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDiscernmentSignal } from '@/hooks/useDiscernmentSignal';
import { Button } from '@/components/ui/button';
import { ArrowRight, ChevronDown, FileDown } from 'lucide-react';
import seePeopleHeroImg from '@/assets/see-people-hero.webp';
import SeoHead from '@/components/seo/SeoHead';
import { articleSchema, breadcrumbSchema } from '@/lib/seo/seoConfig';
import {
  seePeopleHero,
  reflectionQuestions,
  ignatianExamen,
  teamGuide,
  softClose,
} from '@/content/seePeople';

/* ── helpers ── */
const categories = [...new Set(reflectionQuestions.map((q) => q.category))];

const SeePeople = React.forwardRef<HTMLDivElement>(function SeePeople(_props, ref) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const emit = useDiscernmentSignal('see-people');

  useEffect(() => { emit('page_view'); }, [emit]);

  const toggle = (i: number) => {
    const opening = expandedIdx !== i;
    setExpandedIdx(expandedIdx === i ? null : i);
    if (opening) emit('reflection_card_opened', `q-${i}`);
  };

  return (
    <div ref={ref} className="bg-white" data-testid="see-people-root">
      <SeoHead
        title="Do Your Tools Help You See People?"
        description="A calm reflection for nonprofit and ministry leaders discerning whether their current systems support real human care."
        keywords={[
          'nonprofit CRM alternatives',
          'ministry software reflection',
          'church management systems',
          'relational nonprofit technology',
          'CRM discernment',
        ]}
        canonical="/see-people"
        jsonLd={[
          articleSchema({
            headline: 'Do Your Tools Help You See People? A Nonprofit CRM Reflection',
            description:
              'A calm reflection for nonprofit and ministry leaders discerning whether their current systems support real human care.',
            url: '/see-people',
          }),
          breadcrumbSchema([
            { name: 'Home', url: '/' },
            { name: 'See People', url: '/see-people' },
          ]),
        ]}
      />

      {/* ─── SECTION 1 — Quiet Opening ─── */}
      <section className="relative overflow-hidden">
        <img src={seePeopleHeroImg} alt="" aria-hidden="true" loading="eager" className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.15] object-cover object-center scale-[2.4] origin-top" />
        <div className="relative max-w-[720px] mx-auto px-4 sm:px-6 pt-20 sm:pt-28 pb-16 text-center">
        <h1
          className="text-3xl sm:text-4xl md:text-5xl text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-6"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {seePeopleHero.heading}
        </h1>
        <p className="text-base sm:text-lg text-[hsl(var(--marketing-navy)/0.6)] whitespace-pre-line leading-relaxed max-w-lg mx-auto mb-10">
          {seePeopleHero.subtext}
        </p>
        {!started && (
          <Button
            size="lg"
            onClick={() => {
              setStarted(true);
              setTimeout(() => {
                document.getElementById('reflection-section')?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }}
            className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
            data-testid="see-people-start"
          >
            {seePeopleHero.cta} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
        </div>
      </section>

      {/* ─── SECTION 2 — Reflection Questions ─── */}
      <section
        id="reflection-section"
        className="max-w-[780px] mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-16 sm:pb-20"
      >
        {categories.map((cat) => (
          <div key={cat} className="mb-10">
            <h2
              className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-blue))] mb-4"
            >
              {cat}
            </h2>
            <div className="space-y-3">
              {reflectionQuestions
                .map((q, i) => ({ ...q, globalIdx: i }))
                .filter((q) => q.category === cat)
                .map(({ question, followUp, globalIdx }) => {
                  const open = expandedIdx === globalIdx;
                  return (
                    <button
                      key={globalIdx}
                      onClick={() => toggle(globalIdx)}
                      className={`w-full text-left rounded-2xl border p-5 sm:p-6 transition-all ${
                        open
                          ? 'border-[hsl(var(--marketing-blue)/0.3)] bg-[hsl(var(--marketing-surface))]'
                          : 'border-[hsl(var(--marketing-border))] bg-white hover:border-[hsl(var(--marketing-blue)/0.15)]'
                      }`}
                      data-testid={`reflection-q-${globalIdx}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p
                          className="text-base sm:text-lg text-[hsl(var(--marketing-navy))] leading-relaxed"
                          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                        >
                          {question}
                        </p>
                        <ChevronDown
                          className={`h-4 w-4 mt-1.5 shrink-0 text-[hsl(var(--marketing-navy)/0.3)] transition-transform ${
                            open ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                      {open && (
                        <p className="mt-4 text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed">
                          {followUp}
                        </p>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </section>

      {/* ─── SECTION 3 — Ignatian CRM Examen ─── */}
      <section className="bg-[hsl(var(--marketing-surface))] py-16 sm:py-24">
        <div className="max-w-[680px] mx-auto px-4 sm:px-6">
          <div className="h-px bg-[hsl(var(--marketing-border))] max-w-xs mx-auto mb-12" />
          <h2
            className="text-2xl sm:text-3xl text-[hsl(var(--marketing-navy))] text-center mb-12"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            A Quiet Examen for Your Systems
          </h2>
          <div className="space-y-10">
            {ignatianExamen.sections.map((s) => (
              <div key={s.label}>
                <h3
                  className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-blue))] mb-3"
                >
                  {s.label}
                </h3>
                <p
                  className="text-base text-[hsl(var(--marketing-navy)/0.7)] leading-[1.8]"
                  style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                >
                  {s.body}
                </p>
              </div>
            ))}
          </div>
          <div className="h-px bg-[hsl(var(--marketing-border))] max-w-xs mx-auto mt-12" />
        </div>
      </section>

      {/* ─── SECTION 4 — Team Conversation Tool ─── */}
      <section className="max-w-[600px] mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
        <h2
          className="text-xl sm:text-2xl text-[hsl(var(--marketing-navy))] mb-3"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {teamGuide.heading}
        </h2>
        <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] mb-6">
          {teamGuide.body}
        </p>
        <Button
          variant="outline"
          className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))] hover:bg-[hsl(var(--marketing-surface))] px-6"
          onClick={() => {
            import('@/lib/seePeopleReflectionPdf').then(({ downloadSeePeopleReflectionPdf }) => {
              downloadSeePeopleReflectionPdf();
            });
          }}
          data-testid="see-people-download"
        >
          <FileDown className="mr-2 h-4 w-4" />
          {teamGuide.cta}
        </Button>
      </section>

      {/* ─── SECTION 5 — Soft Transition to CROS ─── */}
      <section className="bg-[hsl(var(--marketing-surface))] py-16 sm:py-24 text-center">
        <div className="max-w-[640px] mx-auto px-4 sm:px-6">
          <h2
            className="text-2xl sm:text-3xl text-[hsl(var(--marketing-navy))] mb-2 leading-snug"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {softClose.heading}
          </h2>
          <p
            className="text-lg text-[hsl(var(--marketing-navy)/0.6)] mb-10"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {softClose.subheading}
          </p>
          <Link to={softClose.ctaTo}>
            <Button
              size="lg"
              className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
            >
              {softClose.cta} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
});

export default SeePeople;
