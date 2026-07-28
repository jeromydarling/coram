/**
 * Integration Audit PDF Report Generator
 *
 * WHAT: Generates a comprehensive PDF documenting all CROS™ connectors, their
 *       confidence levels, giving support status, and architectural notes.
 * WHERE: Downloadable from operator console or reports section.
 * WHY: Enables external review (e.g. by Claude AI) of integration architecture.
 */

import jsPDF from 'jspdf';
import { brand } from '@/config/brand';
import { STUB_ADAPTERS } from '@/integrations/connectors/stubAdapters';

const PAGE_WIDTH = 210;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// ─── Connector registry data ──────────────────────────────────

interface ConnectorEntry {
  key: string;
  displayName: string;
  category: 'donor_crm' | 'general_crm' | 'chms' | 'wordpress' | 'outbound';
  confidenceRung: number; // 1-6 per Integration Confidence Ladder
  hasGivingAdapter: boolean;
  givingApiType: string | null;  // 'REST' | 'XML' | 'CSV-only' | null
  authMethod: string;
  paginationType: string | null;
  dateFormat: string | null;
  notes: string[];
}

const CONNECTORS: ConnectorEntry[] = [
  // ── Tier 1 Donor CRMs (full giving adapters) ──
  {
    key: 'bloomerang', displayName: 'Bloomerang', category: 'donor_crm',
    confidenceRung: 2, hasGivingAdapter: true, givingApiType: 'REST',
    authMethod: 'Bearer token (private API key)',
    paginationType: 'Offset (skip/take, max 50)',
    dateFormat: 'YYYY-MM-DD (ISO)',
    notes: [
      'Largest US nonprofit CRM share',
      'Transaction types: Donation, RecurringDonationPayment',
      'Note fallback chain: FundName → CampaignName → AppealName → Note',
      'OAuth 2.0 available for third-party integrations',
    ],
  },
  {
    key: 'neoncrm', displayName: 'NeonCRM', category: 'donor_crm',
    confidenceRung: 2, hasGivingAdapter: true, givingApiType: 'REST',
    authMethod: 'HTTP Basic Auth (OrgID:APIKey)',
    paginationType: 'Page-based (currentPage/totalPages, default 50)',
    dateFormat: 'YYYY-MM-DD (ISO)',
    notes: [
      'v2 API (v2.11, Oct 2025) — actively maintained',
      'Filter: donationStatus = SUCCEED or Settled',
      'v2.11 renamed donorNote → publicRecognitionName',
      'Dedicated integration user recommended: "CROS Integration"',
    ],
  },
  {
    key: 'donorperfect', displayName: 'DonorPerfect', category: 'donor_crm',
    confidenceRung: 2, hasGivingAdapter: true, givingApiType: 'XML',
    authMethod: 'API key (query parameter)',
    paginationType: 'None — date-window chunking (max 500/call)',
    dateFormat: 'MM/DD/YYYY (must convert to ISO)',
    notes: [
      'Legacy XML API (xmlrequest.asp) — no REST',
      'API key not self-service — org must request from DP support',
      'Frequency codes: M/A/Q/W/S/B',
      'Record types: D=donation, G=pledge payment',
      'If 500 records returned in window, assume truncation',
    ],
  },
  {
    key: 'lgl', displayName: 'Little Green Light', category: 'donor_crm',
    confidenceRung: 2, hasGivingAdapter: true, givingApiType: 'REST',
    authMethod: 'Bearer token or HTTP Basic (token:blank)',
    paginationType: 'Offset/limit (default 25)',
    dateFormat: 'YYYY-MM-DD (ISO)',
    notes: [
      'Small-shop nonprofits — REST API, gift endpoint',
      'amount field returned as string — must cast to Number()',
      'Rate limit: 300 calls per 5-minute window',
      'API access requires paid plan; trial users must contact support',
    ],
  },

  // ── Tier 1 General CRM (existing full adapter) ──
  {
    key: 'salesforce', displayName: 'Salesforce', category: 'general_crm',
    confidenceRung: 4, hasGivingAdapter: false, givingApiType: null,
    authMethod: 'OAuth 2.0',
    paginationType: 'Cursor-based',
    dateFormat: 'ISO 8601',
    notes: [
      'Full adapter: Account, Contact, Task, Event, Activity',
      'Outbound adapter available (bi-directional)',
      'Giving: would map Opportunities with RecordType=Donation — not yet implemented',
    ],
  },
  {
    key: 'civicrm', displayName: 'CiviCRM', category: 'donor_crm',
    confidenceRung: 4, hasGivingAdapter: true, givingApiType: 'REST',
    authMethod: 'APIv4 key + site key',
    paginationType: 'Offset/limit',
    dateFormat: 'ISO 8601',
    notes: [
      'Full adapter: Account, Contact, Activity, Contributions (giving)',
      '11K+ nonprofits, open-source — Tier 1 giving connector',
      'Contribution entity maps to GenerosityRecord via normalizeGiving()',
      'Hosting-aware onboarding (WordPress, Drupal, Joomla, Backdrop)',
      'frequency_unit values: month, year, week, day',
      'Filter: contribution_status_id:label = Completed',
    ],
  },

  // ── Outbound (bi-directional) ──
  {
    key: 'dynamics365', displayName: 'Microsoft Dynamics 365', category: 'outbound',
    confidenceRung: 4, hasGivingAdapter: false, givingApiType: null,
    authMethod: 'OAuth 2.0 (Azure AD)',
    paginationType: 'OData $skip/$top',
    dateFormat: 'ISO 8601',
    notes: ['Full adapter + outbound sync', 'Bi-directional supported'],
  },
  {
    key: 'blackbaud', displayName: 'Blackbaud RE NXT', category: 'outbound',
    confidenceRung: 4, hasGivingAdapter: false, givingApiType: null,
    authMethod: 'OAuth 2.0 (SKY API)',
    paginationType: 'Cursor-based',
    dateFormat: 'ISO 8601',
    notes: ['Outbound adapter available', 'Bi-directional sync'],
  },
  {
    key: 'hubspot', displayName: 'HubSpot', category: 'outbound',
    confidenceRung: 2, hasGivingAdapter: false, givingApiType: null,
    authMethod: 'OAuth 2.0 or API key',
    paginationType: 'Cursor-based',
    dateFormat: 'Unix timestamp (ms)',
    notes: ['CSV importer + outbound adapter', 'Giving: not applicable (sales CRM)'],
  },

  // ── WordPress CRMs ──
  {
    key: 'fluentcrm', displayName: 'FluentCRM', category: 'wordpress',
    confidenceRung: 2, hasGivingAdapter: false, givingApiType: null,
    authMethod: 'WordPress REST + Application Password',
    paginationType: 'Page-based',
    dateFormat: 'ISO 8601',
    notes: ['Full adapter: Contact, Tag, List', 'WordPress plugin — self-hosted only'],
  },
  {
    key: 'jetpackcrm', displayName: 'Jetpack CRM', category: 'wordpress',
    confidenceRung: 2, hasGivingAdapter: false, givingApiType: null,
    authMethod: 'WordPress REST + Application Password',
    paginationType: 'Page-based',
    dateFormat: 'ISO 8601',
    notes: ['Full adapter', 'WordPress plugin'],
  },
  {
    key: 'wperp', displayName: 'WP ERP', category: 'wordpress',
    confidenceRung: 2, hasGivingAdapter: false, givingApiType: null,
    authMethod: 'WordPress REST + Application Password',
    paginationType: 'Page-based',
    dateFormat: 'ISO 8601',
    notes: ['Full adapter', 'WordPress plugin'],
  },
  {
    key: 'airtable', displayName: 'Airtable', category: 'general_crm',
    confidenceRung: 2, hasGivingAdapter: false, givingApiType: null,
    authMethod: 'Personal access token',
    paginationType: 'Cursor-based',
    dateFormat: 'ISO 8601',
    notes: ['Full adapter', 'Flexible schema — field mapping varies per base'],
  },

  // ── ChMS Stubs (actual church management systems) ──
  ...[
    { key: 'parishsoft', name: 'ParishSoft' },
    { key: 'ministryplatform', name: 'MinistryPlatform' },
    { key: 'planningcenter', name: 'Planning Center' },
    { key: 'rock', name: 'Rock RMS' },
    { key: 'breeze', name: 'Breeze ChMS' },
    { key: 'fellowshipone', name: 'FellowshipOne' },
    { key: 'pushpay', name: 'Pushpay / CCB' },
    { key: 'shelbynext', name: 'ShelbyNext Membership' },
    { key: 'servantkeeper', name: 'Servant Keeper' },
  ].map(c => ({
    key: c.key, displayName: c.name, category: 'chms' as const,
    confidenceRung: 1, hasGivingAdapter: false, givingApiType: null,
    authMethod: 'Varies', paginationType: null, dateFormat: null,
    notes: ['Stub adapter — generic field guessing', 'Registry & guide only'],
  })),

  // ── Donor CRM Stubs (correctly categorized) ──
  {
    key: 'kindful', displayName: 'Kindful', category: 'donor_crm' as const,
    confidenceRung: 1, hasGivingAdapter: false, givingApiType: null,
    authMethod: 'OAuth 2.0', paginationType: null, dateFormat: null,
    notes: [
      'Now Bloomerang-acquired — donor CRM, not ChMS',
      'Stub adapter — giving adapter on roadmap',
      'contacts, transactions, campaigns, groups, pledges',
    ],
  },
  {
    key: 'virtuous', displayName: 'Virtuous CRM', category: 'donor_crm' as const,
    confidenceRung: 2, hasGivingAdapter: false, givingApiType: 'REST',
    authMethod: 'API key', paginationType: 'Offset/limit', dateFormat: 'ISO 8601',
    notes: [
      'Responsive fundraising platform — growing Catholic/pro-life adoption',
      'REST API with gifts, projects, tasks, contacts endpoints',
      'Elevated to Rung 2 planning — giving adapter on roadmap',
      'High strategic priority for CROS target market',
    ],
  },

  // ── General CRM Stubs (not ChMS) ──
  {
    key: 'zoho', displayName: 'Zoho CRM', category: 'general_crm' as const,
    confidenceRung: 1, hasGivingAdapter: false, givingApiType: null,
    authMethod: 'OAuth 2.0', paginationType: 'Page-based', dateFormat: 'ISO 8601',
    notes: ['General CRM — not a ChMS', 'Stub adapter — registry & guide only'],
  },
  {
    key: 'oracle', displayName: 'Oracle CRM', category: 'general_crm' as const,
    confidenceRung: 1, hasGivingAdapter: false, givingApiType: null,
    authMethod: 'OAuth 2.0', paginationType: 'OData $skip/$top', dateFormat: 'ISO 8601',
    notes: ['Enterprise CRM — not a ChMS', 'Stub adapter — registry & guide only'],
  },

  // ── Membership Platform Stub ──
  {
    key: 'wildapricot', displayName: 'Wild Apricot', category: 'general_crm' as const,
    confidenceRung: 1, hasGivingAdapter: false, givingApiType: null,
    authMethod: 'OAuth 2.0', paginationType: 'Page-based', dateFormat: 'ISO 8601',
    notes: ['Membership management platform (Personify) — not a ChMS or donor CRM', 'Stub adapter'],
  },
];

