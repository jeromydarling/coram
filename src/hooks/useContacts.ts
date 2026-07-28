/**
 * Compat shim — contact (people) hooks now live in `src/data/people/`.
 *
 * Existing callers keep importing from `@/hooks/useContacts`. New code
 * should import from `@/data/people` directly.
 */
export {
  useContacts,
  useContact,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
} from '@/data/people';
export type {
  ContactRow,
  CreateContactInput,
  UpdateContactInput,
} from '@/data/people';
