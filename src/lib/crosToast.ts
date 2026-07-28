/**
 * CROS Toast — Charter-compliant notification system.
 *
 * WHAT: Wraps sonner toast with CROS vocabulary enforcement.
 * WHERE: Import this instead of raw `toast` from sonner in all components.
 * WHY: Prevents SaaS-tone drift in confirmation and error messages.
 */
import { toast as sonnerToast, ExternalToast } from 'sonner';
import { crosText, FRICTION_COPY } from '@/lib/toneCharter';

type ToastData = ExternalToast;

/**
 * CROS-compliant toast functions.
 *
 * Usage:
 *   import { crosToast } from '@/lib/crosToast';
 *   crosToast.held();              // silent "Held." confirmation
 *   crosToast.noted();             // "Noted."
 *   crosToast.updated();           // "Updated."
 *   crosToast.recorded();          // "Recorded."
 *   crosToast.removed();           // "Removed."
 *   crosToast.gentle(message);     // gentle system message (errors)
 *   crosToast.info(message);       // neutral informational
 */
export const crosToast = {
  /** Autosave / save confirmation */
  held: (opts?: ToastData) =>
    sonnerToast('Held.', { duration: 1500, ...opts }),

  /** Generic acknowledgment */
  noted: (description?: string, opts?: ToastData) =>
    sonnerToast('Noted.', { description, duration: 2000, ...opts }),

  /** Update confirmation */
  updated: (description?: string, opts?: ToastData) =>
    sonnerToast('Updated.', { description, duration: 2000, ...opts }),

  /** Action recorded */
  recorded: (description?: string, opts?: ToastData) =>
    sonnerToast('Recorded.', { description, duration: 2000, ...opts }),

  /** Deletion / removal */
  removed: (description?: string, opts?: ToastData) =>
    sonnerToast('Removed.', { description, duration: 2000, ...opts }),

  /** Gentle error — replaces toast.error */
  gentle: (message?: string, opts?: ToastData) =>
    sonnerToast(message || FRICTION_COPY.systemError, {
      duration: 4000,
      ...opts,
    }),

  /** Neutral info */
  info: (message: string, opts?: ToastData) =>
    sonnerToast(crosText(message), { duration: 2500, ...opts }),

  /** Fallback: raw toast with vocabulary filter */
  raw: (message: string, opts?: ToastData) =>
    sonnerToast(crosText(message), opts),
};
