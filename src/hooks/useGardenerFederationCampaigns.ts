/**
 * useGardenerFederationCampaigns — Hooks for the Gardener Federation email tracker (SCIENTIA).
 *
 * WHAT: Reads gardener_tracked_campaigns / _sends / _events / _signup_orphans and wraps the
 *       CSV import + send edge functions.
 * WHERE: Consumed by /operator/scientia/federation-campaigns.
 * WHY:  Keeps operator tracker data-access in one place.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TrackedCampaignRow {
  id: string;
  campaign_id: string;
  federation_app_slug: string;
  tracking_enabled: boolean;
  disclose_pixel: boolean;
  csv_import_filename: string | null;
  csv_row_count: number | null;
  created_at: string;
  updated_at: string;
  campaign?: {
    id: string;
    subject: string | null;
    status: string | null;
    from_name: string | null;
    created_at: string | null;
  } | null;
  stats?: {
    total: number;
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    signed_up: number;
    customers: number;
  };
}

export function useTrackedCampaigns(federationAppSlug: string) {
  return useQuery({
    queryKey: ['gardener-tracked-campaigns', federationAppSlug],
    queryFn: async (): Promise<TrackedCampaignRow[]> => {
      const { data, error } = await supabase
        .from('gardener_tracked_campaigns')
        .select(`
          id, campaign_id, federation_app_slug, tracking_enabled, disclose_pixel,
          csv_import_filename, csv_row_count, created_at, updated_at,
          campaign:email_campaigns!gardener_tracked_campaigns_campaign_id_fkey (
            id, subject, status, from_name, created_at
          )
        `)
        .eq('federation_app_slug', federationAppSlug)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as any[];
      // Fetch aggregate stats per tracked campaign (small N, one query each is fine)
      const withStats = await Promise.all(
        rows.map(async (r: any) => {
          const { data: sends } = await supabase
            .from('gardener_tracked_sends')
            .select('sent_at, first_opened_at, first_clicked_at, replied_at, first_signup_at, first_customer_at')
            .eq('tracked_campaign_id', r.id);
          const s = sends ?? [];
          return {
            ...r,
            stats: {
              total: s.length,
              sent: s.filter((x: any) => x.sent_at).length,
              opened: s.filter((x: any) => x.first_opened_at).length,
              clicked: s.filter((x: any) => x.first_clicked_at).length,
              replied: s.filter((x: any) => x.replied_at).length,
              signed_up: s.filter((x: any) => x.first_signup_at).length,
              customers: s.filter((x: any) => x.first_customer_at).length,
            },
          } as TrackedCampaignRow;
        }),
      );
      return withStats;
    },
    staleTime: 30_000,
  });
}

export function useTrackedSends(trackedCampaignId: string | null) {
  return useQuery({
    queryKey: ['gardener-tracked-sends', trackedCampaignId],
    queryFn: async () => {
      if (!trackedCampaignId) return [];
      const { data, error } = await supabase
        .from('gardener_tracked_sends')
        .select('*')
        .eq('tracked_campaign_id', trackedCampaignId)
        .order('sent_at', { ascending: false, nullsFirst: true })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!trackedCampaignId,
  });
}

export function useSignupOrphans(federationAppSlug: string) {
  return useQuery({
    queryKey: ['gardener-federation-signup-orphans', federationAppSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gardener_federation_signup_orphans')
        .select('*')
        .eq('federation_app_slug', federationAppSlug)
        .order('occurred_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export function useUntrackedCampaigns() {
  return useQuery({
    queryKey: ['untracked-email-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('id, subject, status, from_name, created_at, federation_app_slug')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

export function useFederationApps() {
  return useQuery({
    queryKey: ['federation-apps-active'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('federation_apps')
        .select('slug, name, domain')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

interface ImportCsvArgs {
  campaign_id: string;
  federation_app_slug: string;
  csv_base64: string;
  filename: string;
  dry_run: boolean;
  disclose_pixel: boolean;
}

export function useImportCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: ImportCsvArgs) => {
      const { data, error } = await supabase.functions.invoke('gardener-campaign-import-csv', {
        body: args,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as {
        ok: boolean;
        dry_run: boolean;
        preview: {
          rows_total: number;
          rows_valid: number;
          rows_invalid: number;
          rows_duped_in_csv: number;
          rows_duped_against_existing: number;
          sample: Array<{ email: string; name: string | null; metadata: Record<string, string> }>;
        };
        tracked_campaign_id?: string;
        inserted?: number;
      };
    },
    onSuccess: (_data, args) => {
      if (!args.dry_run) {
        qc.invalidateQueries({ queryKey: ['gardener-tracked-campaigns', args.federation_app_slug] });
      }
    },
  });
}

export function useSendTrackedCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaign_id: string) => {
      const { data, error } = await supabase.functions.invoke('gardener-campaign-send', {
        body: { campaign_id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { ok: boolean; sent: number; failed: number; errors?: string[] };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gardener-tracked-campaigns'] });
      qc.invalidateQueries({ queryKey: ['gardener-tracked-sends'] });
    },
  });
}

/** base64-encode a File in the browser (utf-8 safe). */
export async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
