/**
 * useSeoSatellites — Live SEO-active satellite list from the federation_apps registry.
 *
 * WHAT: Fetches active, seo_active rows from the federation_apps registry via the
 *       public /functions/v1/console-apps edge function.
 * WHERE: CivitasStudio / Studio Library "Publish to" dropdown and source_app chips.
 * WHY:  Adding a new satellite is a registry row, not a code edit. When a row flips
 *       to seo_active=true,status=active it appears here automatically.
 */
import { useEffect, useState } from 'react';

export interface SeoSatellite {
  slug: string;
  name: string;
  supabase_ref: string;
  ingest_essay_url: string;
}

// Session-scoped in-memory cache so we don't refetch on every mount.
let cache: SeoSatellite[] | null = null;
let inflight: Promise<SeoSatellite[]> | null = null;

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/console-apps?seo_active=true&status=active`;

async function fetchSatellites(): Promise<SeoSatellite[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await fetch(ENDPOINT, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    });
    if (!res.ok) throw new Error(`console-apps ${res.status}`);
    const json = await res.json();
    const rows: any[] = Array.isArray(json) ? json : (json.apps ?? json.data ?? []);
    const mapped: SeoSatellite[] = rows
      .map((r) => ({
        slug: r.slug ?? r.source_app,
        name: r.name ?? r.display_name ?? r.slug,
        supabase_ref: r.supabase_ref ?? '',
        ingest_essay_url: r.ingest_essay_url ?? '',
      }))
      .filter((r) => r.slug && r.slug !== 'thecros');
    cache = mapped;
    return mapped;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function useSeoSatellites() {
  const [satellites, setSatellites] = useState<SeoSatellite[]>(cache ?? []);
  const [loading, setLoading] = useState<boolean>(!cache);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (cache) {
      setSatellites(cache);
      setLoading(false);
      return;
    }
    fetchSatellites()
      .then((rows) => { if (!cancelled) { setSatellites(rows); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  return { satellites, loading, error };
}
