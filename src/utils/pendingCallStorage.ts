/**
 * Persists a pending call target in sessionStorage so the Call Modal
 * survives mobile browser page reloads that happen when the user
 * returns from the OS phone dialer.
 */

const STORAGE_KEY = 'profunda_pending_call';

export interface PendingCall {
  contactId: string;
  contactName: string;
  opportunityId?: string | null;
  metroId?: string | null;
  /** ISO timestamp – used to expire stale entries */
  createdAt: string;
}

/** Save before triggering tel: link */
export function savePendingCall(call: Omit<PendingCall, 'createdAt'>) {
  const entry: PendingCall = { ...call, createdAt: new Date().toISOString() };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
}

/** Read and clear. Returns null if nothing stored or if older than 5 minutes. */
export function consumePendingCall(): PendingCall | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(STORAGE_KEY);
  try {
    const entry: PendingCall = JSON.parse(raw);
    const age = Date.now() - new Date(entry.createdAt).getTime();
    if (age > 5 * 60 * 1000) return null; // expired
    return entry;
  } catch {
    return null;
  }
}
