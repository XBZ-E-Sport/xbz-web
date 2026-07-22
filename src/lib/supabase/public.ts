import "server-only";

import { createClient } from "@supabase/supabase-js";

// Client de LECTURE PUBLIQUE, SANS cookies (contrairement à lib/supabase/server,
// qui lit la session via `cookies()` et rend donc le rendu dynamique).
//
// Les données publiques du site sont lisibles via RLS (`active`/`published` =
// true) : aucune session n'est nécessaire pour les lire. Ce client est
// INDISPENSABLE pour `unstable_cache` — la doc interdit tout accès à
// `cookies()` / `headers()` dans une fonction cachée.
//
// Utilise la clé « publishable » (publique, exposée côté client) — JAMAIS la clé
// service_role (celle-ci reste dans lib/supabase/admin, protégée par server-only).
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
