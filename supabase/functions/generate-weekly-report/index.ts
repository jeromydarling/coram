import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Archetype voice & section config ──
const ARCHETYPE_VOICES: Record<string, { tone: string; priorities: string[]; excludeSections: string[] }> = {
  church: {
    tone: "Pastoral, contemplative, community-centered. Speak of people, not pipelines. Use language of accompaniment, invitation, and presence.",
    priorities: ["Relationship depth", "Community presence", "Pastoral care moments", "Volunteer engagement", "Upcoming gatherings"],
    excludeSections: [],
  },
  digital_inclusion: {
    tone: "Mission-driven, equity-focused, outcome-oriented. Emphasize access, empowerment, and community impact.",
    priorities: ["Partnership growth", "Community reach", "Technology provisions delivered", "Outreach effectiveness", "Engagement signals"],
    excludeSections: [],
  },
  social_enterprise: {
    tone: "Strategic, impact-minded, growth-aware. Balance mission language with operational clarity.",
    priorities: ["Partnership pipeline health", "Revenue-adjacent signals", "Outreach ROI", "Team momentum"],
    excludeSections: [],
  },
  workforce_development: {
    tone: "Empowerment-focused, outcome-driven, participant-centered. Emphasize skills, placements, and community partnerships.",
    priorities: ["Participant journey progress", "Employer partnerships", "Provisions delivered", "Program outcomes"],
    excludeSections: [],
  },
  refugee_support: {
    tone: "Compassionate, dignity-centered, culturally sensitive. Speak of accompaniment and resettlement milestones.",
    priorities: ["Case journey progress", "Provisions delivered", "Community connections", "Volunteer engagement"],
    excludeSections: [],
  },
  education_access: {
    tone: "Hopeful, student-centered, equity-aware. Emphasize access, mentorship, and learning milestones.",
    priorities: ["Student/family journey progress", "Mentor engagement", "Program provisions", "Community partnerships"],
    excludeSections: [],
  },
  library_system: {
    tone: "Community-serving, knowledge-focused, inclusive. Emphasize access, programs, and civic engagement.",
    priorities: ["Program reach", "Community partnerships", "Volunteer engagement", "Resource provisions"],
    excludeSections: [],
  },
  caregiver_solo: {
    tone: "Gentle, accompaniment-centered, deeply personal. Speak of presence, care rhythms, and quiet faithfulness.",
    priorities: ["Accompaniment rhythm", "Care moments", "Reflections", "Upcoming presence"],
    excludeSections: [],
  },
  caregiver_agency: {
    tone: "Compassionate, team-oriented, care-focused. Emphasize client journeys, team coordination, and holistic support.",
    priorities: ["Client journey progress", "Team care coordination", "Provisions delivered", "Community partnerships"],
    excludeSections: [],
  },
  missionary_org: {
    tone: "Mission-hearted, global-minded, faith-rooted. Speak of presence across communities and faithful partnership.",
    priorities: ["Field presence", "Partner relationships", "Provisions and support", "Prayer and reflection themes"],
    excludeSections: [],
  },
};

