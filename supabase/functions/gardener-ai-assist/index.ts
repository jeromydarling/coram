/**
 * gardener-ai-assist — AI companion editing for Gardener Studio.
 *
 * WHAT: Generates Ignatian-safe editorial suggestions (tone refinement, simplification, etc.)
 * WHERE: Called from StudioAiAssistPanel in Gardener Studio
 * WHY: AI assists but never replaces human voice. All output is proposed, never auto-published.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROMPTS: Record<string, string> = {
  refine_tone: `You are a pastoral editorial companion. Refine the following text to be gentler, warmer, and more invitational. Preserve the original meaning. Use Ignatian discernment language where appropriate. Never introduce urgency or hype.`,
  simplify: `You are a clarity companion. Simplify the following text without losing its depth or dignity. Use shorter sentences, clearer structure, and accessible vocabulary. Maintain the pastoral, reflective tone.`,
  ignatian_reflection: `You are an Ignatian spiritual companion. Weave contemplative rhythm into this text using the pattern: Noticing → Reflection → Insight → Gentle Invitation. Do not force structure — let it emerge naturally.`,
  generate_excerpt: `Generate a brief, compelling excerpt (2-3 sentences) for this essay. The excerpt should feel invitational and reflective, not like marketing copy. It should make the reader want to sit with the full text.`,
  improve_seo: `Generate an SEO title (under 60 chars) and meta description (under 160 chars) for this essay. The title should include a relevant keyword naturally. Format as:\nTitle: ...\nDescription: ...`,
  suggest_structure: `Suggest a clear structure for this text with section headings. Maintain the pastoral tone. Use the Ignatian rhythm (Noticing, Reflection, Insight, Invitation) as a loose guide if appropriate. Return the restructured text with headings in markdown.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Gardener access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, content, excerpt, entity_type, entity_id } = await req.json();

    if (!action || !PROMPTS[action]) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!content || content.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Content too short for assistance" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: max 10 per hour per user
    const { data: allowed } = await supabase.rpc("check_and_increment_rate_limit", {
      p_user_id: user.id,
      p_function_name: "gardener-ai-assist",
      p_window_minutes: 60,
      p_max_requests: 10,
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "Rate limit reached. Please wait before requesting more assistance." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = PROMPTS[action];
    const userContent = action === 'generate_excerpt'
      ? `Essay content:\n\n${content.slice(0, 3000)}`
      : action === 'improve_seo'
        ? `Essay content:\n\n${content.slice(0, 2000)}`
        : `Original text:\n\n${content.slice(0, 4000)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI service temporarily unavailable");
    }

    const aiData = await response.json();
    const proposed = aiData.choices?.[0]?.message?.content || "";

    if (!proposed.trim()) {
      throw new Error("AI returned empty response");
    }

    return new Response(JSON.stringify({
      proposed: proposed.trim(),
      reasoning: `AI suggestion using ${action.replace(/_/g, ' ')} mode. Review carefully before accepting.`,
      action,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("gardener-ai-assist error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
