/**
 * notificationBundler — Human-language event bundling for operator digests.
 *
 * WHAT: Converts raw event counts into warm, narrative summaries.
 * WHERE: Used by digest email builder and notification display.
 * WHY: "5 registrations" becomes "Five new people joined a tenant's event this morning."
 */

// ─── Number → Words (small numbers) ────────────────

const WORD_MAP: Record<number, string> = {
  1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five',
  6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten',
  11: 'Eleven', 12: 'Twelve',
};

function numberToWords(n: number): string {
  if (n <= 0) return 'No';
  return WORD_MAP[n] ?? String(n);
}

// ─── Event Templates ────────────────────────────────

interface BundleTemplate {
  singular: string;
  plural: (count: string) => string;
}

const TEMPLATES: Record<string, BundleTemplate> = {
  registration: {
    singular: 'A new person joined an event.',
    plural: (n) => `${n} new people joined events across tenants.`,
  },
  essay_ready: {
    singular: 'An essay draft is ready for your review.',
    plural: (n) => `${n} essay drafts are waiting for your thoughtful review.`,
  },
  connector_warning: {
    singular: 'A connector may need a gentle look.',
    plural: (n) => `${n} connectors may need attention.`,
  },
  activation_movement: {
    singular: 'A tenant took a meaningful step forward.',
    plural: (n) => `${n} tenants showed new movement in their activation journey.`,
  },
  migration_complete: {
    singular: 'A data migration completed successfully.',
    plural: (n) => `${n} migrations completed this period.`,
  },
  system_health: {
    singular: 'A system check completed.',
    plural: (n) => `${n} system checks ran — all looking well.`,
  },
  new_tenant: {
    singular: 'A new community joined the platform.',
    plural: (n) => `${n} new communities joined the platform.`,
  },
  volunteer_signup: {
    singular: 'A new volunteer signed up.',
    plural: (n) => `${n} new volunteers signed up to serve.`,
  },
  life_event_created: {
    singular: "A life moment was recorded. If you'd like, you can add a reflection.",
    plural: (n) => `${n} life moments were recorded across people you care for.`,
  },
  life_event_reminder_due: {
    singular: 'A gentle reminder: a meaningful date is coming up this week.',
    plural: (n) => `${n} meaningful dates are approaching. You may want to reach out.`,
  },
};

// ─── Core Bundler ───────────────────────────────────

export interface BundleInput {
  eventType: string;
  count: number;
}

export interface BundledMessage {
  eventType: string;
  message: string;
  count: number;
}

/**
 * Bundle raw event counts into human-readable narrative summaries.
 */
export function bundleNotifications(events: BundleInput[]): BundledMessage[] {
  return events
    .filter(e => e.count > 0)
    .map(e => {
      const template = TEMPLATES[e.eventType];
      if (!template) {
        return {
          eventType: e.eventType,
          message: e.count === 1
            ? `Something happened in ${e.eventType.replace(/_/g, ' ')}.`
            : `${numberToWords(e.count)} things happened in ${e.eventType.replace(/_/g, ' ')}.`,
          count: e.count,
        };
      }

      return {
        eventType: e.eventType,
        message: e.count === 1 ? template.singular : template.plural(numberToWords(e.count)),
        count: e.count,
      };
    });
}

/**
 * Build a complete daily digest summary from bundled messages.
 */
export function buildDigestSummary(bundles: BundledMessage[]): string {
  if (bundles.length === 0) {
    return 'A quiet day — nothing needing your attention. Rest well.';
  }

  const lines = bundles.map(b => `• ${b.message}`);
  return lines.join('\n');
}