const DEFAULT_VOICE = {
  tone: "Strategic, mission-oriented, community-centered. Focus on outcomes and relationships, not technical metrics.",
  priorities: ["Relationship growth", "Journey progress", "Outreach effectiveness", "Provisions delivered", "Community signals"],
  excludeSections: [],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse optional user_id from body
    let targetUserIds: string[] = [];
    try {
      const body = await req.json();
      if (body?.user_id) targetUserIds = [body.user_id];
    } catch {
      // No body — cron invocation
    }

    if (targetUserIds.length === 0) {
      const { data: adminUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "leadership"]);
      targetUserIds = [...new Set((adminUsers || []).map((u: any) => u.user_id))];
    }

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ message: "No target users found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Resolve tenant + archetype + schedule preferences ──
    const firstUserId = targetUserIds[0];
    const { data: tenantLink } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", firstUserId)
      .limit(1)
      .maybeSingle();

    let tenantId = tenantLink?.tenant_id || null;
    let archetype = "digital_inclusion"; // fallback
    let tenantName = "Your Organization";
    let lookbackDays = 7;

    if (tenantId) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("archetype, name, brief_lookback_days")
        .eq("id", tenantId)
        .maybeSingle();
      if (tenant?.archetype) archetype = tenant.archetype;
      if (tenant?.name) tenantName = tenant.name;
      if (tenant?.brief_lookback_days) lookbackDays = tenant.brief_lookback_days;
    }

    const voice = ARCHETYPE_VOICES[archetype] || DEFAULT_VOICE;

    // Calculate date windows using tenant's preferred lookback
    const now = new Date();
    const lookbackMs = lookbackDays * 24 * 60 * 60 * 1000;
    const periodStart = new Date(now.getTime() - lookbackMs).toISOString();
    const doubleLookbackStart = new Date(now.getTime() - 2 * lookbackMs).toISOString();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Report date anchor = today
    const weekOfDate = now.toISOString().split("T")[0];

    // ─── AGGREGATE DATA ───
    // Build tenant filter helper
    const tenantFilter = (q: any) => tenantId ? q.eq("tenant_id", tenantId) : q;

    const [
      contactsRes,
      campaignsSentRes,
      repliesRes,
      calendarRes,
      opportunitiesRes,
      provisionsRes,
      reflectionsRes,
      contactTasksRes,
      orgTasksRes,
      signalsRes,
      journeyOppsRes,
    ] = await Promise.all([
      // Contacts created in lookback period
      supabase
        .from("contacts")
        .select("id, name, opportunity_id")
        .gte("created_at", periodStart),

      // Campaigns sent in lookback period
      supabase
        .from("email_campaigns")
        .select("id, name, subject, sent_count, failed_count, audience_count, status, last_sent_at")
        .in("status", ["sent", "partial"])
        .gte("last_sent_at", periodStart),

      // Outreach replies in lookback period
      supabase
        .from("outreach_replies")
        .select("id, campaign_id, outcome, direction, received_at")
        .gte("received_at", periodStart),

      // Upcoming calendar events (next 7 days)
      supabase
        .from("google_calendar_events")
        .select("id, title, start_time, location")
        .gte("start_time", now.toISOString())
        .lte("start_time", sevenDaysFromNow)
        .order("start_time", { ascending: true })
        .limit(20),

      // New opportunities in lookback period
      supabase
        .from("opportunities")
        .select("id, organization, stage")
        .gte("created_at", periodStart),

      // Provisions created in lookback period
      tenantFilter(
        supabase
          .from("provisions")
          .select("id, status, total_quantity, total_cents, requested_at, delivered_at, created_at")
          .gte("created_at", periodStart)
      ),

      // Reflections written in lookback period (for NRI risk signal extraction)
      supabase
        .from("opportunity_reflections")
        .select("id, body, created_at, opportunity_id")
        .gte("created_at", periodStart)
        .order("created_at", { ascending: false })
        .limit(50),

      // Contact tasks due in next 7 days
      supabase
        .from("contact_tasks")
        .select("id, title, due_date, is_completed")
        .eq("is_completed", false)
        .lte("due_date", sevenDaysFromNow)
        .gte("due_date", now.toISOString())
        .order("due_date", { ascending: true })
        .limit(15),

      // Org tasks due in next 7 days
      supabase
        .from("org_tasks")
        .select("id, title, due_at, status")
        .neq("status", "done")
        .lte("due_at", sevenDaysFromNow)
        .gte("due_at", now.toISOString())
        .order("due_at", { ascending: true })
        .limit(15),

      // Opportunity signals in lookback period
      supabase
        .from("opportunity_signals")
        .select("id, signal_type, opportunity_id, confidence")
        .gte("detected_at", periodStart),

      // Journey stage distribution (all active opportunities)
      supabase
        .from("opportunities")
        .select("id, organization, stage, updated_at")
        .not("stage", "in", '("closed_won","closed_lost","archived")')
        .order("updated_at", { ascending: false })
        .limit(100),
    ]);

    // ── Previous period for trend comparison ──
    const [prevContactsRes, prevCampaignsSentRes, prevRepliesRes, prevOpportunitiesRes] = await Promise.all([
      supabase.from("contacts").select("id").gte("created_at", doubleLookbackStart).lt("created_at", periodStart),
      supabase.from("email_campaigns").select("id, sent_count").in("status", ["sent", "partial"]).gte("last_sent_at", doubleLookbackStart).lt("last_sent_at", periodStart),
      supabase.from("outreach_replies").select("id").gte("received_at", doubleLookbackStart).lt("received_at", periodStart),
      supabase.from("opportunities").select("id").gte("created_at", doubleLookbackStart).lt("created_at", periodStart),
    ]);

    // ─── COMPUTE STRUCTURED DATA ───
    const contacts = contactsRes.data || [];
    const campaignsSent = campaignsSentRes.data || [];
    const replies = repliesRes.data || [];
    const calendarEvents = calendarRes.data || [];
    const opportunities = opportunitiesRes.data || [];
    const provisions = provisionsRes.data || [];
    const reflections = reflectionsRes.data || [];
    const contactTasks = contactTasksRes.data || [];
    const orgTasks = orgTasksRes.data || [];
    const signals = signalsRes.data || [];
    const journeyOpps = journeyOppsRes.data || [];

    const totalEmailsSent = campaignsSent.reduce((sum: number, c: any) => sum + (c.sent_count || 0), 0);
    const totalEmailsFailed = campaignsSent.reduce((sum: number, c: any) => sum + (c.failed_count || 0), 0);
    const usefulReplies = replies.filter((r: any) => r.outcome === "useful").length;

    // Campaign detail for the brief
    const campaignDetails = campaignsSent.map((c: any) => {
      const campaignReplies = replies.filter((r: any) => r.campaign_id === c.id);
      return {
        name: c.name,
        subject: c.subject,
        sent: c.sent_count || 0,
        failed: c.failed_count || 0,
        audience: c.audience_count || 0,
        replies_count: campaignReplies.length,
        useful_replies: campaignReplies.filter((r: any) => r.outcome === "useful").length,
        sent_at: c.last_sent_at,
      };
    });

    // Provision summary
    const provisionSummary = {
      total_created: provisions.length,
      total_quantity: provisions.reduce((sum: number, p: any) => sum + (p.total_quantity || 0), 0),
      total_value_cents: provisions.reduce((sum: number, p: any) => sum + (p.total_cents || 0), 0),
      by_status: provisions.reduce((acc: Record<string, number>, p: any) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      delivered_count: provisions.filter((p: any) => p.status === "delivered" || p.delivered_at).length,
    };

    // Journey stage distribution
    const journeyStages: Record<string, number> = {};
    for (const o of journeyOpps) {
      const stage = (o as any).stage || "unknown";
      journeyStages[stage] = (journeyStages[stage] || 0) + 1;
    }

    // Calendar + Tasks preview
    const calendarPreviewItems = calendarEvents.map((e: any) => ({
      type: "calendar",
      title: e.title,
      date: e.start_time,
      location: e.location,
    }));
    const taskPreviewItems = [
      ...contactTasks.map((t: any) => ({ type: "task", title: t.title, date: t.due_date })),
      ...orgTasks.map((t: any) => ({ type: "task", title: t.title, date: t.due_at })),
    ];

    // Signal breakdown
    const signalsByType: Record<string, number> = {};
    for (const s of signals) {
      const t = (s as any).signal_type || "unknown";
      signalsByType[t] = (signalsByType[t] || 0) + 1;
    }

    // Reflection snippets for NRI risk analysis (anonymized, just the body text)
    const reflectionSnippets = reflections.slice(0, 20).map((r: any) => r.body?.slice(0, 200));

    // Previous week
    const prevContacts = prevContactsRes.data || [];
    const prevCampaignsSent = prevCampaignsSentRes.data || [];
    const prevTotalEmailsSent = prevCampaignsSent.reduce((sum: number, c: any) => sum + ((c as any).sent_count || 0), 0);
    const prevReplies = prevRepliesRes.data || [];
    const prevOpportunities = prevOpportunitiesRes.data || [];

    const trend = (curr: number, prev: number) => curr > prev ? "up" : curr < prev ? "down" : "flat";

    const metrics = {
      contacts_added: contacts.length,
      opportunities_added: opportunities.length,
      opportunity_orgs: opportunities.slice(0, 10).map((o: any) => o.organization),
      campaigns_sent: campaignsSent.length,
      campaign_details: campaignDetails,
      total_emails_sent: totalEmailsSent,
      total_emails_failed: totalEmailsFailed,
      email_success_rate: totalEmailsSent > 0 ? Math.round(((totalEmailsSent - totalEmailsFailed) / totalEmailsSent) * 100) : null,
      outreach_replies: replies.length,
      useful_replies: usefulReplies,
      provisions: provisionSummary,
      journey_stages: journeyStages,
      engagement_signals: signals.length,
      signal_breakdown: signalsByType,
      reflections_written: reflections.length,
      upcoming_calendar: calendarPreviewItems,
      upcoming_tasks: taskPreviewItems,
      trends: {
        contacts: trend(contacts.length, prevContacts.length),
        campaigns_sent: trend(campaignsSent.length, prevCampaignsSent.length),
        emails_sent: trend(totalEmailsSent, prevTotalEmailsSent),
        replies: trend(replies.length, prevReplies.length),
        opportunities: trend(opportunities.length, prevOpportunities.length),
      },
    };

    // ─── LLM GENERATION ───
    const periodLabel = lookbackDays === 7 ? "last week" : lookbackDays === 14 ? "the last two weeks" : `the last ${lookbackDays} days`;
    const systemPrompt = `You generate a leadership brief for "${tenantName}", a ${archetype.replace(/_/g, " ")} organization using CROS™ (Communal Relationship Operating System).

This report covers ${periodLabel}'s activity (${lookbackDays} days). Always use past tense and "${periodLabel}" framing.
You DO NOT invent activity. You ONLY summarize the structured data provided.

VOICE:
${voice.tone}

PRIORITIES (in order of importance for this archetype):
${voice.priorities.map((p, i) => `${i + 1}) ${p}`).join("\n")}

SECTIONS TO GENERATE (JSON output):
{
  "headline": string (warm, mission-aligned, not corporate),
  "executive_summary": string (2-3 sentences capturing the week's story),
  "key_wins": [string] (meaningful moments, not vanity metrics),
  "relationship_growth": [string] (new people, deepened connections),
  "journey_movement": [string] (stage transitions, new organizations, journey momentum — NOT "pipeline"),
  "outreach_report": [string] (for EACH campaign sent: name it, how many emails sent, delivery rate, and how many replies received. Be specific with campaign names.),
  "provisions_delivered": [string] (what was provided, quantities, fulfillment status),
  "engagement_signals": [string] (signals detected and what they indicate),
  "upcoming_focus": [string] (what's ahead based on calendar + tasks),
  "risks_or_concerns": [string|null] (ONLY from relationship reflections that sound like roadblocks, concerns, or stalled relationships. Do NOT include app errors, system issues, or technical problems. If no concerning reflections exist, return [].),
  "calendar_preview": [string] (upcoming calendar events AND pending tasks, formatted as "Day: Event/Task title")
}

REFLECTION ANALYSIS INSTRUCTIONS:
- Review the reflection snippets provided
- Identify any that express concern, frustration, stalled progress, or relationship tension
- Summarize these as human-readable risks (e.g., "A reflection noted growing distance with [organization type]")
- Do NOT quote reflections verbatim — paraphrase respectfully
- If no reflections suggest concerns, leave risks_or_concerns as []

Rules:
- Use the organization's archetype voice throughout
- Campaign names MUST be included in outreach_report — do not generalize
- If a section has no data, return []
- No markdown. JSON only.
- Never mention system names, technical terms, or error codes`;

    const userPrompt = `Here is the structured data for the leadership brief covering ${periodLabel} (${lookbackDays} days).

METRICS:
${JSON.stringify(metrics, null, 2)}

REFLECTION SNIPPETS (for risk/concern analysis only):
${JSON.stringify(reflectionSnippets, null, 2)}`;

    // Check if there's any activity
    const hasActivity = metrics.contacts_added > 0 ||
      metrics.campaigns_sent > 0 || metrics.total_emails_sent > 0 ||
      metrics.opportunities_added > 0 || metrics.provisions.total_created > 0 ||
      metrics.reflections_written > 0 || metrics.engagement_signals > 0;

    let reportJson: any;

    if (!hasActivity) {
      reportJson = {
        headline: "A Quiet Week — Space for Reflection",
        executive_summary: "Last week held a gentle rhythm. No significant new activity was recorded, offering space for planning and presence.",
        key_wins: [],
        relationship_growth: [],
        journey_movement: [],
        outreach_report: [],
        provisions_delivered: [],
        engagement_signals: [],
        upcoming_focus: [],
        risks_or_concerns: [],
        calendar_preview: [
          ...calendarEvents.map((e: any) =>
            `${new Date(e.start_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}: ${e.title}`
          ),
          ...contactTasks.slice(0, 5).map((t: any) =>
            `${new Date(t.due_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}: [Task] ${t.title}`
          ),
          ...orgTasks.slice(0, 5).map((t: any) =>
            `${new Date(t.due_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}: [Task] ${t.title}`
          ),
        ],
      };
    } else {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI gateway error:", aiResponse.status, errorText);

        if (aiResponse.status === 429 || aiResponse.status === 402) {
          // Fallback with structured data
          reportJson = {
            headline: `Week in Review — ${metrics.contacts_added} New Connections`,
            executive_summary: `Last week saw ${metrics.contacts_added} new contacts, ${metrics.campaigns_sent} campaigns sent (${metrics.total_emails_sent} emails), and ${metrics.provisions.total_created} provisions created.`,
            key_wins: metrics.contacts_added > 0 ? [`${metrics.contacts_added} new relationships formed`] : [],
            relationship_growth: [],
            journey_movement: [],
            outreach_report: campaignDetails.map((c: any) => `"${c.name}": ${c.sent} emails sent, ${c.replies_count} replies`),
            provisions_delivered: metrics.provisions.total_created > 0
              ? [`${metrics.provisions.total_created} provisions created (${metrics.provisions.delivered_count} delivered)`]
              : [],
            engagement_signals: [],
            upcoming_focus: [],
            risks_or_concerns: [],
            calendar_preview: calendarEvents.map((e: any) =>
              `${new Date(e.start_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}: ${e.title}`
            ),
          };
        } else {
          throw new Error(`AI gateway error: ${aiResponse.status}`);
        }
      } else {
        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "";

        let cleaned = content.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }

        try {
          reportJson = JSON.parse(cleaned);
        } catch (parseErr) {
          console.error("Failed to parse AI response:", cleaned);
          reportJson = {
            headline: `Week in Review`,
            executive_summary: `Activity summary: ${metrics.contacts_added} contacts, ${metrics.campaigns_sent} campaigns, ${metrics.provisions.total_created} provisions.`,
            key_wins: [],
            relationship_growth: [],
            journey_movement: [],
            outreach_report: [],
            provisions_delivered: [],
            engagement_signals: [],
            upcoming_focus: [],
            risks_or_concerns: [],
            calendar_preview: [],
          };
        }
      }
    }

    // Attach raw metrics
    reportJson._metrics = metrics;
    reportJson._generated_at = now.toISOString();
    reportJson._archetype = archetype;
    reportJson._tenant_name = tenantName;
    reportJson._lookback_days = lookbackDays;

    // ─── STORE REPORT ───
    const results: any[] = [];
    for (const userId of targetUserIds) {
      // Upsert — allow regeneration
      const { data: existing } = await supabase
        .from("weekly_reports")
        .select("id")
        .eq("user_id", userId)
        .eq("week_of_date", weekOfDate)
        .maybeSingle();

      if (existing) {
        // Update existing report
        const { error: updateErr } = await supabase
          .from("weekly_reports")
          .update({ report_json: reportJson })
          .eq("id", existing.id);

        if (updateErr) {
          console.error(`Failed to update report for ${userId}:`, updateErr);
          results.push({ user_id: userId, status: "error", error: updateErr.message });
        } else {
          results.push({ user_id: userId, status: "updated", week: weekOfDate });
        }
      } else {
        const { error: insertErr } = await supabase
          .from("weekly_reports")
          .insert({
            user_id: userId,
            week_of_date: weekOfDate,
            report_json: reportJson,
          });

        if (insertErr) {
          console.error(`Failed to insert report for ${userId}:`, insertErr);
          results.push({ user_id: userId, status: "error", error: insertErr.message });
        } else {
          results.push({ user_id: userId, status: "created", week: weekOfDate });
        }
      }
    }

    return new Response(
      JSON.stringify({ message: "CROS Leadership Brief v4 — Archetype-aware", results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-weekly-report error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
