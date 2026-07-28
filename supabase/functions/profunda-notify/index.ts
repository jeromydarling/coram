import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

interface DBPushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface NotificationSettings {
  user_id: string;
  push_enabled: boolean;
  notify_ai_bundles: boolean;
  notify_weekly_plan: boolean;
  notify_events: boolean;
  notify_post_event: boolean;
  last_ai_bundles_notified_at: string | null;
  last_weekly_plan_notified_at: string | null;
  last_events_notified_at: string | null;
  last_post_event_notified_at: string | null;
  daily_push_count: number;
  daily_push_reset_at: string;
}

type TriggerType = 'weekly_plan' | 'event_week' | 'ai_bundles' | 'post_event';

const TRIGGER_TO_SETTING_MAP: Record<TriggerType, keyof NotificationSettings> = {
  weekly_plan: 'notify_weekly_plan',
  event_week: 'notify_events',
  ai_bundles: 'notify_ai_bundles',
  post_event: 'notify_post_event',
};

const TRIGGER_TO_LAST_NOTIFIED_MAP: Record<TriggerType, keyof NotificationSettings> = {
  weekly_plan: 'last_weekly_plan_notified_at',
  event_week: 'last_events_notified_at',
  ai_bundles: 'last_ai_bundles_notified_at',
  post_event: 'last_post_event_notified_at',
};

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function isSameDay(timestamp: string | null): boolean {
  if (!timestamp) return false;
  return timestamp.slice(0, 10) === getTodayDateString();
}

// ============================================================================
// Pure Deno Web Push Implementation using Web Crypto API
// ============================================================================

function base64UrlToBytes(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Create a signed JWT for VAPID authentication
 */
async function createVapidJwt(
  audience: string,
  subject: string,
  privateKey: CryptoKey,
  expiration: number
): Promise<string> {
  const header = { alg: 'ES256', typ: 'JWT' };
  const payload = {
    aud: audience,
    exp: expiration,
    sub: subject,
  };

  const headerB64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format (64 bytes)
  const rawSignature = derToRaw(new Uint8Array(signatureBuffer));
  const signatureB64 = bytesToBase64Url(rawSignature);

  return `${unsignedToken}.${signatureB64}`;
}

/**
 * Convert DER-encoded ECDSA signature to raw r||s format
 */
function derToRaw(der: Uint8Array): Uint8Array {
  // Simple DER parsing for ECDSA signatures
  // DER format: 0x30 [total-len] 0x02 [r-len] [r] 0x02 [s-len] [s]
  
  // If it's already raw format (64 bytes), return as-is
  if (der.length === 64) return der;
  
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error('Invalid DER signature');
  
  // Skip total length
  let len = der[offset++];
  if (len & 0x80) offset += (len & 0x7f);

  // Parse r
  if (der[offset++] !== 0x02) throw new Error('Invalid DER signature');
  let rLen = der[offset++];
  let rStart = offset;
  offset += rLen;

  // Parse s
  if (der[offset++] !== 0x02) throw new Error('Invalid DER signature');
  let sLen = der[offset++];
  let sStart = offset;

  // Extract r and s, removing leading zeros and padding to 32 bytes
  let r = der.slice(rStart, rStart + rLen);
  let s = der.slice(sStart, sStart + sLen);

  // Remove leading zero if present (happens when high bit is set)
  if (r.length === 33 && r[0] === 0) r = r.slice(1);
  if (s.length === 33 && s[0] === 0) s = s.slice(1);

  // Pad to 32 bytes
  const result = new Uint8Array(64);
  result.set(r, 32 - r.length);
  result.set(s, 64 - s.length);

  return result;
}

/**
 * Import VAPID keys from base64url format
 */
async function importVapidPrivateKey(publicKeyB64: string, privateKeyB64: string): Promise<CryptoKey> {
  const publicKeyBytes = base64UrlToBytes(publicKeyB64);
  const privateKeyBytes = base64UrlToBytes(privateKeyB64);

  // Extract x and y from uncompressed public key (65 bytes: 0x04 + 32 bytes x + 32 bytes y)
  let x: Uint8Array, y: Uint8Array;
  if (publicKeyBytes[0] === 0x04 && publicKeyBytes.length === 65) {
    x = publicKeyBytes.slice(1, 33);
    y = publicKeyBytes.slice(33, 65);
  } else {
    throw new Error('Invalid public key format');
  }

  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToBase64Url(x),
    y: bytesToBase64Url(y),
    d: bytesToBase64Url(privateKeyBytes),
  };

  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

/**
 * Generate ECDH key pair for content encryption
 */
async function generateEcdhKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
}

/**
 * Export public key to uncompressed format (65 bytes)
 */
async function exportPublicKey(key: CryptoKey): Promise<Uint8Array> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(exported);
}

/**
 * Derive shared secret using ECDH
 */
