/**
 * OnboardingFlowGuide — Visual documentation + interactive demo of the CROS tenant onboarding journey.
 *
 * WHAT: Step-by-step reference guide with an embedded interactive demo of each onboarding screen.
 * WHERE: /operator/onboarding-guide
 * WHY: Operators need to see and understand the tenant journey to support new organizations.
 */
import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Download, UserPlus, LogIn, Sparkles, Shield, Church, Compass, MapPin,
  Building2, FileText, BookOpen, CheckCircle2, ListChecks, ChevronRight,
  ChevronLeft, Check, HelpCircle, Upload, Users, Heart, Library, Home,
  GraduationCap, Landmark, HandHeart, Eye, EyeOff, X, Play, Monitor
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { archetypeConfigs } from '@/config/archetypes';
import { MINISTRY_ROLE_PROMPTS, MINISTRY_ROLE_DESCRIPTIONS } from '@/lib/ministryRole';

// ─── Archetype icon map (mirrors Onboarding.tsx) ───
const iconMap: Record<string, typeof Church> = {
  church: Church, workforce_development: Users, social_enterprise: Building2,
  community_foundation: Heart, public_library_or_city_program: Library,
  nonprofit_program: Building2, housing: Home, education: GraduationCap, government: Landmark,
};
const ARCHETYPES = archetypeConfigs.map(a => ({
  key: a.key, name: a.label, icon: iconMap[a.key] ?? Building2, description: a.missionPrompt,
}));

// ─── Demo steps ───
const DEMO_STEPS = [
  'signup', 'login',
  'welcome', 'steward_welcome', 'archetype', 'sectors', 'ministry_role',
  'multi_city', 'metro', 'details', 'knowledge', 'confirm',
  'getting_started',
] as const;
type DemoStep = typeof DEMO_STEPS[number];

const DEMO_STEP_LABELS: Record<DemoStep, { title: string; phase: string }> = {
  signup: { title: '1. Sign Up', phase: 'Authentication' },
  login: { title: '2. Sign In', phase: 'Authentication' },
  welcome: { title: '3. Welcome', phase: 'Onboarding Wizard' },
  steward_welcome: { title: '4. Steward Welcome', phase: 'Onboarding Wizard' },
  archetype: { title: '5. Mission Archetype', phase: 'Onboarding Wizard' },
  sectors: { title: '6. Sector Tags', phase: 'Onboarding Wizard' },
  ministry_role: { title: '7. Ministry Role', phase: 'Onboarding Wizard' },
  multi_city: { title: '8. Multi-City', phase: 'Onboarding Wizard' },
  metro: { title: '9. Home Territory', phase: 'Onboarding Wizard' },
  details: { title: '10. Organization Details', phase: 'Onboarding Wizard' },
  knowledge: { title: '11. Knowledge Upload', phase: 'Onboarding Wizard' },
  confirm: { title: '12. Confirm & Create', phase: 'Onboarding Wizard' },
  getting_started: { title: '13. Getting Started', phase: 'Post-Onboarding' },
};

// ─── Mock metros ───
const MOCK_METROS = [
  { id: 'metro-1', name: 'Minneapolis–St. Paul, MN' },
  { id: 'metro-2', name: 'Dallas–Fort Worth, TX' },
  { id: 'metro-3', name: 'Denver–Aurora, CO' },
  { id: 'metro-4', name: 'Nashville–Davidson, TN' },
  { id: 'metro-5', name: 'Columbus, OH' },
];

