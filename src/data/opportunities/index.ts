/**
 * Opportunities data layer.
 *
 * Domain entry point: import from `@/data/opportunities` rather than
 * deep paths so we can refactor internals without changing callers.
 */
export { useOpportunities } from './useOpportunities';
export type { OpportunityRow } from './useOpportunities';
export { useOpportunity } from './useOpportunity';
export {
  useCreateOpportunity,
  useUpdateOpportunity,
} from './useOpportunityMutations';
export type {
  CreateOpportunityInput,
  UpdateOpportunityInput,
} from './useOpportunityMutations';
