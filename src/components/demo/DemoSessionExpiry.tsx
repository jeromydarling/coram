/**
 * DemoSessionExpiry — 60-minute session timer with gentle expiry dialog.
 *
 * WHAT: Countdown timer that shows a contact form when demo expires.
 * WHERE: Rendered inside DemoBanner when demo mode is active.
 * WHY: Creates urgency for March 25 traffic to convert to real conversations.
 */

import { useState, useEffect, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Clock, MessageCircle, RotateCcw, Send, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const DEMO_DURATION_MS = 60 * 60 * 1000; // 60 minutes
const WARNING_THRESHOLD_MS = 5 * 60 * 1000; // 5 min warning

export function DemoSessionExpiry() {
  const { isDemoMode, demoSession, endDemo } = useDemoMode();
  const [remainingMs, setRemainingMs] = useState<number>(DEMO_DURATION_MS);
  const [showExpiry, setShowExpiry] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [preferredTimes, setPreferredTimes] = useState('');
  const [message, setMessage] = useState('');

  // Pre-fill from demo session
  useEffect(() => {
    if (demoSession) {
      setName(demoSession.name || '');
      setEmail(demoSession.email || '');
    }
  }, [demoSession]);

  useEffect(() => {
    if (!isDemoMode || !demoSession) return;

    const startedAt = new Date(demoSession.grantedAt).getTime();

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, DEMO_DURATION_MS - elapsed);
      setRemainingMs(remaining);

      if (remaining <= 0) {
        setShowExpiry(true);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isDemoMode, demoSession]);

  const formatTime = useCallback((ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const handleSubmit = async () => {
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    setSubmitting(true);
    try {
      await supabase.functions.invoke('demo-gate-submit', {
        body: {
          name: name.trim(),
          email: email.trim(),
          location: organization.trim() || demoSession?.location || '',
          role: demoSession?.role || 'companion',
          source: 'demo_expiry_form',
          preferred_times: preferredTimes.trim(),
          message: message.trim(),
        },
      });
      setSubmitted(true);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isWarning = remainingMs <= WARNING_THRESHOLD_MS && remainingMs > 0;

  if (!isDemoMode) return null;

  return (
    <>
      {/* Inline timer for the banner */}
      <span className={`text-xs tabular-nums ${isWarning ? 'text-yellow-200 animate-pulse' : 'opacity-70'}`}>
        {formatTime(remainingMs)}
      </span>

      {/* Expiry dialog */}
      <Dialog open={showExpiry} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          {submitted ? (
            <div className="py-6 text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-primary mx-auto" />
              <DialogTitle>Thank you!</DialogTitle>
              <DialogDescription className="text-base">
                We'll be in touch soon. Looking forward to learning more about your community.
              </DialogDescription>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 mt-4"
                onClick={() => {
                  setShowExpiry(false);
                  endDemo();
                  window.location.href = '/demo';
                }}
              >
                <RotateCcw className="h-3 w-3" />
                Start a new demo
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Your demo session has ended
                </DialogTitle>
                <DialogDescription className="pt-2 leading-relaxed">
                  Thank you for exploring CROS. We'd love to hear what resonated
                  and discuss how it might serve your community.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="expiry-name" className="text-xs">Name</Label>
                    <Input
                      id="expiry-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="expiry-email" className="text-xs">Email *</Label>
                    <Input
                      id="expiry-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="expiry-org" className="text-xs">Organization</Label>
                  <Input
                    id="expiry-org"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="Your organization"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="expiry-times" className="text-xs">Preferred times to connect</Label>
                  <Input
                    id="expiry-times"
                    value={preferredTimes}
                    onChange={(e) => setPreferredTimes(e.target.value)}
                    placeholder="e.g. Tues/Thurs afternoons, mornings before 10am"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="expiry-message" className="text-xs">What resonated with you?</Label>
                  <Textarea
                    id="expiry-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what caught your attention or questions you have..."
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    size="lg"
                    className="gap-2 w-full"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    <Send className="h-4 w-4" />
                    {submitting ? 'Sending...' : 'Request a conversation'}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-muted-foreground"
                    onClick={() => {
                      setShowExpiry(false);
                      endDemo();
                      window.location.href = '/demo';
                    }}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Start a new demo instead
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
