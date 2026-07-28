import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Resource extraction helpers ──

interface ExtractedResource {
  resource_type: string; // 'download', 'link', 'date'
  label: string;
  url?: string;
  resource_date?: string;
  resource_date_end?: string;
  description?: string;
}

function extractDownloads(links: string[], markdown: string): ExtractedResource[] {
  const resources: ExtractedResource[] = [];
  const seen = new Set<string>();

  // From links array: find PDFs, DOCs, XLS
  const docPattern = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|csv|zip)(\?.*)?$/i;
  for (const link of links) {
    if (docPattern.test(link) && !seen.has(link)) {
      seen.add(link);
      const fileName = decodeURIComponent(link.split('/').pop()?.split('?')[0] || 'Document');
      resources.push({
        resource_type: 'download',
        label: fileName,
        url: link,
      });
    }
  }

  // From markdown: find linked documents [label](url.pdf)
  const mdDocRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+\.(?:pdf|doc|docx|xls|xlsx|ppt|pptx|csv|zip)(?:\?[^)]*)?)\)/gi;
  let m;
  while ((m = mdDocRegex.exec(markdown)) !== null) {
    if (!seen.has(m[2])) {
      seen.add(m[2]);
      resources.push({
        resource_type: 'download',
        label: m[1].trim(),
        url: m[2],
      });
    }
  }

  return resources;
}

function extractResourceLinks(links: string[], markdown: string, sourceUrl: string): ExtractedResource[] {
  const resources: ExtractedResource[] = [];
  const seen = new Set<string>();
  seen.add(sourceUrl);

  // Patterns for useful grant resource pages
  const resourcePatterns = /faq|eligib|guideline|requirement|instruction|webinar|info.?session|workshop|training|resource|toolkit|template|sample|example/i;

  for (const link of links) {
    if (resourcePatterns.test(link) && !seen.has(link)) {
      seen.add(link);
      // Derive label from URL path
      const pathPart = new URL(link).pathname.split('/').filter(Boolean).pop() || 'Resource';
      const label = pathPart.replace(/[-_]/g, ' ').replace(/\.\w+$/, '');
      resources.push({
        resource_type: 'link',
        label: label.charAt(0).toUpperCase() + label.slice(1),
        url: link,
      });
    }
  }

  // From markdown links with resource-like text
  const mdResourceRegex = /\[([^\]]*(?:FAQ|eligib|guideline|requirement|instruction|webinar|info.?session|workshop|training|resource|toolkit|template|sample|example)[^\]]*)\]\((https?:\/\/[^)]+)\)/gi;
  let m;
  while ((m = mdResourceRegex.exec(markdown)) !== null) {
    if (!seen.has(m[2])) {
      seen.add(m[2]);
      resources.push({
        resource_type: 'link',
        label: m[1].trim(),
        url: m[2],
      });
    }
  }

  return resources;
}

