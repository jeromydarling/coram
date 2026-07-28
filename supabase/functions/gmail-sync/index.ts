import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Fetch with AbortController timeout (default 30s) */
async function timedFetch(url: string, opts: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  labelIds?: string[];
  payload: {
    headers: Array<{ name: string; value: string }>;
  };
  internalDate: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Get user from auth header using getClaims
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("No authorization header");
    }
    
    // Create client with anon key and auth header to get user
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user: authUser }, error: userError } = await authClient.auth.getUser();
    
    if (userError || !authUser?.id) {
      console.error("getUser error:", userError);
      throw new Error("Invalid user token");
    }
    
    const userId = authUser.id;
    
    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user's Google tokens from profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("google_access_token, google_refresh_token, google_token_expires_at")
      .eq("user_id", userId)
      .single();
    
    if (profileError || !profile) {
      throw new Error("Profile not found");
    }
    
    if (!profile.google_access_token || !profile.google_refresh_token) {
      throw new Error("Google Calendar not connected. Please connect it first in Settings.");
    }
    
    // Check if token needs refresh
    let accessToken = profile.google_access_token;
    const expiresAt = profile.google_token_expires_at ? new Date(profile.google_token_expires_at) : null;
    
    console.log("Token expires at:", expiresAt, "Now:", new Date());
    
    if (!expiresAt || expiresAt < new Date()) {
      // Refresh the token
      console.log("Refreshing token...");
      const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
      const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
      
      const refreshResponse = await timedFetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: profile.google_refresh_token,
          grant_type: "refresh_token",
        }),
      }, 15000);
      
      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        console.error("Token refresh failed:", errorText);
        throw new Error("Failed to refresh Google token. Please reconnect your Google account.");
      }
      
      const tokenData = await refreshResponse.json();
      accessToken = tokenData.access_token;
      console.log("Token refreshed successfully");
      
      // Update profile with new token
      await supabase
        .from("profiles")
        .update({
          google_access_token: accessToken,
          google_token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        })
        .eq("user_id", userId);
    }
    
    // Get user's email address using Gmail API profile endpoint (more reliable)
    const gmailProfileResponse = await timedFetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }, 15000);
    
    if (!gmailProfileResponse.ok) {
      const errorText = await gmailProfileResponse.text();
      console.error("Gmail profile API error:", errorText);

      // 403 can mean either missing scopes OR the Gmail API is disabled in the Google Cloud project.
      if (gmailProfileResponse.status === 403) {
        try {
          const parsed = JSON.parse(errorText);
          const reason = parsed?.error?.errors?.[0]?.reason;
          const status = parsed?.error?.status;
          if (reason === "accessNotConfigured" || status === "PERMISSION_DENIED") {
            throw new Error(
              "Gmail API is disabled for the Google project used by this integration. Enable the Gmail API in Google Cloud and try again (it can take a few minutes to propagate)."
            );
          }
        } catch {
          // ignore parse errors, fall back to generic handling below
        }

        throw new Error(
          "Gmail access not granted. Please disconnect and reconnect Google Calendar to grant Gmail permissions."
        );
      }

      throw new Error(
        "Failed to access Gmail. Please ensure Gmail API is enabled and permissions are granted."
      );
    }
    
    const gmailProfile = await gmailProfileResponse.json();
    const userEmail = gmailProfile.emailAddress;
    console.log("Gmail profile fetched, email:", userEmail);
    
    // Get all contacts with email addresses to match against
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, email")
      .not("email", "is", null);
    
    const contactEmailMap = new Map<string, string>();
    contacts?.forEach(contact => {
      if (contact.email) {
        contactEmailMap.set(contact.email.toLowerCase(), contact.id);
      }
    });
    
    // Get ignored email domains from ai_user_settings
    const { data: aiSettings } = await supabase
      .from("ai_user_settings")
      .select("ignored_email_domains")
      .eq("user_id", userId)
      .maybeSingle();
    
    const ignoredDomains = (aiSettings?.ignored_email_domains || []) as string[];
    const isIgnoredEmail = (email: string) => {
      const domain = email.toLowerCase().split('@')[1];
      return ignoredDomains.some(d => domain === d.toLowerCase() || domain?.endsWith('.' + d.toLowerCase()));
    };
    
    // Get last sync time
    const { data: syncProfile } = await supabase
      .from("profiles")
      .select("gmail_last_sync_at")
      .eq("user_id", userId)
      .single();

    // Fetch emails from Gmail
    // IMPORTANT:
    // - Gmail search uses seconds-based timestamps and can be sensitive to clock/timezone differences.
    // - If a sync returns 0 messages and we advance gmail_last_sync_at to "now", we can accidentally
    //   skip emails that arrived earlier (like your 2:04pm message).
    // Strategy:
    // - Use 90-day lookback for first sync
    // - Otherwise use last sync time, but add a small overlap window to re-check recent history
    const baseAfterDate = syncProfile?.gmail_last_sync_at
      ? new Date(syncProfile.gmail_last_sync_at)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Re-check the last 2 days every time to avoid missing messages due to timing/caching.
    const overlapMs = 2 * 24 * 60 * 60 * 1000;
    const afterDate = new Date(baseAfterDate.getTime() - overlapMs);
    const afterTimestamp = Math.floor(afterDate.getTime() / 1000);
    
    let syncedCount = 0;
    let matchedCount = 0;
    
    // --- SENT EMAILS ---
    const sentResponse = await timedFetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:sent after:${afterTimestamp}&maxResults=500`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      30000
    );
    
    if (!sentResponse.ok) {
      const errorText = await sentResponse.text();
      console.error("Gmail API error (sent):", errorText);
      throw new Error("Failed to fetch sent emails. Make sure Gmail API is enabled.");
    }
    
    const sentData = await sentResponse.json();
    const sentMessageIds = sentData.messages || [];
    console.log(`Found ${sentMessageIds.length} sent messages to process`);
    
    for (const msg of sentMessageIds) {
      const msgResponse = await timedFetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        15000
      );
      
      if (!msgResponse.ok) continue;
      
      const msgData: GmailMessage = await msgResponse.json();
      
      const getHeader = (name: string) => 
        msgData.payload.headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";
      
      const toHeader = getHeader("To");
      const ccHeader = getHeader("Cc");
      const subject = getHeader("Subject");
      const sentAt = new Date(parseInt(msgData.internalDate));
      
      const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
      const toEmails = toHeader.match(emailRegex) || [];
      const ccEmails = ccHeader.match(emailRegex) || [];
      const recipientEmails = [...toEmails, ...ccEmails];
      
      for (const recipientEmail of recipientEmails) {
        const normalizedEmail = recipientEmail.toLowerCase();
        
        // Skip ignored domains
        if (isIgnoredEmail(normalizedEmail)) continue;
        
        const contactId = contactEmailMap.get(normalizedEmail);
        
        const { error: insertError } = await supabase
          .from("email_communications")
          .upsert({
            user_id: userId,
            contact_id: contactId || null,
            gmail_message_id: `${msg.id}-to-${normalizedEmail}`,
            thread_id: msgData.threadId,
            subject: subject,
            snippet: msgData.snippet,
            sent_at: sentAt.toISOString(),
            recipient_email: normalizedEmail,
            sender_email: userEmail,
          }, {
            onConflict: "gmail_message_id",
            ignoreDuplicates: false,
          });
        
        if (!insertError) {
          syncedCount++;
          if (contactId) matchedCount++;
        }
      }
    }
    
    // --- RECEIVED EMAILS (all external emails, not just from contacts) ---
    // Fetch all received emails (not just inbox) so we can update is_in_inbox flag
    // for previously synced emails that were archived
    const receivedResponse = await timedFetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=-in:sent after:${afterTimestamp}&maxResults=500`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      30000
    );
    
    if (receivedResponse.ok) {
      const receivedData = await receivedResponse.json();
      const receivedMessageIds = receivedData.messages || [];
      console.log(`Found ${receivedMessageIds.length} received messages to process`);
      
      for (const msg of receivedMessageIds) {
        const msgResponse = await timedFetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
          15000
        );
        
        if (!msgResponse.ok) continue;
        
        const msgData: GmailMessage = await msgResponse.json();
        
        const getHeader = (name: string) => 
          msgData.payload.headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";
        
        const fromHeader = getHeader("From");
        const subject = getHeader("Subject");
        const sentAt = new Date(parseInt(msgData.internalDate));
        
        const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
        const fromEmails = fromHeader.match(emailRegex) || [];
        
        for (const senderEmail of fromEmails) {
          const normalizedEmail = senderEmail.toLowerCase();
          
          // Skip ignored domains
          if (isIgnoredEmail(normalizedEmail)) continue;
          
          const contactId = contactEmailMap.get(normalizedEmail);
          
          const isInInbox = Array.isArray(msgData.labelIds) && msgData.labelIds.includes('INBOX');
          
          const { error: insertError } = await supabase
            .from("email_communications")
            .upsert({
              user_id: userId,
              contact_id: contactId || null,  // Can be null for unknown senders
              gmail_message_id: `${msg.id}-from-${normalizedEmail}`,
              thread_id: msgData.threadId,
              subject: subject,
              snippet: msgData.snippet,
              sent_at: sentAt.toISOString(),
              recipient_email: userEmail,
              sender_email: normalizedEmail,
              is_in_inbox: isInInbox,
            }, {
              onConflict: "gmail_message_id",
              ignoreDuplicates: false,
            });
          
          if (!insertError) {
            syncedCount++;
            if (contactId) matchedCount++;
          }

          // Fire-and-forget: check if this received email contains volunteer hours
          const subjectLower = (subject || '').toLowerCase();
          const snippetLower = (msgData.snippet || '').toLowerCase();
          if (subjectLower.includes('volunteer hours') || snippetLower.includes('hours:')) {
            fetch(`${supabaseUrl}/functions/v1/volunteer-hours-ingest`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                gmail_message_id: msg.id,
                from_email: normalizedEmail,
                received_at: sentAt.toISOString(),
                subject,
                snippet: msgData.snippet,
                raw_text: msgData.snippet,
              }),
            }).catch(err => console.error('Volunteer hours ingest error:', err));
          }
        }
      }
    }
    
    // --- REPLY DETECTION: match received emails against campaign audience ---
    let repliesDetected = 0;
    try {
      // Get all audience rows with status 'sent' for campaigns owned by this user
      const { data: sentAudience } = await supabase
        .from("email_campaign_audience")
        .select("id, campaign_id, email, contact_id")
        .eq("status", "sent");

      if (sentAudience && sentAudience.length > 0) {
        // Build a map: lowercase email -> audience rows (one email can be in multiple campaigns)
        const audienceByEmail = new Map<string, typeof sentAudience>();
        for (const row of sentAudience) {
          const key = row.email.toLowerCase();
          if (!audienceByEmail.has(key)) audienceByEmail.set(key, []);
          audienceByEmail.get(key)!.push(row);
        }

        // Query received emails synced in this run (sender_email matches audience emails)
        const audienceEmails = [...audienceByEmail.keys()];
        // Process in batches to avoid overly large IN clauses
        const BATCH = 200;
        for (let i = 0; i < audienceEmails.length; i += BATCH) {
          const batch = audienceEmails.slice(i, i + BATCH);
          const { data: matchedEmails } = await supabase
            .from("email_communications")
            .select("id, gmail_message_id, thread_id, sender_email, sent_at")
            .eq("user_id", userId)
            .eq("recipient_email", userEmail)
            .in("sender_email", batch)
            .gte("sent_at", afterDate.toISOString());

          if (!matchedEmails || matchedEmails.length === 0) continue;

          for (const email of matchedEmails) {
            const audienceRows = audienceByEmail.get(email.sender_email.toLowerCase());
            if (!audienceRows) continue;

            for (const audience of audienceRows) {
              // Upsert into outreach_replies (dedupe on gmail_message_id)
              const { error: replyErr } = await supabase
                .from("outreach_replies")
                .upsert({
                  campaign_id: audience.campaign_id,
                  audience_id: audience.id,
                  contact_id: audience.contact_id || null,
                  thread_id: email.thread_id || "",
                  gmail_message_id: email.gmail_message_id,
                  received_at: email.sent_at,
                  direction: "inbound",
                }, {
                  onConflict: "gmail_message_id",
                  ignoreDuplicates: true,
                });

              if (!replyErr) repliesDetected++;
            }
          }
        }
        console.log(`Reply detection: ${repliesDetected} replies matched to campaigns`);
      }
    } catch (replyDetectErr) {
      // Continue-on-fail: reply detection should not break sync
      console.error("Reply detection error (non-fatal):", replyDetectErr);
    }

    // Re-match any previously synced emails that now have matching contacts
    // This handles the case where a contact was added AFTER emails were synced
    const { data: unmatchedEmails } = await supabase
      .from("email_communications")
      .select("id, recipient_email")
      .eq("user_id", userId)
      .is("contact_id", null);
    
    let rematchedCount = 0;
    for (const email of unmatchedEmails || []) {
      const contactId = contactEmailMap.get(email.recipient_email.toLowerCase());
      if (contactId) {
        await supabase
          .from("email_communications")
          .update({ contact_id: contactId })
          .eq("id", email.id);
        rematchedCount++;
      }
    }
    
    // Update last sync time and enable gmail sync.
    // Only advance gmail_last_sync_at if we actually synced something; otherwise we risk skipping
    // emails that exist but weren't returned (Gmail indexing delay, transient search issue, etc.).
    const profileUpdates: Record<string, unknown> = {
      gmail_sync_enabled: true,
    };
    if (syncedCount > 0) {
      profileUpdates.gmail_last_sync_at = new Date().toISOString();
    }

    await supabase
      .from("profiles")
      .update(profileUpdates)
      .eq("user_id", userId);
    
    console.log(`Synced ${syncedCount} emails, ${matchedCount} matched, ${rematchedCount} rematched, ${repliesDetected} replies detected`);
    
    return new Response(
      JSON.stringify({
        success: true,
        syncedCount,
        matchedCount,
        rematchedCount,
        repliesDetected,
        message: `Synced ${syncedCount} emails, ${matchedCount} matched to contacts${rematchedCount > 0 ? `, ${rematchedCount} rematched` : ''}${repliesDetected > 0 ? `, ${repliesDetected} campaign replies detected` : ''}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Gmail sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
