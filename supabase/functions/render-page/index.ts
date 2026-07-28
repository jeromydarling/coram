/**
 * render-page — Pre-renders marketing pages for AI crawlers using Firecrawl.
 *
 * WHAT: Renders SPA pages to markdown/HTML and caches results.
 * WHERE: Called by sitemap references and direct bot access.
 * WHY: AI crawlers (Perplexity, ChatGPT, etc.) cannot execute JS in an SPA.
 *       This edge function renders pages via Firecrawl, caches the result,
 *       and serves crawler-friendly content.
 *
 * Modes:
 *   GET ?path=/manifesto           → Serve cached or freshly rendered page
 *   GET ?path=/manifesto&refresh=1 → Force re-render
 *   GET ?action=refresh-all        → Re-render all known pages (cron target)
 *   GET ?action=index              → Serve full content index (all pages)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SITE_URL = 'https://thecros.app';
const CACHE_TTL_HOURS = 168; // 7 days

// All known marketing pages — mirrors marketingPageRegistry.ts
const MARKETING_PAGES: { path: string; label: string; description: string }[] = [
  { path: '/', label: 'Homepage', description: 'Primary landing — manifesto hero, archetype signals, and conversion pathways.' },
  { path: '/manifesto', label: 'Manifesto', description: 'The founding narrative — why CROS exists.' },
  { path: '/nri', label: 'NRI™ (Neary)', description: 'Narrative Relational Intelligence — human-first signals instead of traditional AI.' },
  { path: '/cros', label: 'CROS™ Feature Overview', description: 'The relationship operating system overview.' },
  { path: '/profunda', label: 'Profunda™ Origin', description: 'The founding story — how Profunda became CROS.' },
  { path: '/pricing', label: 'Pricing', description: 'Tier breakdown: Core, Insight, Story, Bridge.' },
  { path: '/contact', label: 'Contact', description: 'Inquiry form for prospective organizations.' },
  { path: '/security', label: 'Security', description: 'Data boundaries, row-level security, privacy commitments.' },
  { path: '/features', label: 'Features Overview', description: 'Unified feature map connecting all CROS modules.' },
  { path: '/signum', label: 'Signum™', description: 'Discovery & signal intelligence.' },
  { path: '/testimonium-feature', label: 'Testimonium™', description: 'Narrative storytelling & insight layer.' },
  { path: '/communio-feature', label: 'Communio™', description: 'Inter-org collaboration network.' },
  { path: '/impulsus', label: 'Impulsus™', description: 'Private impact scrapbook journal.' },
  { path: '/voluntarium', label: 'Voluntārium™', description: 'Volunteer management with gentle scheduling.' },
  { path: '/provisio', label: 'Prōvīsiō™', description: 'Technology provisions & resource requests.' },
  { path: '/relatio-campaigns', label: 'Relatio Campaigns™', description: 'Relationship-centered email campaigns.' },
  { path: '/integrations', label: 'Integrations', description: 'CRM bridge — HubSpot, Salesforce, Dynamics 365.' },
  { path: '/roles', label: 'Roles', description: 'Overview of Shepherd, Companion, Visitor, Steward.' },
  { path: '/roles/shepherd', label: 'Shepherd', description: 'Those who hold the longer story and carry the mission.' },
  { path: '/roles/companion', label: 'Companion', description: 'Daily relationship keepers who maintain connection threads.' },
  { path: '/roles/visitor', label: 'Visitor', description: 'Mobile-first field workers recording voice notes and visits.' },
  { path: '/roles/steward', label: 'Steward', description: 'Operations & admin keeping systems clean and teams equipped.' },
  { path: '/archetypes', label: 'Archetypes', description: 'Mission archetype selector — Church, Nonprofit, Social Enterprise.' },
  { path: '/archetypes/church-week', label: 'Church Week', description: '7-day story: a week inside CROS for a church.' },
  { path: '/archetypes/nonprofit-week', label: 'Nonprofit Week', description: '7-day story: digital inclusion nonprofit using CROS.' },
  { path: '/archetypes/social-enterprise-week', label: 'Social Enterprise Week', description: '7-day story: purpose-driven business with CROS.' },
  { path: '/archetypes/community-network-week', label: 'Community Network Week', description: '7-day story: community coalition coordinating across orgs.' },
  { path: '/archetypes/ministry-outreach-week', label: 'Ministry Outreach Week', description: '7-day story: parish team using CROS for pastoral care.' },
  { path: '/for-companions', label: 'For Companions', description: 'Landing for Companion archetypes — Solo and Organization modes.' },
  { path: '/compare', label: 'Compare', description: 'CROS vs traditional CRMs.' },
  { path: '/proof', label: 'Proof', description: 'Evidence and social proof — testimonials and trust indicators.' },
  { path: '/case-study-humanity', label: 'Our Story', description: 'Universal humanity case study.' },
  { path: '/fundraising-without-a-donor-crm', label: 'Relational Fundraising', description: 'Why fundraising works without a donor CRM.' },
  { path: '/see-people', label: 'See People', description: 'What if your system saw people, not records?' },
  { path: '/imagine-this', label: 'Imagine This', description: 'Scenario-based storytelling — three mission contexts.' },
  { path: '/lexicon', label: 'Lexicon', description: 'CROS vocabulary with schema.org DefinedTerm markup.' },
  { path: '/library', label: 'Library', description: 'Knowledge hub connecting roles, archetypes, and concepts.' },
  { path: '/field-journal', label: 'Field Journal', description: 'Role-based narrative entries from the field.' },
  { path: '/insights', label: 'Insights', description: 'Thought leadership on relationship-centered work.' },
  { path: '/insights/why-crm-fails-nonprofits', label: 'Why CRMs Fail Nonprofits', description: 'Sales pipelines were never designed for community work.' },
  { path: '/insights/relationship-memory-matters', label: 'Relationship Memory Matters', description: 'Why organizations forget the people they serve.' },
  { path: '/essays', label: 'Essays', description: 'Living essay library from platform signals.' },
  { path: '/reflections', label: 'Reflections', description: 'Monthly contemplative content connecting movement to narrative.' },
  { path: '/mission-atlas', label: 'Mission Atlas', description: 'Geographic narrative connecting archetypes to metro types.' },
  { path: '/network', label: 'Network Directory', description: 'Public communio directory of organizations using CROS.' },
  { path: '/authority', label: 'Authority Hub', description: 'Trust signals establishing CROS as a credible voice.' },
  { path: '/path/shepherd', label: 'Shepherd Pathway', description: 'Identity-first funnel for mission leaders.' },
  { path: '/path/companion', label: 'Companion Pathway', description: 'Identity-first funnel for field staff.' },
  { path: '/path/steward', label: 'Steward Pathway', description: 'Identity-first funnel for operations leaders.' },
  { path: '/path/visitor', label: 'Visitor Pathway', description: 'Identity-first funnel for mobile field workers.' },
  { path: '/calling/home-visitation', label: 'Home Visitation', description: 'The ministry of presence — home visitation software.' },
  { path: '/calling/parish-outreach', label: 'Parish Outreach', description: 'Reaching beyond the walls — church community engagement.' },
  { path: '/calling/community-support', label: 'Community Support', description: 'Sustaining the daily work of caring.' },
  { path: '/legal/terms', label: 'Terms of Service', description: 'Platform terms of service.' },
  { path: '/legal/privacy', label: 'Privacy Policy', description: 'Data handling, retention, and user rights.' },
  { path: '/legal/data-processing', label: 'Data Processing', description: 'GDPR-aligned DPA.' },
  { path: '/legal/acceptable-use', label: 'Acceptable Use', description: 'Usage boundaries aligned with CROS values.' },
  { path: '/legal/ai-transparency', label: 'AI Transparency', description: 'How NRI uses AI — transparency about human-first principles.' },
];

function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

async function renderPageViaFirecrawl(pagePath: string): Promise<{ markdown: string; title?: string; description?: string } | null> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) {
    console.error('FIRECRAWL_API_KEY not configured');
    return null;
  }

  const url = `${SITE_URL}${pagePath}`;
  console.log(`Rendering: ${url}`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000, // Wait 3s for SPA to render
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await response.json();
    if (!response.ok || !data.success) {
      console.error(`Firecrawl error for ${pagePath}:`, data.error || response.status);
      return null;
    }

    const markdown = data.data?.markdown || data.markdown || '';
    const title = data.data?.metadata?.title || data.metadata?.title;
    const description = data.data?.metadata?.description || data.metadata?.description;

    return { markdown, title, description };
  } catch (error) {
    console.error(`Render failed for ${pagePath}:`, error);
    return null;
  }
}

async function getCachedOrRender(supabase: ReturnType<typeof createClient>, pagePath: string, forceRefresh = false) {
  // Check cache first
  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from('page_render_cache')
      .select('markdown_content, html_title, html_description, rendered_at, expires_at')
      .eq('path', pagePath)
      .single();

    if (cached && new Date(cached.expires_at) > new Date()) {
      return {
        markdown: cached.markdown_content,
        title: cached.html_title,
        description: cached.html_description,
        cached: true,
        rendered_at: cached.rendered_at,
      };
    }
  }

  // Render via Firecrawl
  const result = await renderPageViaFirecrawl(pagePath);
  if (!result) {
    // Return fallback from page list
    const page = MARKETING_PAGES.find(p => p.path === pagePath);
    return {
      markdown: page ? `# ${page.label}\n\n${page.description}` : `# Page not found: ${pagePath}`,
      title: page?.label || 'CROS',
      description: page?.description || '',
      cached: false,
      rendered_at: new Date().toISOString(),
    };
  }

  // Cache the result
  await supabase.from('page_render_cache').upsert({
    path: pagePath,
    markdown_content: result.markdown,
    html_title: result.title || null,
    html_description: result.description || null,
    rendered_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + CACHE_TTL_HOURS * 3600 * 1000).toISOString(),
    render_source: 'firecrawl',
    error: null,
  }, { onConflict: 'path' });

  return {
    markdown: result.markdown,
    title: result.title,
    description: result.description,
    cached: false,
    rendered_at: new Date().toISOString(),
  };
}

function buildFullContentIndex(pages: typeof MARKETING_PAGES, cachedContent: Map<string, string>): string {
  const header = `# CROS™ — Communal Relationship Operating System
# Full Content Index for AI Search Engines
# ${SITE_URL}

> CROS is the operating system for human-centered organizations. Where most platforms track transactions, CROS remembers people.

Website: ${SITE_URL}
Contact: ${SITE_URL}/contact

---

`;

  const sections = pages.map(page => {
    const cached = cachedContent.get(page.path);
    if (cached && cached.length > 50) {
      return `## ${page.label} (${SITE_URL}${page.path})\n\n${cached}`;
    }
    return `## ${page.label} (${SITE_URL}${page.path})\n\n${page.description}`;
  });

  const footer = `

---

## Key Concepts

- **Relationship Memory**: The institutional knowledge that lives in human connections — visits, reflections, conversations, and shared experiences.
- **NRI (Narrative Relational Intelligence)**: Human-first intelligence built from reflections, events, conversations, and community signals. AI assists; intelligence belongs to the humans.
- **Communio**: Opt-in inter-organization collaboration where anonymized signals flow between CROS tenants.
- **Signum**: Signal intelligence that surfaces community events and partner movements without manual searching.
- **Testimonium**: Narrative storytelling layer transforming daily observations into board-ready impact stories.
- **Impulsus**: Private sacred journal for leaders — observations that never feed metrics or reports.
- **Drift Detection**: Gentle awareness of relationships needing attention — no alarms, just quiet noticing.
- **Journey Chapters**: Narrative chapters honoring the complexity of human relationships, replacing CRM pipeline stages.

## About CROS

CROS was born from Profunda — a relationship memory system for Regional Impact Managers in nonprofit ecosystems. It was never a sales CRM. CROS stands for Communal Relationship Operating System. For 40 years, technology has been driven by Operating Systems and AI — both cold, data-driven, and impersonal. CROS replaces the OS with a human touch.

Website: ${SITE_URL}
`;

  return header + sections.join('\n\n---\n\n') + footer;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const pagePath = url.searchParams.get('path');
    const forceRefresh = url.searchParams.get('refresh') === '1';

    const supabase = getSupabaseClient();

    // Action: serve full content index (replacement for llms-full.txt)
    if (action === 'index') {
      // Fetch all cached content
      const { data: allCached } = await supabase
        .from('page_render_cache')
        .select('path, markdown_content')
        .gt('expires_at', new Date().toISOString());

      const cachedMap = new Map<string, string>();
      if (allCached) {
        for (const row of allCached) {
          cachedMap.set(row.path, row.markdown_content);
        }
      }

      const content = buildFullContentIndex(MARKETING_PAGES, cachedMap);
      return new Response(content, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Action: refresh all pages (cron target)
    if (action === 'refresh-all') {
      const results: { path: string; ok: boolean }[] = [];
      // Render in batches of 3 to avoid rate limits
      for (let i = 0; i < MARKETING_PAGES.length; i += 3) {
        const batch = MARKETING_PAGES.slice(i, i + 3);
        const batchResults = await Promise.allSettled(
          batch.map(async (page) => {
            await getCachedOrRender(supabase, page.path, true);
            return { path: page.path, ok: true };
          })
        );
        for (const r of batchResults) {
          if (r.status === 'fulfilled') results.push(r.value);
          else results.push({ path: 'unknown', ok: false });
        }
        // Brief pause between batches
        if (i + 3 < MARKETING_PAGES.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      return new Response(JSON.stringify({ ok: true, rendered: results.length, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default: render a single page
    if (!pagePath) {
      // No path specified — serve the page listing
      const listing = MARKETING_PAGES.map(p => `- [${p.label}](${SITE_URL}${p.path}): ${p.description}`).join('\n');
      return new Response(`# CROS™ Marketing Pages\n\n${listing}\n\nUse ?path=/page-path to get rendered content, or ?action=index for the full content index.`, {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // Validate path is a known marketing page
    const isKnown = MARKETING_PAGES.some(p => p.path === pagePath);
    if (!isKnown) {
      return new Response(`Unknown page: ${pagePath}`, {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    const result = await getCachedOrRender(supabase, pagePath, forceRefresh);

    // Serve as clean HTML page with canonical URL
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${result.title || 'CROS™'}</title>
  <meta name="description" content="${(result.description || '').replace(/"/g, '&quot;')}">
  <link rel="canonical" href="${SITE_URL}${pagePath}">
  <meta name="robots" content="noindex, follow">
  <style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#1a1a1a}h1,h2,h3{color:#2d2d2d}a{color:#4a6da7}pre{background:#f5f5f5;padding:1rem;overflow-x:auto;border-radius:4px}</style>
</head>
<body>
  <nav><a href="${SITE_URL}">← CROS™ Home</a></nav>
  <main>
${markdownToBasicHtml(result.markdown)}
  </main>
  <footer>
    <p><small>Rendered for AI crawlers. <a href="${SITE_URL}${pagePath}">View interactive version</a>.</small></p>
    <p><small>Cached: ${result.cached ? 'yes' : 'freshly rendered'} | ${result.rendered_at}</small></p>
  </footer>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('render-page error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/** Very basic markdown-to-HTML for crawler consumption */
function markdownToBasicHtml(md: string): string {
  if (!md) return '<p>Content not available.</p>';
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/^(?!<[hul]|<li|<strong|<em|<a)(.+)$/gm, '<p>$1</p>')
    .replace(/\n{2,}/g, '\n');
}