function extractDates(markdown: string): ExtractedResource[] {
  const resources: ExtractedResource[] = [];
  const seen = new Set<string>();

  // Common grant date patterns: "Deadline: Month DD, YYYY" or "Due: MM/DD/YYYY"
  const dateLabels = [
    { pattern: /(?:application|submission|proposal)\s+deadline[:\s]*([A-Z][a-z]+ \d{1,2},?\s*\d{4})/gi, label: 'Application Deadline' },
    { pattern: /(?:letter of intent|LOI)\s+(?:deadline|due)[:\s]*([A-Z][a-z]+ \d{1,2},?\s*\d{4})/gi, label: 'LOI Deadline' },
    { pattern: /(?:info(?:rmation)?\s+session|webinar)[:\s]*([A-Z][a-z]+ \d{1,2},?\s*\d{4})/gi, label: 'Information Session' },
    { pattern: /(?:award|notification|announcement)\s+(?:date|by)[:\s]*([A-Z][a-z]+ \d{1,2},?\s*\d{4})/gi, label: 'Award Notification' },
    { pattern: /(?:grant\s+)?(?:start|begin(?:ning)?)\s+date[:\s]*([A-Z][a-z]+ \d{1,2},?\s*\d{4})/gi, label: 'Grant Start Date' },
    { pattern: /(?:grant\s+)?(?:end|closing)\s+date[:\s]*([A-Z][a-z]+ \d{1,2},?\s*\d{4})/gi, label: 'Grant End Date' },
    { pattern: /(?:due\s+(?:date|by)|deadline)[:\s]*([A-Z][a-z]+ \d{1,2},?\s*\d{4})/gi, label: 'Deadline' },
    { pattern: /(?:close(?:s|d)?|open(?:s)?)\s+(?:on\s+)?([A-Z][a-z]+ \d{1,2},?\s*\d{4})/gi, label: 'Important Date' },
    // Also handle MM/DD/YYYY format
    { pattern: /(?:application|submission|proposal)\s+deadline[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/gi, label: 'Application Deadline' },
    { pattern: /(?:due\s+(?:date|by)|deadline)[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/gi, label: 'Deadline' },
  ];

  for (const { pattern, label } of dateLabels) {
    let m;
    while ((m = pattern.exec(markdown)) !== null) {
      const dateStr = m[1].trim();
      const key = `${label}:${dateStr}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Parse to ISO date
      let isoDate: string | undefined;
      try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          isoDate = d.toISOString().split('T')[0];
        }
      } catch { /* ignore */ }

      resources.push({
        resource_type: 'date',
        label,
        resource_date: isoDate,
        description: dateStr,
      });
    }
  }

  return resources;
}

// ── Funding extraction helpers ──

function parseFundingFromMarkdown(markdown: string): { maxAward: number | null; totalProgramFunding: number | null } {
  let maxAward: number | null = null;
  let totalProgramFunding: number | null = null;

  const upToRegex = /(?:up\s+to|maximum\s+(?:of\s+)?|not\s+(?:to\s+)?exceed|awards?\s+(?:of\s+)?up\s+to|grant\s+amounts?\s+(?:will\s+be\s+)?up\s+to)\s*\$\s*([\d,]+(?:\.\d+)?)\s*(million|billion|mil|bil|m|b)?/gi;
  const upToMatches: number[] = [];
  let um;
  while ((um = upToRegex.exec(markdown)) !== null) {
    let val = parseFloat(um[1].replace(/,/g, ""));
    const suffix = (um[2] || "").toLowerCase();
    if (suffix.startsWith("b")) val *= 1_000_000_000;
    else if (suffix.startsWith("m")) val *= 1_000_000;
    if (isFinite(val) && val > 0) upToMatches.push(val);
  }
  if (upToMatches.length > 0) {
    maxAward = Math.min(...upToMatches);
  }

  const availRegex = /(?:approximately\s+)?\$\s*([\d,]+(?:\.\d+)?)\s*(million|billion|mil|bil|m|b)?\s*(?:is\s+)?(?:available|in\s+(?:total|funding))/gi;
  let av;
  while ((av = availRegex.exec(markdown)) !== null) {
    let val = parseFloat(av[1].replace(/,/g, ""));
    const suffix = (av[2] || "").toLowerCase();
    if (suffix.startsWith("b")) val *= 1_000_000_000;
    else if (suffix.startsWith("m")) val *= 1_000_000;
    if (isFinite(val) && val > 0) {
      totalProgramFunding = val;
      break;
    }
  }

  return { maxAward, totalProgramFunding };
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { grant_id, grant_name, funder_name } = await req.json();

    if (!grant_id || !grant_name) {
      return new Response(
        JSON.stringify({ ok: false, error: "grant_id and grant_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build search query and pre-filled search URLs
    const searchQuery = funder_name
      ? `${grant_name} ${funder_name} grant application`
      : `${grant_name} grant application`;

    const encodedQuery = encodeURIComponent(searchQuery);
    const encodedGrantName = encodeURIComponent(grant_name);

    const searchUrls = [
      {
        name: "Google",
        url: `https://www.google.com/search?q=${encodedQuery}`,
      },
      {
        name: "Grants.gov",
        url: `https://www.grants.gov/search-grants.html?keywords=${encodedGrantName}`,
      },
      {
        name: "Foundation Directory",
        url: `https://fconline.foundationcenter.org/?q=${encodedGrantName}`,
      },
    ];

    console.log(`Constructed search URLs for grant ${grant_id}:`, searchUrls.map(s => s.url));

    return new Response(
      JSON.stringify({
        ok: true,
        found: true,
        source: "prefilled",
        search_urls: searchUrls,
        message: "Pre-filled search URLs generated. Browse these sources to locate the official grant page.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("grant-find-url error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
