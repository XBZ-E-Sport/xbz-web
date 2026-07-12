import { createClient } from "@supabase/supabase-js";

// ⚠️ SERVEUR UNIQUEMENT. Ne jamais importer dans un composant client.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}