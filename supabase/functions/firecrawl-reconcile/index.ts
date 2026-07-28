/**
 * firecrawl-reconcile — Polls Firecrawl's account usage API for ground truth credit balance.
 *
 * WHAT: Fetches actual remaining Firecrawl credits and stores a reconciliation snapshot.
 * WHERE: Called on a schedule (daily) or manually by the Gardener.
 * WHY: Our internal credit tracking is based on response-level creditsUsed; this provides
 *       a periodic ground-truth check against the vendor's actual balance.
 *
 * Zone: MACHINA (system monitoring)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "FIRECRAWL_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Poll Firecrawl account/credit info ──
    // Firecrawl v1 exposes GET /v1/team/credit-usage for credit balance
    const creditResp = await fetch("https://api.firecrawl.dev/v1/team/credit-usage", {
      method: "GET",
      headers: { Authorization: `Bearer ${firecrawlKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!creditResp.ok) {
      // Fallback: try the /v1/credits endpoint (some plan tiers use this)
      const fallbackResp = await fetch("https://api.firecrawl.dev/v1/credits", {
        method: "GET",
        headers: { Authorization: `Bearer ${firecrawlKey}` },
        signal: AbortSignal.timeout(10_000),
      });

      if (!fallbackResp.ok) {
        const errText = await fallbackResp.text().catch(() => "");
        console.error(`[firecrawl-reconcile] API error: ${fallbackResp.status} ${errText}`);
        return new Response(
          JSON.stringify({ ok: false, error: `Firecrawl API returned ${fallbackResp.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const fallbackData = await fallbackResp.json();
      return await storeSnapshot(fallbackData);
    }

    const creditData = await creditResp.json();
    return await storeSnapshot(creditData);

  } catch (err) {
    console.error("[firecrawl-reconcile] Error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  async function storeSnapshot(vendorData: Record<string, unknown>) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Extract credits info (Firecrawl returns various shapes)
    const remaining = vendorData.remaining_credits
      ?? vendorData.remainingCredits
      ?? vendorData.credits_remaining
      ?? (vendorData.data as Record<string, unknown>)?.remaining_credits
      ?? null;

    const total = vendorData.total_credits
      ?? vendorData.totalCredits
      ?? vendorData.credits_total
      ?? (vendorData.data as Record<string, unknown>)?.total_credits
      ?? null;

    const used = vendorData.used_credits
      ?? vendorData.usedCredits
      ?? vendorData.credits_used
      ?? (vendorData.data as Record<string, unknown>)?.used_credits
      ?? null;

    const snapshot = {
      vendor: "firecrawl",
      snapshot_at: new Date().toISOString(),
      vendor_remaining: typeof remaining === "number" ? remaining : null,
      vendor_total: typeof total === "number" ? total : null,
      vendor_used: typeof used === "number" ? used : null,
      raw_response: vendorData,
    };

    // Store in vendor_credit_snapshots table
    const { error } = await supabase
      .from("vendor_credit_snapshots")
      .insert(snapshot);

    if (error) {
      console.warn("[firecrawl-reconcile] Failed to store snapshot:", error.message);
    }

    console.log(`[firecrawl-reconcile] Snapshot: remaining=${remaining}, used=${used}, total=${total}`);

    return new Response(
      JSON.stringify({
        ok: true,
        remaining,
        used,
        total,
        snapshot_at: snapshot.snapshot_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
