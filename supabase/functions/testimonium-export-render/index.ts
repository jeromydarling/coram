/**
 * testimonium-export-render — Returns structured export payload for frontend rendering.
 *
 * WHAT: Reads an export + sections and returns a render-ready JSON payload.
 * WHERE: Called from Testimonium Export preview/PDF.
 * WHY: Separates data assembly from presentation.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const body = await req.json();
    const { export_id } = body;
    if (!export_id) {
      return new Response(JSON.stringify({ ok: false, error: "Missing export_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use user client so RLS applies
    const { data: exportRow, error: expErr } = await userClient
      .from("testimonium_exports")
      .select("*")
      .eq("id", export_id)
      .single();

    if (expErr || !exportRow) {
      return new Response(JSON.stringify({ ok: false, error: "Export not found or access denied" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sections } = await userClient
      .from("testimonium_export_sections")
      .select("*")
      .eq("export_id", export_id)
      .order("order_index", { ascending: true });

    const result = {
      title: "Witnessed Stories",
      subtitle: `${exportRow.period_start} — ${exportRow.period_end}`,
      export_type: exportRow.export_type,
      metrics: exportRow.metrics_snapshot,
      sections: (sections || []).map((s: any) => ({
        key: s.section_key,
        title: s.title,
        body: s.body,
      })),
    };

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
