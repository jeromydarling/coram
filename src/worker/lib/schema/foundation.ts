/**
 * Foundation schema.
 *
 * Two rules govern everything here:
 *   §4.2 — every tenant-scoped table carries `tenant_id`, default-deny RLS.
 *   §3.4 — every table registers with retention.ts beside its definition.
 *
 * The Drizzle definitions below are for query typing. The authoritative DDL,
 * including the RLS policies that are the actual security boundary, lives in
 * migrations/0001_foundation.sql. Where the two could drift, the migration
 * wins; scripts/check-retention.ts holds them together in CI.
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { registerTable } from '../retention';

/** The five roles from §4.1. Mirrors the `coram_role` enum in Postgres. */
export const ROLES = ['steward', 'organizer', 'member', 'observer', 'legal'] as const;
export type Role = (typeof ROLES)[number];

/** Billing tiers from §6. Free is contact-gated, never feature-gated. */
export const TIERS = ['parish', 'local', 'coalition', 'federation'] as const;
export type Tier = (typeof TIERS)[number];

// ---------------------------------------------------------------------------
// tenants
// ---------------------------------------------------------------------------

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  tier: text('tier').$type<Tier>().notNull().default('parish'),
  /**
   * Denormalized contact count driving the §6 gate. Downgrade freezes new
   * contact creation; it never deletes.
   */
  contactCount: bigint('contact_count', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

registerTable({
  table: 'tenants',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'id',
  purge: 'delete',
  reason:
    'The workspace itself. Holds no personal data — an organization name and a tier. ' +
    'Lives as long as the workspace does; removed outright by the burn switch.',
});

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

/**
 * A person who can sign in. Deliberately thin: an email to sign in with and a
 * password verifier. No name, no avatar, no phone, no last-login IP.
 *
 * A user's *organizing* identity (what they are called, what turf they hold)
 * lives on the membership, because it is tenant-scoped. The login record is
 * not.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    /** PBKDF2-SHA256, encoded by lib/crypto.ts. Never a reversible form. */
    passwordHash: text('password_hash').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /**
     * Date-granular, not timestamp-granular, and updated at most once a day.
     * We need it to expire abandoned accounts. We do not need to know when
     * someone was at their desk.
     */
    lastSeenOn: timestamp('last_seen_on', { withTimezone: true }),
  },
  (t) => [uniqueIndex('users_email_key').on(sql`lower(${t.email})`)],
);

registerTable({
  table: 'users',
  retentionDays: 730,
  pii: 'contact',
  timestampColumn: 'last_seen_on',
  tenantColumn: 'id',
  purge: 'delete',
  reason:
    'Sign-in identity. Email is required to authenticate and to send password resets. ' +
    'Purged two years after last sign-in so abandoned accounts do not accumulate.',
});

// ---------------------------------------------------------------------------
// memberships
// ---------------------------------------------------------------------------

/**
 * Joins a user to a tenant with exactly one role. The JWT is minted from this
 * row (§4.2) and RLS reads the resulting GUCs — so this table is the origin of
 * every access decision in the product.
 */
export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').$type<Role>().notNull(),
    /**
     * Turfs an `organizer` may see contacts within (§4.1). Empty for every
     * other role. Polygons themselves arrive with Vinculum (§5.2); this column
     * exists now because RLS policies written today already consult it.
     */
    turfIds: uuid('turf_ids').array().notNull().default(sql`'{}'::uuid[]`),
    /** Display name within this workspace. Optional — a handle is fine. */
    displayName: text('display_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('memberships_tenant_user_key').on(t.tenantId, t.userId),
    index('memberships_user_idx').on(t.userId),
  ],
);

registerTable({
  table: 'memberships',
  retentionDays: 730,
  pii: 'pseudonym',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'Binds a person to a workspace and a role. Every access decision derives from it. ' +
    'Matches the users retention window so a purged user leaves no dangling grant.',
});

// ---------------------------------------------------------------------------
// auth_tokens
// ---------------------------------------------------------------------------

/**
 * Single-use email verification and password reset tokens. We store a hash,
 * not the token, so a database disclosure does not hand over live reset links.
 */
export const authTokens = pgTable(
  'auth_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<'verify' | 'reset'>().notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('auth_tokens_hash_key').on(t.tokenHash),
    index('auth_tokens_user_idx').on(t.userId),
  ],
);

registerTable({
  table: 'auth_tokens',
  retentionDays: 2,
  pii: 'pseudonym',
  timestampColumn: 'created_at',
  tenantColumn: 'user_id',
  purge: 'delete',
  reason:
    'Email verification and password reset. Tokens expire in hours; the row is swept ' +
    'after two days so a spent reset link is not still sitting in the table a month on.',
});

// ---------------------------------------------------------------------------
// audit_log
// ---------------------------------------------------------------------------

/**
 * §3.6: records access, never content. Who read what record *type*, when.
 *
 * There is no `payload` column and there will not be one. `recordCount` is the
 * concession to usefulness — a steward reviewing this log needs to tell a
 * single lookup from a bulk export — and a count reveals nothing about values.
 *
 * Note what is absent: no IP, no user agent. §3.7 permits IP only inside a
 * 24-hour rate-limit window, which lives in KV with a TTL, never here.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Null for actions taken by cron rather than a person. */
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorRole: text('actor_role').$type<Role>(),
    /** Verb, dotted. e.g. 'contact.read', 'export.create', 'workspace.burn'. */
    action: text('action').notNull(),
    /** Table or logical record type touched. Never a record id, never a value. */
    recordType: text('record_type').notNull(),
    recordCount: bigint('record_count', { mode: 'number' }).notNull().default(1),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_tenant_time_idx').on(t.tenantId, t.occurredAt),
    index('audit_log_actor_idx').on(t.actorId),
  ],
);

registerTable({
  table: 'audit_log',
  retentionDays: 400,
  pii: 'pseudonym',
  timestampColumn: 'occurred_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'Lets a steward answer "who looked at our members". Holds actor, verb, record type ' +
    'and count — never values. Kept 400 days so a full year is always reviewable.',
});

// ---------------------------------------------------------------------------
// burned_tenants
// ---------------------------------------------------------------------------

/**
 * The one thing that outlives a burn (§3.5).
 *
 * A burned workspace leaves a tombstone holding a tenant id and a timestamp —
 * nothing else, and nothing that was in it. It exists so the id is never
 * reissued, so a returning steward gets "this workspace was destroyed" instead
 * of a confusing 404, and so the semiannual transparency report can state how
 * many workspaces exercised the switch.
 *
 * This is not a soft-delete. The rows are already gone when this is written.
 */
export const burnedTenants = pgTable('burned_tenants', {
  tenantId: uuid('tenant_id').primaryKey(),
  burnedAt: timestamp('burned_at', { withTimezone: true }).notNull().defaultNow(),
});

registerTable({
  table: 'burned_tenants',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'burned_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'Tombstone proving a workspace was destroyed. A uuid and a timestamp, nothing from ' +
    'inside the workspace. Kept indefinitely so the id is never reissued.',
});