// ─── PDF export (kept from original) ───
function exportPDF() {
  import('jspdf').then(({ default: jsPDF }) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 18;
    const contentWidth = doc.internal.pageSize.getWidth() - margin * 2;
    let y = margin;
    const checkSpace = (n: number) => { if (y + n > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; } };

    doc.setFont('helvetica', 'bold'); doc.setFontSize(28);
    doc.text('CROS™ Onboarding', margin, y + 30);
    doc.setFontSize(16); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120);
    doc.text('Flow Guide', margin, y + 42);
    doc.setFontSize(10);
    doc.text(`Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, margin, y + 56);

    Object.entries(DEMO_STEP_LABELS).forEach(([, info]) => {
      doc.addPage(); y = margin;
      doc.setFontSize(8); doc.setTextColor(139, 155, 139);
      doc.text(info.phase.toUpperCase(), margin, y); y += 6;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(40, 40, 40);
      doc.text(info.title, margin, y); y += 12;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(80, 80, 80);
      doc.text('See the interactive demo on the guide page for a visual walkthrough of this step.', margin, y);
    });

    doc.save('CROS-Onboarding-Flow-Guide.pdf');
    toast.success('PDF exported successfully');
  });
}

// ─── Demo screen renderer ───
function DemoScreen({ step, state, setState }: {
  step: DemoStep;
  state: DemoState;
  setState: React.Dispatch<React.SetStateAction<DemoState>>;
}) {
  switch (step) {
    case 'signup': return <DemoSignup />;
    case 'login': return <DemoLogin />;
    case 'welcome': return <DemoWelcome />;
    case 'steward_welcome': return <DemoStewardWelcome />;
    case 'archetype': return <DemoArchetype state={state} setState={setState} />;
    case 'ministry_role': return <DemoMinistryRole state={state} setState={setState} />;
    case 'multi_city': return <DemoMultiCity state={state} setState={setState} />;
    case 'metro': return <DemoMetro state={state} setState={setState} />;
    case 'details': return <DemoDetails state={state} setState={setState} />;
    case 'knowledge': return <DemoKnowledge />;
    case 'confirm': return <DemoConfirm state={state} />;
    case 'getting_started': return <DemoGettingStarted />;
    default: return null;
  }
}

interface DemoState {
  archetype: string | null;
  ministryRole: string;
  multiCity: boolean | null;
  metro: string | null;
  orgName: string;
  orgSlug: string;
  hipaaSensitive: boolean;
}

// ─── Individual demo screens ───

function DemoSignup() {
  const [showPw, setShowPw] = useState(false);
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">CR</span>
          </div>
        </div>
        <CardTitle className="text-2xl text-center">Create an account</CardTitle>
        <CardDescription className="text-center">Join CROS to start building relationships</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant="outline" className="w-full" disabled>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
          Sign up with Google
        </Button>
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or</span></div>
        </div>
        <div className="space-y-2">
          <Label>Display Name</Label>
          <Input placeholder="Your name" defaultValue="Sarah Mitchell" />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" placeholder="you@organization.org" defaultValue="sarah@bridgecommunity.org" />
        </div>
        <div className="space-y-2">
          <Label>Password</Label>
          <div className="relative">
            <Input type={showPw ? 'text' : 'password'} defaultValue="SecureP@ss123" className="pr-10" />
            <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPw(!showPw)}>
              {showPw ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
            </Button>
          </div>
          <div className="flex gap-1 mt-1">
            <div className="h-1 flex-1 rounded bg-primary" /><div className="h-1 flex-1 rounded bg-primary" /><div className="h-1 flex-1 rounded bg-primary" /><div className="h-1 flex-1 rounded bg-muted" />
          </div>
          <span className="text-xs text-muted-foreground">Strong password</span>
        </div>
        <div className="space-y-2">
          <Label>Confirm Password</Label>
          <Input type="password" defaultValue="SecureP@ss123" />
        </div>
        <Button className="w-full" disabled>Create Account</Button>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground text-center w-full">
          Already have an account? <span className="text-primary cursor-pointer">Sign in</span>
        </p>
      </CardFooter>
    </Card>
  );
}

function DemoLogin() {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">CR</span>
          </div>
        </div>
        <CardTitle className="text-2xl text-center">Welcome back</CardTitle>
        <CardDescription className="text-center">Sign in to your CROS workspace</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant="outline" className="w-full" disabled>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
          Sign in with Google
        </Button>
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or</span></div>
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" placeholder="you@organization.org" defaultValue="sarah@bridgecommunity.org" />
        </div>
        <div className="space-y-2">
          <Label>Password</Label>
          <Input type="password" defaultValue="••••••••" />
        </div>
        <div className="text-right"><span className="text-sm text-primary cursor-pointer">Forgot password?</span></div>
        <Button className="w-full" disabled>Sign In</Button>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground text-center w-full">
          Don't have an account? <span className="text-primary cursor-pointer">Sign up</span>
        </p>
      </CardFooter>
    </Card>
  );
}

function DemoWelcome() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Your CROS workspace is almost ready</CardTitle>
        <CardDescription className="max-w-md mx-auto">
          We'll walk you through a few quick steps to configure your workspace. This takes about two minutes.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto text-sm text-muted-foreground">
          {[{ n: 1, t: 'Choose archetype' }, { n: 2, t: 'Select metro' }, { n: 3, t: 'Name & launch' }].map(({ n, t }) => (
            <div key={n} className="space-y-1">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <span className="text-primary font-semibold">{n}</span>
              </div>
              <p>{t}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DemoStewardWelcome() {
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
          <Shield className="h-7 w-7 text-primary" />
        </div>
        <CardTitle style={{ fontFamily: "'Playfair Display', serif" }}>
          You are the Steward of this workspace
        </CardTitle>
        <CardDescription className="max-w-md mx-auto">
          As the founding member, you hold the keys to this workspace.
          You can invite your team, manage settings, and shape how your organization uses CROS.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-muted-foreground max-w-lg mx-auto">
          <div className="p-3 rounded-lg bg-muted/50"><div className="font-medium text-foreground mb-1">Invite your team</div><div className="text-xs">Add Shepherds, Companions, and Visitors</div></div>
          <div className="p-3 rounded-lg bg-muted/50"><div className="font-medium text-foreground mb-1">Manage billing</div><div className="text-xs">Plans, add-ons, and capacity</div></div>
          <div className="p-3 rounded-lg bg-muted/50"><div className="font-medium text-foreground mb-1">Shape the experience</div><div className="text-xs">Configure your workspace identity</div></div>
        </div>
        <p className="text-xs text-muted-foreground/70 pt-2">You'll choose your personal role in the next step — this is separate from your workspace responsibilities.</p>
      </CardContent>
    </Card>
  );
}

function DemoArchetype({ state, setState }: { state: DemoState; setState: React.Dispatch<React.SetStateAction<DemoState>> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose Your Mission Archetype</CardTitle>
        <CardDescription>This shapes your default journey stages, language, and community signals.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ARCHETYPES.map(({ key, name, icon: Icon, description }) => (
            <button key={key} onClick={() => setState(s => ({ ...s, archetype: key }))}
              className={`text-left p-4 rounded-lg border-2 transition-all ${state.archetype === key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
              <div className="flex items-start gap-3">
                <Icon className={`h-5 w-5 mt-0.5 ${state.archetype === key ? 'text-primary' : 'text-muted-foreground'}`} />
                <div><div className="font-medium text-sm">{name}</div><div className="text-xs text-muted-foreground mt-0.5">{description}</div></div>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-6 p-4 rounded-lg border border-border bg-muted/30 space-y-2">
          <div className="flex items-center gap-3">
            <Switch id="demo-hipaa" checked={state.hipaaSensitive} onCheckedChange={(v) => setState(s => ({ ...s, hipaaSensitive: v }))} />
            <Label htmlFor="demo-hipaa" className="text-sm font-medium cursor-pointer">Enable privacy-sensitive narrative mode</Label>
            <Tooltip><TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50" /></TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-xs">
                <p><strong>What:</strong> Anonymizes names in reflections and narratives.</p>
                <p><strong>Where:</strong> Testimonium, NRI summaries, and public presence pages.</p>
                <p><strong>Why:</strong> For healthcare-adjacent or confidential outreach environments.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-xs text-muted-foreground pl-[2.75rem]">When enabled, reflections and narratives use anonymized language.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DemoMinistryRole({ state, setState }: { state: DemoState; setState: React.Dispatch<React.SetStateAction<DemoState>> }) {
  const roles = [
    { role: 'shepherd', icon: Compass, prompt: MINISTRY_ROLE_PROMPTS.shepherd, desc: MINISTRY_ROLE_DESCRIPTIONS.shepherd, context: "You'll see metro narratives, expansion planning, and guidance tools first." },
    { role: 'companion', icon: HandHeart, prompt: MINISTRY_ROLE_PROMPTS.companion, desc: MINISTRY_ROLE_DESCRIPTIONS.companion, context: "You'll start with reflections, email follow-ups, and Impulsus — the daily heartbeat of relationships." },
    { role: 'visitor', icon: MapPin, prompt: MINISTRY_ROLE_PROMPTS.visitor, desc: MINISTRY_ROLE_DESCRIPTIONS.visitor, context: "You'll see events, Voluntārium, and simple mobile-first actions — designed to feel like a paper list." },
  ];
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle style={{ fontFamily: "'Playfair Display', serif" }}>How do you serve your community?</CardTitle>
        <CardDescription className="max-w-md mx-auto">This doesn't change your permissions. It simply helps CROS speak your language.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3">
          {roles.map(({ role, icon: Icon, prompt, desc, context }) => (
            <button key={role} onClick={() => setState(s => ({ ...s, ministryRole: role }))}
              className={`text-left p-5 rounded-lg border-2 transition-all ${state.ministryRole === role ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${state.ministryRole === role ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Icon className={`h-5 w-5 ${state.ministryRole === role ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <div className="font-medium">{prompt}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{desc}</div>
                  {state.ministryRole === role && (
                    <div className="mt-3 text-xs text-muted-foreground/80 leading-relaxed border-t pt-3">{context}</div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DemoMultiCity({ state, setState }: { state: DemoState; setState: React.Dispatch<React.SetStateAction<DemoState>> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Do you operate in more than one city?</CardTitle>
        <CardDescription>Organizations that serve multiple communities can unlock Civitas™ — metro-level awareness, expansion planning, and narrative segmentation.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={() => setState(s => ({ ...s, multiCity: false }))}
            className={`text-left p-4 rounded-lg border-2 transition-all ${state.multiCity === false ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
            <div className="font-medium text-sm">One community</div>
            <div className="text-xs text-muted-foreground mt-1">We focus on a single city or region. You can always add more later.</div>
          </button>
          <button onClick={() => setState(s => ({ ...s, multiCity: true }))}
            className={`text-left p-4 rounded-lg border-2 transition-all ${state.multiCity === true ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
            <div className="font-medium text-sm">Multiple cities</div>
            <div className="text-xs text-muted-foreground mt-1">We serve communities across multiple metros. Enable Civitas™ trial.</div>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function DemoMetro({ state, setState }: { state: DemoState; setState: React.Dispatch<React.SetStateAction<DemoState>> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose Your Home Metro</CardTitle>
        <CardDescription>This sets your default community lens — the metro you'll see first when exploring signals and narrative.</CardDescription>
      </CardHeader>
      <CardContent>
        <Select value={state.metro ?? ''} onValueChange={(v) => setState(s => ({ ...s, metro: v }))}>
          <SelectTrigger><SelectValue placeholder="Select a metro area" /></SelectTrigger>
          <SelectContent>
            {MOCK_METROS.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

function DemoDetails({ state, setState }: { state: DemoState; setState: React.Dispatch<React.SetStateAction<DemoState>> }) {
  const handleNameChange = (v: string) => {
    setState(s => ({
      ...s,
      orgName: v,
      orgSlug: v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40),
    }));
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Details</CardTitle>
        <CardDescription>These will appear throughout your CROS workspace.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Organization Name</Label>
          <Input value={state.orgName} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Bridge Community" />
        </div>
        <div className="space-y-2">
          <Label>URL Slug</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">thecros.app/</span>
            <Input value={state.orgSlug} onChange={(e) => setState(s => ({ ...s, orgSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} placeholder="bridge-community" />
          </div>
        </div>
        <div className="pt-4 border-t">
          <span className="text-sm font-medium">Features included with CROS Core</span>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {['voluntarium', 'provisio', 'signum'].map(k => <Badge key={k} variant="outline" className="text-xs capitalize">{k}</Badge>)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DemoKnowledge() {
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
          <BookOpen className="h-7 w-7 text-primary" />
        </div>
        <CardTitle style={{ fontFamily: "'Playfair Display', serif" }}>Teach NRI about your organization</CardTitle>
        <CardDescription className="max-w-md mx-auto">Upload a PDF — your annual report, mission statement, or team guide — and NRI will learn your language, programs, and people.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="p-3 rounded-lg bg-muted/50 text-center"><Upload className="h-5 w-5 mx-auto text-primary mb-1.5" /><div className="font-medium text-foreground">Upload a PDF</div><div className="text-xs text-muted-foreground mt-0.5">Annual report, handbook, or mission doc</div></div>
          <div className="p-3 rounded-lg bg-muted/50 text-center"><Sparkles className="h-5 w-5 mx-auto text-primary mb-1.5" /><div className="font-medium text-foreground">NRI learns it</div><div className="text-xs text-muted-foreground mt-0.5">Programs, language, and key facts are extracted</div></div>
          <div className="p-3 rounded-lg bg-muted/50 text-center"><FileText className="h-5 w-5 mx-auto text-primary mb-1.5" /><div className="font-medium text-foreground">Smarter guidance</div><div className="text-xs text-muted-foreground mt-0.5">Your AI assistant speaks with your voice</div></div>
        </div>
        <button type="button" className="w-full p-6 rounded-lg border-2 border-dashed border-border hover:border-primary/40 transition-colors text-center cursor-default">
          <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <div className="text-sm font-medium text-foreground">Choose a PDF to upload</div>
          <div className="text-xs text-muted-foreground mt-1">Max 5 MB · Annual reports, handbooks, or mission docs work great</div>
        </button>
        <p className="text-xs text-muted-foreground/70 text-center">This step is optional — you can always add documents later from your workspace settings.</p>
      </CardContent>
    </Card>
  );
}

function DemoConfirm({ state }: { state: DemoState }) {
  const archetypeName = ARCHETYPES.find(a => a.key === state.archetype)?.name ?? state.archetype ?? '—';
  const metroName = MOCK_METROS.find(m => m.id === state.metro)?.name ?? '—';
  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirm & Create</CardTitle>
        <CardDescription>Review your setup before creating your CROS workspace.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-muted-foreground">Organization</span><div className="font-medium">{state.orgName || 'Bridge Community'}</div></div>
          <div><span className="text-muted-foreground">URL</span><div className="font-medium">thecros.app/{state.orgSlug || 'bridge-community'}</div></div>
          <div><span className="text-muted-foreground">Archetype</span><div className="font-medium">{archetypeName}</div></div>
          <div><span className="text-muted-foreground">Plan</span><div className="font-medium">CROS Core</div></div>
          <div><span className="text-muted-foreground">Home Metro</span><div className="font-medium">{metroName}</div></div>
          <div><span className="text-muted-foreground">Civitas™</span><div className="font-medium">{state.multiCity ? 'Enabled (trial)' : 'Not enabled'}</div></div>
          <div><span className="text-muted-foreground">Privacy Mode</span><div className="font-medium">{state.hipaaSensitive ? 'Privacy-sensitive' : 'Standard'}</div></div>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Enabled Features</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {['voluntarium', 'provisio', 'signum'].map(k => <Badge key={k} variant="outline" className="text-xs capitalize">{k}</Badge>)}
          </div>
        </div>
        <Button className="w-full" disabled><Check className="h-4 w-4 mr-2" /> Create Organization</Button>
      </CardContent>
    </Card>
  );
}

function DemoGettingStarted() {
  const steps = [
    { label: 'Connect your email', done: true },
    { label: 'Connect your calendar', done: false },
    { label: 'Create your first reflection', done: false },
    { label: 'Explore your metro', done: false },
    { label: 'Invite a team member', done: false, optional: true },
  ];
  const doneCount = steps.filter(s => s.done).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle style={{ fontFamily: "'Playfair Display', serif" }}>Getting Started</CardTitle>
        <CardDescription>Your personalized checklist for getting the most from CROS.</CardDescription>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>{doneCount} of {steps.length} complete</span>
            <span>{Math.round((doneCount / steps.length) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((s, i) => (
          <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${s.done ? 'bg-primary/5 border-primary/20' : 'border-border'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${s.done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {s.done ? <Check className="h-4 w-4" /> : <span className="text-xs font-medium">{i + 1}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-sm ${s.done ? 'line-through text-muted-foreground' : 'text-foreground font-medium'}`}>{s.label}</span>
              {s.optional && <span className="text-xs text-muted-foreground ml-2">(optional)</span>}
            </div>
            {!s.done && <Button size="sm" variant="outline" className="text-xs shrink-0" disabled>Get started</Button>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Main component ───
export default function OnboardingFlowGuide() {
  const [demoStep, setDemoStep] = useState<number>(0);
  const [demoState, setDemoState] = useState<DemoState>({
    archetype: null, ministryRole: 'companion', multiCity: null,
    metro: null, orgName: '', orgSlug: '', hipaaSensitive: false,
  });
  const demoRef = useRef<HTMLDivElement>(null);

  const currentStep = DEMO_STEPS[demoStep];
  const info = DEMO_STEP_LABELS[currentStep];

  const goNext = () => { if (demoStep < DEMO_STEPS.length - 1) setDemoStep(demoStep + 1); };
  const goBack = () => { if (demoStep > 0) setDemoStep(demoStep - 1); };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Onboarding Flow Guide
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Interactive walkthrough of the CROS tenant onboarding journey
            </p>
          </div>
          <Button onClick={exportPDF} variant="outline" className="gap-2 shrink-0">
            <Download className="h-4 w-4" /> Export PDF
          </Button>
        </div>

        {/* Demo player */}
        <div ref={demoRef} className="space-y-4">
          {/* Step selector bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {DEMO_STEPS.map((s, i) => {
              const label = DEMO_STEP_LABELS[s];
              const isActive = i === demoStep;
              return (
                <button key={s} onClick={() => setDemoStep(i)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}>
                  {label.title}
                </button>
              );
            })}
          </div>

          {/* Phase + step header */}
          <div className="flex items-center gap-3 px-1">
            <Badge variant="secondary" className="text-[10px]">{info.phase}</Badge>
            <span className="text-lg font-semibold text-foreground">{info.title}</span>
            <Badge variant="outline" className="text-[10px] ml-auto">{demoStep + 1} / {DEMO_STEPS.length}</Badge>
          </div>

          {/* Demo preview container */}
          <div className="rounded-xl border-2 border-border bg-muted/20 p-4 sm:p-6 min-h-[400px] flex items-start justify-center">
            <div className="w-full max-w-2xl">
              <DemoScreen step={currentStep} state={demoState} setState={setDemoState} />
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={goBack} disabled={demoStep === 0}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <div className="flex gap-1">
              {DEMO_STEPS.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === demoStep ? 'bg-primary' : i < demoStep ? 'bg-primary/40' : 'bg-muted-foreground/20'}`} />
              ))}
            </div>
            <Button onClick={goNext} disabled={demoStep === DEMO_STEPS.length - 1}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-border/50 text-center">
          <p className="text-xs text-muted-foreground">
            CROS™ Onboarding Flow — 12 steps from signup to workspace readiness
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            This is a non-functional demo. Selections are local only and do not create real data.
          </p>
        </div>
      </div>
    </div>
  );
}
