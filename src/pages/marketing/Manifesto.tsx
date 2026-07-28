import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDiscernmentSignal } from '@/hooks/useDiscernmentSignal';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import RoleIdentityBlock from '@/components/seo/RoleIdentityBlock';
import ConceptLinks from '@/components/seo/ConceptLinks';

import NarrativeCTA from '@/components/marketing/NarrativeCTA';
import CivicSignalBlock from '@/components/marketing/CivicSignalBlock';

export default function Manifesto() {
  const { t } = useTranslation('marketing');
  const emit = useDiscernmentSignal('manifesto');
  useEffect(() => { emit('page_view'); }, [emit]);

  return (
    <div className="bg-background">
      <SeoHead
        title="Manifesto"
        description="CROS™ is not another CRM. It is a living relationship system that remembers people, notices community shifts, and builds lasting stories of impact."
        keywords={['relationship OS', 'community CRM alternative', 'narrative intelligence', 'nonprofit technology']}
        canonical="/manifesto"
      />

      <article className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24 space-y-6 text-lg leading-relaxed text-muted-foreground font-serif">
        <SeoBreadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Manifesto' }]} />

        <p className="text-sm font-sans font-medium text-primary uppercase tracking-wider">Manifesto</p>

        <h1 className="text-3xl sm:text-4xl text-foreground font-semibold leading-tight font-serif">
          The CROS Manifesto
        </h1>

        <p className="text-2xl sm:text-3xl text-foreground font-semibold leading-snug">
          For decades, software taught organizations to think in records and pipelines.
        </p>

        <p>CROS™ teaches us to think in relationships and communities.</p>

        <p>
          It holds memory gently — reflections, touchpoints, moments — so we don't forget
          the people we meant to care for.
        </p>

        <hr className="border-border my-12" />

        <p>
          For the last 40 years, technology has been driven by Operating Systems and Artificial Intelligence.
        </p>

        <p>Both were invented by humans, but both have largely remained cold, data-driven, and impersonal.</p>

        <p>
          CROS™ replaces the OS with a human touch. It is the bridge between an organization
          and the community it serves.
        </p>

        <hr className="border-border my-12" />

        <p>
          NRI™ · Narrative Relational Intelligence · is not artificial. It is human-first intelligence:
          reflections, events attended, conversations, community signals, shared experiences.
        </p>

        <p>AI assists the system, but the intelligence belongs to the human relationships.</p>

        <hr className="border-border my-12" />

        {/* A Different Kind of Stewardship */}
        <p className="text-sm font-sans font-medium text-primary uppercase tracking-wider">
          A Different Kind of Stewardship
        </p>

        <p>
          Many organizations serving their communities were never meant to become software administrators.
        </p>

        <p>
          And yet, over time, technology has quietly shifted from a companion to a burden —
          shaping workflows, budgets, and even language.
        </p>

        <p>
          Grants meant for people are often redirected toward tools that were never designed
          with those people in mind.
          Not because leaders made the wrong choice — but because for a long time,
          those were the only tools available.
        </p>

        <p>
          We don't say this with criticism.
          Only with recognition.
        </p>

        <p>
          Most platforms emerged from enterprise sales models and later adapted themselves
          to nonprofit work. CROS™ began in the opposite direction — from lived community
          experience outward into technology.
        </p>

        <p>
          At its heart, this is an ontological shift.
          Instead of treating relationships as data points, CROS™ treats story as the
          organizing structure through which data finds meaning.
        </p>

        <p>
          We are not simply building new features.
          We are gently redefining the category itself — moving from systems that manage
          people toward a Relationship Operating System that helps people see one another
          more clearly.
        </p>

        <p className="italic text-muted-foreground/60">
          What if software didn't sit above the mission, but walked alongside it?
        </p>

        <p className="italic text-muted-foreground/60">
          What if technology carried the logistics quietly, while people carried the meaning?
        </p>

        <p>
          CROS™ exists because stewardship includes the tools we choose —
          and the spirit those tools embody.
        </p>

        <p className="italic text-muted-foreground/60">
          We do not operate communities.
          We cultivate them.
        </p>

        <hr className="border-border my-12" />

        {/* The First Garden */}
        <p className="text-sm font-sans font-medium text-primary uppercase tracking-wider">
          The First Garden
        </p>

        <p>
          CROS™ did not begin as a startup idea.
          It grew from decades of lived community work —
          ministry, recovery spaces, nonprofit outreach, education,
          creative work, and relational service.
        </p>

        <p>
          The platform was shaped slowly through real encounters,
          not product strategy sessions.
        </p>

        <p>
          Most software asks organizations to reshape their mission
          around systems.
          CROS™ exists to hold relationships more faithfully —
          to let systems bend toward the dignity of people.
        </p>

        <p>
          This is more than a feature set — it is a shift in ontology.
          Rather than reducing people to records, CROS™ makes relational intelligence
          the foundation: the quiet awareness that grows when stewardship
          replaces administration.
        </p>

        <p>
          Over time, the garden became larger than one person.
          New gardeners now shape it through their own communities —
          each one helping to redefine what technology in service of mission can look like.
        </p>

        <p className="italic text-muted-foreground/60">
          Technology built from presence, not disruption.
        </p>

        <hr className="border-border my-12" />

        {/* The Human Nervous System */}
        <p className="text-sm font-sans font-medium text-primary uppercase tracking-wider text-center">
          The Human Nervous System
        </p>

        <h2 className="text-2xl sm:text-3xl font-semibold text-foreground leading-snug text-center">
          The System Only Lives When You Do
        </h2>

        <p>CROS™ was never built to replace people.</p>

        <p>
          Most software tries to automate relationships away.
          We built something different — a system that becomes more aware the more present you are.
        </p>

        <p>
          NRI™ may be the head.
          CROS™ may be the heart.
          Profunda™ may be the body.
        </p>

        <p className="text-foreground font-medium">
          But you are the nervous system.
        </p>

        <p>
          Every reflection you write,
          every conversation you hold,
          every moment you choose to follow up —
          those are the signals that give the platform life.
        </p>

        <p>
          CROS™ doesn't generate meaning on its own.
          It listens to the work already happening
          and helps you see the story that's forming around it.
        </p>

        <p className="text-sm text-muted-foreground/50 text-center italic">
          Your presence drives the intelligence.
        </p>

        <hr className="border-border my-12" />

        {/* From Numbers to Meaning */}
        <p className="text-sm font-sans font-medium text-primary uppercase tracking-wider text-center">
          From Numbers to Meaning
        </p>

        <p>For decades, computers have helped us do what once felt impossible.</p>

        <p>
          A calculator could solve equations in seconds.
          Spreadsheets could organize thousands of numbers at once.
          Software helped us manage schedules, calendars, and endless lists.
        </p>

        <p>In many ways, AI is simply the next step in that same story.</p>

        <p>
          Computers once understood numbers better than we ever could.
          Now they are beginning to understand letters — the language we actually live in.
        </p>

        <p>
          Because humans don't experience life as data points.
          We experience it through conversations,
          through stories,
          through the rhythm of seasons, calendars, and relationships.
        </p>

        <p>
          The goal of CROS™ is not to turn people into code.
          It is to let AI carry the weight of organization
          so that humans can return to the work that only humans can do.
        </p>

        <p>
          Not data entry.
          Not endless spreadsheets.
        </p>

        <p className="text-foreground font-medium">
          But presence.
          Care.
          And the work of love that technology was always meant to support.
        </p>

        <hr className="border-border my-12" />

        {/* Why This Exists */}
        <p className="text-sm font-sans font-medium text-primary uppercase tracking-wider">
          Why This Exists
        </p>

        <p>
          This platform didn't begin as a product idea.
          It began as years of walking alongside communities —
          delivering devices, building curricula, listening to stories,
          and noticing how many tools asked people to become data managers instead of neighbors.
        </p>

        <p>
          CROS™ is simply the digital expression of that lived work —
          an attempt to build technology that reflects the dignity already present in community life.
        </p>

        <p className="italic text-muted-foreground/60">
          It is cultivated by gardeners —
          people who believe technology should grow alongside mission,
          never above it.
        </p>

        <hr className="border-border my-12" />

        <p className="text-foreground font-medium">
          CROS™ is not another system asking you to change your mission.
        </p>

        <p>
          It is a space where your mission can breathe again —
          where story becomes structure,
          and relationships become the operating system.
        </p>

        {/* Role identity block */}
        <RoleIdentityBlock />
      </article>

      {/* Civic Signals */}
      <CivicSignalBlock />

      {/* Quiet CTA */}
      <NarrativeCTA variant="walk_first_week" />

      {/* Concept graph cross-links */}
      <ConceptLinks conceptSlug="cros" heading={t('roleDeepPage.relatedConceptsHeading')} />

      <SeoInternalLinks
        heading={t('manifestoPage.seoLinksHeading')}
        links={[
          { label: 'NRI™ — Narrative Relational Intelligence', to: '/nri', description: 'The intelligence that begins with people.' },
          { label: 'Roles — Shepherd, Companion, Visitor', to: '/roles', description: 'Find where you fit in the system.' },
          { label: 'Archetypes', to: '/archetypes', description: 'See how CROS adapts to your mission type.' },
        ]}
      />
    </div>
  );
}