// ─── PDF generation ───────────────────────────────────────────

function addFooter(doc: jsPDF, pageNum: number) {
  const h = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(`CROS™ Integration Audit Report — Page ${pageNum}`, PAGE_WIDTH / 2, h - 6, { align: 'center' });
  doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), PAGE_WIDTH - MARGIN, h - 6, { align: 'right' });
}

function checkBreak(doc: jsPDF, y: number, needed: number, pageNum: { current: number }): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 18) {
    addFooter(doc, pageNum.current);
    doc.addPage();
    pageNum.current++;
    return 22;
  }
  return y;
}

export function generateIntegrationAuditPdf() {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pn = { current: 1 };
  let y = 20;

  // ── Title ──
  doc.setFontSize(22);
  doc.setTextColor(30);
  doc.text('CROS™ Integration Audit Report', MARGIN, y);
  y += 9;
  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text('Relatio™ Bridge — Connector Architecture & Generosity Support', MARGIN, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toISOString().split('T')[0]} | ${CONNECTORS.length} connectors registered`, MARGIN, y);
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text('Prepared for external architectural review', MARGIN, y);
  y += 8;
  doc.setDrawColor(200);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;

  // ── Executive Summary ──
  doc.setFontSize(14);
  doc.setTextColor(30);
  doc.text('Executive Summary', MARGIN, y);
  y += 7;

  const withGiving = CONNECTORS.filter(c => c.hasGivingAdapter);
  const fullAdapters = CONNECTORS.filter(c => c.confidenceRung >= 2);
  const biDirectional = CONNECTORS.filter(c => c.category === 'outbound');
  const stubs = CONNECTORS.filter(c => c.confidenceRung === 1);

  const summaryLines = [
    `Total registered connectors: ${CONNECTORS.length}`,
    `Full adapters (Rung 2+): ${fullAdapters.length}`,
    `Bi-directional sync (Rung 4): ${biDirectional.length}`,
    `Giving adapters (normalizeGiving): ${withGiving.length} — ${withGiving.map(c => c.displayName).join(', ')}`,
    `Stub adapters (Rung 1, registry only): ${stubs.length}`,
    `CSV importers: Generic, HubSpot, Giving (Bloomerang, NeonCRM, DonorPerfect, LGL presets)`,
  ];

  doc.setFontSize(8.5);
  doc.setTextColor(50);
  for (const line of summaryLines) {
    const wrapped = doc.splitTextToSize(`• ${line}`, CONTENT_WIDTH - 4);
    doc.text(wrapped, MARGIN + 2, y);
    y += wrapped.length * 3.8;
  }
  y += 6;

  // ── Confidence Ladder Reference ──
  y = checkBreak(doc, y, 30, pn);
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text('Integration Confidence Ladder', MARGIN, y);
  y += 6;

  const rungs = [
    'Rung 1 — Registry & Guide only (stub adapter, generic field guessing)',
    'Rung 2 — Inbound Adapter + fixture tests (field-level mapping verified)',
    'Rung 3 — Edge Function resilience (timeouts, retries, idempotency tested)',
    'Rung 4 — Runner verified + bi-directional sync (operational truth)',
    'Rung 5 — Dry-run confidence (tenant preview before import)',
    'Rung 6 — Live account verification (real vendor auth + pagination)',
  ];

  doc.setFontSize(8);
  doc.setTextColor(60);
  for (const r of rungs) {
    doc.text(r, MARGIN + 2, y);
    y += 4;
  }
  y += 6;

  // ── Generosity Architecture ──
  y = checkBreak(doc, y, 40, pn);
  doc.setDrawColor(200);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 6;
  doc.setFontSize(14);
  doc.setTextColor(30);
  doc.text('Generosity Module — Architectural Boundaries', MARGIN, y);
  y += 7;

  const archNotes = [
    'Generosity data lives in a separate domain layer from Reflections, Journeys, Drift, and Narrative.',
    'NRI Firewall: NRI must NOT prioritize people based on gift size, generate donor optimization prompts, or adjust relational signals based on financial data.',
    'Compass may answer factual queries (who gave, when, totals) but must not interpret generosity as influence.',
    'Bridge migration mode: "Retain core giving history only" — imports date, amount, recurring status; discards campaigns, pledges, wealth scores, fund accounting.',
    'ConnectorAdapter.normalizeGiving() is optional — only implemented for donor CRMs.',
    'CSV import supports giving type with auto-detection for Bloomerang, NeonCRM, DonorPerfect, and LGL export formats.',
  ];

  doc.setFontSize(8.5);
  doc.setTextColor(50);
  for (const note of archNotes) {
    y = checkBreak(doc, y, 8, pn);
    const wrapped = doc.splitTextToSize(`• ${note}`, CONTENT_WIDTH - 4);
    doc.text(wrapped, MARGIN + 2, y);
    y += wrapped.length * 3.8;
  }
  y += 6;

  // ── Connector Detail Pages ──
  y = checkBreak(doc, y, 10, pn);
  doc.setDrawColor(200);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 6;
  doc.setFontSize(14);
  doc.setTextColor(30);
  doc.text('Connector Details', MARGIN, y);
  y += 8;

  for (const c of CONNECTORS) {
    y = checkBreak(doc, y, 28, pn);

    // Connector header
    doc.setFontSize(10);
    doc.setTextColor(30);
    doc.text(c.displayName, MARGIN, y);

    // Confidence badge
    const badge = `Rung ${c.confidenceRung}`;
    const badgeX = MARGIN + doc.getTextWidth(c.displayName) + 4;
    doc.setFontSize(7);
    doc.setTextColor(c.confidenceRung >= 4 ? 30 : c.confidenceRung >= 2 ? 80 : 120);
    doc.text(`[${badge}]`, badgeX, y);

    // Giving indicator
    if (c.hasGivingAdapter) {
      doc.setTextColor(40, 120, 60);
      doc.text('[Giving]', badgeX + doc.getTextWidth(`[${badge}]`) + 3, y);
    }

    y += 4.5;

    // Metadata
    doc.setFontSize(7.5);
    doc.setTextColor(80);
    const meta = [
      `Category: ${c.category.replace('_', ' ')}`,
      `Auth: ${c.authMethod}`,
      c.paginationType ? `Pagination: ${c.paginationType}` : null,
      c.dateFormat ? `Date format: ${c.dateFormat}` : null,
      c.givingApiType ? `Giving API: ${c.givingApiType}` : null,
    ].filter(Boolean);

    for (const m of meta) {
      doc.text(m!, MARGIN + 2, y);
      y += 3.2;
    }

    // Notes
    if (c.notes.length > 0) {
      doc.setFontSize(7);
      doc.setTextColor(100);
      for (const n of c.notes) {
        y = checkBreak(doc, y, 5, pn);
        const wrapped = doc.splitTextToSize(`– ${n}`, CONTENT_WIDTH - 6);
        doc.text(wrapped, MARGIN + 4, y);
        y += wrapped.length * 3;
      }
    }

    y += 4;
  }

  // ── Cross-Connector Quick Reference ──
  y = checkBreak(doc, y, 30, pn);
  doc.setDrawColor(200);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 6;
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text('Giving — Cross-Connector Quick Reference', MARGIN, y);
  y += 7;

  // Date format table
  doc.setFontSize(8);
  doc.setTextColor(30);
  doc.text('Date Format Comparison:', MARGIN, y);
  y += 4;

  doc.setFontSize(7.5);
  doc.setTextColor(60);
  const dateTable = [
    'Bloomerang:         YYYY-MM-DD — no conversion needed',
    'NeonCRM:            YYYY-MM-DD — no conversion needed',
    'DonorPerfect:       MM/DD/YYYY — MUST convert to ISO',
    'Little Green Light: YYYY-MM-DD — no conversion needed',
  ];
  for (const row of dateTable) {
    doc.text(row, MARGIN + 2, y);
    y += 3.5;
  }
  y += 4;

  // Recurring interval table
  y = checkBreak(doc, y, 20, pn);
  doc.setFontSize(8);
  doc.setTextColor(30);
  doc.text('Recurring Interval Mapping:', MARGIN, y);
  y += 4;

  doc.setFontSize(7.5);
  doc.setTextColor(60);
  const intervalTable = [
    'monthly:       Bloomerang=Monthly,  NeonCRM=Monthly,   DP=M,  LGL=monthly',
    'annually:      Bloomerang=Yearly,   NeonCRM=Annually,  DP=A,  LGL=annually',
    'quarterly:     Bloomerang=Quarterly, NeonCRM=Quarterly, DP=Q,  LGL=quarterly',
    'weekly:        Bloomerang=Weekly,   NeonCRM=Weekly,    DP=W,  LGL=weekly',
    'semi-annually: —                    —                  DP=S   —',
    'bi-monthly:    —                    —                  DP=B   —',
  ];
  for (const row of intervalTable) {
    doc.text(row, MARGIN + 2, y);
    y += 3.5;
  }
  y += 4;

  // Pagination table
  y = checkBreak(doc, y, 20, pn);
  doc.setFontSize(8);
  doc.setTextColor(30);
  doc.text('Pagination Strategy:', MARGIN, y);
  y += 4;

  doc.setFontSize(7.5);
  doc.setTextColor(60);
  const pagTable = [
    'Bloomerang:         Offset (skip/take),  max 50,  Total in envelope',
    'NeonCRM:            Page/offset,         default 50, currentPage/totalPages',
    'DonorPerfect:       None (date windows), max 500,  annual date chunks',
    'Little Green Light: Offset/limit,        default 25, next_item for offset',
  ];
  for (const row of pagTable) {
    doc.text(row, MARGIN + 2, y);
    y += 3.5;
  }
  y += 6;

  // ── Known Gaps & Recommendations ──
  y = checkBreak(doc, y, 30, pn);
  doc.setDrawColor(200);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 6;
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text('Known Gaps & Recommendations', MARGIN, y);
  y += 7;

  const gaps = [
    'Salesforce giving: Opportunity → GenerosityRecord mapping not yet implemented. NPSP COMPLEXITY: Salesforce Nonprofit Success Pack (NPSP) uses custom objects npe01__OppPayment__c and npsp__Payment__c instead of standard Opportunities. A generic Opportunity mapper will break on NPSP orgs. Needs RecordType detection + NPSP object fallback.',
    'CiviCRM giving: ✅ RESOLVED — normalizeGiving() now implemented. Maps Contribution entity (receive_date, total_amount, contribution_recur_id, frequency_unit, financial_type_id:label, source). Filters on contribution_status_id:label = Completed.',
    'Blackbaud RE NXT giving: SKY API Gift endpoint available but no giving adapter exists. NOTE: SKY API requires OAuth 2.0 + a subscription-based API key (Blackbaud developer account + SKY API subscription key). Higher onboarding barrier than other platforms.',
    'Virtuous CRM: Elevated to Rung 2 — REST API with gifts/projects/tasks/contacts endpoints. Growing Catholic/pro-life adoption. Giving adapter on roadmap as high strategic priority.',
    'Planning Center Giving: Separate product from Planning Center People — needs independent API setup.',
    'DonorPerfect: API key requires manual request to support (api@softerware.com). NOTE: API key can be up to 200 characters — setup form input must support minimum 250 character length to prevent truncation.',
    'NeonCRM v1 → v2 migration: Some orgs still on v1 session auth — v1 fallback not implemented.',
    'Bloomerang v1 → v2 API: Bloomerang has both REST API v1 (deprecated but still live) and current v2. Existing users connected via v1 endpoints may experience silent failures. Migration note needed similar to NeonCRM v1→v2 gap.',
    'FIXTURE TEST GATE (blocks Rung 3): All 5 giving adapters (Bloomerang, NeonCRM, DonorPerfect, LGL, CiviCRM) require fixture tests before Rung 3 promotion. Minimum coverage: normal gift, recurring gift, null amount, malformed date, empty results, DonorPerfect 500-row truncation warning.',
    'Schema drift guards: Not yet applied to giving adapters — recommended before Rung 3.',
    'Dry-run preview: Giving CSV import has preview() but no tenant-facing dry-run panel yet.',
  ];

  doc.setFontSize(8);
  doc.setTextColor(50);
  for (const gap of gaps) {
    y = checkBreak(doc, y, 8, pn);
    const wrapped = doc.splitTextToSize(`• ${gap}`, CONTENT_WIDTH - 4);
    doc.text(wrapped, MARGIN + 2, y);
    y += wrapped.length * 3.8;
  }

  addFooter(doc, pn.current);
  doc.save('CROS-Integration-Audit-Report.pdf');
}
