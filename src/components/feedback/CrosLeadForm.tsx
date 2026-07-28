/**
 * CrosLeadForm — Universal lead-capture form for the CROS family of apps.
 *
 * WHAT: Drop-in form that POSTs to the public-leads-intake edge function
 *       with full source attribution (source_app, source_url, UTMs, referrer).
 * WHERE: Imported by every CROS-family app's marketing pages, demo CTAs,
 *        waitlist sections, and contact pages.
 * WHY: Single ingestion path for every lead across the portfolio.
 *      Operators see them all in CROS → Operator Console → Leads by App.
 *
 * Usage (inside any CROS-family app):
 *
 *   import { CrosLeadForm } from '@/components/feedback/CrosLeadForm';
 *
 *   <CrosLeadForm
 *     sourceApp="hortus"
 *     leadKind="demo"
 *     formVariant="hero"
 *     fields={['name', 'email', 'organization', 'message']}
 *     onSuccess={() => navigate('/thank-you')}
 *   />
 *
 * Apps that aren't React (or don't want this component) can use the vanilla
 * drop-in at /public/embed/cros-lead-form.js — it has the same behavior.
 */

import { useState, useMemo, useEffect, type ChangeEvent, type FormEvent } from 'react';

// ── Types ───────────────────────────────────────────────────────────────
export type CrosLeadKind = 'demo' | 'waitlist' | 'contact' | 'feedback' | 'partner' | 'beta';

export type CrosLeadField =
  | 'name'
  | 'email'
  | 'organization'
  | 'phone'
  | 'message'
  | 'interest'
  | 'archetype';

export interface CrosLeadFormProps {
  /** Slug of the app submitting the lead. Must match watchtower projects.json. */
  sourceApp: string;
  /** Kind of submission. Defaults to 'demo'. */
  leadKind?: CrosLeadKind;
  /** Optional A/B variant label. */
  formVariant?: string;
  /** Which fields to show. Defaults to ['name','email','message']. */
  fields?: CrosLeadField[];
  /** Optional app-specific extra fields (zone, garden size, parish, etc.). */
  extra?: Record<string, unknown>;
  /** Override the intake URL. Defaults to env var or production. */
  intakeUrl?: string;
  /** Optional shared secret if the deployment requires it. */
  intakeSecret?: string;
  /** Submit button label. Default: "Get a demo". */
  submitLabel?: string;
  /** Success callback. */
  onSuccess?: (result: { id: string | null; deduped: boolean }) => void;
  /** Error callback. */
  onError?: (error: Error) => void;
  /** Tailwind class overrides. */
  className?: string;
  /**
   * Email address shown in the error state as a fallback path when the
   * network/CORS request fails. The mailto: link is pre-filled with whatever
   * the user typed so we never silently lose a real lead again.
   * Default: 'Gardener@thecros.app'.
   */
  fallbackEmail?: string;
}

interface IntakeResponse {
  ok: boolean;
  data?: { id: string | null; deduped: boolean; accepted: boolean };
  error?: string;
  code?: string;
}

// ── Defaults ────────────────────────────────────────────────────────────
const DEFAULT_INTAKE_URL =
  // Vite-style env first, then a production fallback consumers can override.
  (typeof import.meta !== 'undefined' &&
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_CROS_INTAKE_URL) ||
  'https://zmeawjhxbgvtcfcfcygf.supabase.co/functions/v1/public-leads-intake';

const DEFAULT_FIELDS: CrosLeadField[] = ['name', 'email', 'message'];

const FIELD_LABELS: Record<CrosLeadField, string> = {
  name: 'Your name',
  email: 'Email',
  organization: 'Organization',
  phone: 'Phone (optional)',
  message: 'How can we help?',
  interest: 'What are you interested in?',
  archetype: 'What best describes you?',
};

const FIELD_TYPES: Record<CrosLeadField, string> = {
  name: 'text',
  email: 'email',
  organization: 'text',
  phone: 'tel',
  message: 'textarea',
  interest: 'text',
  archetype: 'text',
};

// ── Helpers ─────────────────────────────────────────────────────────────
function readUtmsFromUrl(): Record<string, string | null> {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const out: Record<string, string | null> = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
    const v = params.get(k);
    if (v) out[k] = v;
  }
  return out;
}

function readContext() {
  if (typeof window === 'undefined') return { source_url: null, source_page: null, referrer: null };
  return {
    source_url: window.location.href,
    source_page: window.location.pathname,
    referrer: document.referrer || null,
  };
}

