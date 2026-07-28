/**
 * ArchetypeResonanceCard — Week-in-the-life narrative panel for archetypes.
 *
 * WHAT: Shows a condensed archetype narrative with active roles and gentle CTA.
 * WHERE: Marketing pages, metro pages, role deep pages.
 * WHY: Helps visitors see themselves in the system through narrative resonance.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { archetypes, type ArchetypeKey } from '@/config/brand';
import { useTranslation } from 'react-i18next';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const narrativeSnippets: Partial<Record<ArchetypeKey, string>> = {
  church: "Monday begins with a reflection from last Sunday's conversations. By Wednesday, a Companion has followed up on three families. On Friday, a Visitor records a voice note from a home visit that becomes next week's story.",
  digital_inclusion: "Tuesday morning, a Companion reviews which households received devices this month. By Thursday, field Visitors have captured voice notes from three neighborhoods. The Shepherd notices a pattern: families need support beyond hardware.",
  social_enterprise: "The week starts with a Shepherd reviewing community signals. Companions coordinate with two new partners by midweek. By Friday, the team has a clearer picture of where trust is growing.",
  workforce: "Monday's signals show new employer interest. Companions check in with recent graduates. By week's end, the Shepherd notices a pattern: retention improves when follow-up happens within 48 hours.",
  refugee_support: "The week opens gently — a Companion reviews arrival timelines. Visitors check in with three families settling into new neighborhoods. The Shepherd holds the thread of the longer story.",
  education_access: "Tutoring matches are reviewed Monday. Companions track attendance patterns. By Friday, a Visitor's voice note reveals why one student stopped showing up — and what to do about it.",
  library_system: "Program attendance signals arrive Tuesday. Companions notice a surge in ESL conversation circle interest. The Shepherd uses this to shape next quarter's outreach.",
  caregiver_solo: "Monday begins with a quiet review of last week's visits. By Wednesday, a voice note captures a moment of connection with Mrs. Chen. On Friday, a reflection helps prepare for a difficult family conversation.",
  caregiver_agency: "Tuesday morning, the care coordinator reviews visit patterns. By Thursday, two caregivers flag concerns about the same client. The Shepherd notices a staffing gap before it becomes a crisis.",
  missionary_org: "The week opens with field updates from three countries. A Companion reviews partnership signals. By Friday, a pattern emerges — families in two regions are asking about the same kind of support.",
};

const activeRoles: Partial<Record<ArchetypeKey, string[]>> = {
  church: ['Shepherd', 'Companion', 'Visitor'],
  digital_inclusion: ['Companion', 'Visitor', 'Shepherd'],
  social_enterprise: ['Shepherd', 'Companion'],
  workforce: ['Shepherd', 'Companion'],
  refugee_support: ['Companion', 'Visitor', 'Shepherd'],
  education_access: ['Companion', 'Visitor'],
  library_system: ['Companion', 'Shepherd'],
  caregiver_solo: ['Companion'],
  caregiver_agency: ['Shepherd', 'Companion', 'Visitor'],
  missionary_org: ['Shepherd', 'Companion', 'Visitor'],
};

interface Props {
  archetypeSlug: ArchetypeKey;
  metroSlug?: string;
}

export default function ArchetypeResonanceCard({ archetypeSlug, metroSlug }: Props) {
  const { t } = useTranslation('marketing');
  const arch = archetypes[archetypeSlug];
  if (!arch) return null;

  const narrative = narrativeSnippets[archetypeSlug];
  const roles = activeRoles[archetypeSlug] || [];

  return (
    <div className="rounded-2xl bg-[hsl(var(--marketing-surface))] p-6 sm:p-8">
      <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)] mb-3">
        {t('archetypeResonanceCard.eyebrow')}
      </p>
      <h3
        className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-3"
        style={serif}
      >
        {arch.name}
      </h3>
      {narrative && (
        <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed mb-4" style={serif}>
          {narrative}
        </p>
      )}
      {roles.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-5">
          {roles.map((r) => (
            <span
              key={r}
              className="inline-block bg-white text-[hsl(var(--marketing-navy)/0.6)] px-3 py-1 rounded-full text-xs border border-[hsl(var(--marketing-navy)/0.1)]"
            >
              {r}
            </span>
          ))}
        </div>
      )}
      <Link to={`/pricing?archetype=${archetypeSlug}`}>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full border-[hsl(var(--marketing-navy)/0.15)] text-[hsl(var(--marketing-navy)/0.7)] hover:bg-white"
        >
          {t('archetypeResonanceCard.cta')} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </Link>
    </div>
  );
}
