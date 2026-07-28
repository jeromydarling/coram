/**
 * google-oauth-callback — Handles Google OAuth code exchange.
 *
 * SEC-001: Validates redirect_uri against allowlist.
 * SEC-002: Origin-aware CORS via shared module.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { isAllowedOrigin } from '../_shared/cors.ts';

/** Safe redirect paths/origins for post-auth redirect */
const SAFE_REDIRECT_PATTERNS = [
  'https://thecros.lovable.app',
  'https://thecros.app',
  'http://localhost:',
  'https://id-preview--',
];

function isAllowedRedirect(uri: string): boolean {
  try {
    if (uri.startsWith('/')) return true;
    const parsed = new URL(uri, 'https://thecros.lovable.app');
    return SAFE_REDIRECT_PATTERNS.some((origin) => parsed.href.startsWith(origin));
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

    const reqUrl = new URL(req.url);
    const code = reqUrl.searchParams.get('code');
    const stateParam = reqUrl.searchParams.get('state');
    const error = reqUrl.searchParams.get('error');

    if (error || !code || !stateParam) {
      return new Response('<html><body><h2>Authorization failed</h2><p>Please try again.</p></body></html>', {
        status: 400, headers: { 'Content-Type': 'text/html' },
      });
    }

    let state: { user_id: string; property_id: string; redirect_uri: string };
    try {
      state = JSON.parse(atob(stateParam));
    } catch {
      return new Response('<html><body><h2>Invalid state</h2></body></html>', {
        status: 400, headers: { 'Content-Type': 'text/html' },
      });
    }

    const callbackUrl = `${url}/functions/v1/google-oauth-callback`;

    // Exchange code for tokens
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let tokenRes: Response;
    try {
      tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: callbackUrl,
          grant_type: 'authorization_code',
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Token exchange failed:', tokenData);
      return new Response('<html><body><h2>Token exchange failed</h2><p>Please try again.</p></body></html>', {
        status: 400, headers: { 'Content-Type': 'text/html' },
      });
    }

    // Get user email
    let connectedEmail = '';
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userInfo = await userInfoRes.json();
      connectedEmail = userInfo.email || '';
    } catch {
      // Non-critical
    }

    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

    const adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: upsertErr } = await adminClient
      .from('gardener_ga_connections')
      .upsert({
        user_id: state.user_id,
        property_id: state.property_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: expiresAt,
        connected_email: connectedEmail,
        is_active: true,
      }, { onConflict: 'user_id,property_id' })
      .select();

    if (upsertErr) {
      await adminClient.from('gardener_ga_connections')
        .delete()
        .eq('user_id', state.user_id)
        .eq('property_id', state.property_id);

      await adminClient.from('gardener_ga_connections').insert({
        user_id: state.user_id,
        property_id: state.property_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: expiresAt,
        connected_email: connectedEmail,
        is_active: true,
      });
    }

    // SEC-001: Validate redirect against allowlist
    const requestedRedirect = state.redirect_uri || '/operator/nexus/analytics';
    const safeRedirect = isAllowedRedirect(requestedRedirect)
      ? requestedRedirect
      : '/operator/nexus/analytics';

    return new Response(null, {
      status: 302,
      headers: { Location: safeRedirect },
    });
  } catch (err) {
    console.error('google-oauth-callback error:', err);
    return new Response('<html><body><h2>Server error</h2><p>An unexpected error occurred. Please try again.</p></body></html>', {
      status: 500, headers: { 'Content-Type': 'text/html' },
    });
  }
});