async function deriveSharedSecret(privateKey: CryptoKey, publicKeyBytes: Uint8Array): Promise<Uint8Array> {
  const importedPubKey = await crypto.subtle.importKey(
    'raw',
    publicKeyBytes.buffer.slice(publicKeyBytes.byteOffset, publicKeyBytes.byteOffset + publicKeyBytes.byteLength) as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: importedPubKey },
    privateKey,
    256
  );

  return new Uint8Array(sharedBits);
}

/**
 * HKDF implementation using Web Crypto
 */
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const ikmBuffer = ikm.buffer.slice(ikm.byteOffset, ikm.byteOffset + ikm.byteLength) as ArrayBuffer;
  const key = await crypto.subtle.importKey('raw', ikmBuffer, 'HKDF', false, ['deriveBits']);

  const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
  const infoBuffer = info.buffer.slice(info.byteOffset, info.byteOffset + info.byteLength) as ArrayBuffer;
  
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: saltBuffer,
      info: infoBuffer,
    },
    key,
    length * 8
  );

  return new Uint8Array(derived);
}

/**
 * Create info for HKDF (RFC 8291)
 */
function createInfo(type: string, context: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(`Content-Encoding: ${type}\0`);
  return concatBytes(typeBytes, context);
}

/**
 * Encrypt payload using aes128gcm (RFC 8188)
 */
async function encryptPayload(
  payload: string,
  subscriberPublicKey: Uint8Array,
  authSecret: Uint8Array
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  // Generate ephemeral ECDH key pair
  const localKeyPair = await generateEcdhKeyPair();
  const localPublicKey = await exportPublicKey(localKeyPair.publicKey);

  // Derive shared secret
  const sharedSecret = await deriveSharedSecret(localKeyPair.privateKey, subscriberPublicKey);

  // RFC 8291 Section 3.4: info = "WebPush: info\0" || ua_public || as_public
  const keyInfo8291 = concatBytes(
    new TextEncoder().encode('WebPush: info\0'),
    subscriberPublicKey,
    localPublicKey
  );

  // Derive IKM using auth secret as salt, shared secret as IKM
  const prk = await hkdf(
    authSecret,
    sharedSecret,
    keyInfo8291,
    32
  );

  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive content encryption key and nonce
  const keyInfo = createInfo('aes128gcm', new Uint8Array(0));
  const nonceInfo = createInfo('nonce', new Uint8Array(0));

  const cek = await hkdf(salt, prk, keyInfo, 16);
  const nonce = await hkdf(salt, prk, nonceInfo, 12);

  // Pad payload (RFC 8188: at least 1 byte padding, 2 for delimiter)
  const payloadBytes = new TextEncoder().encode(payload);
  const paddedPayload = concatBytes(payloadBytes, new Uint8Array([2])); // 2 = end of content

  // Encrypt with AES-128-GCM
  const cekBuffer = cek.buffer.slice(cek.byteOffset, cek.byteOffset + cek.byteLength) as ArrayBuffer;
  const nonceBuffer = nonce.buffer.slice(nonce.byteOffset, nonce.byteOffset + nonce.byteLength) as ArrayBuffer;
  const aesKey = await crypto.subtle.importKey('raw', cekBuffer, 'AES-GCM', false, ['encrypt']);
  const paddedPayloadBuffer = paddedPayload.buffer.slice(paddedPayload.byteOffset, paddedPayload.byteOffset + paddedPayload.byteLength) as ArrayBuffer;
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonceBuffer },
    aesKey,
    paddedPayloadBuffer
  );

  // Build aes128gcm header (salt || rs || idlen || keyid)
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);

  const header = concatBytes(
    salt,
    recordSize,
    new Uint8Array([65]), // keyid length (P-256 public key)
    localPublicKey
  );

  const ciphertext = concatBytes(header, new Uint8Array(encrypted));

  return { ciphertext, salt, localPublicKey };
}

/**
 * Send a push notification using Web Push protocol
 */
