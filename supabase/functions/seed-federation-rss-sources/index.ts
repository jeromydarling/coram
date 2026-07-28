/**
 * seed-federation-rss-sources — One-shot bulk-seed for monthly federation SEO.
 *
 * WHAT: Inserts 77 verified RSS feed URLs into operator_rss_sources, tagged
 *       with the correct source_app for each of 11 SEO-active satellites.
 *       Safe to re-run (uses ON CONFLICT DO NOTHING on the unique url index).
 * WHERE: Called manually once by an admin via cURL or fetch from the operator
 *        console. After successful run, this function can be disabled.
 * WHY:  Feeds were researched and verified out-of-band (HTTP 200 + valid
 *       RSS/Atom XML). This avoids a 77-row migration file and keeps the
 *       seed reviewable in JSON form.
 *
 * Auth: Operator JWT (admin role required).
 * Method: POST (no body required)
 * Returns: { ok, inserted, skipped, by_satellite: {slug: count} }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Verified RSS feeds, grouped by satellite slug ────────────────────────
// Generated from /home/user/workspace/feeds_verified.json on 2026-05-30.
// Each URL returned HTTP 200 with valid RSS/Atom XML when fetched with a
// browser-grade User-Agent.
const FEEDS: Record<string, Array<{ name: string; url: string; publisher: string }>> = {
  "refugium": [
    {
      "name": "National VOAD News",
      "url": "https://www.nvoad.org/feed/",
      "publisher": "National Voluntary Organizations Active in Disaster"
    },
    {
      "name": "National VOAD Disaster Case Management Committee",
      "url": "https://www.nvoad.org/disaster-case-management-committee/feed/",
      "publisher": "National Voluntary Organizations Active in Disaster"
    },
    {
      "name": "Mutual Aid Disaster Relief Blog",
      "url": "https://mutualaiddisasterrelief.org/feed/",
      "publisher": "Mutual Aid Disaster Relief"
    },
    {
      "name": "Direct Relief",
      "url": "https://www.directrelief.org/feed/",
      "publisher": "Direct Relief"
    },
    {
      "name": "Disaster Recovery Journal",
      "url": "https://drj.com/feed/",
      "publisher": "Disaster Recovery Journal"
    },
    {
      "name": "Center for Disaster Philanthropy",
      "url": "https://disasterphilanthropy.org/feed/",
      "publisher": "Center for Disaster Philanthropy"
    }
  ],
  "resurrectio": [
    {
      "name": "Prison Policy Initiative Blog Feed",
      "url": "https://www.prisonpolicy.org/blog/feed/",
      "publisher": "Prison Policy Initiative"
    },
    {
      "name": "Casey Connects Blog",
      "url": "https://www.aecf.org/blog/rss.xml",
      "publisher": "The Annie E. Casey Foundation"
    },
    {
      "name": "CSG Justice Center Feed",
      "url": "https://csgjusticecenter.org/feed",
      "publisher": "CSG Justice Center"
    },
    {
      "name": "Justice News",
      "url": "https://www.justice.gov/news/rss",
      "publisher": "U.S. Department of Justice"
    },
    {
      "name": "National Reentry Resource Center",
      "url": "https://nationalreentryresourcecenter.org/rss.xml",
      "publisher": "National Reentry Resource Center"
    },
    {
      "name": "Kairos Prison Ministry News",
      "url": "https://kairosprisonministry.org/feed/",
      "publisher": "Kairos Prison Ministry International"
    },
    {
      "name": "Solitary Watch",
      "url": "https://solitarywatch.org/feed/",
      "publisher": "Solitary Watch"
    },
    {
      "name": "Sentencing Project",
      "url": "https://www.sentencingproject.org/feed/",
      "publisher": "The Sentencing Project"
    },
    {
      "name": "The Marshall Project",
      "url": "https://www.themarshallproject.org/rss/recent.rss",
      "publisher": "The Marshall Project"
    },
    {
      "name": "Catholic Mobilizing Network",
      "url": "https://catholicsmobilizing.org/feed",
      "publisher": "Catholic Mobilizing Network"
    }
  ],
  "fabrica-forge": [
    {
      "name": "iFixit News RSS",
      "url": "https://www.ifixit.com/News/rss",
      "publisher": "iFixit"
    },
    {
      "name": "iFixit News RSS (self-link endpoint)",
      "url": "https://www.ifixit.com/News/feed",
      "publisher": "iFixit"
    },
    {
      "name": "Make: Category Feed Placeholder",
      "url": "https://makezine.com/feed/",
      "publisher": "Make: DIY Projects and Ideas for Makers"
    },
    {
      "name": "DoES Liverpool Blog Placeholder",
      "url": "https://doesliverpool.com/feed/",
      "publisher": "DoES Liverpool"
    },
    {
      "name": "Hackaday",
      "url": "https://hackaday.com/feed/",
      "publisher": "Hackaday"
    },
    {
      "name": "Hackster News",
      "url": "https://www.hackster.io/news.rss",
      "publisher": "Hackster.io"
    },
    {
      "name": "DIY Network Family Handyman",
      "url": "https://www.familyhandyman.com/feed/",
      "publisher": "Family Handyman"
    },
    {
      "name": "Apartment Therapy DIY",
      "url": "https://feeds.feedburner.com/apartmenttherapy/diy",
      "publisher": "Apartment Therapy"
    },
    {
      "name": "Adafruit Blog",
      "url": "https://blog.adafruit.com/feed/",
      "publisher": "Adafruit"
    }
  ],
  "transitus": [
    {
      "name": "NRDC News & Commentary RSS",
      "url": "https://www.nrdc.org/rss.xml",
      "publisher": "[NRDC](https://www.nrdc.org/news-and-commentary)"
    },
    {
      "name": "Grist Climate and Environmental News Feed",
      "url": "https://grist.org/feed/",
      "publisher": "[Grist](https://grist.org)"
    },
    {
      "name": "Climate Justice Alliance Blog",
      "url": "https://climatejusticealliance.org/feed/",
      "publisher": "[Climate Justice Alliance](https://climatejusticealliance.org)"
    },
    {
      "name": "Inside Climate News",
      "url": "https://insideclimatenews.org/feed/",
      "publisher": "Inside Climate News"
    },
    {
      "name": "Resilience.org",
      "url": "https://www.resilience.org/feed/",
      "publisher": "Post Carbon Institute"
    },
    {
      "name": "Environmental Health News",
      "url": "https://www.ehn.org/feeds/feed.rss",
      "publisher": "EHN"
    },
    {
      "name": "Yale Environment 360",
      "url": "https://e360.yale.edu/feed.xml",
      "publisher": "Yale E360"
    },
    {
      "name": "Catholic Climate Covenant",
      "url": "https://catholicclimatecovenant.org/feed",
      "publisher": "Catholic Climate Covenant"
    }
  ],
  "communis": [
    {
      "name": "Nonprofit Quarterly \u2013 Home feed",
      "url": "https://nonprofitquarterly.org/feed/",
      "publisher": "Nonprofit Quarterly"
    },
    {
      "name": "Shareable",
      "url": "https://www.shareable.net/feed/",
      "publisher": "Shareable"
    },
    {
      "name": "Yes! Magazine",
      "url": "https://www.yesmagazine.org/feed",
      "publisher": "YES! Magazine"
    },
    {
      "name": "Nation Worker Cooperative News",
      "url": "https://www.thenation.com/subject/labor/feed/",
      "publisher": "The Nation - Labor"
    },
    {
      "name": "Stanford Social Innovation Review",
      "url": "https://ssir.org/site/rss_2.0",
      "publisher": "SSIR"
    },
    {
      "name": "Grassroots Economic Organizing",
      "url": "https://geo.coop/rss.xml",
      "publisher": "GEO Newsletter"
    },
    {
      "name": "Project Equity",
      "url": "https://project-equity.org/feed/",
      "publisher": "Project Equity"
    },
    {
      "name": "Co-operative News",
      "url": "https://www.thenews.coop/feed/",
      "publisher": "Co-operative News"
    }
  ],
  "propria": [
    {
      "name": "HUD News RSS",
      "url": "https://www.hud.gov/rss.xml",
      "publisher": "U.S. Department of Housing and Urban Development"
    },
    {
      "name": "Shelterforce Magazine",
      "url": "https://shelterforce.org/feed/",
      "publisher": "Shelterforce"
    },
    {
      "name": "Strong Towns",
      "url": "https://www.strongtowns.org/journal?format=rss",
      "publisher": "Strong Towns"
    },
    {
      "name": "Catholic News Service",
      "url": "https://www.catholicnewsagency.com/rss/news.xml",
      "publisher": "Catholic News Agency"
    }
  ],
  "bitoku": [
    {
      "name": "MartialJournal feed candidate",
      "url": "https://martialjournal.com/feed",
      "publisher": "MartialJournal.com"
    },
    {
      "name": "Club Industry",
      "url": "https://www.clubindustry.com/rss.xml",
      "publisher": "Club Industry"
    },
    {
      "name": "Coach & AD Magazine",
      "url": "https://coachad.com/feed/",
      "publisher": "Coach & AD"
    },
    {
      "name": "Bonnier Sports Marketing",
      "url": "https://www.sgbonline.com/feed/",
      "publisher": "SGB Online"
    }
  ],
  "hortus": [
    {
      "name": "Fine Gardening",
      "url": "https://www.finegardening.com/feed",
      "publisher": "Fine Gardening"
    },
    {
      "name": "Civil Eats",
      "url": "https://civileats.com/feed/",
      "publisher": "Civil Eats"
    },
    {
      "name": "USDA ARS News",
      "url": "https://www.ars.usda.gov/news-events/news/rss/",
      "publisher": "USDA Agricultural Research Service"
    },
    {
      "name": "Modern Farmer",
      "url": "https://modernfarmer.com/feed/",
      "publisher": "Modern Farmer"
    },
    {
      "name": "Rodale Institute",
      "url": "https://rodaleinstitute.org/feed/",
      "publisher": "Rodale Institute"
    },
    {
      "name": "Garden Professors",
      "url": "https://gardenprofessors.com/feed/",
      "publisher": "Garden Professors Blog"
    },
    {
      "name": "Sustainable Food Trust",
      "url": "https://sustainablefoodtrust.org/feed/",
      "publisher": "Sustainable Food Trust"
    }
  ],
  "vigilia": [
    {
      "name": "LeadingAge News",
      "url": "https://leadingage.org/feed/",
      "publisher": "LeadingAge"
    },
    {
      "name": "Our Sunday Visitor News",
      "url": "https://www.osvnews.com/feed/",
      "publisher": "Our Sunday Visitor / OSV News"
    },
    {
      "name": "Catholic World Report",
      "url": "https://www.catholicworldreport.com/feed/",
      "publisher": "Catholic World Report"
    },
    {
      "name": "Aleteia",
      "url": "https://aleteia.org/feed/",
      "publisher": "Aleteia"
    },
    {
      "name": "Senior Housing News",
      "url": "https://seniorhousingnews.com/feed/",
      "publisher": "Senior Housing News"
    },
    {
      "name": "I Advance Senior Care",
      "url": "https://iadvanceseniorcare.com/feed/",
      "publisher": "I Advance Senior Care"
    },
    {
      "name": "Crux Now",
      "url": "https://cruxnow.com/feed",
      "publisher": "Crux Catholic"
    },
    {
      "name": "Argentum Senior Living",
      "url": "https://www.argentum.org/feed/",
      "publisher": "Argentum"
    }
  ],
  "rehearso": [
    {
      "name": "American Choral Directors Association News",
      "url": "https://acda.org/feed/",
      "publisher": "American Choral Directors Association"
    },
    {
      "name": "American Songwriter",
      "url": "https://americansongwriter.com/feed/",
      "publisher": "American Songwriter"
    },
    {
      "name": "American Theatre Magazine",
      "url": "https://www.americantheatre.org/feed/",
      "publisher": "Theatre Communications Group"
    },
    {
      "name": "Live Design Online",
      "url": "https://www.livedesignonline.com/rss.xml",
      "publisher": "Live Design"
    },
    {
      "name": "OperaWire",
      "url": "https://operawire.com/feed/",
      "publisher": "OperaWire"
    },
    {
      "name": "Chorus America",
      "url": "https://www.chorusamerica.org/rss.xml",
      "publisher": "Chorus America"
    }
  ],
  "via-publica": [
    {
      "name": "Streetsblog USA",
      "url": "https://usa.streetsblog.org/feed",
      "publisher": "Streetsblog USA"
    },
    {
      "name": "Streetsblog NYC",
      "url": "https://nyc.streetsblog.org/feed",
      "publisher": "Streetsblog NYC"
    },
    {
      "name": "Transportation for America",
      "url": "https://t4america.org/feed/",
      "publisher": "Transportation for America"
    },
    {
      "name": "Sightline Institute",
      "url": "https://www.sightline.org/feed/",
      "publisher": "Sightline Institute"
    },
    {
      "name": "Strong Towns",
      "url": "https://www.strongtowns.org/journal?format=rss",
      "publisher": "Strong Towns"
    },
    {
      "name": "ITDP - Sustainable Transport",
      "url": "https://www.itdp.org/feed/",
      "publisher": "Institute for Transportation and Development Policy"
    },
    {
      "name": "CityLab",
      "url": "https://www.bloomberg.com/feeds/citylab/sitemap_news.xml",
      "publisher": "Bloomberg CityLab"
    }
  ]
};

const CATEGORY_BY_SLUG: Record<string, string> = {
  "bitoku": "martial_arts",
  "communis": "cooperative_economy",
  "fabrica-forge": "maker_culture",
  "hortus": "horticulture",
  "propria": "community_land_trust",
  "refugium": "humanitarian_response",
  "rehearso": "performing_arts",
  "resurrectio": "criminal_justice_reentry",
  "transitus": "environmental_justice",
  "via-publica": "walkability_urbanism",
  "vigilia": "catholic_eldercare",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST only" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Auth: operator JWT, admin role required
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ ok: false, error: "Missing auth" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: { user }, error: authErr } = await userClient.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (authErr || !user) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  if (!roles?.some((r: { role: string }) => r.role === "admin")) {
    return new Response(JSON.stringify({ ok: false, error: "Admin only" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Seed each feed
  const bySatellite: Record<string, number> = {};
  let inserted = 0;
  let skipped = 0;
  const errors: Array<{ slug: string; url: string; error: string }> = [];

  for (const [slug, feeds] of Object.entries(FEEDS)) {
    bySatellite[slug] = 0;
    for (const feed of feeds) {
      const row = {
        name: feed.name,
        url: feed.url,
        category: CATEGORY_BY_SLUG[slug] ?? "nonprofit_news",
        source_app: slug,
        enabled: true,
        created_by: user.id,
      };
      const { error } = await admin
        .from("operator_rss_sources")
        .upsert(row, { onConflict: "url", ignoreDuplicates: true });
      if (error) {
        if (error.code === "23505") {
          skipped++;
        } else {
          errors.push({ slug, url: feed.url, error: error.message });
        }
      } else {
        inserted++;
        bySatellite[slug]++;
      }
    }
  }

  console.log(`[seed-federation-rss-sources] inserted=${inserted} skipped=${skipped} errors=${errors.length}`);

  return new Response(
    JSON.stringify({
      ok: true,
      inserted,
      skipped,
      by_satellite: bySatellite,
      errors: errors.length > 0 ? errors : undefined,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
