/**
 * CompanionGuide — Standalone getting-started guide for companions.
 *
 * WHAT: Curated help page showing ONLY sections relevant to accompaniment work.
 * WHERE: /help/companions (public + authenticated). Legacy /help/caregivers still routes here.
 * WHY: Companions need a focused guide without metros, pipeline, anchors, grants, or outreach.
 */

import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Heart, Users, Lock, BookOpen, Shield, Calendar, Activity, FileText, Settings, HelpCircle } from 'lucide-react';

interface CareSection {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  content: string[];
}

const careSections: CareSection[] = [
  {
    id: 'getting-started',
    icon: Heart,
    title: 'Getting Started',
    description: 'Your first steps as a companion in CROS.',
    content: [
      'CROS is a relationship memory system — not compliance software. It helps you remember the people you accompany through stories, milestones, and gentle reflection.',
      'After signing up, add the people you walk with under "People." Each person becomes a living record of your shared journey.',
      'Log your visits and check-ins under "Activities." You can add optional hours, notes, and voice recordings.',
      'Everything you write is private by default. No one sees your notes unless you choose to share.',
    ],
  },
  {
    id: 'people',
    icon: Users,
    title: 'People You Accompany',
    description: 'Adding and managing the people in your care.',
    content: [
      'Each person has a profile with their name, your relationship context, and a timeline of your interactions.',
      'You can have up to 10 active people in the free Solo tier. Archived people don\'t count toward this limit.',
      'When a season of accompaniment ends, you can use the Completion flow to honor the journey with a closing reflection.',
      'The optional "date of passing" field is handled with sensitivity — it is never shared publicly or with organizations.',
    ],
  },
  {
    id: 'care-logging',
    icon: Activity,
    title: 'Companion Logging',
    description: 'Recording visits, check-ins, and moments of care.',
    content: [
      'Activity types include: Visit, Check-in, Home Support, Transport, Appointment Support, and Respite.',
      'Hours are optional — log time if it matters to you. Focus on presence and growth.',
      'You can add voice notes that are automatically transcribed into your activity record.',
      'If you work with an organization, you can mark individual entries as "Private" — leadership sees the count but never the content.',
    ],
  },
  {
    id: 'privacy',
    icon: Lock,
    title: 'Privacy & Sharing',
    description: 'How your data stays private — and when you choose to share.',
    content: [
      'Solo workspaces are completely private. No organization, employer, or third party can access your records.',
      'If you also work with an organization on CROS, those are separate workspaces with separate data.',
      'You can export a Season Summary as a PDF to share with anyone you choose — on your terms.',
      'One-way export: you can push selected summaries to an organization workspace. They can never pull from yours.',
    ],
  },
  {
    id: 'season-summaries',
    icon: BookOpen,
    title: 'Season Summaries',
    description: 'AI-assisted narrative snapshots of a season of accompaniment.',
    content: [
      'A Season Summary captures a period of accompaniment — the number of visits, themes, excerpts from your non-private notes, and a closing gratitude line.',
      'Summaries are generated with AI assistance but grounded in your actual entries. You review and edit before publishing.',
      'Summaries can be: Private (default), Shared to organization (if applicable), or Exported as PDF.',
      'Each summary is versioned — you can generate a new version without losing the previous one.',
    ],
  },
  {
    id: 'care-completion',
    icon: Heart,
    title: 'Companion Completion',
    description: 'Honoring the end of a season of accompaniment with dignity.',
    content: [
      'When a season ends — whether through transition, discharge, or passing — the completion ritual helps you close the chapter.',
      'Steps: Write an optional closing reflection → Generate a final season summary → Set a completion date → Archive the person.',
      'Archived people appear as dimmed stars in your constellation — a private memory layer visible only in your workspace.',
      'The completion ritual is never required. You can simply archive a person at any time.',
    ],
  },
  {
    id: 'agency-companions',
    icon: Shield,
    title: 'Working with an Organization',
    description: 'How CROS works when your organization uses it too.',
    content: [
      'If your organization uses CROS, you\'ll be invited as a Companion. Your organization workspace is separate from any personal Solo workspace.',
      'In the organization workspace, your logs are visible to leadership by default — but you can mark entries as Private.',
      'Private entries: only you can see the content. Leadership sees that you logged an entry and the hours, but never the notes.',
      'Season Summaries: you choose whether to share with the organization or keep private.',
      'If you leave the organization, your data retention depends on the organization\'s configured offboarding policy.',
    ],
  },
  {
    id: 'why-companion',
    icon: Heart,
    title: 'Why Companion Matters',
    description: 'The purpose of this space.',
    content: [
      'Many people who walk closely with others have no structured way to remember the arc of growth.',
      'CROS preserves that memory — for mentors, sponsors, caregivers, spiritual directors, coaches, and anyone who accompanies another person.',
      'This is not about productivity. It\'s about faithfully remembering the people you serve.',
    ],
  },
  {
    id: 'not-relevant',
    icon: HelpCircle,
    title: 'Sections You Won\'t See',
    description: 'CROS features that aren\'t part of companion workspaces.',
    content: [
      'As a companion, you won\'t see: Metros, Pipeline, Anchors, Grants, Outreach/Campaigns, Intel Feed, Momentum Map, or Relatio integrations.',
      'These modules serve community organizations with different operational needs. They\'re hidden from companion workspaces to keep things calm and focused.',
      'You will see: People, Activities (Companion Logging), Calendar, Events, Season Summaries, Settings, and Help.',
      'If you need additional features, your organization\'s Steward can adjust workspace settings.',
    ],
  },
];

export default function CaregiverGuide() {
  return (
    <MainLayout title="Companion Guide">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Companion Guide</h1>
          </div>
          <p className="text-muted-foreground">
            Everything you need to know about using CROS™ as a companion — solo or with an organization.
          </p>
          <p className="text-sm text-muted-foreground italic">
            For mentors, sponsors, caregivers, and those who walk closely with others.
          </p>
        </div>

        {/* Quick context */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <p className="text-sm text-foreground">
              CROS is not compliance software. It's a relationship memory system — 
              designed for people who accompany others, not corporations that manage them. 
              Your notes, reflections, and season summaries belong to you.
            </p>
          </CardContent>
        </Card>

        {/* Sections */}
        <Accordion type="multiple" defaultValue={['getting-started']} className="space-y-2">
          {careSections.map(section => (
            <AccordionItem key={section.id} value={section.id} className="border rounded-lg px-1">
              <AccordionTrigger className="hover:no-underline py-3 px-3">
                <div className="flex items-center gap-3 text-left">
                  <div className="p-1.5 rounded-md bg-muted shrink-0">
                    <section.icon className="w-4 h-4 text-foreground" />
                  </div>
                  <div>
                    <span className="font-medium text-foreground text-sm">{section.title}</span>
                    <p className="text-xs text-muted-foreground">{section.description}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-4">
                <ul className="space-y-2">
                  {section.content.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-primary shrink-0 mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {/* Footer */}
        <div className="text-center pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Need more help? Visit the full Help page or reach out through Help Requests.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
