/**
 * contact-enrich — Web scraping-based contact discovery for organizations.
 *
 * WHAT: Maps, scrapes, and extracts staff/leadership contacts from org websites.
 * WHERE: Called via automation runs for contact enrichment.
 * WHY: Discovers partnership contacts by crawling team/staff/about pages.
 *
 * ENGINE: Firecrawl (web scraper) — CANNOT be replaced by Perplexity.
 * Perplexity returns synthesized text, not raw HTML/links needed for:
 * - Site mapping (discovering team/staff page URLs)
 * - HTML scraping (extracting mailto: links, phone numbers, structured data)
 * - Link discovery (finding person detail pages)
 * - rawHtml fallback passes (regex email/phone extraction)
 *
 * FUTURE: If Firecrawl is removed, replace with another web scraper (Puppeteer, Playwright, etc.)
 * NOT with Perplexity.
 */

import { recordWorkflowUsage, RATE_CARDS } from "../_shared/intelligenceGovernance.ts";

// Module-level Firecrawl credit accumulator for this invocation.
// Carried between chunks via dispatch payload (firecrawl_credits_accumulated).
let _fcCredits = 0;
function trackFC(credits = 1): void { _fcCredits += credits; }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(code: string, message: string, status = 400) {
  return new Response(
    JSON.stringify({ ok: false, error: code, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

const FIRECRAWL_API = "https://api.firecrawl.dev/v1";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

/** Max URLs to scrape per chunk invocation */
const CHUNK_SIZE = 5;
/** Max total pages to scrape across all chunks */
const MAX_TOTAL_PAGES = 20;

interface ExtractedContact {
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  confidence: number;
  source_url: string;
}

// ──────────────────────────────────────────────
// Blocklist of personal/freemail domains
// ──────────────────────────────────────────────
const BLOCKED_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "ymail.com",
  "outlook.com", "hotmail.com", "live.com", "msn.com", "hotmail.co.uk",
  "aol.com", "icloud.com", "me.com", "mac.com",
  "protonmail.com", "proton.me", "tutanota.com", "zoho.com",
  "mail.com", "email.com", "usa.com", "gmx.com", "gmx.net",
  "yandex.com", "yandex.ru", "inbox.com", "fastmail.com",
  "hushmail.com", "runbox.com", "mailfence.com",
  "comcast.net", "verizon.net", "att.net", "sbcglobal.net",
  "cox.net", "charter.net", "earthlink.net", "juno.com",
  "bellsouth.net", "windstream.net", "centurylink.net",
  "frontier.com", "optonline.net", "roadrunner.com",
  "rocketmail.com", "rediffmail.com",
  "example.com", "test.com", "sentry.io",
]);

function isBlockedPersonalEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return true;
  return BLOCKED_EMAIL_DOMAINS.has(domain);
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ──────────────────────────────────────────────
// PHASE 1: MAP — discover URLs, store plan, kick off first chunk
// ──────────────────────────────────────────────
async function phaseMap(
  websiteUrl: string,
  firecrawlKey: string,
): Promise<string[]> {
  console.log(`[contact-enrich:map] Mapping ${websiteUrl}`);

  const mapResp = await fetch(`${FIRECRAWL_API}/map`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${firecrawlKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: websiteUrl,
      search: "staff team leadership board directors people employees our-team",
      limit: 100,
      includeSubdomains: false,
    }),
    signal: AbortSignal.timeout(30000),
  });

  let mapLinks: string[] = [];
  if (mapResp.ok) {
    const mapData = await mapResp.json();
    mapLinks = mapData?.links || [];
    trackFC(1); // map = 1 credit
  } else {
    console.error(`[contact-enrich:map] Map failed: ${await mapResp.text()}`);
  }

  console.log(`[contact-enrich:map] Map returned ${mapLinks.length} links`);

  // Filter to likely people/team/staff/about pages
  const peoplePatterns = /(team|staff|people|about|leadership|board|directors|contact|who-we-are|our-team|our-people|our-staff|employees|management|executive|bios?|meet-us|meet-the-team)/i;
  const relevantLinks = mapLinks.filter((l: string) => peoplePatterns.test(l));

  // Probe common staff URL patterns
  const baseUrl = websiteUrl.replace(/\/+$/, "");
  const probePaths = new Set([
    "/staff", "/team", "/our-team", "/our-staff", "/people", "/leadership",
    "/about/staff", "/about/team", "/about/our-team", "/about/leadership",
    "/about/people", "/about/our-people", "/about/board",
    "/about-us/staff", "/about-us/team", "/about-us/our-team", "/about-us/leadership",
    "/about-us/our-staff", "/about-us/our-people", "/about-us/board",
    "/who-we-are/team", "/who-we-are/staff", "/who-we-are/leadership",
    "/meet-the-team", "/meet-us", "/our-people",
    "/board-of-directors", "/board", "/executive-team", "/executives",
    "/contact", "/contact-us",
  ]);

  // Sub-page probes under about-like pages
  const aboutLikePages = relevantLinks.filter(l => /about/i.test(l));
  for (const aboutUrl of aboutLikePages) {
    const aboutBase = aboutUrl.replace(/\/+$/, "");
    for (const suffix of ["/staff", "/team", "/leadership", "/people", "/our-team", "/our-staff", "/board"]) {
      try { probePaths.add(new URL(aboutBase + suffix).pathname); } catch { /* skip */ }
    }
  }

  for (const path of probePaths) {
    const fullUrl = baseUrl + path;
    if (!relevantLinks.includes(fullUrl)) {
      relevantLinks.push(fullUrl);
    }
  }

  // Deduplicate and limit
  const uniqueLinks = [...new Set(relevantLinks)].slice(0, MAX_TOTAL_PAGES);
  if (uniqueLinks.length === 0) {
    uniqueLinks.push(websiteUrl);
  }

  console.log(`[contact-enrich:map] Plan: ${uniqueLinks.length} URLs to scrape`);
  return uniqueLinks;
}

