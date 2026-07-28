/**
 * CompanionOnboardingFlow — Relationship-first onboarding for free Companion accounts.
 *
 * WHAT: 4-screen guided flow: welcome → first person → first reflection → compass greeting.
 * WHERE: Shown after first login for caregiver_solo tenants.
 * WHY: Companions should begin with a person, not system configuration.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, ChevronRight, Feather, Bell, BookOpen, Compass, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { crosToast } from '@/lib/crosToast';

interface Props {
  onComplete: () => void;
}

type Screen = 'welcome' | 'first_person' | 'first_reflection' | 'compass_greeting';

const COMPANION_ARCHETYPES = ['caregiver_solo', 'caregiver_agency', 'missionary_org'];

export function CompanionOnboardingFlow({ onComplete }: Props) {
  const { tenantId, tenant } = useTenant();
  const { user } = useAuth();
  const [screen, setScreen] = useState<Screen>('welcome');
  const [personName, setPersonName] = useState('');
  const [personNote, setPersonNote] = useState('');
  const [reflectionBody, setReflectionBody] = useState('');
  const [reflectionType, setReflectionType] = useState<'note' | 'prayer' | 'reminder'>('note');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOpportunityId, setCreatedOpportunityId] = useState<string | null>(null);

  const isDeepCompanion = COMPANION_ARCHETYPES.includes(tenant?.archetype ?? '');

  const handleCreatePerson = async () => {
    if (!personName.trim() || !tenantId || !user) return;
    setIsSubmitting(true);
    try {
      // Create as a contact/opportunity (journey)
      const oppId = `COMPANION-${Date.now().toString(36).toUpperCase()}`;
      const { data, error } = await supabase
        .from('opportunities')
        .insert({
          opportunity_id: oppId,
          organization: personName.trim(),
          notes: personNote.trim() || null,
          stage: 'Discovery',
          status: 'Active',
          tenant_id: tenantId,
        })
        .select('id')
        .single();

      if (error) throw error;
      setCreatedOpportunityId(data.id);
      setScreen('first_reflection');
    } catch (err) {
      crosToast.gentle('Something didn\'t go through. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveReflection = async () => {
    if (!reflectionBody.trim() || !createdOpportunityId || !user) {
      setScreen('compass_greeting');
      return;
    }
    setIsSubmitting(true);
    try {
      await supabase
        .from('opportunity_reflections')
        .insert({
          opportunity_id: createdOpportunityId,
          author_id: user.id,
          body: reflectionBody.trim(),
          visibility: 'private',
        });
      setScreen('compass_greeting');
    } catch {
      // Non-blocking — move forward
      setScreen('compass_greeting');
    } finally {
      setIsSubmitting(false);
    }
  };

  const compassGreeting = isDeepCompanion
    ? "You're beginning a work of remembrance.\nLet's remember the people you're walking with."
    : "You've begun remembering this journey.\nI'll help you keep the thread.";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">

        {/* Screen 1: Welcome */}
        {screen === 'welcome' && (
          <Card className="border-none shadow-lg">
            <CardContent className="pt-12 pb-10 px-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Heart className="h-8 w-8 text-primary" />
              </div>
              <h1
                className="text-3xl font-bold text-foreground"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Welcome to CROS
              </h1>
              <p className="text-muted-foreground text-lg leading-relaxed">
                CROS helps you remember the people you're walking with.
              </p>
              <Button
                size="lg"
                className="gap-2 mt-4"
                onClick={() => setScreen('first_person')}
              >
                Start with one person
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Screen 2: First Person */}
        {screen === 'first_person' && (
          <Card className="border-none shadow-lg">
            <CardContent className="pt-10 pb-8 px-8 space-y-6">
              <h2
                className="text-2xl font-bold text-foreground text-center"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Who is someone you're accompanying right now?
              </h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Input
                    placeholder="Their name"
                    value={personName}
                    onChange={e => setPersonName(e.target.value)}
                    className="text-base"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    placeholder="Optional note (mentor, student, neighbor, etc.)"
                    value={personNote}
                    onChange={e => setPersonNote(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
              <Button
                className="w-full gap-2"
                disabled={!personName.trim() || isSubmitting}
                onClick={handleCreatePerson}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                Create Journey
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Screen 3: First Reflection */}
        {screen === 'first_reflection' && (
          <Card className="border-none shadow-lg">
            <CardContent className="pt-10 pb-8 px-8 space-y-6">
              <h2
                className="text-2xl font-bold text-foreground text-center"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                What happened recently with {personName}?
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'note' as const, label: 'Quick note', icon: Feather },
                  { key: 'prayer' as const, label: 'Prayer request', icon: Heart },
                  { key: 'reminder' as const, label: 'Follow-up', icon: Bell },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setReflectionType(opt.key)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs transition-colors
                      ${reflectionType === opt.key
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/30'
                      }`}
                  >
                    <opt.icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                ))}
              </div>
              <Textarea
                value={reflectionBody}
                onChange={e => setReflectionBody(e.target.value)}
                placeholder={
                  reflectionType === 'prayer'
                    ? 'What would you like to hold in prayer?'
                    : reflectionType === 'reminder'
                    ? 'What do you want to follow up on?'
                    : 'What have you noticed, learned, or felt?'
                }
                className="min-h-[100px] text-sm"
              />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setScreen('compass_greeting')}
                  className="flex-1"
                >
                  Skip for now
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={isSubmitting}
                  onClick={handleSaveReflection}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Feather className="h-4 w-4" />}
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Screen 4: Compass Greeting */}
        {screen === 'compass_greeting' && (
          <Card className="border-none shadow-lg">
            <CardContent className="pt-12 pb-10 px-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Compass className="h-8 w-8 text-primary" />
              </div>
              <p
                className="text-lg text-foreground leading-relaxed whitespace-pre-line"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {compassGreeting}
              </p>
              <Button
                size="lg"
                onClick={onComplete}
                className="mt-4"
              >
                Begin
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
