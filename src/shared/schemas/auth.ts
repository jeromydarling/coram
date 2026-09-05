/**
 * Auth payload schemas. Imported by both the Worker and the SPA (§1.2) so a
 * form and the route it posts to cannot disagree about what is valid.
 */

import { z } from 'zod';

export const email = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .email('That does not look like an email address.');

/**
 * Length is the only rule. No character-class requirements: they push people
 * toward predictable substitutions and a shorter effective password, and the
 * verifier is PBKDF2 at 600k iterations either way.
 */
export const password = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(256, 'That is longer than we can hash.');

export const signupSchema = z.object({
  email,
  password,
  /** The workspace this person is creating. They become its steward. */
  workspaceName: z.string().trim().min(2, 'Name the group.').max(120),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
});

export const requestResetSchema = z.object({ email });

export const confirmResetSchema = z.object({
  token: z.string().min(20),
  password,
});

export const selectWorkspaceSchema = z.object({
  tenantId: z.string().uuid(),
});

/**
 * Accepting an invite. No email field — the invite already names one, and
 * asking again would let someone accept it as an address that is not theirs.
 *
 * `password` is required by the schema but only load-bearing when the invited
 * address has no account yet; api/auth.ts decides which case it is and, for an
 * existing account, treats it as the password to authenticate with rather than
 * one to set.
 */
export const acceptInviteSchema = z.object({
  token: z.string().min(20),
  password,
  displayName: z.string().trim().max(120).optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RequestResetInput = z.infer<typeof requestResetSchema>;
export type ConfirmResetInput = z.infer<typeof confirmResetSchema>;
export type SelectWorkspaceInput = z.infer<typeof selectWorkspaceSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