async function sendPushNotification(
  subscription: DBPushSubscription,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: CryptoKey
): Promise<{ success: boolean; expired?: boolean; error?: string; status?: number }> {
  try {
    const endpoint = new URL(subscription.endpoint);
    const audience = `${endpoint.protocol}//${endpoint.host}`;

    // Create VAPID JWT (valid for 12 hours)
    const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
    const jwt = await createVapidJwt(
      audience,
      'mailto:support@profunda.app',
      vapidPrivateKey,
      expiration
    );

    // Encrypt the payload
    const subscriberPublicKey = base64UrlToBytes(subscription.p256dh);
    const authSecret = base64UrlToBytes(subscription.auth);
    const { ciphertext } = await encryptPayload(payload, subscriberPublicKey, authSecret);

    // Send the push message
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Content-Length': ciphertext.length.toString(),
        Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
        TTL: '86400',
        Urgency: 'normal',
      },
      body: ciphertext.buffer.slice(ciphertext.byteOffset, ciphertext.byteOffset + ciphertext.byteLength) as ArrayBuffer,
    });

    if (response.ok || response.status === 201) {
      return { success: true, status: response.status };
    }

    // Handle expired/invalid subscriptions
    if (response.status === 404 || response.status === 410) {
      console.warn(`[push] Subscription expired: ${response.status}`);
      return { success: false, expired: true, status: response.status };
    }

    const errorText = await response.text();
    console.error(`[push] Failed: ${response.status} - ${errorText} - endpoint: ${subscription.endpoint.slice(0, 60)}`);
    return { success: false, error: `HTTP ${response.status}: ${errorText}`, status: response.status };
  } catch (error) {
    console.error('[push] Exception:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Cache the imported private key
let vapidPrivateKeyCache: CryptoKey | null = null;

async function getVapidPrivateKey(): Promise<CryptoKey> {
  if (vapidPrivateKeyCache) return vapidPrivateKeyCache;

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('VAPID keys not configured');
  }

  vapidPrivateKeyCache = await importVapidPrivateKey(vapidPublicKey, vapidPrivateKey);
  return vapidPrivateKeyCache;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const internalNotifyKey = Deno.env.get('INTERNAL_NOTIFY_KEY');

  try {
    const body = await req.json();
    const { mode } = body;

    // Handle internal send-notification mode with dual-header auth
    if (mode === 'send-notification') {
      const xInternalKey = req.headers.get('x-internal-key');
      const authHeader = req.headers.get('Authorization');
      const bearerToken = authHeader?.replace('Bearer ', '');

      // Dual-header verification
      if (!xInternalKey || xInternalKey !== internalNotifyKey) {
        return new Response(JSON.stringify({ error: 'Invalid internal key' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!bearerToken || bearerToken !== supabaseServiceRoleKey) {
        return new Response(JSON.stringify({ error: 'Invalid service role key' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Use service role client for internal operations
      const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

      const { userId, trigger, title, body: notifBody, deepLink } = body as {
        userId: string;
        trigger: TriggerType;
        title: string;
        body: string;
        deepLink: string;
      };

      if (!userId || !trigger || !title || !notifBody || !deepLink) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch or create settings
      let { data: settings, error: settingsError } = await adminClient
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (settingsError && settingsError.code === 'PGRST116') {
        // No settings row, create one
        const { data: newSettings, error: insertError } = await adminClient
          .from('user_notification_settings')
          .insert({ user_id: userId })
          .select()
          .single();

        if (insertError) throw insertError;
        settings = newSettings;
      } else if (settingsError) {
        throw settingsError;
      }

      // Check if push is enabled
      if (!settings.push_enabled) {
        return new Response(JSON.stringify({ skipped: true, reason: 'push_disabled' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if this trigger type is enabled
      const triggerSetting = TRIGGER_TO_SETTING_MAP[trigger];
      if (!settings[triggerSetting]) {
        return new Response(JSON.stringify({ skipped: true, reason: 'trigger_disabled' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const today = getTodayDateString();

      // Note: Daily rate limiting removed - unlimited notifications allowed

      // Check per-trigger limit
      const lastNotifiedField = TRIGGER_TO_LAST_NOTIFIED_MAP[trigger];
      if (isSameDay(settings[lastNotifiedField] as string | null)) {
        return new Response(JSON.stringify({ skipped: true, reason: 'trigger_already_sent_today' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch subscriptions
      const { data: subscriptions, error: subError } = await adminClient
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId);

      if (subError) throw subError;

      if (!subscriptions || subscriptions.length === 0) {
        return new Response(JSON.stringify({ skipped: true, reason: 'no_subscriptions' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const vapidKey = await getVapidPrivateKey();
      const payload = JSON.stringify({ title, body: notifBody, deepLink });
      let sentCount = 0;
      const invalidSubscriptions: string[] = [];

      // Send to all subscriptions
      for (const sub of subscriptions as DBPushSubscription[]) {
        const result = await sendPushNotification(sub, payload, vapidPublicKey!, vapidKey);
        if (result.success) {
          sentCount++;
        } else if (result.expired) {
          invalidSubscriptions.push(sub.id);
        }
      }

      // Remove invalid subscriptions
      if (invalidSubscriptions.length > 0) {
        await adminClient
          .from('push_subscriptions')
          .delete()
          .in('id', invalidSubscriptions);
      }

      if (sentCount > 0) {
        // Update last notified timestamp (for per-trigger deduplication)
        await adminClient
          .from('user_notification_settings')
          .update({
            [lastNotifiedField]: new Date().toISOString(),
          })
          .eq('user_id', userId);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        sent: sentCount, 
        invalidRemoved: invalidSubscriptions.length 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // All other modes require user JWT auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    switch (mode) {
      case 'register-subscription': {
        const { endpoint, p256dh, auth, userAgent } = body;
        
        if (!endpoint || !p256dh || !auth) {
          return new Response(JSON.stringify({ error: 'Missing subscription data' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Upsert subscription
        const { error } = await supabase
          .from('push_subscriptions')
          .upsert(
            {
              user_id: userId,
              endpoint,
              p256dh,
              auth,
              user_agent: userAgent || null,
            },
            { onConflict: 'user_id,endpoint' }
          );

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'unregister-subscription': {
        const { endpoint } = body;

        if (endpoint) {
          // Remove specific subscription
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId)
            .eq('endpoint', endpoint);
        } else {
          // Remove all subscriptions for user
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get-settings': {
        let { data: settings, error } = await supabase
          .from('user_notification_settings')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (error && error.code === 'PGRST116') {
          // Create default settings
          const { data: newSettings, error: insertError } = await supabase
            .from('user_notification_settings')
            .insert({ user_id: userId })
            .select()
            .single();

          if (insertError) throw insertError;
          settings = newSettings;
        } else if (error) {
          throw error;
        }

        return new Response(JSON.stringify({ settings }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update-settings': {
        const { push_enabled, notify_ai_bundles, notify_weekly_plan, notify_events, notify_post_event } = body;
        
        const updates: Record<string, any> = {};
        if (push_enabled !== undefined) updates.push_enabled = push_enabled;
        if (notify_ai_bundles !== undefined) updates.notify_ai_bundles = notify_ai_bundles;
        if (notify_weekly_plan !== undefined) updates.notify_weekly_plan = notify_weekly_plan;
        if (notify_events !== undefined) updates.notify_events = notify_events;
        if (notify_post_event !== undefined) updates.notify_post_event = notify_post_event;

        if (Object.keys(updates).length === 0) {
          return new Response(JSON.stringify({ error: 'No updates provided' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { error } = await supabase
          .from('user_notification_settings')
          .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' });

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'enqueue-notification': {
        const { trigger } = body as { trigger: 'weekly_plan' | 'event_week' };

        if (!trigger || !['weekly_plan', 'event_week'].includes(trigger)) {
          return new Response(JSON.stringify({ error: 'Invalid trigger' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        let title = 'Profunda';
        let notifBody = '';
        let deepLink = '/';

        if (trigger === 'weekly_plan') {
          title = '📋 Weekly Focus Plan Ready';
          notifBody = 'Your prioritized actions for this week are ready to review.';
          deepLink = '/?open=weekly_plan';
        } else if (trigger === 'event_week') {
          // Check for upcoming events this week
          const startOfWeek = new Date();
          const endOfWeek = new Date();
          endOfWeek.setDate(endOfWeek.getDate() + 7);

          const { data: events } = await supabase
            .from('events')
            .select('id, event_name, event_date')
            .gte('event_date', startOfWeek.toISOString().slice(0, 10))
            .lte('event_date', endOfWeek.toISOString().slice(0, 10))
            .order('event_date', { ascending: true })
            .limit(1);

          if (events && events.length > 0) {
            title = '📅 Event This Week';
            notifBody = `Don't forget: ${events[0].event_name} is coming up!`;
            deepLink = '/calendar';
          } else {
            return new Response(JSON.stringify({ skipped: true, reason: 'no_upcoming_events' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        // Now call ourselves with send-notification mode (internal)
        const sendResult = await fetch(`${supabaseUrl}/functions/v1/profunda-notify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-key': internalNotifyKey!,
            'Authorization': `Bearer ${supabaseServiceRoleKey}`,
          },
          body: JSON.stringify({
            mode: 'send-notification',
            userId,
            trigger,
            title,
            body: notifBody,
            deepLink,
          }),
        });

        const sendData = await sendResult.json();
        return new Response(JSON.stringify(sendData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get-vapid-key': {
        if (!vapidPublicKey) {
          return new Response(JSON.stringify({ error: 'VAPID key not configured' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ vapidPublicKey }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'send-test': {
        // Dev-only test mode
        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', userId);

        if (!subscriptions || subscriptions.length === 0) {
          return new Response(JSON.stringify({ error: 'No subscriptions found' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const vapidKey = await getVapidPrivateKey();
        const payload = JSON.stringify({
          title: '🧪 Test Notification',
          body: 'Push notifications are working!',
          deepLink: '/settings',
        });

        let sentCount = 0;
        for (const sub of subscriptions as DBPushSubscription[]) {
          const result = await sendPushNotification(sub, payload, vapidPublicKey!, vapidKey);
          if (result.success) sentCount++;
        }

        return new Response(JSON.stringify({ success: true, sent: sentCount }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown mode' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('[profunda-notify] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