// ──────────────────────────────────────────────
// PHASE 2: SCRAPE — process a chunk of URLs
// ──────────────────────────────────────────────
async function phaseScrape(
  urls: string[],
  firecrawlKey: string,
  lovableKey: string,
  orgDomain: string,
): Promise<{ contacts: ExtractedContact[]; detailLinks: string[] }> {
  console.log(`[contact-enrich:scrape] Scraping chunk of ${urls.length} URLs`);

  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const { markdown, links } = await scrapePageForMarkdownAndLinks(url, firecrawlKey);
        const contacts = markdown
          ? await extractContactsFromMarkdown(markdown, url, lovableKey, orgDomain)
          : [];
        const detailLinks = findPersonDetailLinks(links, url);
        return { contacts, detailLinks };
      } catch (err) {
        console.log(`[contact-enrich:scrape] Skipped ${url}: ${(err as Error)?.message || err}`);
        return { contacts: [] as ExtractedContact[], detailLinks: [] as string[] };
      }
    })
  );

  return {
    contacts: results.flatMap(r => r.contacts),
    detailLinks: [...new Set(results.flatMap(r => r.detailLinks))],
  };
}

// ──────────────────────────────────────────────
// PHASE 3: FINALIZE — email fallbacks + write suggestions
// ──────────────────────────────────────────────
async function phaseFinalize(
  allContacts: ExtractedContact[],
  scrapedUrls: string[],
  websiteUrl: string,
  firecrawlKey: string,
  orgDomain: string,
): Promise<ExtractedContact[]> {
  console.log(`[contact-enrich:finalize] Starting with ${allContacts.length} contacts`);

  // ── EMAIL rawHtml regex fallback (limited to 5 pages max) ──
  const contactsMissingEmail = allContacts.filter(c => c.name && !c.email);
  const staffPageUrls = scrapedUrls
    .filter(l => /(staff|team|people|leadership|board|our-team|our-staff|meet|about|contact|directors)/i.test(l))
    .slice(0, 5);
  if (staffPageUrls.length === 0) staffPageUrls.push(websiteUrl);

  if (contactsMissingEmail.length > 0) {
    console.log(`[contact-enrich:finalize] rawHtml email pass on ${staffPageUrls.length} pages`);
    const rawHtmlEmails = await extractEmailsFromRawHtml(staffPageUrls, firecrawlKey, orgDomain);
    console.log(`[contact-enrich:finalize] rawHtml found ${rawHtmlEmails.size} emails`);
    allContacts = matchEmailsToContacts(allContacts, rawHtmlEmails);
  }

  // ── PHONE rawHtml regex fallback (reuse same pages) ──
  const contactsMissingPhone = allContacts.filter(c => c.name && !c.phone);
  if (contactsMissingPhone.length > 0) {
    console.log(`[contact-enrich:finalize] rawHtml phone pass on ${staffPageUrls.length} pages`);
    const rawHtmlPhones = await extractPhonesFromRawHtml(staffPageUrls, firecrawlKey);
    console.log(`[contact-enrich:finalize] rawHtml found ${rawHtmlPhones.size} phones`);
    allContacts = matchPhonesToContacts(allContacts, rawHtmlPhones);
  }

  // ── EMAIL Firecrawl Search fallback (limited to 5 contacts max) ──
  const stillMissingEmail = allContacts.filter(c => c.name && !c.email);
  if (stillMissingEmail.length > 0) {
    const searchLimit = Math.min(stillMissingEmail.length, 5);
    console.log(`[contact-enrich:finalize] Search fallback for ${searchLimit} contacts (email)`);
    const searchResults = await Promise.all(
      stillMissingEmail.slice(0, searchLimit).map(contact =>
        searchForContactEmail(contact, orgDomain, firecrawlKey).catch(() => null)
      )
    );

    for (let i = 0; i < searchLimit; i++) {
      if (searchResults[i]) {
        const key = (stillMissingEmail[i].name || "").toLowerCase().trim();
        const match = allContacts.find(c => (c.name || "").toLowerCase().trim() === key);
        if (match && !match.email) {
          match.email = searchResults[i];
        }
      }
    }
  }

  // ── PHONE Firecrawl Search fallback (limited to 5 contacts max) ──
  const stillMissingPhone = allContacts.filter(c => c.name && !c.phone);
  if (stillMissingPhone.length > 0) {
    const searchLimit = Math.min(stillMissingPhone.length, 5);
    console.log(`[contact-enrich:finalize] Search fallback for ${searchLimit} contacts (phone)`);
    const searchResults = await Promise.all(
      stillMissingPhone.slice(0, searchLimit).map(contact =>
        searchForContactPhone(contact, orgDomain, firecrawlKey).catch(() => null)
      )
    );

    for (let i = 0; i < searchLimit; i++) {
      if (searchResults[i]) {
        const key = (stillMissingPhone[i].name || "").toLowerCase().trim();
        const match = allContacts.find(c => (c.name || "").toLowerCase().trim() === key);
        if (match && !match.phone) {
          match.phone = searchResults[i];
        }
      }
    }
  }

  // Final domain filter for emails
  let strippedCount = 0;
  for (const contact of allContacts) {
    if (contact.email && isBlockedPersonalEmail(contact.email)) {
      contact.email = null;
      strippedCount++;
    }
  }
  if (strippedCount > 0) {
    console.log(`[contact-enrich:finalize] Stripped ${strippedCount} personal emails`);
  }

  console.log(`[contact-enrich:finalize] Final: ${allContacts.length} contacts`);
  return allContacts;
}

