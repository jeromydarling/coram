/**
 * Compat shim — activity hooks now live in `src/data/activities/`.
 * Existing callers keep importing from `@/hooks/useActivities`.
 */
export {
  useActivities,
  useActivitiesForCalendar,
  useCreateActivity,
  useUpdateActivity,
  useDeleteActivity,
} from '@/data/activities';
export type {
  Activity,
  CreateActivityInput,
  UpdateActivityInput,
} from '@/data/activities';
