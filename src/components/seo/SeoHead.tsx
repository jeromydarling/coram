/**
 * SeoHead — Declarative document-head manager for marketing pages.
 *
 * WHAT: Sets <title>, meta tags, canonical, and injects JSON-LD.
 * WHERE: Rendered at the top of every marketing page component.
 * WHY: Keeps SEO concerns out of page JSX; single source of truth.
 */
import React, { useEffect } from 'react';
import { buildMeta, type SeoMeta } from '@/lib/seo/seoConfig';

interface SeoHeadProps extends SeoMeta {
  /** Optional JSON-LD schema object(s) to inject. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SeoHead = React.forwardRef<HTMLElement, SeoHeadProps>(function SeoHead({ jsonLd, ...meta }, _ref) {
  const m = buildMeta(meta);

  useEffect(() => {
    // Title
    document.title = m.title;

    // Helper to set/create meta tags
    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('name', 'description', m.description);
    if (m.keywords) setMeta('name', 'keywords', m.keywords);
    setMeta('property', 'og:title', m.ogTitle);
    setMeta('property', 'og:description', m.ogDescription);
    setMeta('property', 'og:image', m.ogImage);
    setMeta('property', 'og:type', m.ogType);
    if (m.canonical) setMeta('property', 'og:url', m.canonical);
    setMeta('name', 'twitter:title', m.ogTitle);
    setMeta('name', 'twitter:description', m.ogDescription);
    setMeta('name', 'twitter:image', m.ogImage);

    // Canonical
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (m.canonical) {
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', m.canonical);
    } else {
      link?.remove();
    }

    // JSON-LD
    const ids: string[] = [];
    const schemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
    schemas.forEach((schema, i) => {
      const id = `seo-jsonld-${i}`;
      ids.push(id);
      let script = document.getElementById(id) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = id;
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(schema);
    });

    return () => {
      ids.forEach((id) => document.getElementById(id)?.remove());
    };
  }, [m.title, m.description, m.keywords, m.ogTitle, m.ogDescription, m.ogImage, m.ogType, m.canonical, jsonLd]);

  return null;
});

export default SeoHead;
