/**
 * DemoGatePage — Public demo access gate with lead capture.
 *
 * WHAT: Name/email/location form that grants demo access and captures leads for Gardener pipeline.
 * WHERE: /demo (public, no auth required).
 * WHY: Allows prospects to experience CROS while creating trackable leads.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Eye, Users, Compass, Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useDemoMode, type DemoSession } from '@/contexts/DemoModeContext';
import type { LensRole } from '@/lib/ministryRole';
import { brand } from '@/config/brand';

const ROLE_OPTIONS: { value: LensRole; label: string; description: string; icon: typeof Eye }[] = [
  { value: 'steward', label: 'Steward', description: 'Workspace caretaker — full administrative view', icon: Eye },
  { value: 'shepherd', label: 'Shepherd', description: 'Leadership lens — vision, planning, oversight', icon: Compass },
  { value: 'companion', label: 'Companion', description: 'Daily relationship building & care work', icon: Heart },
  { value: 'visitor', label: 'Visitor', description: 'Field volunteer — simplified, mobile-first experience', icon: Users },
];

export default function DemoGatePage() {
  const navigate = useNavigate();
  const { startDemo } = useDemoMode();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [role, setRole] = useState<LensRole>('steward');
  const [submitting, setSubmitting] = useState(false);

  const isValid = name.trim().length > 0 && email.includes('@') && location.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || submitting) return;

    setSubmitting(true);

    try {
      // Fire-and-forget lead capture — don't block demo access on it
      supabase.functions.invoke('demo-gate-submit', {
        body: {
          name: name.trim(),
          email: email.trim(),
          location: location.trim(),
          role_selected: role,
        },
      }).catch(() => { /* silent — demo access still proceeds */ });

      const session: DemoSession = {
        name: name.trim(),
        email: email.trim(),
        location: location.trim(),
        role,
        grantedAt: new Date().toISOString(),
      };

      startDemo(session);
      toast.success(`Welcome, ${name.split(' ')[0]}!`, {
        description: `Entering as ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      });

      // Navigate into demo tenant
      navigate(`/community-tech-alliance`, { replace: true });
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Experience {brand.appName}
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed max-w-md mx-auto">
            Explore a living relationship system — with real data, real workflows, nothing hidden. 
            No account needed.
          </p>
        </div>

        <Card className="border-border/60 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Start Your Demo</CardTitle>
            <CardDescription>
              Tell us a bit about yourself and choose your experience lens.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="demo-name">Your Name</Label>
                <Input
                  id="demo-name"
                  placeholder="Maria Torres"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  maxLength={100}
                  autoComplete="name"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="demo-email">Email</Label>
                <Input
                  id="demo-email"
                  type="email"
                  placeholder="maria@community.org"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  maxLength={255}
                  autoComplete="email"
                />
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="demo-location">City or Region</Label>
                <Input
                  id="demo-location"
                  placeholder="Denver, CO"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  required
                  maxLength={100}
                  autoComplete="address-level2"
                />
              </div>

              {/* Role Selector */}
              <div className="space-y-3">
                <Label>Choose Your Lens</Label>
                <RadioGroup value={role} onValueChange={v => setRole(v as LensRole)} className="space-y-2">
                  {ROLE_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <label
                        key={opt.value}
                        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors
                          ${role === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                      >
                        <RadioGroupItem value={opt.value} className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-primary/70" />
                            <span className="font-medium text-sm">{opt.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </RadioGroup>
              </div>

              {/* Submit */}
              <Button type="submit" className="w-full" size="lg" disabled={!isValid || submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Preparing demo…
                  </>
                ) : (
                  'Enter Demo'
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                This is a read-only experience with sample data. No account is created.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