// ──────────────────────────────────────────────
// Self-dispatch: invoke this function for next chunk
// ──────────────────────────────────────────────
async function selfDispatch(
  supabaseUrl: string,
  serviceRoleKey: string,
  enrichmentSecret: string,
  body: Record<string, unknown>,
): Promise<void> {
  const url = `${supabaseUrl}/functions/v1/contact-enrich`;
  console.log(`[contact-enrich] Self-dispatching phase=${body.phase}, chunk=${body.chunk_index}`);

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": enrichmentSecret,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (resp.ok || resp.status < 500) {
        // Consume body to prevent resource leak
        await resp.text().catch(() => {});
        if (!resp.ok) {
          console.error(`[contact-enrich] Self-dispatch returned ${resp.status} on attempt ${attempt}`);
        }
        return; // Success or client error (no point retrying)
      }

      // 5xx — retry
      await resp.text().catch(() => {});
      console.warn(`[contact-enrich] Self-dispatch got ${resp.status}, attempt ${attempt}/${MAX_RETRIES}`);
    } catch (err) {
      // Timeout or network error
      console.warn(`[contact-enrich] Self-dispatch attempt ${attempt}/${MAX_RETRIES} failed: ${(err as Error)?.message}`);
    }

    // Wait before retry (500ms, 1s, 2s)
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
    }
  }

  // All retries exhausted — mark run as error so it doesn't stay stuck
  console.error(`[contact-enrich] Self-dispatch FAILED after ${MAX_RETRIES} attempts for phase=${body.phase}`);
  const runId = body.run_id as string;
  if (runId) {
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    await supabaseAdmin.from("automation_runs")
      .update({
        status: "error",
        error_message: `Self-dispatch chain broke at phase=${body.phase}, chunk=${body.chunk_index}`,
        processed_at: new Date().toISOString(),
      })
      .eq("run_id", runId);
  }
}

// ──────────────────────────────────────────────
// Helper functions (unchanged logic)
// ──────────────────────────────────────────────

