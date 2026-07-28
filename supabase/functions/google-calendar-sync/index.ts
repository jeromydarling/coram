/**
 * Unified Google OAuth handler for Calendar + Gmail integration.
 * Handles OAuth callback for both services using shared tokens.
 * 
 * CRITICAL: This is the ONLY path that may INSERT ai_user_settings.
 * All other handlers must require existing row or return GMAIL_NOT_CONNECTED.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/** Time-bounded fetch — prevents hanging on external API calls */
async function timedFetch(url: string, opts: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Allowed origins for redirect (whitelist)
const ALLOWED_ORIGINS = [
  SUPABASE_URL,
  "https://profunda.lovable.app",
  "https://thecros.app",
  "https://www.thecros.app",
  "https://thecros.lovable.app",
  "https://id-preview--aa50a64c-df02-4cea-bce6-5c272c15ae3b.lovable.app",
];

function isAllowedOrigin(origin: string): boolean {
  // Check if origin matches any allowed origin or is a Lovable preview/app URL
  // Also allow any subdomain of lovable.app or lovableproject.com
  return ALLOWED_ORIGINS.some(allowed => origin === allowed) ||
    origin.includes(".lovable.app") ||
    origin.includes(".lovableproject.com") ||
    origin.includes("localhost");
}

// NOTE: Supabase edge runtime typings can infer `never` for table types in functions.
// We intentionally loosen types here to avoid build-time failures.
async function ensureAIUserSettingsInitialized(supabase: any, userId: string) {
  const nowTimestamp = new Date().toISOString();

  const { data: existing } = await supabase
    .from("ai_user_settings")
    .select("user_id, gmail_connected_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase
      .from("ai_user_settings")
      .insert({
        user_id: userId,
        gmail_connected_at: nowTimestamp,
        gmail_ai_start_at: nowTimestamp,
        gmail_ai_enabled: false,
        gmail_ai_enabled_at: null,
        created_at: nowTimestamp,
        updated_at: nowTimestamp,
      });

    if (error) console.error("Failed to create ai_user_settings:", error);
    return;
  }

  if (!(existing as any).gmail_connected_at) {
    const { error } = await supabase
      .from("ai_user_settings")
      .update({
        gmail_connected_at: nowTimestamp,
        gmail_ai_start_at: nowTimestamp,
        updated_at: nowTimestamp,
      })
      .eq("user_id", userId);

    if (error) console.error("Failed to update ai_user_settings:", error);
  }
}

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
    organizer?: boolean;
    resource?: boolean;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ 
          error: "Google Calendar not configured",
          message: "Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET" 
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Callback doesn't need auth - it's called by Google's redirect
    // But we validate the state token server-side
    if (action === "callback") {
      const code = url.searchParams.get("code");
      const stateToken = url.searchParams.get("state");
      
      if (!code || !stateToken) {
        return new Response("Missing code or state", { status: 400 });
      }

      // Validate state token from server-side storage
      const { data: stateData, error: stateError } = await supabase
        .from("oauth_states")
        .select("*")
        .eq("token", stateToken)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (stateError || !stateData) {
        console.error("Invalid or expired state token:", stateError?.message);
        return new Response("Invalid or expired state token. Please try connecting again.", { 
          status: 400,
          headers: { "Content-Type": "text/plain" }
        });
      }

      // Delete the state token immediately (one-time use)
      await supabase
        .from("oauth_states")
        .delete()
        .eq("token", stateToken);

      // Validate origin from stored state (not from user input)
      const origin = stateData.origin;
      if (!isAllowedOrigin(origin)) {
        console.error("Invalid redirect origin:", origin);
        return new Response("Invalid redirect origin", { status: 400 });
      }

      const userId = stateData.user_id;
      const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar-sync?action=callback`;

      // Exchange code for tokens
      const tokenResponse = await timedFetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        console.error("Token exchange error:", tokens);
        return new Response(`Error: ${tokens.error_description}`, { status: 400 });
      }

      // Store tokens in user profile using validated userId from state
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      
      await supabase
        .from("profiles")
        .update({
          google_calendar_enabled: true,
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token,
          google_token_expires_at: expiresAt.toISOString(),
        })
        .eq("user_id", userId);

      // ============================================================
      // Fetch Gmail profile to store verified email for outreach
      // ============================================================
      try {
        const gmailRes = await timedFetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/profile",
          { headers: { Authorization: `Bearer ${tokens.access_token}` } }
        );
        if (gmailRes.ok) {
          const gmailProfile = await gmailRes.json();
          await supabase
            .from("profiles")
            .update({ gmail_email_address: gmailProfile.emailAddress })
            .eq("user_id", userId);
        }
      } catch (gmailErr) {
        console.error("Failed to fetch Gmail profile:", gmailErr);
        // Non-fatal - continue with OAuth flow
      }

      // ============================================================
      // CRITICAL: This is the ONLY path that may INSERT ai_user_settings.
      // All other handlers must require existing row or return error.
      // ============================================================
      
      // Initialize AI user settings when Google is connected
      // Use upsert to create row if missing, or update gmail_connected_at if re-connecting
      const nowTimestamp = new Date().toISOString();
      
      // Check if settings already exist
      const { data: existingSettings } = await supabase
        .from("ai_user_settings")
        .select("user_id, gmail_connected_at")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (!existingSettings) {
        // Create new settings row
        const { error: insertError } = await supabase
          .from("ai_user_settings")
          .insert({
            user_id: userId,
            gmail_connected_at: nowTimestamp,
            gmail_ai_start_at: nowTimestamp,
            gmail_ai_enabled: false,
            gmail_ai_enabled_at: null,
            created_at: nowTimestamp,
            updated_at: nowTimestamp,
          });
        
        if (insertError) {
          console.error("Failed to create ai_user_settings:", insertError);
        } else {
          console.log("Created ai_user_settings for user:", userId);
        }
      } else if (!existingSettings.gmail_connected_at) {
        // Update existing row if gmail wasn't connected before
        await supabase
          .from("ai_user_settings")
          .update({
            gmail_connected_at: nowTimestamp,
            gmail_ai_start_at: nowTimestamp,
            updated_at: nowTimestamp,
          })
          .eq("user_id", userId);
        console.log("Updated gmail_connected_at for user:", userId);
      }

      // NOTE: We do NOT touch gmail_ai_enabled or gmail_ai_enabled_at here.
      // Those are controlled exclusively by enable_gmail_ai() RPC.

      // Redirect back to calendar page using validated origin
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}/calendar?google=connected` },
      });
    }

    // Cron-triggered sync for all connected users (service-role auth only)
    if (action === "cron-sync") {
      const authHeader = req.headers.get("Authorization");
      const token = authHeader?.replace("Bearer ", "");
      if (token !== SUPABASE_SERVICE_ROLE_KEY) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("[cron-sync] Starting nightly calendar sync for all connected users");

      // Find all users with Google Calendar enabled and a refresh token
      const { data: connectedUsers, error: usersError } = await supabase
        .from("profiles")
        .select("user_id, google_access_token, google_refresh_token, google_token_expires_at")
        .eq("google_calendar_enabled", true)
        .not("google_refresh_token", "is", null);

      if (usersError) {
        console.error("[cron-sync] Failed to fetch connected users:", usersError);
        return new Response(JSON.stringify({ error: "Failed to fetch users" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("[cron-sync] Found", connectedUsers?.length || 0, "connected users");
      const results: { user_id: string; pushed: number; pulled: number; errors: string[] }[] = [];

      for (const profile of connectedUsers || []) {
        const userId = profile.user_id;
        console.log("[cron-sync] Syncing user:", userId);

        try {
          // Refresh token if expired
          let accessToken = profile.google_access_token;
          const tokenExpiry = new Date(profile.google_token_expires_at!);

          if (tokenExpiry < new Date()) {
            const refreshResponse = await timedFetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID!,
                client_secret: GOOGLE_CLIENT_SECRET!,
                refresh_token: profile.google_refresh_token!,
                grant_type: "refresh_token",
              }),
            });

            const refreshData = await refreshResponse.json();
            if (refreshData.error) {
              console.error("[cron-sync] Token refresh failed for", userId, refreshData.error);
              results.push({ user_id: userId, pushed: 0, pulled: 0, errors: [`Token refresh: ${refreshData.error}`] });
              continue;
            }

            accessToken = refreshData.access_token;
            await supabase
              .from("profiles")
              .update({
                google_access_token: refreshData.access_token,
                google_token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
              })
              .eq("user_id", userId);
          }

          const syncResults = { pushed: 0, pulled: 0, errors: [] as string[] };

          // --- PULL: Fetch events from Google Calendar ---
          const { data: crmEvents } = await supabase
            .from("events")
            .select("google_calendar_event_id")
            .not("google_calendar_event_id", "is", null);

          const { data: crmActivities } = await supabase
            .from("activities")
            .select("google_calendar_event_id")
            .not("google_calendar_event_id", "is", null);

          const crmGoogleIds = new Set([
            ...(crmEvents || []).map((e: any) => e.google_calendar_event_id),
            ...(crmActivities || []).map((a: any) => a.google_calendar_event_id),
          ].filter(Boolean));

          const now = new Date();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          // Pull past 14 days through next 90 days so recently-occurred meetings remain visible
          // and aren't deleted as "removed" simply because they fell outside the window.
          const past = new Date(startOfToday.getTime() - 14 * 24 * 60 * 60 * 1000);
          const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

          const gcalResponse = await timedFetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
            `timeMin=${past.toISOString()}&timeMax=${future.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=250`,
            { headers: { Authorization: `Bearer ${accessToken}` } }, 30000
          );

          if (!gcalResponse.ok) {
            const errorBody = await gcalResponse.text();
            console.error("[cron-sync] Google API error for", userId, gcalResponse.status);
            syncResults.errors.push(`Fetch events: ${gcalResponse.status}`);
          } else {
            const gcalData = await gcalResponse.json();
            const googleEvents: GoogleCalendarEvent[] = gcalData.items || [];

            const externalEvents = googleEvents.filter(ge => !crmGoogleIds.has(ge.id));

            const { data: existingExternal } = await supabase
              .from("google_calendar_events")
              .select("google_event_id")
              .eq("user_id", userId);

            const existingIds = new Set((existingExternal || []).map((e: any) => e.google_event_id));
            const currentGoogleIds = new Set(externalEvents.map(e => e.id));

            // Delete removed events
            const deletedIds = [...existingIds].filter(id => !currentGoogleIds.has(id));
            if (deletedIds.length > 0) {
              await supabase
                .from("google_calendar_events")
                .delete()
                .eq("user_id", userId)
                .in("google_event_id", deletedIds);
            }

            // Upsert external events and attendees
            for (const gEvent of externalEvents) {
              try {
                const isAllDay = !!gEvent.start?.date;
                const startTime = isAllDay
                  ? new Date(gEvent.start!.date! + "T00:00:00Z")
                  : new Date(gEvent.start?.dateTime || now);
                const endTime = isAllDay
                  ? (gEvent.end?.date ? new Date(gEvent.end.date + "T00:00:00Z") : startTime)
                  : (gEvent.end?.dateTime ? new Date(gEvent.end.dateTime) : startTime);

                const { data: upsertedEvent, error: upsertError } = await supabase
                  .from("google_calendar_events")
                  .upsert({
                    user_id: userId,
                    google_event_id: gEvent.id,
                    title: gEvent.summary || "(No title)",
                    description: gEvent.description || null,
                    start_time: startTime.toISOString(),
                    end_time: endTime.toISOString(),
                    location: gEvent.location || null,
                    is_all_day: isAllDay,
                    synced_at: new Date().toISOString(),
                  }, { onConflict: "user_id,google_event_id" })
                  .select("id")
                  .single();

                if (upsertError) {
                  syncResults.errors.push(`Event ${gEvent.summary}: ${upsertError.message}`);
                  continue;
                }

                syncResults.pulled++;

                if (gEvent.attendees && gEvent.attendees.length > 0 && upsertedEvent) {
                  const humanAttendees = gEvent.attendees.filter(a => !a.resource);

                  await supabase
                    .from("google_calendar_attendees")
                    .delete()
                    .eq("google_event_id", upsertedEvent.id);

                  if (humanAttendees.length > 0) {
                    await supabase
                      .from("google_calendar_attendees")
                      .insert(humanAttendees.map(a => ({
                        google_event_id: upsertedEvent.id,
                        email: a.email,
                        display_name: a.displayName || null,
                        response_status: a.responseStatus || null,
                        is_organizer: a.organizer || false,
                      })));
                  }
                }
              } catch (e) {
                syncResults.errors.push(`External event ${gEvent.id}: ${e instanceof Error ? e.message : String(e)}`);
              }
            }
          }

          // Stamp last-sync timestamp on profile so the UI can show an accurate "Last synced" time.
          await supabase
            .from("profiles")
            .update({ gmail_last_sync_at: new Date().toISOString() })
            .eq("user_id", userId);

          results.push({ user_id: userId, ...syncResults });
        } catch (e) {
          console.error("[cron-sync] Error for user", userId, e);
          results.push({ user_id: userId, pushed: 0, pulled: 0, errors: [e instanceof Error ? e.message : String(e)] });
        }
      }

      console.log("[cron-sync] Complete. Results:", JSON.stringify(results));
      return new Response(JSON.stringify({ success: true, users_synced: results.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Use getUser to verify the JWT token
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData?.user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Invalid token", details: userError?.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const user = userData.user;
    console.log("Authenticated user:", user.id);

    // Handle different actions
    if (action === "auth-url") {
      // Generate OAuth URL with server-side state storage
      const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "").split("/").slice(0, 3).join("/") || SUPABASE_URL;
      
      // Validate origin before storing
      if (!isAllowedOrigin(origin)) {
        console.error("Origin validation failed:", origin, "Allowed:", ALLOWED_ORIGINS);
        return new Response(JSON.stringify({ error: "Invalid origin" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Generate cryptographically random state token
      const stateToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      // Store state server-side
      const { error: insertError } = await supabase
        .from("oauth_states")
        .insert({
          token: stateToken,
          user_id: user.id,
          origin: origin,
          expires_at: expiresAt.toISOString(),
        });
      
      if (insertError) {
        console.error("Failed to store OAuth state:", insertError);
        return new Response(JSON.stringify({ error: "Failed to initiate OAuth flow" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar-sync?action=callback`;
      const scope = encodeURIComponent("openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send");
      
      // Use only the random token as state (not user data)
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${scope}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${stateToken}`;

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sync") {
      console.log("Starting sync for user:", user.id);
      // Sync events with Google Calendar
      const body = await req.json();
      const { direction = "push" } = body; // push, pull, or both

      // Get user's Google tokens
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("google_access_token, google_refresh_token, google_token_expires_at")
        .eq("user_id", user.id)
        .single();

      console.log("Profile fetch result:", { hasProfile: !!profile, error: profileError?.message });

      if (!profile?.google_access_token) {
        return new Response(
          JSON.stringify({ error: "Google Calendar not connected" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If the user connected Google in the past (before we added ai_user_settings init),
      // initialize it here so Settings can show Gmail as connected.
      await ensureAIUserSettingsInitialized(supabase, user.id);

      // Check if token needs refresh
      let accessToken = profile.google_access_token;
      const tokenExpiry = new Date(profile.google_token_expires_at!);
      console.log("Token expires at:", tokenExpiry.toISOString(), "Now:", new Date().toISOString());
      
      if (tokenExpiry < new Date()) {
        console.log("Token expired, refreshing...");
        // Refresh the token
        const refreshResponse = await timedFetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: profile.google_refresh_token!,
            grant_type: "refresh_token",
          }),
        });

        const refreshData = await refreshResponse.json();
        console.log("Token refresh result:", { success: !!refreshData.access_token, error: refreshData.error });
        
        if (refreshData.error) {
          return new Response(
            JSON.stringify({ error: "Failed to refresh Google token", details: refreshData.error_description }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (refreshData.access_token) {
          accessToken = refreshData.access_token;
          await supabase
            .from("profiles")
            .update({
              google_access_token: refreshData.access_token,
              google_token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
            })
            .eq("user_id", user.id);
        }
      }

      const syncResults = { pushed: 0, pulled: 0, errors: [] as string[] };

      if (direction === "push" || direction === "both") {
        // Push events to Google Calendar
        const { data: events, error: eventsError } = await supabase
          .from("events")
          .select("*")
          .is("google_calendar_event_id", null);

        console.log("Events to sync:", events?.length || 0, "Error:", eventsError?.message);

        for (const event of events || []) {
          try {
            const gcalEvent: Record<string, unknown> = {
              summary: event.event_name,
              start: { date: event.event_date },
              end: { date: event.end_date || event.event_date },
              // Use description field if available, fallback to notes
              description: event.description || event.notes || "",
            };

            // Include location (city field stores address) for Google Maps integration
            if (event.city) {
              gcalEvent.location = event.city;
            }

            console.log("Pushing event:", event.event_name);

            const response = await timedFetch(
              "https://www.googleapis.com/calendar/v3/calendars/primary/events",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(gcalEvent),
              }
            );

            if (response.ok) {
              const created = await response.json();
              await supabase
                .from("events")
                .update({
                  google_calendar_event_id: created.id,
                  google_calendar_synced_at: new Date().toISOString(),
                })
                .eq("id", event.id);
              syncResults.pushed++;
              console.log("Successfully pushed event:", event.event_name);
            } else {
              const errorBody = await response.text();
              console.error("Google API error for event:", event.event_name, response.status, errorBody);
              syncResults.errors.push(`Event ${event.event_name}: ${response.status} - ${errorBody}`);
            }
          } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.error("Exception pushing event:", event.event_name, errorMessage);
            syncResults.errors.push(`Event ${event.id}: ${errorMessage}`);
          }
        }

        // Push activities (meetings) to Google Calendar
        const { data: activities } = await supabase
          .from("activities")
          .select("*")
          .eq("activity_type", "Meeting")
          .is("google_calendar_event_id", null);

        for (const activity of activities || []) {
          try {
            const startTime = new Date(activity.activity_date_time);
            const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour default

            const gcalEvent = {
              summary: `Meeting${activity.notes ? `: ${activity.notes.substring(0, 50)}` : ""}`,
              start: { dateTime: startTime.toISOString() },
              end: { dateTime: endTime.toISOString() },
              description: activity.notes || "",
            };

            const response = await timedFetch(
              "https://www.googleapis.com/calendar/v3/calendars/primary/events",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(gcalEvent),
              }
            );

            if (response.ok) {
              const created = await response.json();
              await supabase
                .from("activities")
                .update({
                  google_calendar_event_id: created.id,
                  google_calendar_synced_at: new Date().toISOString(),
                })
                .eq("id", activity.id);
              syncResults.pushed++;
            }
          } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            syncResults.errors.push(`Activity ${activity.id}: ${errorMessage}`);
          }
        }
      }

      // PULL: Fetch events from Google Calendar
      if (direction === "pull" || direction === "both") {
        console.log("Pulling events from Google Calendar...");
        
        try {
          // Get existing CRM event IDs that are synced to Google Calendar
          const { data: crmEvents } = await supabase
            .from("events")
            .select("google_calendar_event_id")
            .not("google_calendar_event_id", "is", null);
          
          const { data: crmActivities } = await supabase
            .from("activities")
            .select("google_calendar_event_id")
            .not("google_calendar_event_id", "is", null);
          
          const crmGoogleIds = new Set([
            ...(crmEvents || []).map(e => e.google_calendar_event_id),
            ...(crmActivities || []).map(a => a.google_calendar_event_id),
          ].filter(Boolean));
          
          console.log("CRM Google event IDs to exclude:", crmGoogleIds.size);
          
          // Fetch events from Google Calendar (past 14 days through next 90 days).
          // Pulling the recent past prevents recently-occurred meetings from being
          // skipped — and from being deleted as "removed" simply because they fell
          // outside a today-forward window.
          const now = new Date();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const past = new Date(startOfToday.getTime() - 14 * 24 * 60 * 60 * 1000);
          const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
          
          const gcalResponse = await timedFetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
            `timeMin=${past.toISOString()}&timeMax=${future.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=250`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }, 30000
          );
          
          if (!gcalResponse.ok) {
            const errorBody = await gcalResponse.text();
            console.error("Failed to fetch Google Calendar events:", gcalResponse.status, errorBody);
            syncResults.errors.push(`Failed to fetch Google events: ${gcalResponse.status}`);
          } else {
            const gcalData = await gcalResponse.json();
            const googleEvents: GoogleCalendarEvent[] = gcalData.items || [];
            
            console.log("Fetched Google Calendar events:", googleEvents.length);
            
            // Filter out events that originated from CRM
            const externalEvents = googleEvents.filter(ge => !crmGoogleIds.has(ge.id));
            console.log("External events to import:", externalEvents.length);
            
            // Get current external events in DB to track deletions
            const { data: existingExternal } = await supabase
              .from("google_calendar_events")
              .select("google_event_id")
              .eq("user_id", user.id);
            
            const existingIds = new Set((existingExternal || []).map(e => e.google_event_id));
            const currentGoogleIds = new Set(externalEvents.map(e => e.id));
            
            // Delete events that no longer exist in Google Calendar
            const deletedIds = [...existingIds].filter(id => !currentGoogleIds.has(id));
            if (deletedIds.length > 0) {
              await supabase
                .from("google_calendar_events")
                .delete()
                .eq("user_id", user.id)
                .in("google_event_id", deletedIds);
              console.log("Deleted", deletedIds.length, "removed events");
            }
            
            // Upsert external events and their attendees
            for (const gEvent of externalEvents) {
              try {
                const isAllDay = !!gEvent.start?.date;
                const startTime = isAllDay
                  ? new Date(gEvent.start!.date! + "T00:00:00Z")
                  : new Date(gEvent.start?.dateTime || now);
                const endTime = isAllDay
                  ? (gEvent.end?.date ? new Date(gEvent.end.date + "T00:00:00Z") : startTime)
                  : (gEvent.end?.dateTime ? new Date(gEvent.end.dateTime) : startTime);
                
                // Upsert the external event
                const { data: upsertedEvent, error: upsertError } = await supabase
                  .from("google_calendar_events")
                  .upsert({
                    user_id: user.id,
                    google_event_id: gEvent.id,
                    title: gEvent.summary || "(No title)",
                    description: gEvent.description || null,
                    start_time: startTime.toISOString(),
                    end_time: endTime.toISOString(),
                    location: gEvent.location || null,
                    is_all_day: isAllDay,
                    synced_at: new Date().toISOString(),
                  }, { onConflict: "user_id,google_event_id" })
                  .select("id")
                  .single();
                
                if (upsertError) {
                  console.error("Failed to upsert external event:", gEvent.summary, upsertError.message);
                  syncResults.errors.push(`Event ${gEvent.summary}: ${upsertError.message}`);
                  continue;
                }
                
                syncResults.pulled++;
                
                // Handle attendees
                if (gEvent.attendees && gEvent.attendees.length > 0 && upsertedEvent) {
                  // Filter out resource rooms
                  const humanAttendees = gEvent.attendees.filter(a => !a.resource);
                  
                  // Delete existing attendees for this event
                  await supabase
                    .from("google_calendar_attendees")
                    .delete()
                    .eq("google_event_id", upsertedEvent.id);
                  
                  // Insert new attendees
                  if (humanAttendees.length > 0) {
                    const attendeeRecords = humanAttendees.map(a => ({
                      google_event_id: upsertedEvent.id,
                      email: a.email,
                      display_name: a.displayName || null,
                      response_status: a.responseStatus || null,
                      is_organizer: a.organizer || false,
                    }));
                    
                    const { error: attendeeError } = await supabase
                      .from("google_calendar_attendees")
                      .insert(attendeeRecords);
                    
                    if (attendeeError) {
                      console.error("Failed to insert attendees:", attendeeError.message);
                    }
                  }
                }
              } catch (e) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                console.error("Exception processing external event:", gEvent.summary, errorMessage);
                syncResults.errors.push(`External event ${gEvent.id}: ${errorMessage}`);
              }
            }
          }
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.error("Pull sync error:", errorMessage);
          syncResults.errors.push(`Pull error: ${errorMessage}`);
        }
      }

      // Stamp last-sync timestamp on profile so the UI can show an accurate "Last synced" time.
      await supabase
        .from("profiles")
        .update({ gmail_last_sync_at: new Date().toISOString() })
        .eq("user_id", user.id);

      return new Response(JSON.stringify(syncResults), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      // Disconnect Google Calendar
      await supabase
        .from("profiles")
        .update({
          google_calendar_enabled: false,
          google_access_token: null,
          google_refresh_token: null,
          google_token_expires_at: null,
        })
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});