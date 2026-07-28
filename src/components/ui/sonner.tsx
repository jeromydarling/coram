import { useTheme } from "next-themes";
import { Toaster as Sonner, toast as rawToast, ExternalToast } from "sonner";
import { crosText, FRICTION_COPY } from '@/lib/toneCharter';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

/**
 * Charter-compliant toast wrapper.
 *
 * WHAT: Wraps sonner's toast with CROS vocabulary mapping.
 * WHERE: Import { toast } from '@/components/ui/sonner' everywhere.
 * WHY: Automatically translates SaaS-tone messages to charter language.
 *
 * - toast.success(msg) → maps common SaaS phrases to charter vocabulary
 * - toast.error(msg) → softens to gentle, non-alarming language
 * - All other methods pass through unchanged.
 */
const toast = Object.assign(
  (message: string | React.ReactNode, data?: ExternalToast) => {
    const mapped = typeof message === 'string' ? crosText(message) : message;
    return rawToast(mapped, { duration: 2000, ...data });
  },
  {
    success: (message: string | React.ReactNode, data?: ExternalToast) => {
      if (typeof message !== 'string') return rawToast.success(message, data);
      // Charter vocabulary: map common success messages
      const mapped = mapSuccess(message);
      return rawToast(mapped, { duration: 2000, ...data });
    },
    error: (message: string | React.ReactNode, data?: ExternalToast) => {
      if (typeof message !== 'string') return rawToast.error(message, data);
      // Soften error messages
      const softened = softenError(message);
      return rawToast(softened, { duration: 4000, ...data });
    },
    warning: (message: string | React.ReactNode, data?: ExternalToast) => {
      if (typeof message !== 'string') return rawToast.warning(message, data);
      return rawToast(crosText(message), { duration: 3000, ...data });
    },
    info: rawToast.info,
    loading: (message: string | React.ReactNode, data?: ExternalToast) => {
      if (typeof message !== 'string') return rawToast.loading(message, data);
      return rawToast.loading(crosText(message) || FRICTION_COPY.loading, data);
    },
    promise: rawToast.promise,
    dismiss: rawToast.dismiss,
    message: rawToast.message,
    custom: rawToast.custom,
  }
);

/** Map common success messages to charter vocabulary */
function mapSuccess(msg: string): string {
  const lower = msg.toLowerCase().trim();

  // Direct vocabulary hit
  const direct = crosText(msg);
  if (direct !== msg) return direct;

  // Pattern matching for common CRUD messages
  if (/created|added/i.test(lower)) return 'Noted.';
  if (/updated|changed|modified|saved|stage updated/i.test(lower)) return 'Updated.';
  if (/deleted|removed|archived/i.test(lower)) return 'Removed.';
  if (/logged|recorded|submitted|sent/i.test(lower)) return 'Recorded.';
  if (/approved/i.test(lower)) return 'Noted.';
  if (/dismissed|skipped/i.test(lower)) return 'Noted.';
  if (/copied|cloned|duplicated/i.test(lower)) return 'Noted.';
  if (/enabled|activated|connected/i.test(lower)) return 'Noted.';
  if (/disabled|deactivated|disconnected/i.test(lower)) return 'Noted.';
  if (/imported|synced|migrated/i.test(lower)) return 'Noted.';
  if (/exported|downloaded/i.test(lower)) return 'Noted.';

  // Fallback: strip "successfully" and apply crosText
  const cleaned = msg.replace(/\s*successfully\s*/gi, ' ').trim();
  return crosText(cleaned);
}

/** Soften error messages to charter-compliant gentle language */
function softenError(msg: string): string {
  // Remove "Failed to" prefix pattern
  const softened = msg
    .replace(/^Failed to /i, "Didn't complete: ")
    .replace(/^Error: /i, '')
    .replace(/^Failed: /i, "Didn't complete: ");

  return softened || FRICTION_COPY.systemError;
}

export { Toaster, toast };
