/**
 * NetworkDirectory — Public Communio directory.
 *
 * WHAT: Lists organizations that have opted into the Communio network.
 * WHERE: /network
 * WHY: Human-first presence discovery — no metrics, no rankings.
 */
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, MapPin, Heart } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';

const ARCHETYPE_LABELS: Record<string, string> = {
  church: 'Faith Community',
  digital_inclusion: 'Digital Inclusion',
  social_enterprise: 'Social Enterprise',
  workforce_development: 'Workforce Development',
  refugee_support: 'Refugee Support',
  education_access: 'Education Access',
  library_system: 'Library System',
};

export default function NetworkDirectory() {
  useEffect(() => {
    document.title = 'CROS Network — Community Directory';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Discover community organizations in the CROS network. A human-first directory of presence, not promotion.');
  }, []);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ['network-directory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communio_public_profiles')
        .select('id, tenant_id, org_name, archetype, presence_story, website_url, visibility')
        .in('visibility', ['public', 'network'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-20 space-y-10">
      <SeoHead title="Communio Network Directory — Organizations on CROS™" description="A public directory of mission-driven organizations sharing their presence through the Communio network." canonical="/network" />
      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Heart className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">The CROS Network</h1>
        <p className="text-muted-foreground max-w-xl mx-auto font-serif leading-relaxed">
          Organizations sharing their presence with the community.
          No rankings. No metrics. Just human connection.
        </p>
      </div>

      {/* Directory */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">Loading directory…</p>
        </div>
      ) : profiles && profiles.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {profiles.map(p => (
            <Card key={p.id} className="rounded-xl hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold">{p.org_name}</h3>
                  {p.archetype && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {ARCHETYPE_LABELS[p.archetype] || p.archetype}
                    </Badge>
                  )}
                </div>
                {p.presence_story && (
                  <p className="text-sm text-muted-foreground font-serif leading-relaxed line-clamp-3">
                    {p.presence_story}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {p.website_url && (
                    <a
                      href={p.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      <Globe className="h-3 w-3" />
                      Website
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="rounded-xl text-center py-12">
          <CardContent className="space-y-3">
            <Globe className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground font-serif">
              The directory is growing. Organizations will appear here as they share their presence.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