async function scrapePageForMarkdownAndLinks(
  url: string,
  firecrawlKey: string,
): Promise<{ markdown: string; links: string[] }> {
  const scrapeResp = await fetch(`${FIRECRAWL_API}/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${firecrawlKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown", "links"],
      onlyMainContent: true,
      waitFor: 3000,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!scrapeResp.ok) {
    console.error(`[contact-enrich] Scrape failed for ${url}: ${scrapeResp.status}`);
    return { markdown: "", links: [] };
  }

  const scrapeData = await scrapeResp.json();
  trackFC(1); // scrape = 1 credit
  return {
    markdown: scrapeData?.data?.markdown || scrapeData?.markdown || "",
    links: scrapeData?.data?.links || scrapeData?.links || [],
  };
}

function findPersonDetailLinks(links: string[], parentUrl: string): string[] {
  if (!links || links.length === 0) return [];

  let parentPath = "";
  try { parentPath = new URL(parentUrl).pathname.toLowerCase(); } catch { /* skip */ }

  const personPagePatterns = [
    /\/(staff|team|people|leadership|board|directors|our-team|our-staff|our-people|employees|management)\/[a-z0-9][\w-]+$/i,
    /\/bio\/[a-z0-9][\w-]+$/i,
    /\/profile\/[a-z0-9][\w-]+$/i,
    /\/member\/[a-z0-9][\w-]+$/i,
  ];

  const parentBasedPattern = parentPath && parentPath.length > 1
    ? new RegExp(`^${parentPath.replace(/\/$/, "")}/[a-z0-9][\\w-]+$`, "i")
    : null;

  const detailLinks: string[] = [];
  for (const link of links) {
    if (typeof link !== "string") continue;
    let fullUrl: string;
    try { fullUrl = new URL(link, parentUrl).href; } catch { continue; }
    let linkPath: string;
    try { linkPath = new URL(fullUrl).pathname; } catch { continue; }
    if (/\.(pdf|jpg|jpeg|png|gif|svg|css|js|xml|json|doc|docx|xlsx)$/i.test(linkPath)) continue;
    const matchesPattern = personPagePatterns.some(p => p.test(linkPath));
    const matchesParent = parentBasedPattern ? parentBasedPattern.test(linkPath) : false;
    if (matchesPattern || matchesParent) {
      detailLinks.push(fullUrl);
    }
  }
  return [...new Set(detailLinks)];
}

async function extractContactsFromMarkdown(
  markdown: string,
  sourceUrl: string,
  lovableKey: string,
  orgDomain?: string,
): Promise<ExtractedContact[]> {
  if (!markdown || markdown.length < 50) return [];

  const truncated = markdown.slice(0, 8000);

  const aiResp = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are a contact extraction specialist for a nonprofit computer refurbishment organization (PCs for People). Extract ONLY people who would be relevant partnership or outreach contacts.

INCLUDE these roles (decision-makers and partnership contacts):
- Executive leadership (CEO, President, VP, Director, COO, CFO, CTO, CIO, CDO)
- Program/Partnership managers (Program Director, Partnership Manager, Community Relations, Outreach)
- IT/Technology leadership (IT Director, Technology Director, Digital Inclusion)
- Development/Fundraising (Development Director, Grants Manager)
- Operations leadership (Operations Director/Manager)
- Board members and founders

EXCLUDE these roles (not relevant for outreach):
- Finance/Accounting staff (Accountant, Bookkeeper, Controller, Payroll, AP/AR)
- Administrative/Clerical (Admin Assistant, Receptionist, Secretary, Office Manager, Clerk)
- HR/Recruiting (HR Manager, Recruiter, Benefits Coordinator)
- Legal (Attorney, Paralegal, Compliance Officer)
- Marketing/Communications (unless Director-level)
- Maintenance/Facilities staff
- Interns, Volunteers (unless coordinator-level)
- Generic "Staff" with no title

Only extract REAL people with real names — skip generic roles, placeholder text, or "Contact Us" forms.
For each person found, provide their FULL name (first AND last name), title/role, email (if visible), phone (if visible), and a confidence score (0.0-1.0).
CRITICAL: Only include PROFESSIONAL/WORK email addresses. Discard any email from personal domains like gmail.com, yahoo.com, outlook.com, hotmail.com, aol.com, icloud.com, protonmail.com, etc.
High confidence (0.8+): Name + title clearly listed on a staff/team page AND role is relevant.
Medium confidence (0.5-0.79): Name mentioned in context but role relevance unclear.
Low confidence (<0.5): Ambiguous or possibly not relevant.
IMPORTANT: Look carefully for email addresses and phone numbers — they may appear as mailto: links, inline text, or in contact sections.`,
        },
        {
          role: "user",
          content: `Extract all people/contacts from this webpage content. Return ONLY the JSON array, no other text.\n\nSource URL: ${sourceUrl}\n\nContent:\n${truncated}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_contacts",
            description: "Extract contacts found on an organization webpage",
            parameters: {
              type: "object",
              properties: {
                contacts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Full name" },
                      title: { type: "string", description: "Job title or role" },
                      email: { type: "string", description: "Email if found" },
                      phone: { type: "string", description: "Phone if found" },
                      confidence: { type: "number", description: "Confidence 0.0-1.0" },
                    },
                    required: ["name", "confidence"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["contacts"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_contacts" } },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!aiResp.ok) {
    console.error(`[contact-enrich] AI extraction failed: ${aiResp.status}`);
    return [];
  }

  const aiData = await aiResp.json();
  try {
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) return [];
    const parsed = JSON.parse(toolCall.function.arguments);
    return (parsed.contacts || [])
      .map((c: any) => ({
        name: typeof c.name === "string" ? c.name : null,
        title: typeof c.title === "string" ? c.title : null,
        email: typeof c.email === "string" ? c.email : null,
        phone: typeof c.phone === "string" ? c.phone : null,
        confidence: typeof c.confidence === "number" ? c.confidence : 0.5,
        source_url: sourceUrl,
      }))
      .filter((c: ExtractedContact) => c.name && c.name.length > 1)
      .filter((c: ExtractedContact) => {
        // Post-extraction title filter: drop clearly irrelevant roles
        if (!c.title) return true; // Keep untitled contacts (may be relevant)
        const t = c.title.toLowerCase();
        const excludePatterns = [
          /\baccountant\b/, /\bbookkeeper\b/, /\bpayroll\b/, /\bcontroller\b/,
          /\ba[\/.]?[pr]\b/, /\baccounts (payable|receivable)\b/,
          /\breceptionist\b/, /\bsecretary\b/, /\bclerk\b/,
          /\badmin(istrative)?\s*(assist|asst|sec|coord)/,
          /\bparalegal\b/, /\battorney\b/, /\blegal\s*(assist|asst|sec)/,
          /\brecruiter\b/, /\brecruiting\b/, /\bbenefits\s*(coord|spec|admin)/,
          /\bmaintenance\b/, /\bcustodian\b/, /\bjanitor\b/, /\bfacilities\s*(tech|maint)/,
          /\bintern\b/, /\bfellow\b/,
          /\bdata\s*entry\b/, /\bfile\s*clerk\b/,
        ];
        return !excludePatterns.some(p => p.test(t));
      });
  } catch {
    return [];
  }
}

async function extractEmailsFromRawHtml(
  urls: string[],
  firecrawlKey: string,
  _orgDomain: string,
): Promise<Map<string, string>> {
  const emailMap = new Map<string, string>();

  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const resp = await fetch(`${FIRECRAWL_API}/scrape`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url, formats: ["rawHtml"], waitFor: 5000 }),
          signal: AbortSignal.timeout(30000),
        });
        if (!resp.ok) return "";
        const data = await resp.json();
        trackFC(1); // rawHtml scrape = 1 credit
        return data?.data?.rawHtml || data?.rawHtml || "";
      } catch { return ""; }
    })
  );

  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const skipPatterns = /^(info|contact|support|admin|hello|office|general|sales|hr|careers|jobs|noreply|no-reply|webmaster|postmaster|abuse|privacy|security|billing|help|team|press|media|marketing|events|donations|volunteer)@/i;

  for (let html of results) {
    if (!html) continue;
    // Cap HTML size to prevent CPU exhaustion on large pages
    if (html.length > 200_000) html = html.slice(0, 200_000);
    const matches = html.match(emailRegex) || [];
    for (const email of matches) {
      const lowerEmail = email.toLowerCase();
      if (skipPatterns.test(lowerEmail)) continue;
      if (isBlockedPersonalEmail(lowerEmail)) continue;
      const idx = html.indexOf(email);
      const context = html.substring(Math.max(0, idx - 200), idx + email.length + 200);
      emailMap.set(lowerEmail, context);
    }
  }

  return emailMap;
}

function matchEmailsToContacts(
  contacts: ExtractedContact[],
  emailMap: Map<string, string>,
): ExtractedContact[] {
  if (emailMap.size === 0) return contacts;

  for (const contact of contacts) {
    if (contact.email || !contact.name) continue;
    const nameParts = contact.name.toLowerCase().trim().split(/\s+/);
    if (nameParts.length < 2) continue;
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];

    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const [email, context] of emailMap) {
      const localPart = email.split("@")[0].toLowerCase();
      let score = 0;
      if (localPart.includes(firstName) && localPart.includes(lastName)) score += 10;
      else if (localPart.includes(lastName)) score += 5;
      else if (localPart.includes(firstName)) score += 3;
      else if (localPart.includes(firstName[0] + lastName)) score += 7;
      else if (localPart.includes(firstName + lastName[0])) score += 6;

      const contextLower = context.toLowerCase();
      if (contextLower.includes(contact.name!.toLowerCase())) score += 8;
      else if (contextLower.includes(firstName) && contextLower.includes(lastName)) score += 6;

      if (score > bestScore) { bestScore = score; bestMatch = email; }
    }

    if (bestMatch && bestScore >= 5) {
      contact.email = bestMatch;
      emailMap.delete(bestMatch);
    }
  }

  return contacts;
}

async function searchForContactEmail(
  contact: ExtractedContact,
  domain: string,
  firecrawlKey: string,
): Promise<string | null> {
  const query = `"${contact.name}" ${domain} email`;
  const resp = await fetch(`${FIRECRAWL_API}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${firecrawlKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, limit: 3 }),
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) { await resp.text(); return null; }

  const data = await resp.json();
  trackFC(2); // search = 2 credits
  const results = data?.data || [];
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const nameParts = (contact.name || "").toLowerCase().split(/\s+/);
  const lastName = nameParts[nameParts.length - 1] || "";

  for (const result of results) {
    const text = [result.description, result.title, result.markdown].filter(Boolean).join(" ");
    const emails = text.match(emailRegex) || [];
    for (const email of emails) {
      const lowerEmail = email.toLowerCase();
      if (isBlockedPersonalEmail(lowerEmail)) continue;
      const localPart = lowerEmail.split("@")[0];
      if (localPart.includes(lastName) || localPart.includes(nameParts[0])) {
        return lowerEmail;
      }
    }
  }
  return null;
}

