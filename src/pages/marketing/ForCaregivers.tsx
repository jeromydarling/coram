/**
 * ForCaregivers → ForCompanions — Marketing page for companion paths.
 *
 * WHAT: Two-block landing page for solo companions and companion agencies.
 * WHERE: /for-companions (public marketing route). Legacy /for-caregivers still routes here.
 * WHY: Clear positioning of solo vs agency paths, dignity-first tone.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Heart, Users, Lock, BookOpen, Shield, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import SeoHead from '@/components/seo/SeoHead';

export default function ForCaregivers() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16 space-y-16">
      <SeoHead title="CROS™ for Caregivers — A Private Memory for the Work of Care" description="A gentle, privacy-first companion for individual and agency caregivers. Remember conversations, preferences, and the people you serve." canonical="/for-caregivers" />
      {/* Hero */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
          Accompaniment deserves memory.
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          CROS™ helps companions remember the people they walk with — not with charts and compliance,
          but with stories, milestones, and gentle reflection.
        </p>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto italic">
          For mentors, sponsors, caregivers, spiritual directors, coaches, and anyone who walks closely with others.
        </p>
      </div>

      {/* Two paths */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Solo */}
        <Card className="border-2 border-primary/20 hover:border-primary/40 transition-colors">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-6 w-6 text-primary" />
              <CardTitle className="text-xl">For independent companions</CardTitle>
            </div>
            <CardDescription>
              A private workspace — just for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <span>Private by default. No organization can see your notes unless you choose to share.</span>
              </li>
              <li className="flex items-start gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <span>Visit logs, voice notes, season summaries — your memory of the people you accompany.</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <span>Free forever. Pay-what-you-can support if you'd like.</span>
              </li>
            </ul>
            <div className="pt-2">
              <Button asChild className="w-full">
                <Link to="/onboarding?tier=companion_free">Start Free</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Agency */}
        <Card className="border-2 border-border hover:border-primary/30 transition-colors">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-6 w-6 text-primary" />
              <CardTitle className="text-xl">For companion organizations</CardTitle>
            </div>
            <CardDescription>
              Coordinate accompaniment with dignity — not surveillance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <span>Invite companions as team members. They log visits; you see patterns and summaries.</span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <span>Companions can mark entries as private. Leadership sees counts, never content.</span>
              </li>
              <li className="flex items-start gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <span>Season summaries help tell the story of accompaniment — when it's time.</span>
              </li>
            </ul>
            <div className="pt-2">
              <Button variant="outline" asChild className="w-full">
                <Link to="/pricing">Choose a Plan</Link>
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Select "Companion" as your archetype during setup.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sponsor-specific */}
      <div className="rounded-2xl bg-muted/50 p-6 sm:p-8 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">For Recovery Sponsors</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p>Track sobriety anniversaries.</p>
            <p>Remember milestone moments.</p>
          </div>
          <div className="space-y-2">
            <p>Reflect on growth over time.</p>
            <p>See long arcs forming across seasons.</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground italic pt-2">
          No reporting pressure. No exposure. Private by default.
        </p>
      </div>

      {/* Companion identity */}
      <div className="max-w-3xl mx-auto space-y-4">
        <h2
          className="text-xl font-semibold text-foreground text-center"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Companions are the people who walk alongside others.
        </h2>
        <p className="text-center text-muted-foreground leading-relaxed">
          Mentors. Missionaries. Caregivers. Sponsors. Spiritual directors. Volunteers.
        </p>
        <p className="text-center text-muted-foreground leading-relaxed">
          CROS helps them remember the people they serve, capture moments of care,
          and follow through on the relationships that matter most.
        </p>
      </div>

      {/* Philosophy */}
      <div className="text-center space-y-3 pt-8 border-t border-border/50">
        <p className="text-lg font-medium text-foreground">
          Private by default. Share intentionally.
        </p>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          CROS™ is not compliance software. It's a relationship memory system —
          designed for people who accompany others, not corporations that manage them.
        </p>
      </div>
    </div>
  );
}
