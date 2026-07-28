/**
 * tenant-export-spine — Trust Export: lets tenants download their data.
 *
 * WHAT: Exports opportunities, contacts, activities, events, and reflections summary.
 * WHERE: Tenant Settings → Data & Trust → "Export My Relationships".
 * WHY: Customers must feel safe to leave anytime — data portability is trust.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const tenantId: string | null = body.tenant_id;
    const format: string = body.format || "json"; // "json" or "csv"

    if (!tenantId) return json({ error: "tenant_id required" }, 400);

    // Verify user belongs to tenant
    const { data: membership } = await anonClient
      .from("tenant_users")
      .select("id, role")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .limit(1);

    if (!membership || membership.length === 0) {
      return json({ error: "Not a member of this tenant" }, 403);
    }

    // Use service role for complete data export
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Export data
    const [opps, contacts, activities, events, reflections] = await Promise.all([
      svc.from("opportunities")
        .select("organization, stage, status, website_url, metro_id, notes, created_at, updated_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),

      svc.from("contacts")
        .select("name, email, phone, title, notes, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),

      svc.from("activities")
        .select("activity_type, activity_date_time, notes, outcome, next_action")
        .eq("tenant_id", tenantId)
        .order("activity_date_time", { ascending: false })
        .limit(500),

      svc.from("events")
        .select("event_name, event_date, event_type, location, notes, created_at")
        .eq("tenant_id", tenantId)
        .order("event_date", { ascending: false }),

      svc.from("opportunity_reflections")
        .select("reflection_type, content, sentiment, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      tenant_id: tenantId,
      format: "cros_export_v1",
      data: {
        opportunities: opps.data ?? [],
        contacts: contacts.data ?? [],
        activities: activities.data ?? [],
        events: events.data ?? [],
        reflections_summary: {
          total: reflections.data?.length ?? 0,
          types: [...new Set(reflections.data?.map(r => r.reflection_type) ?? [])],
          note: "Full reflection content is not included for privacy. This is a summary only.",
        },
      },
      totals: {
        opportunities: opps.data?.length ?? 0,
        contacts: contacts.data?.length ?? 0,
        activities: activities.data?.length ?? 0,
        events: events.data?.length ?? 0,
        reflections: reflections.data?.length ?? 0,
      },
    };

    if (format === "csv") {
      // Build CSV bundle as JSON with CSV strings
      const toCsv = (rows: Record<string, unknown>[]) => {
        if (rows.length === 0) return "";
        const headers = Object.keys(rows[0]);
        const lines = [headers.join(",")];
        for (const row of rows) {
          lines.push(headers.map(h => {
            const v = row[h];
            const str = v === null || v === undefined ? "" : String(v);
            return str.includes(",") || str.includes('"') || str.includes("\n")
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          }).join(","));
        }
        return lines.join("\n");
      };

      return json({
        exported_at: exportData.exported_at,
        format: "csv_bundle",
        files: {
          "opportunities.csv": toCsv(opps.data ?? []),
          "contacts.csv": toCsv(contacts.data ?? []),
          "activities.csv": toCsv(activities.data ?? []),
          "events.csv": toCsv(events.data ?? []),
        },
        totals: exportData.totals,
      });
    }

    return json(exportData);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
