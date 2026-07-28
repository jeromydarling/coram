/**
 * runner.ts — QA Employee Playwright runner for GitHub Actions.
 *
 * WHAT: Executes the actual Playwright spec file for a given suite,
 *       parses JSON results, uploads screenshots, and reports to Supabase.
 * WHERE: Runs in GitHub Actions, triggered by qa-run-suite edge function.
 * WHY: Each spec file defines its own test steps — no more hardcoded fallbacks.
 * VERSION: 3 — 2026-02-22 — Playwright JSON parsing, no hardcoded steps.
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const RUNNER_VERSION = 'v3-2026-02-22-playwright-json';

// ── Env ──────────────────────────────────────────────────────
const RUN_ID = process.env.RUN_ID!;
const SUITE_KEY = process.env.SUITE_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL!;
const QA_CALLBACK_SECRET = process.env.QA_CALLBACK_SECRET!;
const CALLBACK_URL = process.env.CALLBACK_URL || `${SUPABASE_URL}/functions/v1/qa-run-callback`;
const CONFIG_URL = process.env.CONFIG_URL || `${SUPABASE_URL}/functions/v1/qa-suite-config`;

const resultsFile = path.join(process.cwd(), 'test-results.json');
const screenshotsDir = path.join(process.cwd(), 'test-results');

// ── Types ────────────────────────────────────────────────────
interface StepResult {
  step_index: number;
  step_key: string;
  label: string;
  status: 'passed' | 'failed' | 'skipped';
  started_at: string;
  completed_at: string;
  url: string | null;
  screenshot_path: string | null;
  console_errors: string[];
  page_errors: string[];
  network_failures: string[];
  notes: string | null;
}

// ── Helpers ──────────────────────────────────────────────────

async function fetchSuiteConfig(suiteKey: string): Promise<{ spec_path?: string } | null> {
  try {
    const resp = await fetch(`${CONFIG_URL}?suite_key=${encodeURIComponent(suiteKey)}`, {
      headers: { 'x-internal-key': QA_CALLBACK_SECRET },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.suite || null;
  } catch {
    return null;
  }
}

async function uploadScreenshot(runId: string, stepKey: string, filePath: string): Promise<string | null> {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const resp = await fetch(CALLBACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': QA_CALLBACK_SECRET,
      },
      body: JSON.stringify({
        action: 'upload_screenshot',
        run_id: runId,
        step_key: stepKey,
        screenshot_base64: fileBuffer.toString('base64'),
      }),
    });
    if (!resp.ok) {
      console.error(`Screenshot upload failed for ${stepKey}:`, await resp.text());
      return null;
    }
    return `${runId}/${stepKey}.png`;
  } catch {
    return null;
  }
}

async function sendCallback(results: {
  run_id: string;
  status: string;
  summary: Record<string, unknown>;
  steps: StepResult[];
  github_run_id?: string;
}) {
  try {
    const resp = await fetch(CALLBACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': QA_CALLBACK_SECRET,
      },
      body: JSON.stringify(results),
    });
    if (!resp.ok) {
      console.error('Callback failed:', await resp.text());
    }
  } catch (err) {
    console.error('Callback error:', err);
  }
}

// ── Parse Playwright JSON results ────────────────────────────

function parsePlaywrightResults(jsonPath: string): {
  steps: StepResult[];
  passed: number;
  failed: number;
  skipped: number;
} {
  if (!fs.existsSync(jsonPath)) {
    return { steps: [], passed: 0, failed: 0, skipped: 0 };
  }

  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const steps: StepResult[] = [];
  let stepIndex = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  // Playwright JSON reporter outputs { suites: [...] } with nested structure
  function walkSuites(suites: any[]) {
    for (const suite of suites) {
      // Process specs (test cases)
      if (suite.specs) {
        for (const spec of suite.specs) {
          for (const test of spec.tests || []) {
            for (const result of test.results || []) {
              const status: 'passed' | 'failed' | 'skipped' =
                result.status === 'passed'
                  ? 'passed'
                  : result.status === 'skipped'
                    ? 'skipped'
                    : 'failed'; // timedOut/interrupted/failure must be treated as failed for prompt generation

              if (status === 'passed') passed++;
              else if (status === 'failed') failed++;
              else skipped++;

              // Find screenshot attachments
              const screenshots = (result.attachments || []).filter(
                (a: any) => a.contentType?.startsWith('image/')
              );

              const errorMessage = result.error?.message || result.error?.snippet || null;

              steps.push({
                step_index: stepIndex++,
                step_key: spec.title?.replace(/\s+/g, '_').toLowerCase().slice(0, 60) || `step_${stepIndex}`,
                label: spec.title || `Test ${stepIndex}`,
                status,
                started_at: result.startTime || new Date().toISOString(),
                completed_at: result.startTime
                  ? new Date(new Date(result.startTime).getTime() + (result.duration || 0)).toISOString()
                  : new Date().toISOString(),
                url: null, // Playwright JSON doesn't include current URL
                screenshot_path: screenshots[0]?.path || null,
                console_errors: [],
                page_errors: errorMessage ? [errorMessage.slice(0, 1000)] : [],
                network_failures: [],
                notes: errorMessage?.slice(0, 500) || null,
              });
            }
          }
        }
      }
      // Recurse into child suites
      if (suite.suites) {
        walkSuites(suite.suites);
      }
    }
  }

  walkSuites(raw.suites || []);
  return { steps, passed, failed, skipped };
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log(`\n========================================`);
  console.log(`CROS QA Runner ${RUNNER_VERSION}`);
  console.log(`========================================`);
  console.log(`RUN_ID:    ${RUN_ID}`);
  console.log(`SUITE_KEY: ${SUITE_KEY}`);
  console.log(`CWD:       ${process.cwd()}`);
  console.log(`========================================\n`);

  // 1. Resolve spec file path
  let specPath = '';
  const config = await fetchSuiteConfig(SUITE_KEY);
  console.log(`[qa-runner] Config response for '${SUITE_KEY}':`, JSON.stringify(config));

  if (config?.spec_path) {
    specPath = config.spec_path;
    console.log(`[qa-runner] Using config spec_path: ${specPath}`);
  } else {
    // Fallback: derive from suite key — just the filename, no tests/ prefix
    specPath = `${SUITE_KEY}.spec.ts`;
    console.log(`[qa-runner] No config spec_path, falling back to: ${specPath}`);
  }

  // Normalize: strip qa-runner/ AND tests/ prefixes.
  // Playwright filters against paths relative to testDir (which is ./tests/),
  // so the CLI argument must be just the filename, NOT "tests/filename".
  const relativeSpec = specPath
    .replace(/^qa-runner\//, '')
    .replace(/^tests\//, '');
  const fullSpecPath = path.resolve(process.cwd(), 'tests', relativeSpec);
  console.log(`[qa-runner] Resolved spec filter: ${relativeSpec} (full: ${fullSpecPath})`);

  if (!fs.existsSync(fullSpecPath)) {
    console.error(`Spec file not found: ${fullSpecPath}`);
    await sendCallback({
      run_id: RUN_ID,
      status: 'failed',
      summary: { error: `Spec file not found: tests/${relativeSpec}` },
      steps: [{
        step_index: 0,
        step_key: 'spec_not_found',
        label: `Spec file missing: tests/${relativeSpec}`,
        status: 'failed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        url: null,
        screenshot_path: null,
        console_errors: [],
        page_errors: [`File not found: tests/${relativeSpec}`],
        network_failures: [],
        notes: `The spec file tests/${relativeSpec} does not exist.`,
      }],
      github_run_id: process.env.GITHUB_RUN_ID,
    });
    process.exit(1);
  }

  // 2. Execute Playwright test
  console.log(`Running spec: ${relativeSpec}`);

  // Delete stale results file to guarantee we only read THIS run's output
  if (fs.existsSync(resultsFile)) {
    fs.unlinkSync(resultsFile);
    console.log('[qa-runner] Cleared stale test-results.json');
  }

  // Pre-flight: check critical env vars before running Playwright
  const missingVars: string[] = [];
  if (!process.env.QA_DEFAULT_BASE_URL && !process.env.BASE_URL) missingVars.push('QA_DEFAULT_BASE_URL');
  if (!process.env.QA_LOGIN_PASSWORD && !process.env.QA_PASSWORD) missingVars.push('QA_LOGIN_PASSWORD');
  // BrowserBase is optional (USE_BROWSERBASE=true to enable); only warn if enabled but missing
  if (process.env.USE_BROWSERBASE === 'true') {
    if (!process.env.BROWSERBASE_API_KEY) missingVars.push('BROWSERBASE_API_KEY');
    if (!process.env.BROWSERBASE_PROJECT_ID) missingVars.push('BROWSERBASE_PROJECT_ID');
  }
  
  if (missingVars.length > 0) {
    const errMsg = `Missing required env vars: ${missingVars.join(', ')}`;
    console.error(`[qa-runner] FATAL: ${errMsg}`);
    await sendCallback({
      run_id: RUN_ID,
      status: 'failed',
      summary: { error: errMsg, runner_version: RUNNER_VERSION },
      steps: [{
        step_index: 0,
        step_key: 'env_missing',
        label: `Missing environment variables`,
        status: 'failed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        url: null,
        screenshot_path: null,
        console_errors: [],
        page_errors: [errMsg],
        network_failures: [],
        notes: `Required secrets not configured in GitHub Actions: ${missingVars.join(', ')}`,
      }],
      github_run_id: process.env.GITHUB_RUN_ID,
    });
    process.exit(1);
  }

  let exitCode = 0;
  let playwrightOutput = '';
  try {
    const output = execSync(
      `npx playwright test "${relativeSpec}"`,
      {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PLAYWRIGHT_JSON_OUTPUT_FILE: resultsFile,
        },
        timeout: 240_000, // 4 minute max per spec (must exceed Playwright globalTimeout of 210s)
      }
    );
    playwrightOutput = output?.toString?.()?.slice(0, 4000) || '';
    if (playwrightOutput) console.log(`[qa-runner] STDOUT:\n${playwrightOutput}`);
  } catch (err: any) {
    exitCode = err.status || 1;
    const stdout = err.stdout?.toString?.()?.trim() || '';
    const stderr = err.stderr?.toString?.()?.trim() || '';
    playwrightOutput = [stdout, stderr].filter(Boolean).join('\n---STDERR---\n').slice(0, 4000);
    console.log(`Playwright exited with code ${exitCode}`);
    console.log(`[qa-runner] STDOUT:\n${stdout.slice(0, 2000)}`);
    if (stderr) console.log(`[qa-runner] STDERR:\n${stderr.slice(0, 2000)}`);
  }

  console.log(`[qa-runner] Playwright exited. Results file exists: ${fs.existsSync(resultsFile)}`);
  if (fs.existsSync(resultsFile)) {
    const stat = fs.statSync(resultsFile);
    console.log(`[qa-runner] Results file size: ${stat.size} bytes`);
  }

  // 3. Parse results
  const parseResult = parsePlaywrightResults(resultsFile);
  const { steps, passed, skipped } = parseResult;
  let { failed } = parseResult;

  // 4. Upload screenshots
  for (const step of steps) {
    if (step.screenshot_path && fs.existsSync(step.screenshot_path)) {
      const uploaded = await uploadScreenshot(RUN_ID, step.step_key, step.screenshot_path);
      step.screenshot_path = uploaded;
    } else {
      step.screenshot_path = null;
    }
  }

  // If Playwright exits non-zero but produced no failed steps (e.g. all timedOut/skipped),
  // emit a synthetic failed step so the QA prompt pipeline always has failure evidence.
  if (failed === 0 && exitCode !== 0) {
    failed++;
    steps.push({
      step_index: steps.length,
      step_key: 'spec_timeout_or_crash',
      label: `Spec timeout/crash: ${SUITE_KEY}`,
      status: 'failed',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      url: null,
      screenshot_path: null,
      console_errors: [],
      page_errors: [playwrightOutput || 'Spec exited non-zero without explicit failed step.'],
      network_failures: [],
      notes: playwrightOutput?.slice(0, 1000) || 'Playwright returned a non-zero exit code. Inspect runner logs for details.',
    });
  }

  // 5. Report
  const overallStatus = (failed > 0 || (exitCode !== 0 && passed === 0)) ? (passed > 0 ? 'partial' : 'failed') : 'passed';

  await sendCallback({
    run_id: RUN_ID,
    status: overallStatus,
    summary: {
      runner_version: RUNNER_VERSION,
      step_count: steps.length,
      passed,
      failed,
      skipped,
      spec_path: relativeSpec,
      screenshot_count: steps.filter(s => s.screenshot_path).length,
    },
    steps,
    github_run_id: process.env.GITHUB_RUN_ID,
  });

  console.log(`\nQA run complete (${RUNNER_VERSION}): ${overallStatus} (${passed} passed, ${failed} failed, ${skipped} skipped)`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Unhandled runner error:', err);
  await sendCallback({
    run_id: RUN_ID,
    status: 'failed',
    summary: { error: String(err) },
    steps: [],
    github_run_id: process.env.GITHUB_RUN_ID,
  });
  process.exit(1);
});
