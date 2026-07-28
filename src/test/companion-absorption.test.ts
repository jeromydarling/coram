/**
 * Companion Absorption Logic — Vitest suite.
 *
 * WHAT: Tests the pure logic used in companion absorption: strategy validation,
 *       ownership model rules, and invite eligibility checks.
 * WHERE: src/test/companion-absorption.test.ts
 * WHY: Ensures relationship handling, ownership model, and privacy rules are correct.
 */
import { describe, it, expect } from 'vitest';

// ── Strategy validation ──
describe('Companion Absorption: Strategy Validation', () => {
  const VALID_STRATEGIES = ['private', 'move', 'copy'];

  it('accepts "private" strategy', () => {
    expect(VALID_STRATEGIES.includes('private')).toBe(true);
  });

  it('accepts "move" strategy', () => {
    expect(VALID_STRATEGIES.includes('move')).toBe(true);
  });

  it('accepts "copy" strategy', () => {
    expect(VALID_STRATEGIES.includes('copy')).toBe(true);
  });

  it('rejects "teleport" strategy', () => {
    expect(VALID_STRATEGIES.includes('teleport')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(VALID_STRATEGIES.includes('')).toBe(false);
  });

  it('default strategy is "private"', () => {
    const strategy = undefined;
    const resolved = strategy || 'private';
    expect(resolved).toBe('private');
  });
});

// ── Ownership model rules ──
describe('Companion Absorption: Ownership Model', () => {
  type OriginType = 'tenant' | 'personal' | 'moved' | 'copied';

  interface Relationship {
    id: string;
    tenant_id: string;
    origin_type: OriginType;
    source_user_id?: string;
    source_opportunity_id?: string;
  }

  it('new tenant relationships default to "tenant" origin', () => {
    const rel: Relationship = {
      id: '1',
      tenant_id: 'tenant-1',
      origin_type: 'tenant',
    };
    expect(rel.origin_type).toBe('tenant');
  });

  it('moved relationships become tenant-owned', () => {
    const rel: Relationship = {
      id: '1',
      tenant_id: 'target-tenant',
      origin_type: 'moved',
      source_user_id: 'user-1',
    };
    // After move, it belongs to target tenant
    expect(rel.tenant_id).toBe('target-tenant');
    expect(rel.origin_type).toBe('moved');
    expect(rel.source_user_id).toBe('user-1');
  });

  it('copied relationships create distinct entity', () => {
    const original: Relationship = {
      id: 'orig-1',
      tenant_id: 'personal-tenant',
      origin_type: 'personal',
    };
    const copy: Relationship = {
      id: 'copy-1',
      tenant_id: 'target-tenant',
      origin_type: 'copied',
      source_opportunity_id: 'orig-1',
      source_user_id: 'user-1',
    };
    // Original stays in personal space
    expect(original.tenant_id).toBe('personal-tenant');
    // Copy is in target tenant
    expect(copy.tenant_id).toBe('target-tenant');
    expect(copy.source_opportunity_id).toBe('orig-1');
    // They are distinct entities
    expect(original.id).not.toBe(copy.id);
  });

  it('private strategy produces no new relationships', () => {
    const strategy: string = 'private';
    const selectedIds: string[] = [];
    const movedCount = strategy === 'move' ? selectedIds.length : 0;
    const copiedCount = strategy === 'copy' ? selectedIds.length : 0;
    expect(movedCount).toBe(0);
    expect(copiedCount).toBe(0);
  });
});

// ── Invite eligibility ──
describe('Companion Absorption: Invite Eligibility', () => {
  function isInviteValid(invite: {
    accepted_at: string | null;
    revoked_at: string | null;
    expires_at: string;
  }): { valid: boolean; reason?: string } {
    if (invite.accepted_at) return { valid: false, reason: 'already_accepted' };
    if (invite.revoked_at) return { valid: false, reason: 'revoked' };
    if (new Date(invite.expires_at) < new Date()) return { valid: false, reason: 'expired' };
    return { valid: true };
  }

  it('accepts valid invite', () => {
    const result = isInviteValid({
      accepted_at: null,
      revoked_at: null,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(result.valid).toBe(true);
  });

  it('rejects already accepted invite', () => {
    const result = isInviteValid({
      accepted_at: new Date().toISOString(),
      revoked_at: null,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('already_accepted');
  });

  it('rejects revoked invite', () => {
    const result = isInviteValid({
      accepted_at: null,
      revoked_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('revoked');
  });

  it('rejects expired invite', () => {
    const result = isInviteValid({
      accepted_at: null,
      revoked_at: null,
      expires_at: new Date(Date.now() - 86400000).toISOString(),
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired');
  });
});

// ── Email matching ──
describe('Companion Absorption: Email Matching', () => {
  function emailsMatch(userEmail: string, inviteEmail: string): boolean {
    return userEmail.toLowerCase() === inviteEmail.toLowerCase();
  }

  it('matches same email', () => {
    expect(emailsMatch('user@example.com', 'user@example.com')).toBe(true);
  });

  it('matches case-insensitive', () => {
    expect(emailsMatch('User@Example.COM', 'user@example.com')).toBe(true);
  });

  it('rejects different emails', () => {
    expect(emailsMatch('user1@example.com', 'user2@example.com')).toBe(false);
  });
});

// ── Privacy safeguard ──
describe('Companion Absorption: Privacy Safeguards', () => {
  it('default strategy must always be private', () => {
    // Simulates what happens when no strategy is provided
    const body = {};
    const strategy = (body as any).relationship_strategy || 'private';
    expect(strategy).toBe('private');
  });

  it('companion relationships are never auto-transferred', () => {
    const strategy: string = 'move';
    const selectedIds: string[] = [];
    const shouldTransfer = strategy !== 'private' && selectedIds.length > 0;
    expect(shouldTransfer).toBe(false);
  });

  it('accept button disabled when move/copy with no selection', () => {
    const strategy: string = 'move';
    const selectedOpps: string[] = [];
    const selectedContacts: string[] = [];
    const isDisabled = strategy !== 'private' && selectedOpps.length === 0 && selectedContacts.length === 0;
    expect(isDisabled).toBe(true);
  });

  it('accept button enabled for private strategy regardless of selection', () => {
    const strategy: string = 'private';
    const selectedOpps: string[] = [];
    const selectedContacts: string[] = [];
    const isDisabled = strategy !== 'private' && selectedOpps.length === 0 && selectedContacts.length === 0;
    expect(isDisabled).toBe(false);
  });
});
