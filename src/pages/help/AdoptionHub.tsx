/**
 * AdoptionHub — Narrative-first formation space for daily rhythm adoption.
 *
 * WHAT: Guides Stewards, Shepherds, Companions, and Visitors into daily rhythm.
 * WHERE: /:tenantSlug/help/adoption
 * WHY: Adoption is about building rhythm, not learning software.
 */

import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { Link } from 'react-router-dom';
import {
  Heart,
  Mic,
  MessageCircle,
  Users,
  Sparkles,
  BookOpen,
  Mail,
} from 'lucide-react';

/* ─── Narrative card wrapper ─── */
function NarrativeCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/50 bg-card/80 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <CardTitle className="text-lg font-serif">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-muted-foreground leading-relaxed text-[0.925rem]">
        {children}
      </CardContent>
    </Card>
  );
}

/* ─── Content cards ─── */

function AdoptionIntroCard({ tenantSlug }: { tenantSlug: string }) {
  return (
    <NarrativeCard icon={Heart} title="Adoption is not about learning tools — it is about building rhythm.">
      <p>
        CROS works when people add small moments daily. A reflection here. A voice note there.
        Over time, those quiet acts become a living memory — one that speaks for the organization
        when reports are due, when leadership asks what changed, when a new person joins the mission.
      </p>
      <p>
        You don't need to master every feature. You just need to start noticing — and recording what
        you notice.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-1">
        <Link to={`/${tenantSlug}/dashboard`}>Open Command Center</Link>
      </Button>
    </NarrativeCard>
  );
}

function LeaderRhythmCard() {
  return (
    <NarrativeCard icon={Sparkles} title="The 5-Minute Daily Model">
      <p>
        Leaders set the rhythm. Here's a gentle daily pattern that takes less than five minutes:
      </p>
      <ul className="list-none space-y-2 pl-1">
        <li className="flex items-start gap-2">
          <span className="text-primary mt-0.5">•</span>
          <span><strong className="text-foreground">Notice one signal</strong> — a drift alert, a momentum shift, a new connection.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-primary mt-0.5">•</span>
          <span><strong className="text-foreground">Send one encouragement</strong> — a message, a quick check-in, a reflection shared with a teammate.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-primary mt-0.5">•</span>
          <span><strong className="text-foreground">Record one reflection</strong> — what did you observe today that matters?</span>
        </li>
      </ul>
      <p className="text-sm italic text-muted-foreground/80">
        When leaders model this rhythm, teams follow naturally.
      </p>
    </NarrativeCard>
  );
}

function VisitorMomentumCard({ tenantSlug }: { tenantSlug: string }) {
  return (
    <NarrativeCard icon={Mic} title="When visitors speak, the system remembers.">
      <p>
        Visitors — your volunteers, your field workers, your community witnesses —
        carry stories that no dashboard can capture. Voice notes turn those stories into searchable,
        sharable memory.
      </p>
      <p>
        A 30-second recording after a visit becomes a reflection that leadership can see weeks later
        when writing a grant narrative or preparing a board report.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-1">
        <Link to={`/${tenantSlug}/visits`}>Open Visits</Link>
      </Button>
    </NarrativeCard>
  );
}

function FrictionGuidanceCard() {
  return (
    <NarrativeCard icon={MessageCircle} title="When something feels confusing, pause.">
      <p>
        The system learns from moments of hesitation. If a screen feels unfamiliar, if a workflow
        seems too complex — that's a signal, not a failure.
      </p>
      <p>
        Operators see these friction patterns in aggregate and can adjust guidance, simplify
        navigation, or offer a Guided Activation session. You don't need to figure it out alone.
      </p>
    </NarrativeCard>
  );
}

function FirstStoryMeetingCard() {
  return (
    <NarrativeCard icon={BookOpen} title="Your First Story Meeting">
      <p>
        When your team gathers to talk about relationships, try opening with this:
      </p>
      <blockquote className="border-l-2 border-primary/30 pl-4 italic text-foreground/80 my-3">
        "We are not reporting — we are noticing together.<br />
        What did we see this week that surprised us?<br />
        Who did we meet that we want to remember?<br />
        What story is forming that we haven't named yet?"
      </blockquote>
      <p className="text-sm text-muted-foreground/80">
        This framing shifts the conversation from performance tracking to collective awareness.
      </p>
    </NarrativeCard>
  );
}

function EmailIntakeAdoptionCard({ tenantSlug }: { tenantSlug: string }) {
  return (
    <NarrativeCard icon={Mail} title="How to include people who prefer email">
      <p>
        Not everyone will open an app after a visit — and they shouldn't have to.
        Simple Intake lets anyone on your team send notes by email.
        CROS logs them automatically as part of the relationship story.
      </p>
      <p className="font-medium text-foreground text-sm">Three simple steps for Stewards:</p>
      <ul className="list-none space-y-2 pl-1">
        <li className="flex items-start gap-2">
          <span className="text-primary mt-0.5">1.</span>
          <span>Enable Simple Intake in <strong className="text-foreground">Settings</strong>.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-primary mt-0.5">2.</span>
          <span>Copy the share message and send it to your team.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-primary mt-0.5">3.</span>
          <span>That's it. Notes flow in — no training required.</span>
        </li>
      </ul>
      <p className="text-sm text-muted-foreground/80 italic">
        Works well for social worker visit summaries, partner updates, supervisor dictation notes,
        and quick field reflections.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-1">
        <Link to={`/${tenantSlug}/settings`}>Open Settings</Link>
      </Button>
    </NarrativeCard>
  );
}

function AdoptionSignalsCard({ tenantSlug }: { tenantSlug: string }) {
  const { isAdmin, isSteward } = useAuth();
  if (!isAdmin && !isSteward) return null;

  return (
    <Card className="border-primary/20 bg-primary/5 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Users className="h-4.5 w-4.5" />
          </div>
          <CardTitle className="text-lg font-serif">Adoption Signals</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-muted-foreground leading-relaxed text-[0.925rem]">
        <p>
          Operators can see rhythm patterns across the workspace — which roles are engaging,
          where friction appears, and how reflections flow over time.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/operator/nexus">View Adoption Dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/* ─── Page ─── */

export default function AdoptionHub() {
  const { tenant } = useTenant();
  const slug = tenant?.slug ?? '';

  return (
    <MainLayout
      title="Adoption & Daily Rhythm"
      subtitle="Helping your people live inside the story — not learn software."
    >
      <div className="max-w-2xl mx-auto space-y-5">
        <AdoptionIntroCard tenantSlug={slug} />
        <LeaderRhythmCard />
        <EmailIntakeAdoptionCard tenantSlug={slug} />
        <VisitorMomentumCard tenantSlug={slug} />
        <FrictionGuidanceCard />
        <FirstStoryMeetingCard />
        <AdoptionSignalsCard tenantSlug={slug} />
      </div>
    </MainLayout>
  );
}
