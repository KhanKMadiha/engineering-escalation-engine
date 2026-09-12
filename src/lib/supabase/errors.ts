/**
 * Re-exports persistence errors for Supabase mapping helpers.
 * Prefer importing from `@/lib/repositories/persistence-errors` in domain code.
 */
export {
  ConstraintViolationError,
  DuplicateDecisionError,
  ForeignKeyViolationError,
  PersistenceError,
  RecordNotFoundError,
  mapDatabaseError as mapSupabaseError,
} from "@/lib/repositories/persistence-errors";
