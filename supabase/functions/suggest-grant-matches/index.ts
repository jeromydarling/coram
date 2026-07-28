import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { opportunity_id } = await req.json();

    if (!opportunity_id) {
      return new Response(JSON.stringify({ error: "opportunity_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the opportunity details
    const { data: opportunity, error: oppError } = await supabase
      .from("opportunities")
      .select(`
        id, organization, grant_alignment, mission_snapshot, 
        partner_tier, partner_tiers, metros(metro, region_id)
      `)
      .eq("id", opportunity_id)
      .single();

    if (oppError || !opportunity) {
      return new Response(JSON.stringify({ error: "Opportunity not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get grants that match the opportunity's alignment and aren't already linked
    const grantAlignments = opportunity.grant_alignment || [];
    const missionSnapshots = opportunity.mission_snapshot || [];

    // Fetch all active grants
    const { data: grants, error: grantsError } = await supabase
      .from("grants")
      .select(`
        id, grant_name, funder_name, funder_type, stage, 
        strategic_focus, grant_types, star_rating, 
        amount_requested, metros(metro)
      `)
      .eq("status", "Active")
      .is("opportunity_id", null); // Not already linked

    if (grantsError) {
      throw grantsError;
    }

    // Score each grant for relevance
    interface ScoredGrant {
      grant: typeof grants[0];
      score: number;
      matchReasons: string[];
    }

    const scoredGrants: ScoredGrant[] = (grants || []).map(grant => {
      let score = 0;
      const matchReasons: string[] = [];

      // Check strategic focus alignment
      const strategicFocus: string[] = (grant.strategic_focus as string[]) || [];
      for (const alignment of grantAlignments) {
        if (strategicFocus.some((sf: string) => sf.toLowerCase().includes(alignment.toLowerCase()))) {
          score += 30;
          matchReasons.push(`Aligns with ${alignment}`);
        }
      }

      // Check mission snapshot alignment
      for (const mission of missionSnapshots) {
        if (strategicFocus.some((sf: string) => sf.toLowerCase().includes(mission.toLowerCase()))) {
          score += 20;
          matchReasons.push(`Supports ${mission}`);
        }
      }

      // Metro match bonus
      if ((grant.metros as any)?.metro === (opportunity.metros as any)?.metro) {
        score += 25;
        matchReasons.push(`Same metro: ${(grant.metros as any)?.metro}`);
      }

      // Star rating bonus
      if (grant.star_rating >= 4) {
        score += 15;
        matchReasons.push('High star rating');
      }

      // Stage bonus (prioritize earlier stage grants that need opportunities)
      if (['Researching', 'Eligible', 'Cultivating'].includes(grant.stage)) {
        score += 10;
        matchReasons.push(`${grant.stage} stage`);
      }

      return { grant, score, matchReasons };
    });

    // Filter and sort by score
    const suggestions = scoredGrants
      .filter(sg => sg.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(sg => ({
        id: sg.grant.id,
        grant_name: sg.grant.grant_name,
        funder_name: sg.grant.funder_name,
        stage: sg.grant.stage,
        star_rating: sg.grant.star_rating,
        metro: (sg.grant.metros as any)?.metro,
        amount_requested: sg.grant.amount_requested,
        match_score: sg.score,
        match_reasons: sg.matchReasons
      }));

    return new Response(JSON.stringify({
      opportunity_id,
      organization: opportunity.organization,
      suggestions,
      generatedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in suggest-grant-matches:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
