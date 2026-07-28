/**
 * Membra payload schemas, shared by the SPA and the Worker (§1.2) so a form
 * and the route it posts to cannot disagree about what is valid.
 *
 * The absences are as deliberate here as in the migration. There is no field
 * for date of birth, gender, employer, income, immigration status, or a street
 * address, and §3.7 puts several of those permanently out of bounds. If a
 * future form needs one, it is a spec conversation before it is a schema
 * change.
 */

import { z } from 'zod';

/** Blank strings from HTML forms mean "not provided", not "set to empty". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? undefined : v))
    .optional();

export const contactEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email('That does not look like an email address.');

/**
 * Loose on purpose. Organizing lists carry international numbers, extensions,
 * and numbers written the way the person said them. Rejecting those loses
 * contacts; storing them as given loses nothing.
 */
export const contactPhone = z.string().trim().min(4).max(32);

/** Coarse by design — no street address (§3.7). */
export const postalCode = z.string().trim().max(12);

export const contactBase = z.object({
  displayName: z.string().trim().min(1, 'A name, or whatever they go by.').max(200),
  email: contactEmail.optional(),
  phone: contactPhone.optional(),
  postalCode: postalCode.optional(),
  turfId: z.string().uuid().optional(),
  customFields: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
});

/** Same rule as the DB CHECK: a record with no name and no way to reach them is not a contact. */
const reachable = <T extends { displayName?: string; email?: string; phone?: string }>(v: T) =>
  Boolean(v.displayName?.trim() || v.email || v.phone);

export const createContactSchema = contactBase.refine(reachable, {
  message: 'Give at least a name, an email, or a phone number.',
});

export const updateContactSchema = contactBase.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'Nothing to change.' },
);

export const listContactsQuery = z.object({
  /** Matches name, email or phone. */
  q: z.string().trim().max(200).optional(),
  turfId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Consent ledger (§5.1)
// ---------------------------------------------------------------------------

export const consentChannel = z.enum(['email', 'sms', 'phone', 'post', 'any']);

export const recordConsentSchema = z.object({
  channel: consentChannel,
  granted: z.boolean(),
  /** How we came to have them. Free text so a workspace can be specific. */
  acquisition: z.string().trim().min(1, 'Say how this contact was acquired.').max(80),
  note: optionalText(500),
});

// ---------------------------------------------------------------------------
// Encrypted notes (§3.3)
//
// The Worker validates the envelope and nothing else. It has no key, so it
// cannot check that the ciphertext decrypts, and it must never be given a
// plaintext field to accidentally persist — hence `.strict()`.
// ---------------------------------------------------------------------------

export const sealedNoteSchema = z
  .object({
    ciphertext: z.string().min(1).max(64_000),
    nonce: z.string().min(1).max(64),
    keyId: z.string().uuid(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Import (§5.1) — column mapping, dry-run preview, rollback
// ---------------------------------------------------------------------------

/** Contact fields an import can target. Anything else is ignored. */
export const IMPORTABLE_FIELDS = ['displayName', 'email', 'phone', 'postalCode'] as const;
export type ImportableField = (typeof IMPORTABLE_FIELDS)[number];

/** CSV header -> contact field. Unmapped headers are dropped, not guessed at. */
export const columnMapping = z.record(z.enum(IMPORTABLE_FIELDS));

/**
 * Rows travel with both preview and commit, and are never stored between them.
 *
 * Sending them twice costs bandwidth. The alternative — parking an uploaded
 * list of people in R2 or KV between the two calls — would create a second
 * copy of exactly the data §3 is most careful about, sitting somewhere with
 * its own retention story to get wrong. The bandwidth is the cheaper problem.
 */
export const importRows = z.array(z.record(z.string())).min(1).max(5_000);

export const importPreviewSchema = z.object({
  mapping: columnMapping,
  rows: importRows,
});

export const importCommitSchema = z.object({
  label: z.string().trim().min(1, 'Name this import so it can be found again.').max(120),
  mapping: columnMapping,
  rows: importRows,
  /** What to do when an incoming email already exists in the workspace. */
  onDuplicate: z.enum(['skip', 'update']).default('skip'),
  turfId: z.string().uuid().optional(),
});

export type ImportAction = 'create' | 'update' | 'skip';

export interface ImportPreviewRow {
  row: number;
  action: ImportAction;
  displayName?: string;
  email?: string;
  /** Why a row will be skipped, in words an organizer can act on. */
  reason?: string;
}

export interface ImportPreview {
  total: number;
  creates: number;
  updates: number;
  skips: number;
  /** Every row, so an organizer can see what will happen before it happens. */
  rows: ImportPreviewRow[];
  /** Set when the import would carry the workspace past its tier ceiling (§6). */
  overContactLimit?: { limit: number; current: number; wouldAdd: number };
}

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type RecordConsentInput = z.infer<typeof recordConsentSchema>;
export type SealedNoteInput = z.infer<typeof sealedNoteSchema>;
export type ImportCommitInput = z.infer<typeof importCommitSchema>;
