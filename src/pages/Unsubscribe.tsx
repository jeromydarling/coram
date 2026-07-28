/**
 * Unsubscribe — CROS app email unsubscribe confirmation page.
 *
 * WHAT: Validates a token via handle-email-unsubscribe (GET), then confirms via POST.
 * WHERE: /unsubscribe route (linked from every app email footer).
 * WHY: RFC 8058-style one-click flow with a branded, human confirmation.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

const SUPABASE_URL = 'https://zmeawjhxbgvtcfcfcygf.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZWF3amh4Ymd2dGNmY2ZjeWdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NjUyNTgsImV4cCI6MjA4NzA0MTI1OH0.791t7RHYp8EyXfOdu2_lNI5d7fTMkB1X11XkH2cTwZY';

type State = 'checking' | 'valid' | 'already' | 'invalid' | 'done' | 'error';

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<State>('checking');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setState('invalid'); return; }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: ANON } },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) setState('invalid');
        else if (data.valid === false && data.reason === 'already_unsubscribed') setState('already');
        else if (data.valid) setState('valid');
        else setState('invalid');
      } catch {
        setState('error');
      }
    })();
  }, [token]);

  const confirm = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('handle-email-unsubscribe', {
        body: { token },
      });
      if (error) setState('error');
      else if (data?.success || data?.reason === 'already_unsubscribed') setState('done');
      else setState('error');
    } catch {
      setState('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="py-10 px-8 text-center space-y-4">
          <h1 className="font-serif text-2xl">Unsubscribe from CROS</h1>

          {state === 'checking' && (
            <p className="text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking your link…
            </p>
          )}

          {state === 'valid' && (
            <>
              <p className="text-muted-foreground">
                We're sorry to see you go. Confirm below and we'll stop sending you
                app emails from CROS. Essential account emails may still reach you.
              </p>
              <Button onClick={confirm} disabled={submitting} className="mt-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirm unsubscribe
              </Button>
            </>
          )}

          {state === 'already' && (
            <p className="text-muted-foreground flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              You're already unsubscribed. Nothing more to do.
            </p>
          )}

          {state === 'done' && (
            <p className="text-muted-foreground flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Done. You've been removed. Peace to you.
            </p>
          )}

          {state === 'invalid' && (
            <p className="text-muted-foreground flex items-center justify-center gap-2">
              <XCircle className="h-4 w-4" />
              This unsubscribe link isn't valid or has expired.
            </p>
          )}

          {state === 'error' && (
            <p className="text-muted-foreground">
              Something went wrong. Please try again in a moment, or reply to any
              CROS email and we'll take care of it.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
