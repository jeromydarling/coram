import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { archetypes, type ArchetypeKey } from '@/config/brand';
import SeoHead from '@/components/seo/SeoHead';

export default function Contact() {
  const { t } = useTranslation('marketing');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const lastSubmitRef = useRef(0);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    // Client-side rate limit (1 per 10s)
    const now = Date.now();
    if (now - lastSubmitRef.current < 10_000) {
      setError(t('contactPage.rateLimitError'));
      return;
    }

    const form = new FormData(e.currentTarget);
    const honeypot = form.get('website') as string;
    if (honeypot) return; // bot detected

    const name = (form.get('name') as string || '').trim();
    const email = (form.get('email') as string || '').trim();
    const organization = (form.get('organization') as string || '').trim();
    const archetype = form.get('archetype') as string || '';
    const message = (form.get('message') as string || '').trim();

    if (!name || !email) {
      setError(t('contactPage.nameEmailRequired'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('contactPage.invalidEmail'));
      return;
    }

    setSubmitting(true);
    lastSubmitRef.current = now;

    const { error: dbError } = await supabase.from('inbound_leads').insert({
      name,
      email,
      organization: organization || null,
      archetype: archetype || null,
      message: message || null,
      honeypot: null,
    } as any);

    setSubmitting(false);

    if (dbError) {
      setError(t('contactPage.serverError'));
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="bg-white">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-24 sm:py-32 text-center">
          <CheckCircle2 className="h-12 w-12 text-[hsl(var(--marketing-blue))] mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-[hsl(var(--marketing-navy))] mb-3">{t('contactPage.successHeading')}</h1>
          <p className="text-[hsl(var(--marketing-navy)/0.55)]">
            {t('contactPage.successBody')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <SeoHead title="Contact CROS™" description="Reach the CROS team. Ask about pastoral onboarding, archetypes, integrations, or your organization's fit." canonical="/contact" />
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <h1 className="text-3xl font-bold text-[hsl(var(--marketing-navy))] mb-3">{t('contactPage.heading')}</h1>
        <p className="text-[hsl(var(--marketing-navy)/0.55)] mb-10">
          {t('contactPage.subheading')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Honeypot — hidden from humans */}
          <div className="absolute opacity-0 pointer-events-none" aria-hidden="true">
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm text-[hsl(var(--marketing-navy)/0.7)]">{t('contactPage.nameLabel')}</Label>
            <Input id="name" name="name" required maxLength={100} className="rounded-xl border-[hsl(var(--marketing-border))]" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm text-[hsl(var(--marketing-navy)/0.7)]">{t('contactPage.emailLabel')}</Label>
            <Input id="email" name="email" type="email" required maxLength={255} className="rounded-xl border-[hsl(var(--marketing-border))]" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="organization" className="text-sm text-[hsl(var(--marketing-navy)/0.7)]">{t('contactPage.organizationLabel')}</Label>
            <Input id="organization" name="organization" maxLength={150} className="rounded-xl border-[hsl(var(--marketing-border))]" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-[hsl(var(--marketing-navy)/0.7)]">{t('contactPage.archetypeLabel')}</Label>
            <Select name="archetype">
              <SelectTrigger className="rounded-xl border-[hsl(var(--marketing-border))]">
                <SelectValue placeholder={t('contactPage.archetypePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(archetypes) as ArchetypeKey[]).map((key) => (
                  <SelectItem key={key} value={key}>{archetypes[key].name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message" className="text-sm text-[hsl(var(--marketing-navy)/0.7)]">{t('contactPage.messageLabel')}</Label>
            <Textarea id="message" name="message" rows={4} maxLength={1000} className="rounded-xl border-[hsl(var(--marketing-border))] resize-none" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] h-11"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>{t('contactPage.sendButton')} <ArrowRight className="ml-2 h-4 w-4" /></>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
