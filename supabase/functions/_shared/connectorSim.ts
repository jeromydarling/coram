/**
 * connectorSim.ts — Deterministic Connector Simulation Engine.
 *
 * WHAT: Generates fake CRM data for testing connector contracts.
 * WHERE: Used by integration-smoke-test, migration-dry-run, migration-commit in simulation mode.
 * WHY: Test mapping, dedupe, and rollback logic without real vendor APIs.
 */

// Seeded PRNG (Mulberry32)
function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

interface SimProfile {
  id: string;
  connector_key: string;
  profile_key: string;
  display_name: string;
  description: string | null;
  behavior: {
    mode: "success" | "error";
    status: number;
    error_code?: string;
    counts: Record<string, number>;
    samples?: Record<string, unknown[]>;
    schema_variant?: string;
    latency_ms?: number;
  };
  seed: number;
  active: boolean;
}

export async function getSimulationProfile(
  svc: { from: (t: string) => any },
  connector_key: string,
  profile_key: string,
): Promise<SimProfile | null> {
  const { data } = await svc
    .from("connector_simulation_profiles")
    .select("*")
    .eq("connector_key", connector_key)
    .eq("profile_key", profile_key)
    .eq("active", true)
    .maybeSingle();
  return data as SimProfile | null;
}

const OBJECT_TYPES = ["companies", "contacts", "activities", "tasks", "events"];

const FAKE_DOMAINS = [
  "example.org", "sample-npo.org", "community-bridge.org",
  "metro-connect.org", "neighborhub.org", "pathways-inc.org",
  "serving-hands.org", "civic-roots.org", "openfield.org", "brighthope.org",
];

const FIRST_NAMES = [
  "Jordan", "Taylor", "Casey", "Morgan", "Riley",
  "Alex", "Quinn", "Avery", "Drew", "Finley",
];

const LAST_NAMES = [
  "Rivers", "Chen", "Brooks", "Nakamura", "Patel",
  "Torres", "Kim", "Okafor", "Singh", "Kowalski",
];

const ORG_PREFIXES = [
  "Bridge", "Metro", "Community", "Horizon", "Pathway",
  "Civic", "Open", "Bright", "Neighborhood", "Roots",
];

const ORG_SUFFIXES = [
  "Alliance", "Coalition", "Initiative", "Network", "Foundation",
  "Partners", "Collaborative", "Hub", "Services", "Center",
];

function generateCompany(rng: () => number, idx: number, schemaV2: boolean) {
  const prefix = ORG_PREFIXES[Math.floor(rng() * ORG_PREFIXES.length)];
  const suffix = ORG_SUFFIXES[Math.floor(rng() * ORG_SUFFIXES.length)];
  const domain = FAKE_DOMAINS[Math.floor(rng() * FAKE_DOMAINS.length)];

  const base: Record<string, unknown> = {
    id: `sim-company-${idx}`,
    name: `${prefix} ${suffix}`,
    domain: `${prefix.toLowerCase()}.${domain}`,
  };

  if (!schemaV2) {
    base.description = `A community organization focused on ${suffix.toLowerCase()} work.`;
    base.industry = "Nonprofit";
  } else {
    // v2 renames description → about, drops industry
    base.about = `A community organization focused on ${suffix.toLowerCase()} work.`;
  }

  return base;
}

