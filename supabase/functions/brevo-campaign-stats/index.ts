import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BrevoStatistics {
  uniqueClicks: number;
  clickers: number;
  complaints: number;
  delivered: number;
  sent: number;
  softBounces: number;
  hardBounces: number;
  uniqueViews: number;
  trackableViews: number;
  unsubscriptions: number;
  trackableViewsRate?: number;
  estimatedViews?: number;
}

interface BrevoCampaignResponse {
  id: number;
  name: string;
  subject: string;
  status: string;
  statistics: {
    globalStats: BrevoStatistics;
  };
  sentDate?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { campaignId } = await req.json();
    if (!campaignId) {
      return new Response(JSON.stringify({ error: "campaignId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the campaign's brevo_campaign_id
    const { data: campaign, error: campaignError } = await supabase
      .from("email_campaigns")
      .select("brevo_campaign_id, status")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!campaign.brevo_campaign_id) {
      return new Response(JSON.stringify({ error: "Campaign not synced to Brevo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    if (!BREVO_API_KEY) {
      throw new Error("BREVO_API_KEY not configured");
    }

    // Fetch campaign stats from Brevo
    const brevoResponse = await fetch(
      `https://api.brevo.com/v3/emailCampaigns/${campaign.brevo_campaign_id}`,
      {
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    if (!brevoResponse.ok) {
      const errorText = await brevoResponse.text();
      console.error("Brevo API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch stats from Brevo" }),
        {
          status: brevoResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const brevoData: BrevoCampaignResponse = await brevoResponse.json();
    const stats = brevoData.statistics?.globalStats;

    if (!stats) {
      return new Response(
        JSON.stringify({ 
          stats: null, 
          message: "No statistics available yet" 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Calculate rates
    const deliveryRate = stats.sent > 0 
      ? ((stats.delivered / stats.sent) * 100).toFixed(1) 
      : "0";
    const openRate = stats.delivered > 0 
      ? ((stats.uniqueViews / stats.delivered) * 100).toFixed(1) 
      : "0";
    const clickRate = stats.delivered > 0 
      ? ((stats.uniqueClicks / stats.delivered) * 100).toFixed(1) 
      : "0";
    const bounceRate = stats.sent > 0 
      ? (((stats.softBounces + stats.hardBounces) / stats.sent) * 100).toFixed(1) 
      : "0";

    const responseStats = {
      sent: stats.sent,
      delivered: stats.delivered,
      uniqueOpens: stats.uniqueViews,
      uniqueClicks: stats.uniqueClicks,
      softBounces: stats.softBounces,
      hardBounces: stats.hardBounces,
      unsubscribes: stats.unsubscriptions,
      complaints: stats.complaints,
      deliveryRate: parseFloat(deliveryRate),
      openRate: parseFloat(openRate),
      clickRate: parseFloat(clickRate),
      bounceRate: parseFloat(bounceRate),
      sentDate: brevoData.sentDate,
      brevoStatus: brevoData.status,
    };

    return new Response(JSON.stringify({ stats: responseStats }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error fetching campaign stats:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