// ── Component ───────────────────────────────────────────────────────────
export function CrosLeadForm({
  sourceApp,
  leadKind = 'demo',
  formVariant,
  fields = DEFAULT_FIELDS,
  extra,
  intakeUrl = DEFAULT_INTAKE_URL,
  intakeSecret,
  submitLabel = 'Get a demo',
  onSuccess,
  onError,
  className = '',
  fallbackEmail = 'Gardener@thecros.app',
}: CrosLeadFormProps) {
  const [values, setValues] = useState<Record<string, string>>({} as Record<string, string>);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<'idle' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const utms = useMemo(readUtmsFromUrl, []);

  // Persist UTMs across page navigations within the satellite app
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (Object.keys(utms).length > 0) {
      try {
        sessionStorage.setItem('cros_utms', JSON.stringify(utms));
      } catch {
        /* sessionStorage may be blocked */
      }
    }
  }, [utms]);

  const persistedUtms = useMemo<Record<string, string | null>>(() => {
    if (Object.keys(utms).length > 0) return utms;
    if (typeof window === 'undefined') return {};
    try {
      const raw = sessionStorage.getItem('cros_utms');
      return raw ? (JSON.parse(raw) as Record<string, string | null>) : {};
    } catch {
      return {};
    }
  }, [utms]);

  const setField = (field: string, value: string) =>
    setValues((prev: Record<string, string>) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const ctx = readContext();
    const payload = {
      // Required
      source_app: sourceApp,
      lead_kind: leadKind,
      form_variant: formVariant ?? null,
      // Core fields
      name: values.name?.trim() ?? '',
      email: values.email?.trim() ?? '',
      organization: values.organization?.trim() ?? null,
      phone: values.phone?.trim() ?? null,
      message: values.message?.trim() ?? null,
      interest: values.interest?.trim() ?? null,
      archetype: values.archetype?.trim() ?? null,
      // Honeypot — must be empty
      honeypot: values.cros_hp ?? '',
      // Context
      source_url: ctx.source_url,
      source_page: ctx.source_page,
      referrer: ctx.referrer,
      ...persistedUtms,
      extra: extra ?? {},
    };

    try {
      const res = await fetch(intakeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(intakeSecret ? { 'x-cros-intake-secret': intakeSecret } : {}),
        },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as IntakeResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Submission failed');
      }

      setDone('sent');
      onSuccess?.({
        id: json.data?.id ?? null,
        deduped: !!json.data?.deduped,
      });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Submission failed';
      // 'Failed to fetch' = network/CORS error; the request never reached us.
      // 'NetworkError when attempting to fetch resource' = same on Firefox.
      // Show the visitor a useful path forward instead of a cryptic technical string.
      const isNetworkFailure =
        rawMessage === 'Failed to fetch' ||
        rawMessage.toLowerCase().includes('network') ||
        rawMessage.toLowerCase().includes('cors');
      const friendly = isNetworkFailure
        ? "We couldn't reach our server — please try again, or email us directly using the link below."
        : rawMessage;

      // Last-resort recovery: stash the payload locally so the visitor can
      // retry on the same device without re-typing. Also gives us a forensic
      // record if the user later contacts us about the issue.
      try {
        if (typeof window !== 'undefined') {
          const stash = {
            ts: new Date().toISOString(),
            sourceApp,
            name: values.name,
            email: values.email,
            message: values.message,
            error: rawMessage,
          };
          window.localStorage.setItem(`cros_lead_failed_${sourceApp}`, JSON.stringify(stash));
        }
      } catch {
        // Storage might be disabled (private browsing, etc.) — swallow.
      }

      setDone('error');
      setErrorMessage(friendly);
      onError?.(err instanceof Error ? err : new Error(rawMessage));
    } finally {
      setSubmitting(false);
    }
  };

  if (done === 'sent') {
    return (
      <div className={`rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6 text-emerald-700 dark:text-emerald-300 ${className}`}>
        <p className="font-serif text-lg">Thank you — we'll be in touch shortly.</p>
        <p className="text-sm mt-1 opacity-80">
          Your message reached the CROS console. A real human reads every one.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`} noValidate>
      {fields.map((field) => {
        const type = FIELD_TYPES[field];
        const label = FIELD_LABELS[field];
        const required = field === 'name' || field === 'email';
        const id = `cros-lead-${field}`;
        const common = {
          id,
          name: field,
          required,
          value: values[field] ?? '',
          onChange: (
            e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
          ) => setField(field, e.target.value),
          className:
            'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50',
          placeholder: label,
        } as const;
        return (
          <div key={field} className="space-y-1.5">
            <label htmlFor={id} className="text-sm font-medium text-foreground">
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </label>
            {type === 'textarea' ? (
              <textarea {...common} rows={4} />
            ) : (
              <input type={type} {...common} />
            )}
          </div>
        );
      })}

      {/* Honeypot — visually hidden, kept off the tab order */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Don't fill this out:
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={values.cros_hp ?? ''}
            onChange={(e) => setField('cros_hp', e.target.value)}
          />
        </label>
      </div>

      {done === 'error' && errorMessage && (
        <div className="space-y-2" role="alert">
          <p className="text-sm text-destructive">{errorMessage}</p>
          {fallbackEmail && (
            <p className="text-sm text-muted-foreground">
              Or write to{' '}
              <a
                href={(() => {
                  const subject = encodeURIComponent(
                    `${sourceApp} inquiry from ${values.name || 'a visitor'}`,
                  );
                  const lines = [
                    values.name ? `Name: ${values.name}` : '',
                    values.email ? `Email: ${values.email}` : '',
                    values.organization ? `Organization: ${values.organization}` : '',
                    values.phone ? `Phone: ${values.phone}` : '',
                    values.interest ? `Interested in: ${values.interest}` : '',
                    '',
                    values.message || '',
                  ]
                    .filter(Boolean)
                    .join('\n');
                  const body = encodeURIComponent(lines);
                  return `mailto:${fallbackEmail}?subject=${subject}&body=${body}`;
                })()}
                className="underline hover:text-foreground"
              >
                {fallbackEmail}
              </a>{' '}
              — your message is saved on this device, so you won't need to re-type it.
            </p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
      >
        {submitting ? 'Sending…' : submitLabel}
      </button>

      <p className="text-xs text-muted-foreground">
        We'll only use your details to follow up. No marketing spam, ever.
      </p>
    </form>
  );
}

export default CrosLeadForm;

