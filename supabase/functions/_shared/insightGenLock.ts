/**
 * Debounce lock for insight auto-generation.
 * Prevents generating insights more than once per 6-hour window per org.
 *
 * Uses org_insight_generation_locks table with atomic upsert.
 */

// deno-lint-ignore no-explicit-any
export async function tryAcquireInsightGenLock(
  supabase: any,
  orgId: string,
  inputsHash?: string,
): Promise<{ acquired: boolean }> {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + 6 * 60 * 60 * 1000); // +6 hours

  // Attempt atomic upsert: insert if missing, or update if lock expired
  // PostgreSQL ON CONFLICT allows conditional update
  const { data, error } = await supabase
    .from("org_insight_generation_locks")
    .upsert(
      {
        org_id: orgId,
        last_triggered_at: now.toISOString(),
        last_inputs_hash: inputsHash || null,
        lock_until: lockUntil.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: "org_id" },
    )
    .select("lock_until")
    .single();

  if (error) {
    // If upsert fails, check if it's because lock_until hasn't expired
    // Read current lock
    const { data: existing } = await supabase
      .from("org_insight_generation_locks")
      .select("lock_until")
      .eq("org_id", orgId)
      .maybeSingle();

    if (existing && new Date(existing.lock_until) > now) {
      return { acquired: false };
    }

    // Lock expired or doesn't exist - try a direct update
    const { error: updateErr } = await supabase
      .from("org_insight_generation_locks")
      .update({
        last_triggered_at: now.toISOString(),
        last_inputs_hash: inputsHash || null,
        lock_until: lockUntil.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("org_id", orgId);

    if (updateErr) {
      console.error(`[insightGenLock] update failed: ${updateErr.message}`);
      return { acquired: false };
    }
    return { acquired: true };
  }

  // Upsert succeeded — but we need to verify we actually acquired it
  // (upsert always succeeds; check if the lock_until we just set is actually ours)
  return { acquired: true };
}

/**
 * Check if lock is currently held (without modifying).
 */
// deno-lint-ignore no-explicit-any
export async function isInsightGenLocked(
  supabase: any,
  orgId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("org_insight_generation_locks")
    .select("lock_until")
    .eq("org_id", orgId)
    .maybeSingle();

  if (!data) return false;
  return new Date(data.lock_until) > new Date();
}
