import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowRight, Eye, Layers, Compass, ShieldCheck } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import RoleIdentityBlock from '@/components/seo/RoleIdentityBlock';
import ConceptLinks from '@/components/seo/ConceptLinks';
import { faqSchema } from '@/lib/seo/seoConfig';
import NarrativeGraphLinks from '@/components/marketing/NarrativeGraphLinks';
import { getConceptRelatedNodes, definedTermSchema } from '@/content/narrativeGraph';
import RelatedNarrativesCard from '@/components/marketing/RelatedNarrativesCard';
import nriHero from '@/assets/nri-hero.webp';
import {
  activeHero,
  aiStrengths,
  aiLimits,
  coreLoop,
  adoptionBridge,
  principles,
  trustBoundaries,
  restoration,
  closingManifesto,
  nriFaq,
} from '@/content/nriMarketingContent';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const stepIcons = [Eye, Layers, Compass];

export default function NRI() {
  const { t } = useTranslation('marketing');
  return (
    <div className="bg-white">
      <SeoHead
        title="NRI™ — Narrative Relational Intelligence | Recognize · Synthesize · Prioritize"
        description="NRI is human-first intelligence that recognizes signals, synthesizes stories, and prioritizes your attention — grounded in relationships, not cold analytics."
        keywords={['narrative intelligence', 'NRI', 'human-first AI', 'relationship intelligence', 'community awareness', 'recognize synthesize prioritize']}
        canonical="/nri"
        jsonLd={[faqSchema(nriFaq), definedTermSchema('nri')].filter(Boolean)}
      />
      <SeoBreadcrumb items={[{ label: 'Home', to: '/' }, { label: 'NRI™' }]} />

      {/* ── Section 1 — Hero ── */}
      <section className="relative overflow-hidden">
        <img src={nriHero} alt="" aria-hidden="true" loading="eager" className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.15] object-cover object-center scale-[2.4] origin-top" />
        <div className="relative max-w-2xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20 text-center">
        <p className="text-sm font-medium text-[hsl(var(--marketing-blue))] uppercase tracking-wider mb-4">
          {activeHero.eyebrow}
        </p>
        <h1
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-8"
        >
          {activeHero.title}
        </h1>
        <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed whitespace-pre-line" style={serif}>
          <p>{activeHero.subtitle}</p>
        </div>
        <p className="text-sm text-[hsl(var(--marketing-navy)/0.45)] mt-8 italic" style={serif}>
          {activeHero.footnote}
        </p>
        </div>
      </section>

      {/* ── Section 2 — What AI Is Good For ── */}
      <section className="bg-[hsl(var(--marketing-surface))] py-16 sm:py-24">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[hsl(var(--marketing-navy))] mb-8 text-center" style={serif}>
            {aiStrengths.heading}
          </h2>
          <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed" style={serif}>
            {aiStrengths.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <ul className="space-y-2 pl-4">
              {aiStrengths.bullets.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--marketing-blue))] flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p>{aiStrengths.bridge}</p>
          </div>
        </div>
      </section>

      {/* ── Section 3 — Where AI Stops ── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[hsl(var(--marketing-navy))] mb-8 text-center" style={serif}>
            {aiLimits.heading}
          </h2>
          <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed" style={serif}>
            {aiLimits.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <p className="text-lg text-[hsl(var(--marketing-navy))] font-medium">
              {aiLimits.closing}
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 4 — The NRI Core Loop ── */}
      <section className="bg-[hsl(var(--marketing-surface))] py-16 sm:py-24">
        <div className="max-w-[960px] mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[hsl(var(--marketing-navy))] mb-4 text-center" style={serif}>
            {coreLoop.heading}
          </h2>
          <p className="text-center text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed mb-12 max-w-xl mx-auto" style={serif}>
            {coreLoop.intro}
          </p>

          <div className="grid sm:grid-cols-3 gap-6">
            {coreLoop.steps.map((step, i) => {
              const Icon = stepIcons[i];
              return (
                <div
                  key={step.label}
                  className="bg-white rounded-2xl border border-[hsl(var(--marketing-border))] p-8"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--marketing-blue)/0.08)] flex items-center justify-center mb-5">
                    <Icon className="h-5 w-5 text-[hsl(var(--marketing-blue))]" />
                  </div>
                  <h3
                    className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-3"
                    style={serif}
                  >
                    {step.label}
                  </h3>
                  <p className="text-sm text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed mb-4">
                    {step.description}
                  </p>
                  <ul className="space-y-2">
                    {step.examples.map((ex) => (
                      <li key={ex} className="flex items-start gap-2.5 text-xs text-[hsl(var(--marketing-navy)/0.5)] leading-relaxed">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-[hsl(var(--marketing-blue)/0.4)] shrink-0" />
                        {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <p className="text-center mt-10 text-[hsl(var(--marketing-navy)/0.6)] italic" style={serif}>
            {coreLoop.closing}
          </p>
        </div>
      </section>

      {/* ── Section 5 — Why This Matters (Adoption Bridge) ── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[hsl(var(--marketing-navy))] mb-10 text-center" style={serif}>
            {adoptionBridge.heading}
          </h2>
          <div className="space-y-10">
            {adoptionBridge.hurdles.map((h) => (
              <div key={h.objection}>
                <p className="text-lg font-medium text-[hsl(var(--marketing-navy))] mb-3" style={serif}>
                  {h.objection}
                </p>
                <p className="text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed" style={serif}>
                  {h.response}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 6 — Principles ── */}
      <section className="bg-[hsl(var(--marketing-surface))] py-16 sm:py-24">
        <div className="max-w-[960px] mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[hsl(var(--marketing-navy))] mb-4 text-center" style={serif}>
            {principles.heading}
          </h2>
          <p className="text-center text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed mb-12 max-w-xl mx-auto" style={serif}>
            {principles.intro}
          </p>

          <div className="grid sm:grid-cols-3 gap-6">
            {principles.items.map((p) => (
              <div
                key={p.name}
                className="bg-white rounded-2xl border border-[hsl(var(--marketing-border))] p-8"
              >
                <h3 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-2" style={serif}>
                  {p.name}
                </h3>
                <p className="text-sm font-medium text-[hsl(var(--marketing-navy)/0.75)] mb-4">
                  {p.definition}
                </p>
                <p className="text-xs text-[hsl(var(--marketing-navy)/0.5)] leading-relaxed italic">
                  {p.example}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 7 — Trust & Boundaries ── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-center gap-3 mb-4">
            <ShieldCheck className="h-6 w-6 text-[hsl(var(--marketing-blue))]" />
            <h2 className="text-2xl sm:text-3xl font-semibold text-[hsl(var(--marketing-navy))]" style={serif}>
              {trustBoundaries.heading}
            </h2>
          </div>
          <p className="text-center text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed mb-10" style={serif}>
            {trustBoundaries.intro}
          </p>

          <div className="space-y-6">
            {trustBoundaries.commitments.map((c) => (
              <div key={c.statement} className="border-l-2 border-[hsl(var(--marketing-blue)/0.3)] pl-5">
                <p className="font-medium text-[hsl(var(--marketing-navy))] mb-1">{c.statement}</p>
                <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">{c.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Restoration note ── */}
      <section className="bg-[hsl(var(--marketing-surface))] py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed italic" style={serif}>
            {restoration.body}
          </p>
        </div>
      </section>

      {/* ── Section 8 — Closing Manifesto + CTA ── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[hsl(var(--marketing-navy))] mb-8" style={serif}>
            {closingManifesto.heading}
          </h2>
          <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed" style={serif}>
            {closingManifesto.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <p className="text-lg text-[hsl(var(--marketing-navy))] font-medium whitespace-pre-line">
              {closingManifesto.closing}
            </p>
          </div>

          {/* Early adopter nudge */}
          <p className="mt-8 text-sm text-[hsl(var(--marketing-navy)/0.5)] italic" style={serif}>
            {closingManifesto.earlyAdopter}
          </p>

          {/* Primary CTA */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to={closingManifesto.cta.primary.to}>
              <Button
                size="lg"
                className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
              >
                {closingManifesto.cta.primary.label} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            {closingManifesto.cta.secondary.map((s) => (
              <Link key={s.to} to={s.to}>
                <Button
                  variant="outline"
                  className="rounded-full border-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-navy)/0.7)] hover:bg-[hsl(var(--marketing-surface))] px-6 h-11 text-sm"
                >
                  {s.label}
                </Button>
              </Link>
            ))}
          </div>

          {/* Role identity block */}
          <RoleIdentityBlock heading={t('nriPage.roleIdentityHeading')} />
        </div>
      </section>

      {/* ── Cross-links ── */}
      <ConceptLinks conceptSlug="nri" heading={t('roleDeepPage.relatedConceptsHeading')} />

      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <NarrativeGraphLinks nodes={getConceptRelatedNodes('nri')} />
        <RelatedNarrativesCard currentPath="/nri" />
      </div>

      <SeoInternalLinks
        heading={t('nriPage.seoLinksHeading')}
        links={[
          { label: 'Archetypes', to: '/archetypes', description: 'See how NRI adapts to your mission type.' },
          { label: 'Roles', to: '/roles', description: 'Find where you fit — Shepherd, Companion, or Visitor.' },
          { label: 'Signals', to: '/signum', description: 'Anonymized narrative signals.' },
          { label: 'Compare', to: '/compare', description: 'See how CROS differs from legacy CRMs.' },
        ]}
      />
    </div>
  );
}
