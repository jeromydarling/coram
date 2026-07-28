/**
 * Convocare payload schemas (§5.3), shared by the SPA and the Worker.
 */

import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? undefined : v))
    .optional();

/**
 * §5.3 puts accessibility on every event. These are `.optional()` rather than
 * defaulted to false on purpose — three states, not two. "Nobody has said
 * whether there is step-free access" and "there is no step-free access" are
 * different answers, and collapsing them tells someone deciding whether they
 * can physically attend something we do not actually know.
 */
export const accessibilitySchema = z.object({
  accessTransit: z.boolean().optional(),
  accessStepFree: z.boolean().optional(),
  accessAsl: z.boolean().optional(),
  accessQuietSpace: z.boolean().optional(),
  accessNotes: optionalText(1000),
});

export const createEventSchema = accessibilitySchema.extend({
  title: z.string().trim().min(1, 'Give the event a name.').max(200),
  description: optionalText(10_000),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).optional(),
  locationName: optionalText(200),
  locationAddress: optionalText(500),
  capacity: z.number().int().positive().optional(),
  isPublic: z.boolean().default(false),
  /** RFC 5545 RRULE. Validated for shape only; expansion happens server-side. */
  recurrenceRule: optionalText(500),
});

export const updateEventSchema = createEventSchema.partial();

export const createShiftSchema = z
  .object({
    name: z.string().trim().min(1, 'Name the shift.').max(200),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    slots: z.number().int().positive().max(500).default(1),
    requiredSkills: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  })
  .refine((v) => v.endsAt >= v.startsAt, {
    message: 'A shift cannot end before it starts.',
    path: ['endsAt'],
  });

export const rsvpStatus = z.enum(['going', 'waitlist', 'declined', 'cancelled']);

/** An organizer recording an RSVP on someone's behalf — at a door, on a call. */
export const adminRsvpSchema = z.object({
  contactId: z.string().uuid(),
  status: rsvpStatus.default('going'),
  guestCount: z.number().int().min(0).max(50).default(0),
  needsRide: z.boolean().default(false),
  canOfferRide: z.boolean().default(false),
  rideSeats: z.number().int().min(0).max(12).default(0),
  childcareChildren: z.number().int().min(0).max(20).default(0),
  accessNeeds: optionalText(1000),
});

/**
 * The public form. Deliberately shorter than the admin one: a stranger signing
 * up gives us what is needed to hold a place and let them know if things
 * change, and nothing more.
 */
export const publicRsvpSchema = z
  .object({
    displayName: z.string().trim().max(200).optional(),
    email: z.string().trim().toLowerCase().email('Check that email address.').optional(),
    phone: z.string().trim().min(4).max(32).optional(),
    postalCode: z.string().trim().max(12).optional(),
    guestCount: z.number().int().min(0).max(20).default(0),
    needsRide: z.boolean().default(false),
    childcareChildren: z.number().int().min(0).max(20).default(0),
    accessNeeds: optionalText(1000),
  })
  .refine((v) => Boolean(v.email || v.phone), {
    message: 'An email or phone number, so we can tell you if anything changes.',
    path: ['email'],
  });

export const checkInSchema = z.object({
  /** The raw token from the QR code. The server stores only its hash. */
  token: z.string().min(10).max(200),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type AdminRsvpInput = z.infer<typeof adminRsvpSchema>;
export type PublicRsvpInput = z.infer<typeof publicRsvpSchema>;
