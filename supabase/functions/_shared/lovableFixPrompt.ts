/**
 * lovableFixPrompt — Canonical Lovable repair-prompt builder for edge functions.
 *
 * WHAT: Deterministic prompt builder shared by the error-alert-digest cron and any
 *       other edge function that needs to render a fix prompt from an issue record.
 * WHERE: Imported by supabase/functions/error-alert-digest. Mirrors the frontend
 *        src/lib/buildLovableFixPrompt.ts (kept in sync intentionally — Deno cannot
 *        import the Vite-aliased frontend module, so the logic lives here for the
 *        server side).
 * WHY: One source of truth for the server-side prompt shape; the digest now builds
 *      prompts from Sentry-normalized issues (context.route / function_name / stack).
 */

export interface FixPromptIssue {
  source: string;
  severity: string;
  fingerprint: string;
  message: string;
  context: Record<string, unknown>;
  repro_steps?: string | null;
  expected?: string | null;
  count: number;
  first_seen_at: string | null;
  last_seen_at?: string | null;
  status: string;
}

function inferLikelyFiles(issue: FixPromptIssue): string[] {
  const files: string[] = [];
  const route = (issue.context?.route as string) || "";
  const functionName = (issue.context?.function_name as string) || "";
  if (route.includes("/operator")) files.push("src/pages/operator/");
  if (route.includes("/admin")) files.push("src/pages/admin/");
  if (route.includes("/onboarding")) files.push("src/pages/Onboarding.tsx");
  if (issue.source === "edge_function" && functionName) {
    files.push(`supabase/functions/${functionName}/index.ts`);
  }
  const stack = (issue.context?.stack as string) || "";
  const srcMatch = stack.match(/src\/[^\s:)]+/g);
  if (srcMatch) files.push(...srcMatch.slice(0, 3));
  return [...new Set(files)];
}

export function buildFixPrompt(issue: FixPromptIssue): string {
  const route = (issue.context?.route as string) || "unknown";
  const shortMsg =
    issue.message.length > 60 ? issue.message.slice(0, 60) + "…" : issue.message;
  const likelyFiles = inferLikelyFiles(issue);
  const since = issue.first_seen_at
    ? new Date(issue.first_seen_at).toLocaleDateString()
    : "unknown";
  return [
    `# FIX: [${issue.source}] — ${route} — ${shortMsg}`,
    "",
    "## CONTEXT",
    `A ${issue.source} error on route \`${route}\`.`,
    `Seen ${issue.count} time(s) since ${since}.`,
    `Severity: ${issue.severity}. Status: ${issue.status}.`,
    "",
    "## REPRO STEPS",
    issue.repro_steps ||
      `1. Navigate to \`${route}\`\n2. Trigger the failing action\n3. Observe the error`,
    "",
    "## ACTUAL",
    `Error message: ${issue.message}`,
    (issue.context?.stack as string)
      ? `\nStack excerpt:\n\`\`\`\n${(issue.context.stack as string).slice(0, 400)}\n\`\`\``
      : "",
    "",
    "## LIKELY FILES",
    likelyFiles.length > 0
      ? likelyFiles.map((f) => `- \`${f}\``).join("\n")
      : "- Check stack trace",
    "",
    "## REQUIRED FIX",
    "- Stabilize the failing handler",
    "- Add input guardrails / validation",
    "- Maintain RLS policies",
    "- Mobile-first layouts at 320px",
    "- Calm Mode language",
  ].join("\n");
}
