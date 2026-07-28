/**
 * qa-sync-suites — Syncs test suite registry from GitHub repo /tests folder.
 *
 * WHAT: Reads *.spec.ts files from the GitHub repo and upserts them into qa_test_suites.
 * WHERE: Operator Console → QA Employee → "Sync Suites" button.
 * WHY: Ensures new Playwright spec files are automatically available in the QA Runner
 *       without manual DB inserts.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/** Convert a filename like "login-redirects-after-auth.spec.ts" to a display name */
function fileToDisplayName(filename: string): string {
  return filename
    .replace(/\.spec(\.ts)?$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Convert a filename to a slug key */
function fileToKey(filename: string): string {
  return filename
    .replace(/\.spec(\.ts)?$/, '')
    .replace(/[^a-z0-9-]/gi, '_')
    .toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    // Check admin role
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: corsHeaders });
    }

    // Read GitHub repo /tests folder
    const githubPat = Deno.env.get('GITHUB_QA_PAT');
    if (!githubPat) {
      return new Response(JSON.stringify({ error: 'GITHUB_QA_PAT secret not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const repoOwner = Deno.env.get('GITHUB_REPO_OWNER') || 'jeromydarling';
    const repoName = Deno.env.get('GITHUB_REPO_NAME') || 'thecros';
    const testsUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/qa-runner/tests`;

    const ghResp = await fetch(testsUrl, {
      headers: {
        Authorization: `Bearer ${githubPat}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    // Treat 404 (directory doesn't exist) as empty listing
    let specFiles: Array<{ name: string; path: string; type: string }> = [];
    if (ghResp.ok) {
      const files: Array<{ name: string; path: string; type: string }> = await ghResp.json();
      specFiles = files.filter(f => f.type === 'file' && f.name.match(/\.spec(\.ts)?$/));
    } else if (ghResp.status !== 404) {
      const errText = await ghResp.text();
      return new Response(JSON.stringify({ error: 'GitHub API error', status: ghResp.status, detail: errText }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert each spec file into qa_test_suites
    // Use ignoreDuplicates so existing rows (including disabled ones) are NOT overwritten.
    // Only genuinely new spec files get inserted with enabled=true.
    const upserts = specFiles.map(f => ({
      key: fileToKey(f.name),
      name: fileToDisplayName(f.name),
      spec_path: f.path,
      enabled: true,
      updated_at: new Date().toISOString(),
    }));

    // First: insert only NEW suites (ignore conflicts)
    const { error: insertError } = await serviceClient
      .from('qa_test_suites')
      .upsert(upserts, { onConflict: 'key', ignoreDuplicates: true });

    if (insertError) {
      return new Response(JSON.stringify({ error: 'Insert failed', detail: insertError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Second: update spec_path + name for existing suites (without touching enabled)
    for (const u of upserts) {
      await serviceClient
        .from('qa_test_suites')
        .update({ name: u.name, spec_path: u.spec_path, updated_at: u.updated_at })
        .eq('key', u.key);
    }

    // Hard-delete any suites NOT in the current repo listing.
    // Previously we only soft-disabled, which left orphaned legacy rows.
    // We must first delete associated qa_test_runs to avoid FK violations.
    const repoKeys = upserts.map(u => u.key);
    const { data: allSuites } = await serviceClient
      .from('qa_test_suites')
      .select('key');

    if (allSuites) {
      const orphanKeys = allSuites
        .filter(s => !repoKeys.includes(s.key))
        .map(s => s.key);

      if (orphanKeys.length > 0) {
        // Delete runs referencing orphaned suites first (FK constraint)
        await serviceClient
          .from('qa_test_runs')
          .delete()
          .in('suite_key', orphanKeys);

        await serviceClient
          .from('qa_test_suites')
          .delete()
          .in('key', orphanKeys);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      synced: upserts.length,
      keys: upserts.map(u => u.key),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
