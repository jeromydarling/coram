/**
 * PublicEventPage — Public RSVP page for events.
 *
 * WHAT: Renders event details and a registration form at /events/:publicSlug.
 * WHERE: Public marketing route, no auth required.
 * WHY: Allows community members to RSVP and automatically join the tenant's People.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Heart, CheckCircle, DollarSign, Users, Clock } from 'lucide-react';
import { format } from 'date-fns';
import SeoHead from '@/components/seo/SeoHead';

interface RegistrationField {
  id: string;
  label: string;
  field_type: string;
  options: unknown;
  sort_order: number;
}

export default function PublicEventPage() {
  const { publicSlug } = useParams<{ publicSlug: string }>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  // Fetch event with tenant branding
  const { data: event, isLoading: eventLoading, error: eventError } = useQuery({
    queryKey: ['public-event', publicSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, event_name, event_date, end_date, description, city, location, metro_id, tenant_id, event_type, slug, is_paid, price_cents, cover_image_url, capacity, host_organization')
        .eq('slug', publicSlug)
        .is('deleted_at', null)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!publicSlug,
  });

  // Fetch tenant branding
  const { data: tenant } = useQuery({
    queryKey: ['public-event-tenant', event?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('name, slug, logo_url, brand_color')
        .eq('id', event!.tenant_id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!event?.tenant_id,
  });

  // Fetch registration count for capacity display
  const { data: regCount } = useQuery({
    queryKey: ['public-event-reg-count', event?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('event_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event!.id);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!event?.id && !!event?.capacity,
  });

  const { data: fields } = useQuery({
    queryKey: ['event-reg-fields', event?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_registration_fields')
        .select('id, label, field_type, options, sort_order')
        .eq('event_id', event!.id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as RegistrationField[];
    },
    enabled: !!event?.id,
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('event-register', {
        body: {
          event_id: event!.id,
          guest_name: name.trim(),
          guest_email: email.trim(),
          guest_phone: phone.trim() || null,
          answers,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSubmitted(true);
      if (data?.checkout_url) {
        setSubmitMessage("Redirecting to secure payment…");
        window.location.href = data.checkout_url;
      } else {
        setSubmitMessage(data?.message || "You're registered. We look forward to seeing you.");
      }
    },
  });

  useEffect(() => {
    if (event?.event_name) {
      document.title = `${event.event_name} — RSVP`;
    }
  }, [event?.event_name]);

  // Dynamic accent color from tenant branding
  const accentColor = tenant?.brand_color || 'hsl(var(--primary))';
  const isFull = event?.capacity && regCount !== undefined ? regCount >= event.capacity : false;

  if (eventLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (eventError || !event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border-muted">
          <CardContent className="pt-8 text-center space-y-3">
            <p className="text-muted-foreground font-serif text-lg">This event could not be found.</p>
            <p className="text-sm text-muted-foreground">It may have passed or the link may be incorrect.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const eventDate = event.event_date ? new Date(event.event_date) : null;
  const endDate = event.end_date ? new Date(event.end_date) : null;

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border-muted">
          <CardContent className="pt-8 text-center space-y-4">
            <CheckCircle className="h-12 w-12 mx-auto" style={{ color: accentColor }} />
            <h2 className="font-serif text-2xl text-foreground">{submitMessage}</h2>
            <p className="text-sm text-muted-foreground">
              We've noted your interest. You'll hear from us soon.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SeoHead title={`${event.event_name} — RSVP`} description={event.description?.slice(0, 155) || `RSVP for ${event.event_name}.`} />
      {/* Cover Image */}
      {event.cover_image_url && (
        <div className="w-full max-h-[320px] overflow-hidden">
          <img
            src={event.cover_image_url}
            alt={event.event_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-12 space-y-8">
        {/* Tenant branding header */}
        {tenant && (
          <div className="flex items-center gap-3">
            {tenant.logo_url && (
              <img
                src={tenant.logo_url}
                alt={tenant.name}
                className="h-10 w-10 rounded-full object-cover border border-border"
              />
            )}
            <span className="text-sm text-muted-foreground font-medium">{tenant.name}</span>
          </div>
        )}

        {/* Event header */}
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">You're invited</p>
          <h1 className="font-serif text-3xl md:text-4xl text-foreground leading-tight">
            {event.event_name}
          </h1>

          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {eventDate && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {format(eventDate, 'EEEE, MMMM d, yyyy')}
                {endDate && ` – ${format(endDate, 'MMMM d, yyyy')}`}
              </span>
            )}
            {(event.location || event.city) && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {event.location || event.city}
              </span>
            )}
            {event.host_organization && (
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Hosted by {event.host_organization}
              </span>
            )}
            {event.is_paid && event.price_cents && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                ${(event.price_cents / 100).toFixed(2)}
              </Badge>
            )}
            {event.capacity && (
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {isFull ? (
                  <span className="text-destructive font-medium">Full</span>
                ) : (
                  `${event.capacity - (regCount ?? 0)} spots remaining`
                )}
              </span>
            )}
          </div>

          {event.description && (
            <p className="text-muted-foreground leading-relaxed pt-2 whitespace-pre-line">{event.description}</p>
          )}
        </div>

        {/* Registration form */}
        {isFull ? (
          <Card className="border-muted">
            <CardContent className="pt-8 text-center space-y-3">
              <Users className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="font-serif text-lg text-foreground">This event is full.</p>
              <p className="text-sm text-muted-foreground">
                Thank you for your interest. Please check back for future events.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-muted">
            <CardHeader className="pb-4">
              <CardTitle className="font-serif text-xl">Register</CardTitle>
              <p className="text-sm text-muted-foreground">
                {event.is_paid && event.price_cents
                  ? `Registration is $${(event.price_cents / 100).toFixed(2)}. You'll complete payment securely after registering.`
                  : "You're welcome here."}
              </p>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  registerMutation.mutate();
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="reg-name">Name *</Label>
                  <Input
                    id="reg-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email *</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    maxLength={255}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-phone">Phone <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="reg-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    maxLength={30}
                  />
                </div>

                {/* Custom fields */}
                {fields?.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={`field-${field.id}`}>{field.label}</Label>
                    {field.field_type === 'text' && (
                      <Input
                        id={`field-${field.id}`}
                        value={answers[field.id] || ''}
                        onChange={(e) => setAnswers((a) => ({ ...a, [field.id]: e.target.value }))}
                        maxLength={500}
                      />
                    )}
                    {field.field_type === 'select' && (
                      <select
                        id={`field-${field.id}`}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={answers[field.id] || ''}
                        onChange={(e) => setAnswers((a) => ({ ...a, [field.id]: e.target.value }))}
                      >
                        <option value="">Select…</option>
                        {Array.isArray(field.options)
                          ? (field.options as string[]).map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))
                          : null}
                      </select>
                    )}
                    {field.field_type === 'checkbox' && (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={answers[field.id] === 'true'}
                          onChange={(e) =>
                            setAnswers((a) => ({ ...a, [field.id]: e.target.checked ? 'true' : 'false' }))
                          }
                          className="rounded"
                        />
                        {field.label}
                      </label>
                    )}
                    {field.field_type === 'note' && (
                      <textarea
                        id={`field-${field.id}`}
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={answers[field.id] || ''}
                        onChange={(e) => setAnswers((a) => ({ ...a, [field.id]: e.target.value }))}
                        maxLength={1000}
                      />
                    )}
                  </div>
                ))}

                {registerMutation.isError && (
                  <p className="text-sm text-destructive">
                    Something went wrong. Please try again.
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerMutation.isPending || !name.trim() || !email.trim()}
                  style={tenant?.brand_color ? { backgroundColor: tenant.brand_color } : undefined}
                >
                  {registerMutation.isPending ? 'Registering…' : (
                    <span className="flex items-center gap-2">
                      {event.is_paid ? <DollarSign className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
                      {event.is_paid && event.price_cents
                        ? `Register · $${(event.price_cents / 100).toFixed(2)}`
                        : 'Register'}
                    </span>
                  )}
                </Button>

                {event.is_paid && (
                  <p className="text-xs text-muted-foreground text-center italic">
                    Payment is handled securely through Stripe. Your organization receives funds directly.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Your information is kept private and will only be used to welcome you.
        </p>
      </div>
    </div>
  );
}
