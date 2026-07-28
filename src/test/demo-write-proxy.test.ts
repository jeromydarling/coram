/**
 * demoWriteProxy unit tests.
 *
 * WHAT: Tests that the Supabase client proxy intercepts writes and passes reads.
 * WHERE: src/lib/demoWriteProxy.ts
 * WHY: The proxy is the single critical gate preventing demo writes — it MUST work.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock supabase (hoisted to avoid factory ref issues) ──
const mockSelect = vi.hoisted(() => vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: '1' }, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  }),
}));

const mockInsert = vi.hoisted(() => vi.fn().mockReturnValue({
  select: vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'new' }, error: null }),
  }),
}));

const mockUpdate = vi.hoisted(() => vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

const mockDelete = vi.hoisted(() => vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

const mockInvoke = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { ok: true }, error: null }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    })),
    functions: {
      invoke: mockInvoke,
    },
  },
}));
import { supabase } from '@/integrations/supabase/client';
import {
  activateDemoProxy,
  deactivateDemoProxy,
  isDemoProxyActive,
} from '@/lib/demoWriteProxy';

describe('demoWriteProxy', () => {
  afterEach(() => {
    deactivateDemoProxy();
  });

  it('starts inactive', () => {
    expect(isDemoProxyActive()).toBe(false);
  });

  it('activates and deactivates cleanly', () => {
    activateDemoProxy();
    expect(isDemoProxyActive()).toBe(true);

    deactivateDemoProxy();
    expect(isDemoProxyActive()).toBe(false);
  });

  it('double-activate is safe', () => {
    activateDemoProxy();
    activateDemoProxy();
    expect(isDemoProxyActive()).toBe(true);
    deactivateDemoProxy();
    expect(isDemoProxyActive()).toBe(false);
  });

  describe('when active', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      activateDemoProxy();
    });

    it('intercepts .insert() and returns fake success with demo id', async () => {
      const builder = (supabase as any).from('contacts');
      const result = await builder.insert({ name: 'Test' }).select().single();

      // Proxy returns a fake row with a generated id (BT-003 fix)
      expect(result.error).toBeNull();
      expect(result.data).toBeTruthy();
      expect(result.data.id).toMatch(/^demo-/);
      // The real mockInsert should NOT have been called
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('intercepts .update() and returns fake success', async () => {
      const builder = (supabase as any).from('contacts');
      const result = await builder.update({ name: 'Test' }).eq('id', '1');

      expect(result.error).toBeNull();
      expect(result.data).toBeTruthy();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('intercepts .delete() and returns fake success', async () => {
      const builder = (supabase as any).from('contacts');
      const result = await builder.delete().eq('id', '1');

      expect(result).toEqual(
        expect.objectContaining({ data: null, error: null }),
      );
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('passes .select() through to real client', () => {
      const builder = (supabase as any).from('contacts');
      builder.select('*');
      expect(mockSelect).toHaveBeenCalledWith('*');
    });

    it('intercepts functions.invoke for non-safe functions', async () => {
      const result = await (supabase as any).functions.invoke('opportunity-auto-enrich', {
        body: { opportunity_id: '1' },
      });

      expect(result.data.demo).toBe(true);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('allows safe edge functions through', async () => {
      await (supabase as any).functions.invoke('demo-gate-submit', {
        body: { name: 'Test' },
      });

      expect(mockInvoke).toHaveBeenCalledWith('demo-gate-submit', {
        body: { name: 'Test' },
      });
    });

    it('allows check-subscription through', async () => {
      await (supabase as any).functions.invoke('check-subscription');
      expect(mockInvoke).toHaveBeenCalledWith('check-subscription', undefined);
    });
  });

  describe('when inactive (deactivated)', () => {
    it('passes all operations through normally', async () => {
      // Activate then deactivate
      activateDemoProxy();
      deactivateDemoProxy();

      vi.clearAllMocks();

      const builder = (supabase as any).from('contacts');
      builder.insert({ name: 'Test' });
      expect(mockInsert).toHaveBeenCalled();

      await (supabase as any).functions.invoke('opportunity-auto-enrich', {});
      expect(mockInvoke).toHaveBeenCalled();
    });
  });
});