// ──────────────────────────────────────────────
// Phone extraction helpers
// ──────────────────────────────────────────────

/** Regex for US phone numbers in various formats */
const PHONE_REGEX = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;

/** Filter out obvious non-phone matches (fax, generic lines, etc.) */
const PHONE_SKIP_CONTEXT = /\b(fax|facsimile|toll.?free|customer.?service|main.?line|general.?info|switchboard)\b/i;

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

function isValidPhoneNumber(phone: string): boolean {
  const digits = normalizePhone(phone);
  // Must be exactly 10 US digits
  if (digits.length !== 10) return false;
  // Area code can't start with 0 or 1
  if (digits[0] === "0" || digits[0] === "1") return false;
  return true;
}

async function extractPhonesFromRawHtml(
  urls: string[],
  firecrawlKey: string,
): Promise<Map<string, string>> {
  const phoneMap = new Map<string, string>(); // normalized phone -> surrounding context

  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const resp = await fetch(`${FIRECRAWL_API}/scrape`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url, formats: ["rawHtml"], waitFor: 5000 }),
          signal: AbortSignal.timeout(30000),
        });
        if (!resp.ok) return "";
        const data = await resp.json();
        trackFC(1); // rawHtml scrape = 1 credit
        return data?.data?.rawHtml || data?.rawHtml || "";
      } catch { return ""; }
    })
  );

  for (let html of results) {
    if (!html) continue;
    // Cap HTML size to prevent CPU exhaustion on large pages
    if (html.length > 200_000) html = html.slice(0, 200_000);
    const matches = html.match(PHONE_REGEX) || [];
    for (const rawPhone of matches) {
      if (!isValidPhoneNumber(rawPhone)) continue;
      const idx = html.indexOf(rawPhone);
      const context = html.substring(Math.max(0, idx - 300), idx + rawPhone.length + 100);
      // Skip fax numbers and generic lines
      if (PHONE_SKIP_CONTEXT.test(context)) continue;
      const normalized = normalizePhone(rawPhone);
      if (!phoneMap.has(normalized)) {
        phoneMap.set(normalized, context);
      }
    }
  }

  return phoneMap;
}

