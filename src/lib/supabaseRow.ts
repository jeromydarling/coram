/**
 * supabaseRow / supabaseRows — Typed cast helpers for Supabase results.
 *
 * WHAT: A single chokepoint for the `as unknown as T` cast we currently spread
 *       as 599+ `as any` calls across the codebase. Use this in src/data/**
 *       hooks so that the unsafe cast is named, greppable, and trivially
 *       upgradeable later (e.g. to runtime zod validation).
 * WHERE: Imported by every data hook that selects from Supabase tables whose
 *        generated types disagree with the runtime shape (relations, joins,
 *        custom RPC, etc.).
 * WHY:   `as any` hides bugs and is impossible to audit. Centralizing the
 *        cast lets us swap in validation without touching every call site.
 */

/** Cast a single Supabase row (or null) to the expected app-domain shape. */
export function supabaseRow<T>(row: unknown): T {
  return row as T;
}

/** Cast a Supabase row array (defaults to []) to the app-domain shape. */
export function supabaseRows<T>(rows: unknown): T[] {
  return (rows ?? []) as T[];
}

/**
 * Unwrap a Supabase `{ data, error }` response, throwing on error.
 * Use in queryFn bodies to remove repetitive `if (error) throw error` lines.
 */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
