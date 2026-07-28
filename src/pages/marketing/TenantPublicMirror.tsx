/**
 * TenantPublicMirror — Optional public profile page for CROS™ tenants.
 *
 * WHAT: Displays an organization's public presence — archetype, calling, metro, narrative themes.
 * WHERE: /public/:tenantSlug
 * WHY: Creates organic backlink network and establishes community presence.
 */
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Users, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { untypedTable } from '@/lib/untypedTable';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import { articleSchema, breadcrumbSchema } from '@/lib/seo/seoConfig';
import { archetypes, type ArchetypeKey } from '@/config/brand';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

export default function TenantPublicMirror() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['tenant-public-mirror', tenantSlug],
    enabled: !!tenantSlug,
    queryFn: async () => {
      // Fetch tenant basic info
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, slug, archetype')
        .eq('slug', tenantSlug!)
        .maybeSingle();
      if (error || !data) return null;

      // Check if public profile is enabled
      // TEMP TYPE ESCAPE — tenant_settings EAV pattern (setting_key/setting_value) not in types.ts
      const { data: settings } = await untypedTable('tenant_settings')
        .select('setting_value')
        .eq('tenant_id', data.id)
        .eq('setting_key', 'public_profile_enabled')
        .maybeSingle();

      const enabled = settings?.setting_value === 'true' || settings?.setting_value === true;
      if (!enabled) return null;

      return {
        name: data.name as string,
        slug: data.slug as string,
        archetype: (data.archetype as ArchetypeKey) ?? null,
        metroName: null as string | null,
      };
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="max-w-[720px] mx-auto px-4 py-20 text-center">
        <p className="text-sm text-[hsl(var(--marketing-navy)/0.4)]">Loading…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-[720px] mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold text-[hsl(var(--marketing-navy))] mb-3" style={serif}>
          Profile not available
        </h1>
        <p className="text-sm text-[hsl(var(--marketing-navy)/0.5)]">
          This organization has not enabled a public profile.
        </p>
      </div>
    );
  }

  const arch = profile.archetype ? archetypes[profile.archetype] : null;
  const crumbs = [
    { label: 'Home', to: '/' },
    { label: 'Network', to: '/roles' },
    { label: profile.name },
  ];

  return (
    <>
      <SeoHead
        title={`${profile.name} — CROS\u2122 Network`}
        description={`${profile.name} serves their community through CROS\u2122${arch ? ` as a ${arch.name}` : ''}.`}
        canonical={`/public/${profile.slug}`}
        jsonLd={[
          articleSchema({
            headline: `${profile.name} on CROS\u2122`,
            description: `${profile.name} serves their community through the CROS\u2122 network.`,
            url: `/public/${profile.slug}`,
          }),
          breadcrumbSchema(crumbs.map(c => ({ name: c.label, url: c.to ?? '' }))),
        ]}
      />
      <SeoBreadcrumb items={crumbs} />

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 pb-20">
        <section className="pt-10 pb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-[hsl(var(--marketing-surface))] rounded-full px-4 py-1.5 mb-4">
            <Users className="h-3.5 w-3.5 text-[hsl(var(--marketing-navy)/0.4)]" />
            <span className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)]">
              Community Member
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[hsl(var(--marketing-navy))] mb-4" style={serif}>
            {profile.name}
          </h1>
        </section>

        <div className="space-y-4">
          {/* Archetype */}
          {arch && (
            <div className="rounded-2xl bg-[hsl(var(--marketing-surface))] p-6">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-[hsl(var(--marketing-navy)/0.4)]" />
                <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)]">
                  Mission archetype
                </p>
              </div>
              <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-1" style={serif}>
                {arch.name}
              </h2>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)]">{arch.tagline}</p>
            </div>
          )}

          {/* Metro */}
          {profile.metroName && (
            <div className="rounded-2xl bg-[hsl(var(--marketing-surface))] p-6">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-[hsl(var(--marketing-navy)/0.4)]" />
                <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)]">
                  Metro presence
                </p>
              </div>
              <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))]" style={serif}>
                {profile.metroName}
              </h2>
            </div>
          )}

          {/* Narrative note */}
          <div className="rounded-2xl bg-[hsl(var(--marketing-surface))] p-6">
            <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed italic" style={serif}>
              This organization is part of the CROS&#8482; network — a community of missions
              working to remember, notice, and serve people well.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
