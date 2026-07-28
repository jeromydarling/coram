/**
 * Generic importer interface for CRM exit ramp.
 * Connectors plug in by implementing this interface.
 *
 * Current implementations:
 * - GenericCSVImporter (built-in)
 * - HubSpotCSVImporter (preset column mappings)
 *
 * Future (API-based, NOT built yet):
 * - SalesforceImporter
 * - ZohoImporter
 * - PipedriveImporter
 */

export interface ImporterConfig {
  sourceSystem: string;
  importType: string;
}

export interface ImportPreviewRow {
  action: 'create' | 'update' | 'skip';
  data: Record<string, unknown>;
  reason?: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface Importer {
  /** Detect if this importer can handle the given data */
  detect(headers: string[], sourceSystem: string): boolean;

  /** Auto-map columns to target fields */
  map(headers: string[]): Record<string, string>;

  /** Preview first N rows */
  preview(
    data: Record<string, string>[],
    mapping: Record<string, string>,
    limit?: number
  ): ImportPreviewRow[];

  /** Execute the import */
  import(
    data: Record<string, string>[],
    mapping: Record<string, string>
  ): Promise<ImportResult>;
}

/**
 * Generic CSV importer — works with any CSV.
 * Column mapping is manual (or auto-guessed by name).
 */
export class GenericCSVImporter implements Importer {
  detect(headers: string[], sourceSystem: string): boolean {
    return sourceSystem === 'generic_csv' || headers.length > 0;
  }

  map(headers: string[]): Record<string, string> {
    // No auto-mapping for generic — return empty
    return {};
  }

  preview(
    data: Record<string, string>[],
    mapping: Record<string, string>,
    limit = 20
  ): ImportPreviewRow[] {
    return data.slice(0, limit).map(row => {
      const mapped: Record<string, unknown> = {};
      for (const [src, tgt] of Object.entries(mapping)) {
        if (tgt && row[src]) mapped[tgt] = row[src];
      }
      return { action: 'create' as const, data: mapped };
    });
  }

  async import(
    data: Record<string, string>[],
    mapping: Record<string, string>
  ): Promise<ImportResult> {
    // Placeholder — actual import logic lives in ImportCenter page
    return { created: 0, updated: 0, skipped: data.length, errors: [] };
  }
}

/**
 * HubSpot CSV export preset.
 * Auto-maps common HubSpot export column names.
 */
export class HubSpotCSVImporter extends GenericCSVImporter {
  private readonly HUBSPOT_MAP: Record<string, string> = {
    'Company name': 'organization',
    'Company Name': 'organization',
    'Website URL': 'website_url',
    'Company Domain Name': 'website_url',
    'Industry': 'sector',
    'City': 'city',
    'State/Region': 'state',
    'First Name': 'first_name',
    'Last Name': 'last_name',
    'Email': 'email',
    'Phone Number': 'phone',
    'Job Title': 'title',
    'Notes': 'notes',
  };

  detect(headers: string[], sourceSystem: string): boolean {
    if (sourceSystem === 'hubspot_export') return true;
    // Auto-detect by checking for HubSpot-specific columns
    const hubspotCols = ['Company name', 'Company Domain Name', 'Record ID'];
    return hubspotCols.some(c => headers.includes(c));
  }

  map(headers: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const h of headers) {
      if (this.HUBSPOT_MAP[h]) {
        result[h] = this.HUBSPOT_MAP[h];
      }
    }
    return result;
  }
}
