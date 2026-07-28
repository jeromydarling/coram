import { z } from 'zod';

// Common validation patterns
const phoneRegex = /^[\d\s\-\(\)\+\.]*$/;
const maxNotesLength = 2000;
const maxNameLength = 100;
const maxTitleLength = 100;
const maxOrganizationLength = 200;

// Contact validation schema
export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(maxNameLength, `Name must be less than ${maxNameLength} characters`),
  title: z
    .string()
    .trim()
    .max(maxTitleLength, `Title must be less than ${maxTitleLength} characters`)
    .optional()
    .or(z.literal('')),
  email: z
    .string()
    .trim()
    .email('Invalid email format')
    .max(255, 'Email must be less than 255 characters')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, 'Phone can only contain digits, spaces, dashes, parentheses, and +')
    .max(30, 'Phone must be less than 30 characters')
    .optional()
    .or(z.literal('')),
  opportunity_id: z.string().uuid().optional().nullable(),
  is_primary: z.boolean().default(false),
  notes: z
    .string()
    .trim()
    .max(maxNotesLength, `Notes must be less than ${maxNotesLength} characters`)
    .optional()
    .or(z.literal(''))
});

export type ContactFormData = z.infer<typeof contactSchema>;

// Event validation schema
// Note: event_type is now dynamic from database lookup table, so we use string validation instead of enum
export const eventSchema = z.object({
  event_name: z
    .string()
    .trim()
    .min(1, 'Event name is required')
    .max(200, 'Event name must be less than 200 characters'),
  event_date: z
    .string()
    .min(1, 'Event date is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  metro_id: z.string().uuid().optional().nullable(),
  event_type: z
    .string()
    .min(1, 'Event type is required')
    .max(100, 'Event type must be less than 100 characters'),
  staff_deployed: z
    .number()
    .int('Staff count must be a whole number')
    .min(0, 'Staff count cannot be negative')
    .max(10000, 'Staff count exceeds maximum')
    .optional()
    .nullable(),
  households_served: z
    .number()
    .int('Households count must be a whole number')
    .min(0, 'Households count cannot be negative')
    .max(100000, 'Households count exceeds maximum')
    .optional()
    .nullable(),
  devices_distributed: z
    .number()
    .int('Devices count must be a whole number')
    .min(0, 'Devices count cannot be negative')
    .max(100000, 'Devices count exceeds maximum')
    .optional()
    .nullable(),
  internet_signups: z
    .number()
    .int('Signups count must be a whole number')
    .min(0, 'Signups count cannot be negative')
    .max(100000, 'Signups count exceeds maximum')
    .optional()
    .nullable(),
  anchor_identified_yn: z.boolean().default(false),
  notes: z
    .string()
    .trim()
    .max(maxNotesLength, `Notes must be less than ${maxNotesLength} characters`)
    .optional()
    .or(z.literal(''))
});

export type EventFormData = z.infer<typeof eventSchema>;

// Opportunity validation schema
const opportunityStages = [
  // Canonical chapter labels (new)
  'Found', 'First Conversation', 'Discovery', 'Pricing Shared',
  'Account Setup', 'First Devices', 'Growing Together', 'Not the Right Time',
  // Legacy stage values (still valid in DB)
  'Target Identified', 'Contacted', 'Discovery Scheduled', 'Discovery Held',
  'Proposal Sent', 'Agreement Pending', 'Agreement Signed', 'First Volume',
  'Stable Producer', 'Closed - Not a Fit'
] as const;

export const opportunitySchema = z.object({
  organization: z
    .string()
    .trim()
    .min(1, 'Organization is required')
    .max(maxOrganizationLength, `Organization must be less than ${maxOrganizationLength} characters`),
  metro_id: z.string().uuid().optional().nullable(),
  stage: z.enum(opportunityStages, { errorMap: () => ({ message: 'Invalid stage' }) }),
  partner_tier: z
    .string()
    .min(1, 'Partner tier is required')
    .max(100, 'Partner tier must be less than 100 characters'),
  primary_contact_name: z
    .string()
    .trim()
    .max(maxNameLength, `Name must be less than ${maxNameLength} characters`)
    .optional()
    .or(z.literal('')),
  primary_contact_title: z
    .string()
    .trim()
    .max(maxTitleLength, `Title must be less than ${maxTitleLength} characters`)
    .optional()
    .or(z.literal('')),
  primary_contact_email: z
    .string()
    .trim()
    .email('Invalid email format')
    .max(255, 'Email must be less than 255 characters')
    .optional()
    .or(z.literal('')),
  primary_contact_phone: z
    .string()
    .trim()
    .regex(phoneRegex, 'Phone can only contain digits, spaces, dashes, parentheses, and +')
    .max(30, 'Phone must be less than 30 characters')
    .optional()
    .or(z.literal('')),
  next_step: z
    .string()
    .trim()
    .max(500, 'Next step must be less than 500 characters')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .trim()
    .max(maxNotesLength, `Notes must be less than ${maxNotesLength} characters`)
    .optional()
    .or(z.literal(''))
});

export type OpportunityFormData = z.infer<typeof opportunitySchema>;

// Helper function to parse numeric input
export function parseNumericInput(value: string): number | undefined {
  if (!value || value.trim() === '') return undefined;
  const num = parseInt(value, 10);
  return isNaN(num) ? undefined : num;
}

// Helper to format validation errors for display
export function formatValidationErrors(error: z.ZodError): string[] {
  return error.errors.map(err => err.message);
}
