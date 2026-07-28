/**
 * library-essay-pipeline — Automated Living Library + Federation Monthly SEO.
 *
 * WHAT: Two modes selected by the `mode` body param.
 *   • mode='monthly' (default) — Federation SEO synthesis. For each SEO-active
 *     satellite in federated_apps, group recent operator_rss_items by
 *     source_app, run the satellite's essay_templates prompt against them,
 *     insert into library_essays with target_app=<slug> + status='published',
 *     then fire publish-essay-to-satellite to ship via HMAC. No login needed.
 *   • mode='daily' — Legacy NRI-voiced reflective drafts grouped by topic
 *     category. Preserves the pre-existing behavior for the Living Library.
 *
 * WHERE: Called by pg_cron. Monthly job runs on the 1st of each month at
 *        06:00 UTC. Legacy daily job kept on its current schedule until the
 *        operator chooses to retire it.
 * WHY:  Per the user: "every app in the federation should have SEO content
 *        generation and function the same way across the board" and "I
 *        shouldn't even have to login and publish (eventually)".
 *
 * Auth: Service-role key or N8N_SHARED_SECRET via X-Api-Key/Bearer.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Env (read once at module init)
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

function jsonOk(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, code: string, message: string) {
  return new Response(
    JSON.stringify({ ok: false, error: code, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function authenticateServiceRequest(req: Request): boolean {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";
  if (authHeader.startsWith("Bearer ") && serviceRoleKey) {
    if (authHeader.slice(7).trim() === serviceRoleKey) return true;
  }
  let token = "";
  if (apiKeyHeader) token = apiKeyHeader.trim();
  else if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();
  if (!token) return false;
  if (sharedSecret && constantTimeCompare(token, sharedSecret)) return true;
  return false;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function extractText(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${tag}>`, "s"));
  return match ? match[1].trim() : "";
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function parseRssItems(xml: string, limit = 10) {
  const items: Array<{ guid: string; title: string; link: string; summary: string; published_at: string | null }> = [];
  const itemMatches = xml.match(/<item[\s>].*?<\/item>/gs) || [];
  for (const itemXml of itemMatches.slice(0, limit)) {
    const title = extractText(itemXml, "title");
    const link = extractText(itemXml, "link");
    const guid = extractText(itemXml, "guid") || link || title;
    const pubDate = extractText(itemXml, "pubDate");
    const description = extractText(itemXml, "description");
    const content = extractText(itemXml, "content:encoded");
    if (!title || !guid) continue;
    items.push({
      guid,
      title: title.slice(0, 500),
      link: link.slice(0, 2000),
      summary: stripHtml(content || description).slice(0, 2000),
      published_at: pubDate ? new Date(pubDate).toISOString() : null,
    });
  }
  return items;
}

function generateSlug(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  return `${base}-${Date.now().toString(36)}`;
}

function fillPromptVars(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, v);
  }
  return out;
}

function detectSector(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(parish|catholic|diocese|mass|liturgy|eucharist)\b/.test(lower)) return "catholic";
  if (/\b(church|worship|congregation|pastor|sermon)\b/.test(lower)) return "christian";
  if (/\b(ministry|mission|faith\s?based|spiritual)\b/.test(lower)) return "ministry";
  if (/\b(nonprofit|501\(c\)|grant|social\s?service|community\s?development)\b/.test(lower)) return "nonprofit";
  return "general";
}

// ── Main ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "POST only");
  if (!authenticateServiceRequest(req)) return jsonError(401, "UNAUTHORIZED", "Invalid auth");

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }

  const mode = (body.mode as string) || "monthly";
  const onlySatellite = body.only_satellite as string | undefined;
  const dryRun = body.dry_run === true;

  if (mode === "monthly") {
    return await runFederationMonthly(admin, LOVABLE_API_KEY, { onlySatellite: onlySatellite as string | undefined, dryRun });
  } else if (mode === "daily") {
    return await runLegacyDaily(admin, LOVABLE_API_KEY, body);
  } else {
    return jsonError(400, "BAD_MODE", `Unknown mode '${mode}'. Use 'monthly' or 'daily'.`);
  }
});

// ── Mode 1: Federation Monthly SEO ───────────────────────────────────────

async function runFederationMonthly(
  admin: ReturnType<typeof createClient>,
  LOVABLE_API_KEY: string | undefined,
  opts: { onlySatellite?: string; dryRun: boolean },
) {
  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const monthName = now.toLocaleString("en-US", { month: "long" });
  const year = String(now.getFullYear());

  console.log(`[library-essay-pipeline:monthly] starting month=${monthKey} onlySatellite=${opts.onlySatellite || "all"} dryRun=${opts.dryRun}`);

  // 1) Pull SEO-active satellites from federated_apps. Exclude theschola (it
  //    has its own pipeline) and any non-active rows.
  let satQuery = admin
    .from("federated_apps")
    .select("source_app, display_name, public_base_url, is_active")
    .eq("is_active", true)
    .eq("is_hub", false)
    .neq("source_app", "theschola");
  if (opts.onlySatellite) satQuery = satQuery.eq("source_app", opts.onlySatellite);
  const { data: satellites, error: satErr } = await satQuery;
  if (satErr) return jsonError(500, "FED_QUERY_ERR", satErr.message);
  if (!satellites?.length) return jsonOk({ ok: true, message: "No active satellites configured" });

  // 2) Load all monthly_seo templates in one shot
  const { data: templates } = await admin
    .from("essay_templates")
    .select("source_app, name, prompt, voice_notes, seo_meta")
    .eq("category", "monthly_seo")
    .eq("enabled", true);

  const templateBySlug = new Map<string, any>(
    (templates || []).map((t: any) => [t.source_app, t])
  );

  // 3) Ensure RSS items are fresh: pull feeds per satellite
  for (const sat of satellites) {
    const slug = sat.source_app;
    const { data: sources } = await admin
      .from("operator_rss_sources")
      .select("id, name, url")
      .eq("source_app", slug)
      .eq("enabled", true);
    if (!sources?.length) {
      console.log(`[${slug}] no enabled RSS sources, skipping fetch`);
      continue;
    }
    for (const src of sources) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(src.url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; CROS-FederationContent/1.0; +https://thecros.app)",
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.5",
          },
        });
        clearTimeout(t);
        if (!res.ok) {
          console.log(`[${slug}] feed ${src.name} → HTTP ${res.status}`);
          continue;
        }
        const xml = await res.text();
        const items = parseRssItems(xml, 10);
        for (const item of items) {
          await admin.from("operator_rss_items").upsert({
            source_id: src.id,
            source_app: slug,
            guid: item.guid,
            title: item.title,
            link: item.link,
            summary: item.summary,
            published_at: item.published_at,
            fetched_at: new Date().toISOString(),
          }, { onConflict: "source_id,guid", ignoreDuplicates: true });
        }
      } catch (e) {
        console.error(`[${slug}] fetch error ${src.name}:`, (e as Error).message);
      }
    }
  }

  // 4) Generate one essay per satellite from last-30-days items
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const results: Array<{ slug: string; status: string; essay_id?: string; title?: string; seed_count?: number; reason?: string }> = [];

  for (const sat of satellites) {
    const slug = sat.source_app;
    const displayName = sat.display_name;
    const primaryDomain = sat.public_base_url || `https://${slug}.app`;

    try {
      // Skip if monthly essay already exists for this satellite this month
      const { data: existing } = await admin
        .from("library_essays")
        .select("id")
        .eq("target_app", slug)
        .eq("month_key", monthKey)
        .eq("source_type", "monthly_seo")
        .maybeSingle();
      if (existing) {
        results.push({ slug, status: "already_exists", reason: `Essay for ${monthKey} already exists` });
        continue;
      }

      const tmpl = templateBySlug.get(slug);
      if (!tmpl) {
        results.push({ slug, status: "no_template", reason: `No monthly_seo template found for ${slug}` });
        continue;
      }

      const { data: items } = await admin
        .from("operator_rss_items")
        .select("title, summary, link, published_at, operator_rss_sources(name)")
        .eq("source_app", slug)
        .gte("fetched_at", thirtyDaysAgo)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(15);

      if (!items?.length) {
        results.push({ slug, status: "no_items", reason: "No RSS items in last 30 days" });
        continue;
      }

      const seedSummaries = items.slice(0, 12).map((it: any, i: number) =>
        `[Source ${i + 1}: ${it.operator_rss_sources?.name || "RSS"}]\nTitle: ${it.title}\nSummary: ${(it.summary || "").slice(0, 500)}\nURL: ${it.link}`
      ).join("\n\n---\n\n");

      const meta = tmpl.seo_meta || {};
      const audience = meta.audience || "general audience";
      const topicScope = Array.isArray(meta.topic_scope_keywords)
        ? meta.topic_scope_keywords.join(", ")
        : "";
      const voice = tmpl.voice_notes || "warm and substantive";

      const filledPrompt = fillPromptVars(tmpl.prompt, {
        satellite_display_name: displayName,
        primary_domain: primaryDomain,
        synthesis_voice: voice,
        synthesis_audience: audience,
        topic_scope_keywords: topicScope,
        month_name: monthName,
        year,
        seed_summaries: seedSummaries,
        seed_count: String(items.length),
      });

      if (opts.dryRun) {
        results.push({ slug, status: "dry_run", title: "(dry run — prompt only)", seed_count: items.length });
        continue;
      }

      if (!LOVABLE_API_KEY) {
        results.push({ slug, status: "error", reason: "LOVABLE_API_KEY not configured" });
        continue;
      }

      // AI synthesis
      const aiCtrl = new AbortController();
      const aiTimeout = setTimeout(() => aiCtrl.abort(), 60000);
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: filledPrompt },
            {
              role: "user",
              content: `Write the synthesis essay now. Output ONLY the markdown — no preamble, no closing notes. Begin with the H1 title.`,
            },
          ],
        }),
        signal: aiCtrl.signal,
      });
      clearTimeout(aiTimeout);

      if (!aiResp.ok) {
        const errText = await aiResp.text();
        results.push({ slug, status: "ai_error", reason: `${aiResp.status}: ${errText.slice(0, 200)}` });
        continue;
      }

      const aiData = await aiResp.json();
      let body = aiData.choices?.[0]?.message?.content || "";
      const titleMatch = body.match(/^#\s+(.+)$/m);
      const title = (titleMatch ? titleMatch[1] : `${displayName} — ${monthName} ${year}`).trim().slice(0, 180);
      if (titleMatch) body = body.replace(/^#\s+.+\n+/, "");

      const slug_url = generateSlug(`${slug}-${monthName}-${year}`);
      const excerpt = body.replace(/[#>*_\[\]()]/g, "").slice(0, 200).trim() + "...";
      const sector = detectSector(`${title} ${body}`);

      const seoDescription = excerpt.slice(0, 155);
      const tags = Array.isArray(meta.topic_scope_keywords) ? meta.topic_scope_keywords.slice(0, 5) : [];

      // Insert essay with target_app set + status='published' (auto-publish)
      const { data: essay, error: insertErr } = await admin
        .from("library_essays")
        .insert({
          title,
          slug: slug_url,
          target_app: slug,
          month_key: monthKey,
          sector,
          source_type: "monthly_seo",
          voice_profile: `${slug}_seo`,
          content_markdown: body,
          excerpt,
          seo_title: title.slice(0, 60),
          seo_description: seoDescription,
          tags,
          citations: items.slice(0, 12).map((it: any) => ({ title: it.title, url: it.link })),
          generated_by: "federation_monthly_seo",
          meta_robots: "index,follow",
          status: "published",
          published_at: new Date().toISOString(),
        })
        .select("id, title")
        .single();

      if (insertErr) {
        results.push({ slug, status: "insert_error", reason: insertErr.message });
        continue;
      }

      // Fire publish-essay-to-satellite (HMAC ship to live site)
      try {
        const publishResp = await fetch(
          `${supabaseUrl}/functions/v1/publish-essay-to-satellite`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ essay_id: essay.id }),
          }
        );
        const pubData = await publishResp.json();
        if (!publishResp.ok || !pubData.ok) {
          results.push({
            slug, status: "synthesized_but_publish_failed",
            essay_id: essay.id, title: essay.title, seed_count: items.length,
            reason: pubData.message || `publish HTTP ${publishResp.status}`,
          });
          continue;
        }
        results.push({
          slug, status: "published",
          essay_id: essay.id, title: essay.title, seed_count: items.length,
          reason: pubData.canonical_url,
        });
      } catch (e) {
        results.push({
          slug, status: "synthesized_but_publish_threw",
          essay_id: essay.id, title: essay.title, seed_count: items.length,
          reason: (e as Error).message,
        });
      }

      // Brief pause between AI calls to avoid rate limits
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      results.push({ slug, status: "error", reason: (e as Error).message });
      console.error(`[${slug}] pipeline error:`, e);
    }
  }

  const published = results.filter(r => r.status === "published").length;
  console.log(`[library-essay-pipeline:monthly] complete. published=${published}/${satellites.length}`);

  return jsonOk({
    ok: true,
    mode: "monthly",
    month_key: monthKey,
    satellites_processed: satellites.length,
    published,
    results,
  });
}

// ── Mode 2: Legacy daily NRI reflective drafts ───────────────────────────
// Preserved for backward compatibility; logic carried over verbatim from
// the pre-augmentation pipeline.

async function runLegacyDaily(
  admin: ReturnType<typeof createClient>,
  LOVABLE_API_KEY: string | undefined,
  body: Record<string, unknown>,
) {
  const monthKey = new Date().toISOString().slice(0, 7);
  const maxEssays = Math.min(Number(body.max_essays) || 3, 5);
  console.log(`[library-essay-pipeline:daily-legacy] starting month=${monthKey} max=${maxEssays}`);

  const { data: sources } = await admin
    .from("operator_rss_sources")
    .select("id, name, url, category")
    .eq("enabled", true)
    .limit(20);
  if (!sources?.length) return jsonOk({ ok: true, message: "No RSS sources configured", essays_created: 0 });

  const allItems: Array<{ title: string; summary: string; link: string; category: string }> = [];
  for (const source of sources) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(source.url, { signal: controller.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const xml = await res.text();
      const items = parseRssItems(xml, 5);
      for (const item of items) {
        allItems.push({ ...item, category: source.category || "general" });
      }
    } catch (e) {
      console.error(`[daily-legacy] fetch error ${source.name}:`, (e as Error).message);
    }
  }

  if (!allItems.length) return jsonOk({ ok: true, message: "No items found", essays_created: 0 });

  const { data: existingEssays } = await admin
    .from("library_essays")
    .select("title")
    .eq("month_key", monthKey)
    .eq("source_type", "rss");
  const existingTitles = new Set((existingEssays || []).map((e: any) => e.title?.toLowerCase()));
  const fresh = allItems.filter(it => !existingTitles.has(it.title.toLowerCase()));
  if (!fresh.length) return jsonOk({ ok: true, message: "All items already processed", essays_created: 0 });

  const grouped: Record<string, typeof fresh> = {};
  for (const item of fresh) {
    const key = item.category || "general";
    (grouped[key] = grouped[key] || []).push(item);
  }

  let created = 0;
  const results: Array<{ title: string; status: string }> = [];
  for (const [category, items] of Object.entries(grouped)) {
    if (created >= maxEssays) break;
    const articleContext = items.slice(0, 4).map((it, i) =>
      `Article ${i + 1}: "${it.title}"\n${it.summary.slice(0, 400)}\nSource: ${it.link}`
    ).join("\n\n");

    let title = `${category} — ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
    let bodyText = items.slice(0, 3).map(it => `## ${it.title}\n\n${it.summary.slice(0, 300)}\n\n[Source](${it.link})`).join("\n\n---\n\n");

    if (LOVABLE_API_KEY) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 45000);
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `You are NRI (Narrative Relational Intelligence), the narrative voice of CROS. Calm, reflective essays weaving recent community news into gentle narrative. No platform names. No marketing. Ignatian cadence. Under 600 words. Markdown only. Title evocative. End with 2-3 gentle questions in blockquotes.`,
              },
              { role: "user", content: `Write a reflective essay based on these recent articles in the "${category}" space:\n\n${articleContext}` },
            ],
          }),
          signal: ctrl.signal,
        });
        clearTimeout(t);
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const generated = aiData.choices?.[0]?.message?.content || "";
          const titleMatch = generated.match(/^#\s+(.+)$/m);
          if (titleMatch) {
            title = titleMatch[1].trim();
            bodyText = generated.replace(/^#\s+.+\n+/, "");
          } else {
            bodyText = generated;
          }
        }
      } catch (e) {
        console.error("[daily-legacy] AI error:", e);
      }
    }

    const slug = generateSlug(title);
    const excerpt = bodyText.replace(/[#>*_\[\]()]/g, "").slice(0, 200).trim() + "...";
    const { data: essay } = await admin.from("library_essays").insert({
      title,
      slug,
      month_key: monthKey,
      sector: detectSector(`${title} ${bodyText}`),
      source_type: "rss",
      voice_profile: "cros_default",
      content_markdown: bodyText,
      excerpt,
      seo_title: title.slice(0, 60),
      seo_description: excerpt.slice(0, 155),
      tags: [category],
      citations: items.slice(0, 4).map(it => ({ title: it.title, url: it.link })),
      generated_by: "NRI",
      meta_robots: "noindex,nofollow",
      status: "ready_for_review",
    }).select("id, title").single();

    if (essay) {
      created++;
      results.push({ title: essay.title, status: "ready_for_review" });
    }
  }

  return jsonOk({ ok: true, mode: "daily", essays_created: created, results, month_key: monthKey });
}

