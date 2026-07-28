/**
 * Compat shim — event hooks now live in `src/data/events/`.
 * Existing callers keep importing from `@/hooks/useEvents`.
 */
export {
  useEvents,
  useCreateEvent,
  useUpdateEvent,
  useDuplicateEvent,
} from '@/data/events';
export type {
  EventRow,
  UseEventsOptions,
  CreateEventInput,
  UpdateEventInput,
  DuplicateEventInput,
} from '@/data/events';
