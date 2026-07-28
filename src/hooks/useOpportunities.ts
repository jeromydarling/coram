/**
 * Compat shim — opportunity hooks now live in `src/data/opportunities/`.
 *
 * Existing callers (50+ files) keep importing from `@/hooks/useOpportunities`.
 * New code should import from `@/data/opportunities` directly.
 */
export {
  useOpportunities,
  useOpportunity,
  useCreateOpportunity,
  useUpdateOpportunity,
} from '@/data/opportunities';
export type {
  OpportunityRow,
  CreateOpportunityInput,
  UpdateOpportunityInput,
} from '@/data/opportunities';
