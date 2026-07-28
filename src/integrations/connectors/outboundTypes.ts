/**
 * Outbound Adapter Interface — Bi-directional Sync
 *
 * WHAT: Defines the denormalization contract for writing CROS data back to external CRMs.
 * WHERE: Used by relatio-outbound-sync edge function for direct vendor API calls.
 * WHY: Consistent reverse-mapping from CROS entities to vendor-specific formats.
 *
 * Architecture:
 * - Inbound: ConnectorAdapter (types.ts) normalizes vendor → CROS
 * - Outbound: OutboundAdapter denormalizes CROS → vendor
 * - Conflicts: sync_conflicts table with flag-for-review resolution
 * - Transport: Direct Edge Function → Vendor API (no n8n)
 */

import type {
  NormalizedAccount,
  NormalizedContact,
  NormalizedTask,
  NormalizedEvent,
  NormalizedActivity,
} from './types';

/** Vendor-specific record format for outbound writes */
export interface OutboundPayload {
  /** The vendor API endpoint path (e.g., '/api/data/v9.2/contacts') */
  endpoint: string;
  /** HTTP method: POST for create, PATCH for update */
  method: 'POST' | 'PATCH';
  /** The vendor-formatted record body */
  body: Record<string, unknown>;
  /** External ID for PATCH operations */
  externalId?: string;
}

/** Change detection result for conflict checking */
export interface FieldDiff {
  field: string;
  crosValue: unknown;
  remoteValue: unknown;
}

/** Outbound sync direction for a connector */
export type SyncDirection = 'inbound' | 'outbound' | 'bidirectional';

/** Entities that can be synced outbound */
export type OutboundEntity = 'account' | 'contact' | 'task' | 'event' | 'activity' | 'stage';

/**
 * OutboundAdapter — reverse-maps CROS normalized entities to vendor format.
 *
 * Each method returns an OutboundPayload ready for the vendor API.
 * The adapter does NOT make HTTP calls — that's n8n's responsibility.
 */
export interface OutboundAdapter {
  key: string;
  displayName: string;
  supportedEntities: OutboundEntity[];

  /** CROS account → vendor account payload */
  denormalizeAccount(account: NormalizedAccount, isUpdate: boolean): OutboundPayload;

  /** CROS contact → vendor contact payload */
  denormalizeContact(contact: NormalizedContact, isUpdate: boolean): OutboundPayload;

  /** CROS task → vendor task payload */
  denormalizeTask(task: NormalizedTask, isUpdate: boolean): OutboundPayload;

  /** CROS event → vendor event payload */
  denormalizeEvent(event: NormalizedEvent, isUpdate: boolean): OutboundPayload;

  /** CROS activity → vendor activity/note payload */
  denormalizeActivity(activity: NormalizedActivity, isUpdate: boolean): OutboundPayload;

  /** Detect field-level differences between CROS and remote data */
  detectConflicts(
    entityType: OutboundEntity,
    crosData: Record<string, unknown>,
    remoteData: Record<string, unknown>
  ): FieldDiff[];
}