function matchPhonesToContacts(
  contacts: ExtractedContact[],
  phoneMap: Map<string, string>,
): ExtractedContact[] {
  if (phoneMap.size === 0) return contacts;

  for (const contact of contacts) {
    if (contact.phone || !contact.name) continue;
    const nameParts = contact.name.toLowerCase().trim().split(/\s+/);
    if (nameParts.length < 2) continue;
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];

    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const [phone, context] of phoneMap) {
      const contextLower = context.toLowerCase();
      let score = 0;

      // Full name near phone
      if (contextLower.includes(contact.name!.toLowerCase())) score += 10;
      else if (contextLower.includes(firstName) && contextLower.includes(lastName)) score += 8;
      else if (contextLower.includes(lastName)) score += 4;

      // Check for email of this contact nearby (strong signal)
      if (contact.email) {
        const emailLocal = contact.email.split("@")[0].toLowerCase();
        if (contextLower.includes(emailLocal)) score += 5;
      }

      if (score > bestScore) { bestScore = score; bestMatch = phone; }
    }

    if (bestMatch && bestScore >= 8) {
      // Format as (XXX) XXX-XXXX
      const d = bestMatch;
      contact.phone = `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
      phoneMap.delete(bestMatch);
    }
  }

  return contacts;
}

async function searchForContactPhone(
  contact: ExtractedContact,
  domain: string,
  firecrawlKey: string,
): Promise<string | null> {
  const query = `"${contact.name}" ${domain} phone`;
  const resp = await fetch(`${FIRECRAWL_API}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${firecrawlKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, limit: 3 }),
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) { await resp.text(); return null; }

  const data = await resp.json();
  trackFC(2); // search = 2 credits
  const results = data?.data || [];
  const nameParts = (contact.name || "").toLowerCase().split(/\s+/);
  const lastName = nameParts[nameParts.length - 1] || "";

  for (const result of results) {
    const text = [result.description, result.title, result.markdown].filter(Boolean).join(" ");
    const phones = text.match(PHONE_REGEX) || [];
    for (const rawPhone of phones) {
      if (!isValidPhoneNumber(rawPhone)) continue;
      // Check that the result page actually mentions this person
      const textLower = text.toLowerCase();
      if (textLower.includes(lastName) || textLower.includes(nameParts[0])) {
        const d = normalizePhone(rawPhone);
        return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
      }
    }
  }
  return null;
}

function mergeContacts(
  firstPass: ExtractedContact[],
  secondPass: ExtractedContact[],
): ExtractedContact[] {
  const byName = new Map<string, ExtractedContact>();
  for (const c of firstPass) {
    const key = (c.name || "").toLowerCase().trim();
    if (!key) continue;
    byName.set(key, { ...c });
  }
  for (const c of secondPass) {
    const key = (c.name || "").toLowerCase().trim();
    if (!key) continue;
    const existing = byName.get(key);
    if (existing) {
      if (!existing.email && c.email) existing.email = c.email;
      if (!existing.phone && c.phone) existing.phone = c.phone;
      if (c.email && c.source_url) existing.source_url = c.source_url;
    } else {
      byName.set(key, { ...c });
    }
  }
  return Array.from(byName.values());
}

