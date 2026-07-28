/**
 * SeoBreadcrumb — Breadcrumb navigation strip for marketing pages.
 *
 * WHAT: Renders accessible breadcrumbs with structured data.
 * WHERE: Top of marketing page content (inside PublicLayout).
 * WHY: Aids crawlers + gives visitors orientation without visual clutter.
 */
import { breadcrumbSchema } from '@/lib/seo/seoConfig';

export interface Crumb {
  label: string;
  to?: string;
}

interface SeoBreadcrumbProps {
  items: Crumb[];
}

export default function SeoBreadcrumb({ items }: SeoBreadcrumbProps) {
  // Breadcrumbs removed from marketing pages — retain JSON-LD only for crawlers
  const schemaItems = items.map((c) => ({
    name: c.label,
    url: c.to ?? '',
  }));

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(schemaItems)) }}
    />
  );
}
