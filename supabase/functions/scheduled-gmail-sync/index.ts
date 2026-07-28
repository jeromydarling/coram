import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

// deno-lint-ignore no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

async function syncUserGmail(
  supabase: AnySupabaseClient,
  userId: string,
  profile: {
    google_access_token: string;
    google_refresh_token: string;
    google_token_expires_at: string | null;
    gmail_last_sync_at: string | null;
  }
): Promise<{ synced: number; matched: number; error?: string }> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  // Refresh token if needed
  let accessToken = profile.google_access_token;
  const expiresAt = profile.google_token_expires_at
    ? new Date(profile.google_token_expires_at)
    : null;

  if (!expiresAt || expiresAt < new Date()) {
    console.log(`[${userId}] Refreshing token...`);
    const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: profile.google_refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text();
      console.error(`[${userId}] Token refresh failed:`, errorText);
      return { synced: 0, matched: 0, error: "Token refresh failed" };
    }

    const tokenData = await refreshResponse.json();
    accessToken = tokenData.access_token;

    await supabase
      .from("profiles")
      .update({
        google_access_token: accessToken,
        google_token_expires_at: new Date(
          Date.now() + tokenData.expires_in * 1000
        ).toISOString(),
      })
      .eq("user_id", userId);
  }

  // Get user's email
  const gmailProfileResponse = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!gmailProfileResponse.ok) {
    const errorText = await gmailProfileResponse.text();
    console.error(`[${userId}] Gmail profile error:`, errorText);
    return { synced: 0, matched: 0, error: "Gmail access failed" };
  }

  const gmailProfile = await gmailProfileResponse.json();
  const userEmail = gmailProfile.emailAddress;

  // Get contacts for matching
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, email")
    .not("email", "is", null);

  const contactEmailMap = new Map<string, string>();
  contacts?.forEach((contact: { id: string; email: string | null }) => {
    if (contact.email) {
      contactEmailMap.set(contact.email.toLowerCase(), contact.id);
    }
  });

  // Get ignored domains
  const { data: aiSettings } = await supabase
    .from("ai_user_settings")
    .select("ignored_email_domains")
    .eq("user_id", userId)
    .maybeSingle();

  // deno-lint-ignore no-explicit-any
  const aiSettingsRow = aiSettings as any;
  const ignoredDomains = ((aiSettingsRow?.ignored_email_domains || []) as string[]);
  const isIgnoredEmail = (email: string) => {
    const domain = email.toLowerCase().split("@")[1];
    return ignoredDomains.some(
      (d) => domain === d.toLowerCase() || domain?.endsWith("." + d.toLowerCase())
    );
  };

  // Calculate sync window with 2-day overlap
  const baseAfterDate = profile.gmail_last_sync_at
    ? new Date(profile.gmail_last_sync_at)
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const overlapMs = 2 * 24 * 60 * 60 * 1000;
  const afterDate = new Date(baseAfterDate.getTime() - overlapMs);
  const afterTimestamp = Math.floor(afterDate.getTime() / 1000);

  let syncedCount = 0;
  let matchedCount = 0;

  // Sync sent emails (limit to 100 for scheduled sync to be quick)
  const sentResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:sent after:${afterTimestamp}&maxResults=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (sentResponse.ok) {
    const sentData = await sentResponse.json();
    const sentMessageIds = sentData.messages || [];

    for (const msg of sentMessageIds) {
      const msgResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!msgResponse.ok) continue;

      const msgData: GmailMessage = await msgResponse.json();
      const getHeader = (name: string) =>
        msgData.payload.headers.find(
          (h) => h.name.toLowerCase() === name.toLowerCase()
        )?.value || "";

      const toHeader = getHeader("To");
      const ccHeader = getHeader("Cc");
      const subject = getHeader("Subject");
      const sentAt = new Date(parseInt(msgData.internalDate));

      const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
      const recipientEmails = [
        ...(toHeader.match(emailRegex) || []),
        ...(ccHeader.match(emailRegex) || []),
      ];

      for (const recipientEmail of recipientEmails) {
        const normalizedEmail = recipientEmail.toLowerCase();
        if (isIgnoredEmail(normalizedEmail)) continue;

        const contactId = contactEmailMap.get(normalizedEmail);

        const { error: insertError } = await supabase
          .from("email_communications")
          .upsert(
            {
              user_id: userId,
              contact_id: contactId || null,
              gmail_message_id: `${msg.id}-to-${normalizedEmail}`,
              thread_id: msgData.threadId,
              subject: subject,
              snippet: msgData.snippet,
              sent_at: sentAt.toISOString(),
              recipient_email: normalizedEmail,
              sender_email: userEmail,
            },
            { onConflict: "gmail_message_id", ignoreDuplicates: false }
          );

        if (!insertError) {
          syncedCount++;
          if (contactId) matchedCount++;
        }
      }
    }
  }

  // Sync received emails (all, not just inbox, so is_in_inbox flag gets updated for archived)
  const receivedResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=-in:sent after:${afterTimestamp}&maxResults=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (receivedResponse.ok) {
    const receivedData = await receivedResponse.json();
    const receivedMessageIds = receivedData.messages || [];

    for (const msg of receivedMessageIds) {
      const msgResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!msgResponse.ok) continue;

      const msgData: GmailMessage = await msgResponse.json();
      const getHeader = (name: string) =>
        msgData.payload.headers.find(
          (h) => h.name.toLowerCase() === name.toLowerCase()
        )?.value || "";

      const fromHeader = getHeader("From");
      const subject = getHeader("Subject");
      const sentAt = new Date(parseInt(msgData.internalDate));

      const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
      const fromEmails = fromHeader.match(emailRegex) || [];

      for (const senderEmail of fromEmails) {
        const normalizedEmail = senderEmail.toLowerCase();
        if (isIgnoredEmail(normalizedEmail)) continue;

        const contactId = contactEmailMap.get(normalizedEmail);

        const isInInbox = Array.isArray(msgData.labelIds) && msgData.labelIds.includes('INBOX');
        
        const { error: insertError } = await supabase
          .from("email_communications")
          .upsert(
            {
              user_id: userId,
              contact_id: contactId || null,
              gmail_message_id: `${msg.id}-from-${normalizedEmail}`,
              thread_id: msgData.threadId,
              subject: subject,
              snippet: msgData.snippet,
              sent_at: sentAt.toISOString(),
              recipient_email: userEmail,
              sender_email: normalizedEmail,
              is_in_inbox: isInInbox,
            },
            { onConflict: "gmail_message_id", ignoreDuplicates: false }
          );

        if (!insertError) {
          syncedCount++;
          if (contactId) matchedCount++;
        }

        // Fire-and-forget: check if this received email contains volunteer hours
        const subjectLower = (subject || '').toLowerCase();
        const snippetLower = (msgData.snippet || '').toLowerCase();
        if (subjectLower.includes('volunteer hours') || snippetLower.includes('hours:')) {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          fetch(`${supabaseUrl}/functions/v1/volunteer-hours-ingest`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceRoleKey}`,
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

  // Update last sync time if we synced something
  if (syncedCount > 0) {
    await supabase
      .from("profiles")
      .update({ gmail_last_sync_at: new Date().toISOString() })
      .eq("user_id", userId);
  }

  return { synced: syncedCount, matched: matchedCount };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find all users with Gmail sync enabled
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select(
        "user_id, google_access_token, google_refresh_token, google_token_expires_at, gmail_last_sync_at"
      )
      .eq("gmail_sync_enabled", true)
      .not("google_refresh_token", "is", null);

    if (profilesError) {
      throw profilesError;
    }

    console.log(`[scheduled-gmail-sync] Found ${profiles?.length || 0} users to sync`);

    const results: Array<{
      userId: string;
      synced: number;
      matched: number;
      error?: string;
    }> = [];

    for (const profile of profiles || []) {
      console.log(`[scheduled-gmail-sync] Syncing user ${profile.user_id}...`);
      const result = await syncUserGmail(supabase, profile.user_id, profile);
      results.push({ userId: profile.user_id, ...result });
      console.log(
        `[scheduled-gmail-sync] User ${profile.user_id}: ${result.synced} synced, ${result.matched} matched`
      );
    }

    const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);
    const totalMatched = results.reduce((sum, r) => sum + r.matched, 0);
    const usersProcessed = results.length;

    console.log(
      `[scheduled-gmail-sync] Complete: ${usersProcessed} users, ${totalSynced} emails synced, ${totalMatched} matched`
    );

    return new Response(
      JSON.stringify({
        success: true,
        users_processed: usersProcessed,
        total_synced: totalSynced,
        total_matched: totalMatched,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[scheduled-gmail-sync] Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