// ──────────────────────────────────────────────
// MAIN HANDLER — orchestrates chunked phases
// ──────────────────────────────────────────────
export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError("METHOD_NOT_ALLOWED", "Only POST is accepted", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET") || "";

  if (!supabaseUrl || !serviceRoleKey) return jsonError("CONFIG_ERROR", "Server misconfigured", 503);
  if (!firecrawlKey) return jsonError("CONFIG_ERROR", "Firecrawl not configured", 503);
  if (!lovableKey) return jsonError("CONFIG_ERROR", "Lovable AI not configured", 503);

  // Auth: accept either user JWT or internal x-api-key
  const authHeader = req.headers.get("Authorization") ?? "";
  const apiKey = req.headers.get("x-api-key") ?? "";

  let isInternalCall = false;
  if (apiKey && enrichmentSecret && apiKey === enrichmentSecret) {
    isInternalCall = true;
  } else if (authHeader.startsWith("Bearer ")) {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { error: authErr } = await userClient.auth.getUser();
    if (authErr) return jsonError("UNAUTHORIZED", "Invalid token", 401);
  } else {
    return jsonError("UNAUTHORIZED", "Missing auth", 401);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError("INVALID_JSON", "Body must be JSON", 400); }

  const opportunityId = body.opportunity_id as string;
  const runId = (body.run_id as string) || crypto.randomUUID();
  const websiteUrl = body.website_url as string | undefined;
  const phase = (body.phase as string) || "map"; // map | scrape | finalize
  const chunkIndex = (body.chunk_index as number) || 0;
  // Accumulated state passed between chunks
  const urlPlan = (body.url_plan as string[]) || [];
  const detailUrlPlan = (body.detail_url_plan as string[]) || [];
  const accumulatedContacts = (body.accumulated_contacts as ExtractedContact[]) || [];
  const carriedCredits = (body.firecrawl_credits_accumulated as number) || 0;
  const carriedTenantId = (body.tenant_id as string) || "";

  // Reset module-level counter for this invocation, start from carried
  _fcCredits = 0;

  if (!opportunityId || typeof opportunityId !== "string") {
    return jsonError("INVALID_PAYLOAD", "opportunity_id required", 400);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    // ── PHASE: MAP ──
    if (phase === "map") {
      // Get opportunity details + tenant_id for credit tracking
      const { data: opp, error: oppErr } = await supabaseAdmin
        .from("opportunities")
        .select("id, organization, website_url, tenant_id")
        .eq("id", opportunityId)
        .maybeSingle();

      if (oppErr || !opp) return jsonError("NOT_FOUND", "Opportunity not found", 404);

      const resolvedTenantId = opp.tenant_id || "";

      const effectiveUrl = websiteUrl || opp.website_url;
      if (!effectiveUrl) {
        return jsonResponse({ ok: true, contacts_found: 0, message: "No website URL available" });
      }

      // Track this run
      await supabaseAdmin.from("automation_runs").upsert({
        run_id: runId,
        workflow_key: "contact_enrich",
        status: "processing",
        org_id: opportunityId,
        org_name: opp.organization,
        payload: { phase: "map", total_chunks: 0 },
      }, { onConflict: "run_id" });

      console.log(`[contact-enrich:map] Starting for ${opp.organization} (${effectiveUrl})`);

      const urls = await phaseMap(effectiveUrl, firecrawlKey);

      if (urls.length === 0) {
        await supabaseAdmin.from("automation_runs")
          .update({ status: "completed", processed_at: new Date().toISOString() })
          .eq("run_id", runId);
        return jsonResponse({ ok: true, contacts_found: 0 });
      }

      const totalChunks = Math.ceil(urls.length / CHUNK_SIZE);

      // Update run with plan metadata
      await supabaseAdmin.from("automation_runs")
        .update({ payload: { phase: "scrape", total_chunks: totalChunks, total_urls: urls.length } })
        .eq("run_id", runId);

      // Self-dispatch first scrape chunk
      await selfDispatch(supabaseUrl, serviceRoleKey, enrichmentSecret, {
        opportunity_id: opportunityId,
        run_id: runId,
        website_url: effectiveUrl,
        phase: "scrape",
        chunk_index: 0,
        url_plan: urls,
        detail_url_plan: [],
        accumulated_contacts: [],
        tenant_id: resolvedTenantId,
        firecrawl_credits_accumulated: _fcCredits,
      });

      return jsonResponse({
        ok: true,
        phase: "map",
        run_id: runId,
        total_urls: urls.length,
        total_chunks: totalChunks,
        message: "Map complete, scrape chunks dispatched",
      });
    }

    // ── PHASE: SCRAPE ──
    if (phase === "scrape") {
      const effectiveUrl = websiteUrl || "";
      const orgDomain = extractDomain(effectiveUrl);

      const start = chunkIndex * CHUNK_SIZE;
      const chunkUrls = urlPlan.slice(start, start + CHUNK_SIZE);

      if (chunkUrls.length === 0) {
        // No more main URLs — check if we have detail pages to scrape
        if (detailUrlPlan.length > 0) {
          console.log(`[contact-enrich:scrape] Main URLs done, switching to detail pages`);
          await selfDispatch(supabaseUrl, serviceRoleKey, enrichmentSecret, {
            opportunity_id: opportunityId,
            run_id: runId,
            website_url: effectiveUrl,
            phase: "scrape_detail",
            chunk_index: 0,
            url_plan: urlPlan,
            detail_url_plan: detailUrlPlan,
            accumulated_contacts: accumulatedContacts,
            tenant_id: carriedTenantId,
            firecrawl_credits_accumulated: carriedCredits + _fcCredits,
          });
          return jsonResponse({ ok: true, phase: "scrape", message: "Main scrape done, detail pages next" });
        }

        // No detail pages either — go to finalize
        console.log(`[contact-enrich:scrape] All URLs done, finalizing`);
        await selfDispatch(supabaseUrl, serviceRoleKey, enrichmentSecret, {
          opportunity_id: opportunityId,
          run_id: runId,
          website_url: effectiveUrl,
          phase: "finalize",
          url_plan: urlPlan,
          detail_url_plan: [],
          accumulated_contacts: accumulatedContacts,
          tenant_id: carriedTenantId,
          firecrawl_credits_accumulated: carriedCredits + _fcCredits,
        });
        return jsonResponse({ ok: true, phase: "scrape", message: "Scrape done, finalizing" });
      }

      console.log(`[contact-enrich:scrape] Chunk ${chunkIndex}: ${chunkUrls.length} URLs`);

      // Update run status with chunk progress
      await supabaseAdmin.from("automation_runs")
        .update({ payload: { phase: "scrape", chunk_index: chunkIndex, total_urls: urlPlan.length } })
        .eq("run_id", runId);

      const { contacts, detailLinks } = await phaseScrape(chunkUrls, firecrawlKey, lovableKey, orgDomain);

      // Merge contacts
      const newAccumulated = mergeContacts(accumulatedContacts, contacts);

      // Collect new detail links (excluding already-scraped URLs)
      const alreadyScraped = new Set(urlPlan.map(u => u.toLowerCase()));
      const existingDetail = new Set(detailUrlPlan.map(u => u.toLowerCase()));
      const newDetailLinks = detailLinks.filter(l =>
        !alreadyScraped.has(l.toLowerCase()) && !existingDetail.has(l.toLowerCase())
      );
      const updatedDetailPlan = [...detailUrlPlan, ...newDetailLinks].slice(0, 15);

      console.log(`[contact-enrich:scrape] Chunk ${chunkIndex}: ${contacts.length} contacts, ${newDetailLinks.length} new detail links. Total accumulated: ${newAccumulated.length}`);

      // Dispatch next chunk
      await selfDispatch(supabaseUrl, serviceRoleKey, enrichmentSecret, {
        opportunity_id: opportunityId,
        run_id: runId,
        website_url: effectiveUrl,
        phase: "scrape",
        chunk_index: chunkIndex + 1,
        url_plan: urlPlan,
        detail_url_plan: updatedDetailPlan,
        accumulated_contacts: newAccumulated,
        tenant_id: carriedTenantId,
        firecrawl_credits_accumulated: carriedCredits + _fcCredits,
      });

      return jsonResponse({ ok: true, phase: "scrape", chunk_index: chunkIndex, contacts_so_far: newAccumulated.length });
    }

    // ── PHASE: SCRAPE_DETAIL ──
    if (phase === "scrape_detail") {
      const effectiveUrl = websiteUrl || "";
      const orgDomain = extractDomain(effectiveUrl);

      const start = chunkIndex * CHUNK_SIZE;
      const chunkUrls = detailUrlPlan.slice(start, start + CHUNK_SIZE);

      if (chunkUrls.length === 0) {
        // Done with detail pages — finalize
        await selfDispatch(supabaseUrl, serviceRoleKey, enrichmentSecret, {
          opportunity_id: opportunityId,
          run_id: runId,
          website_url: effectiveUrl,
          phase: "finalize",
          url_plan: urlPlan,
          detail_url_plan: detailUrlPlan,
          accumulated_contacts: accumulatedContacts,
          tenant_id: carriedTenantId,
          firecrawl_credits_accumulated: carriedCredits + _fcCredits,
        });
        return jsonResponse({ ok: true, phase: "scrape_detail", message: "Detail scrape done, finalizing" });
      }

      console.log(`[contact-enrich:scrape_detail] Chunk ${chunkIndex}: ${chunkUrls.length} detail URLs`);

      await supabaseAdmin.from("automation_runs")
        .update({ payload: { phase: "scrape_detail", chunk_index: chunkIndex, total_detail_urls: detailUrlPlan.length } })
        .eq("run_id", runId);

      // Detail pages: scrape but don't discover more detail links
      const { contacts } = await phaseScrape(chunkUrls, firecrawlKey, lovableKey, orgDomain);
      const newAccumulated = mergeContacts(accumulatedContacts, contacts);

      console.log(`[contact-enrich:scrape_detail] Chunk ${chunkIndex}: ${contacts.length} contacts. Total: ${newAccumulated.length}`);

      // Next detail chunk
      await selfDispatch(supabaseUrl, serviceRoleKey, enrichmentSecret, {
        opportunity_id: opportunityId,
        run_id: runId,
        website_url: effectiveUrl,
        phase: "scrape_detail",
        chunk_index: chunkIndex + 1,
        url_plan: urlPlan,
        detail_url_plan: detailUrlPlan,
        accumulated_contacts: newAccumulated,
        tenant_id: carriedTenantId,
        firecrawl_credits_accumulated: carriedCredits + _fcCredits,
      });

      return jsonResponse({ ok: true, phase: "scrape_detail", chunk_index: chunkIndex, contacts_so_far: newAccumulated.length });
    }

    // ── PHASE: FINALIZE ──
    if (phase === "finalize") {
      const effectiveUrl = websiteUrl || "";
      const orgDomain = extractDomain(effectiveUrl);
      const allScrapedUrls = [...urlPlan, ...detailUrlPlan];

      await supabaseAdmin.from("automation_runs")
        .update({ payload: { phase: "finalize" } })
        .eq("run_id", runId);

      const finalContacts = await phaseFinalize(
        accumulatedContacts,
        allScrapedUrls,
        effectiveUrl,
        firecrawlKey,
        orgDomain,
      );

      if (finalContacts.length === 0) {
        await supabaseAdmin.from("automation_runs")
          .update({ status: "completed", processed_at: new Date().toISOString() })
          .eq("run_id", runId);
        return jsonResponse({ ok: true, contacts_found: 0 });
      }

      // Write to contact_suggestions
      const { data: existingRow } = await supabaseAdmin
        .from("contact_suggestions")
        .select("id, applied_indices")
        .eq("entity_type", "opportunity")
        .eq("entity_id", opportunityId)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .maybeSingle();

      if (existingRow) {
        await supabaseAdmin
          .from("contact_suggestions")
          .update({
            suggestions: finalContacts,
            source_url: effectiveUrl,
            run_id: runId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingRow.id);
      } else {
        await supabaseAdmin
          .from("contact_suggestions")
          .insert({
            run_id: runId,
            entity_type: "opportunity",
            entity_id: opportunityId,
            source_url: effectiveUrl,
            suggestions: finalContacts,
            status: "ready",
            applied_indices: [],
          });
      }

      await supabaseAdmin.from("automation_runs")
        .update({ status: "completed", processed_at: new Date().toISOString() })
        .eq("run_id", runId);

      console.log(`[contact-enrich:finalize] Done: ${finalContacts.length} contacts for ${opportunityId}`);

      // ── Flush Firecrawl credit usage to governance system ──
      const totalCredits = carriedCredits + _fcCredits;
      if (carriedTenantId && totalCredits > 0) {
        const cost = totalCredits * RATE_CARDS.firecrawl.costPerCall;
        await recordWorkflowUsage(supabaseAdmin, carriedTenantId, 'enrichment', 'firecrawl', 'deep', totalCredits, cost)
          .catch((e: unknown) => console.warn('[contact-enrich] Credit flush failed (non-fatal):', e));
        console.log(`[contact-enrich:finalize] Firecrawl credits flushed: ${totalCredits} credits, $${cost.toFixed(4)}`);
      }

      return jsonResponse({
        ok: true,
        contacts_found: finalContacts.length,
        run_id: runId,
      });
    }

    return jsonError("INVALID_PHASE", `Unknown phase: ${phase}`, 400);
  } catch (err) {
    console.error(`[contact-enrich] Error in phase=${phase}:`, err);
    await supabaseAdmin.from("automation_runs")
      .update({ status: "error", error_message: String(err), processed_at: new Date().toISOString() })
      .eq("run_id", runId);
    return jsonError("INTERNAL_ERROR", "Contact enrichment failed", 503);
  }
}

Deno.serve(handleRequest);