function generateContact(rng: () => number, idx: number, schemaV2: boolean) {
  const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
  const domain = FAKE_DOMAINS[Math.floor(rng() * FAKE_DOMAINS.length)];

  const base: Record<string, unknown> = {
    id: `sim-contact-${idx}`,
    firstname: first,
    lastname: last,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`,
  };

  if (!schemaV2) {
    base.phone = `555-${String(1000 + idx).slice(-4)}`;
    base.jobtitle = "Program Coordinator";
  } else {
    base.mobile = `555-${String(1000 + idx).slice(-4)}`;
    base.role = "Program Coordinator";
  }

  return base;
}

function generateActivity(rng: () => number, idx: number) {
  const days = Math.floor(rng() * 180);
  const d = new Date(2026, 0, 1);
  d.setDate(d.getDate() - days);
  return {
    id: `sim-activity-${idx}`,
    type: ["meeting", "call", "email", "note"][Math.floor(rng() * 4)],
    date: d.toISOString().split("T")[0],
    notes: `Simulated activity record ${idx}.`,
  };
}

function generateTask(rng: () => number, idx: number) {
  return {
    id: `sim-task-${idx}`,
    subject: `Follow-up task ${idx}`,
    status: ["open", "completed"][Math.floor(rng() * 2)],
    due_date: "2026-03-15",
  };
}

function generateEvent(rng: () => number, idx: number) {
  return {
    id: `sim-event-${idx}`,
    name: `Community Gathering ${idx}`,
    date: "2026-04-01",
    location: "Downtown Community Center",
  };
}

export function buildSimulatedSourcePayload(
  connector_key: string,
  profile: SimProfile,
  run_key: string,
): { type: "simulate"; profile_key: string; run_key: string; data: Record<string, unknown[]> } {
  const behavior = profile.behavior;
  const seedVal = hashString(`${connector_key}:${profile.profile_key}:${run_key}:${profile.seed}`);
  const rng = mulberry32(seedVal);
  const schemaV2 = behavior.schema_variant === "v2";

  const data: Record<string, unknown[]> = {};

  // If behavior provides explicit samples, use them
  if (behavior.samples) {
    for (const [objType, samples] of Object.entries(behavior.samples)) {
      data[objType] = samples;
    }
    return { type: "simulate", profile_key: profile.profile_key, run_key, data };
  }

  const generators: Record<string, (rng: () => number, i: number, v2: boolean) => unknown> = {
    companies: generateCompany,
    contacts: generateContact,
    activities: (r, i) => generateActivity(r, i),
    tasks: (r, i) => generateTask(r, i),
    events: (r, i) => generateEvent(r, i),
  };

  for (const objType of OBJECT_TYPES) {
    const count = behavior.counts[objType] ?? 0;
    const gen = generators[objType];
    if (!gen) continue;
    const rows: unknown[] = [];
    // Cap sample generation at 200 for preview
    const genCount = Math.min(count, 200);
    for (let i = 0; i < genCount; i++) {
      rows.push(gen(rng, i, schemaV2));
    }
    data[objType] = rows;
  }

  return { type: "simulate", profile_key: profile.profile_key, run_key, data };
}

export interface SimFetchResult {
  ok: boolean;
  status: number;
  data?: Record<string, unknown[]>;
  error?: { code: string; message: string };
  simulated: true;
  profile_key: string;
  warnings: string[];
}

export function simulateConnectorFetch(
  connector_key: string,
  profile: SimProfile,
  run_key: string,
): SimFetchResult {
  const behavior = profile.behavior;
  const warnings: string[] = [];

  if (behavior.mode === "error") {
    return {
      ok: false,
      status: behavior.status,
      error: {
        code: behavior.error_code ?? "UNKNOWN_ERROR",
        message: `Simulated ${behavior.error_code ?? "error"} for ${connector_key}:${profile.profile_key}`,
      },
      simulated: true,
      profile_key: profile.profile_key,
      warnings,
    };
  }

  const payload = buildSimulatedSourcePayload(connector_key, profile, run_key);

  if (behavior.schema_variant === "v2") {
    warnings.push("Schema drift detected: v2 schema has renamed/removed fields.");
  }

  // Check for large datasets
  for (const [objType, count] of Object.entries(behavior.counts)) {
    if (count > 50000) {
      warnings.push(`${objType}: exceeds 50,000 row limit (${count} rows)`);
    }
  }

  return {
    ok: true,
    status: 200,
    data: payload.data,
    simulated: true,
    profile_key: profile.profile_key,
    warnings,
  };
}
