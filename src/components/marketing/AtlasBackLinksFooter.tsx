/**
 * AtlasBackLinksFooter — Satellite-app footer linking back to the Mission Atlas.
 *
 * WHAT: Fetches the Mission Atlas entries this app participates in (from the
 *       public `atlas-back-links` edge function) and renders a muted footer list
 *       of links back to the corresponding thecros.app/mission-atlas/* pages.
 * WHERE: Designed to be dropped into the footer of any CROS Federation satellite
 *        app. In thecros itself it self-mounts with appSlug="thecros" where used.
 * WHY: Closes the bidirectional SEO loop — the Atlas detail pages link out to
 *      federation apps, and each app links back to the Atlas patterns it serves.
 *
 * Satellite usage (copy this file into the satellite repo as-is):
 *
 *   import AtlasBackLinksFooter from './AtlasBackLinksFooter';
 *
 *   <AtlasBackLinksFooter appSlug="propria" />
 *
 * The component is self-contained: it renders nothing while loading, nothing on
 * error, and nothing when the app has zero linked Atlas entries — so it is always
 * safe to mount unconditionally. The default `apiUrl` points at the CROS
 * production Supabase project; override it only for staging/local testing.
 */
import { useEffect, useState } from 'react';

const DEFAULT_API_URL =
  'https://zmeawjhxbgvtcfcfcygf.supabase.co/functions/v1/atlas-back-links';

interface AtlasBackLink {
  id: string;
  archetype: string;
  metro_type: string;
  title: string;
  url: string;
}

interface AtlasBackLinksResponse {
  app_slug: string;
  atlas_entries: AtlasBackLink[];
}

interface Props {
  /** Federation app slug as registered in the atlas↔app map (e.g. "propria"). */
  appSlug: string;
  /** Override the back-links endpoint (defaults to CROS production). */
  apiUrl?: string;
}

export default function AtlasBackLinksFooter({ appSlug, apiUrl = DEFAULT_API_URL }: Props) {
  const [links, setLinks] = useState<AtlasBackLink[]>([]);

  useEffect(() => {
    let cancelled = false;
    const url = `${apiUrl}?app_slug=${encodeURIComponent(appSlug)}`;
    fetch(url, { headers: { Accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AtlasBackLinksResponse | null) => {
        if (!cancelled && data?.atlas_entries?.length) {
          setLinks(data.atlas_entries);
        }
      })
      .catch(() => {
        /* Silent — the footer is purely additive; never block the page. */
      });
    return () => {
      cancelled = true;
    };
  }, [appSlug, apiUrl]);

  if (links.length === 0) return null;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: links.map((link, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: link.title,
      item: link.url,
    })),
  };

  return (
    <nav
      aria-label="Mission Atlas back-links"
      style={{
        fontSize: '0.8125rem',
        lineHeight: 1.6,
        color: 'rgba(30, 41, 59, 0.55)',
        padding: '1.5rem 0',
      }}
    >
      <p style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
        This app participates in the Mission Atlas:
      </p>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem 1rem',
        }}
      >
        {links.map((link) => (
          <li key={link.id}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#2563eb', textDecoration: 'none' }}
            >
              {link.title}
            </a>
          </li>
        ))}
      </ul>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </nav>
  );
}
