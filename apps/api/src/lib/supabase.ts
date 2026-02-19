import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

export function getSupabaseClient() {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    return null;
  }

  return createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });
}
