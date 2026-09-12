import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/supabase/env";

export {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/supabase/env";

/**
 * Privileged server-side Supabase client (service role).
 * Must never be imported from Client Components.
 */
export function createSupabaseServerClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (!cachedClient) {
    cachedClient = createSupabaseServerClient();
  }
  return cachedClient;
}

/** Test helper — clears the cached client. */
export function resetSupabaseServerClient(): void {
  cachedClient = null;
}
