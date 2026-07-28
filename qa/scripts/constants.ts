/**
 * Stable constants for QA smoke tests.
 * Use real public URLs instead of example.com so Firecrawl returns actual content.
 */

/** Default website URL for partner_enrich smoke tests */
export const SMOKE_WEBSITE_URL =
  process.env.SMOKE_WEBSITE_URL || "https://www.pcsforpeople.org";

/** Secondary URL for multi-URL test scenarios */
export const SMOKE_WEBSITE_URL_2 =
  process.env.SMOKE_WEBSITE_URL_2 || "https://www.unitedway.org";

/** Stable org name for smoke tests */
export const SMOKE_ORG_NAME = "PCs for People";

/** Stable org ID placeholder (UUID zero-padded) */
export const SMOKE_ORG_ID = "00000000-0000-0000-0000-000000000001";

/** Real metro_id (Chicago) for recommendations_generate */
export const SMOKE_METRO_ID = "40627106-53ab-483f-969f-18e584abab9d";
