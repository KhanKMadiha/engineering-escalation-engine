/**
 * Thin factory so repository wiring can construct SupabaseCaseRepository
 * without scattering Supabase client setup.
 */
export { createSupabaseCaseRepository } from "@/lib/supabase/supabase-case-repository";
