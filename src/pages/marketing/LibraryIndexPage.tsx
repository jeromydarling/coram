/**
 * LibraryIndexPage — CROS™ Authority Engine hub.
 *
 * WHAT: Calm discovery space connecting roles, archetypes, week stories, philosophy, and concepts.
 * WHERE: /library
 * WHY: Central narrative hub that guides visitors through story-first pathways.
 */
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Users, Compass, Heart, Lightbulb } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import { breadcrumbSchema } from '@/lib/seo/seoConfig';
import { itemListSchema } from '@/lib/seo/languageGraph';
import { libraryConcepts } from '@/content/libraryConcepts';
import { weekNarratives } from '@/content/weekNarratives';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };
const crumbs = [{ label: 'Home', to: '/' }, { label: 'Library' }];

interface CardProps {
  to: string;
  title: string;
  subtitle: string;
}

function NarrativeCard({ to, title, subtitle }: CardProps) {
  return (
    <Link
      to={to}
      className="block rounded-xl bg-[hsl(var(--marketing-surface))] p-5 hover:bg-white transition-colors group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[hsl(var(--marketing-navy))] mb-1">{title}</h3>
          <p className="text-xs text-[hsl(var(--marketing-navy)/0.5)] leading-relaxed">{subtitle}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-[hsl(var(--marketing-navy)/0.2)] group-hover:text-[hsl(var(--marketing-navy)/0.5)] transition-colors flex-shrink-0 mt-0.5" />
      </div>
    </Link>
  );
}

function SectionHeader({ icon: Icon, label, title }: { icon: React.ElementType; label: string; title: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-[hsl(var(--marketing-navy)/0.35)]" />
        <span className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.35)]">{label}</span>
      </div>
      <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))]" style={serif}>{title}</h2>
    </div>
  );
}

export default function LibraryIndexPage() {
  return (
    <>
      <SeoHead
        title="The Living Library — CROS\u2122"
        description="Explore the narrative world of CROS\u2122 — roles, archetypes, weekly stories, philosophy, and the canonical language of communal care."
        canonical="/library"
        jsonLd={[
          itemListSchema({
            name: 'CROS Living Library',
            description: 'A calm discovery space for roles, archetypes, stories, and philosophy.',
            url: '/library',
            items: [
              { name: 'Roles in CROS', url: '/roles' },
              ...weekNarratives.map(w => ({ name: w.title, url: `/week/${w.slug}` })),
              { name: 'Manifesto', url: '/manifesto' },
              { name: 'NRI', url: '/nri' },
              ...libraryConcepts.map(c => ({ name: c.title, url: `/library/${c.slug}` })),
            ],
          }),
          breadcrumbSchema(crumbs.map(c => ({ name: c.label, url: c.to ?? '' }))),
        ]}
      />

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 pb-20">
        <SeoBreadcrumb items={crumbs} />
        {/* Hero */}
        <section className="pt-12 pb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-[hsl(var(--marketing-surface))] rounded-full px-4 py-1.5 mb-4">
            <BookOpen className="h-3.5 w-3.5 text-[hsl(var(--marketing-navy)/0.4)]" />
            <span className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)]">Library</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[hsl(var(--marketing-navy))] mb-4" style={serif}>
            Explore the Living Library of CROS™
          </h1>
          <p className="text-base text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed max-w-lg mx-auto" style={serif}>
            Stories, roles, philosophy, and the language that shapes how communities remember, notice, and serve people well.
          </p>
        </section>

        {/* 1) Start With Your Role */}
        <section className="py-8">
          <SectionHeader icon={Users} label="Discover" title="Start with your role" />
          <div className="space-y-2">
            <NarrativeCard to="/roles" title="All Roles" subtitle="Shepherd · Companion · Visitor · Steward" />
            <NarrativeCard to="/week/shepherd" title="A Week as a Shepherd" subtitle="Holding the longer story of community life" />
            <NarrativeCard to="/week/community-companion" title="A Week as a Companion" subtitle="Walking alongside people with quiet presence" />
            <NarrativeCard to="/week/catholic-visitor" title="A Week as a Visitor" subtitle="Presence over paperwork" />
            <NarrativeCard to="/week/steward" title="A Week as a Steward" subtitle="Making the work easier for everyone else" />
          </div>
        </section>

        {/* 2) Start With Your Mission */}
        <section className="py-8">
          <SectionHeader icon={Compass} label="Mission" title="Start with your mission" />
          <div className="space-y-2">
            <NarrativeCard to="/archetypes" title="All Archetypes" subtitle="Church · Nonprofit · Social Enterprise · Library · Workforce" />
            <NarrativeCard to="/week/catholic-visitor" title="Catholic Parish Outreach" subtitle="How parish visitors use CROS™ each week" />
            <NarrativeCard to="/week/social-outreach" title="Social Outreach Teams" subtitle="Nonprofit case workers in the field" />
          </div>
        </section>

        {/* 3) Learn the Philosophy */}
        <section className="py-8">
          <SectionHeader icon={Lightbulb} label="Philosophy" title="Learn the philosophy" />
          <div className="space-y-2">
            <NarrativeCard to="/manifesto" title="The CROS™ Manifesto" subtitle="Why we built a relationship operating system" />
            <NarrativeCard to="/nri" title="Narrative Relational Intelligence" subtitle="Intelligence that belongs to humans, not machines" />
          </div>
        </section>

        {/* 4) Canonical Language */}
        <section className="py-8">
          <SectionHeader icon={Heart} label="Language" title="The language of communal care" />
          <div className="space-y-2">
            {libraryConcepts.slice(0, 5).map((c) => (
              <NarrativeCard
                key={c.slug}
                to={`/library/${c.slug}`}
                title={c.title}
                subtitle={c.definition.slice(0, 80) + '…'}
              />
            ))}
            {libraryConcepts.length > 5 && (
              <div className="text-center pt-2">
                <Link
                  to="/library/relationship-memory"
                  className="text-xs font-medium text-[hsl(var(--marketing-navy)/0.45)] hover:text-[hsl(var(--marketing-navy)/0.7)] transition-colors"
                >
                  View all {libraryConcepts.length} concepts →
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
