import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const handleI18n = createIntlMiddleware(routing);

/**
 * Transforme la redirection de langue en 308 (permanent).
 *
 * next-intl répond 307 « temporaire ». Or l'ajout du préfixe `/fr` est
 * définitif : les anciennes URL (`/equipes`) ne reviendront pas. Un 308 dit à
 * Google de transférer le référencement acquis vers la nouvelle adresse au lieu
 * de garder l'ancienne indexée. Le 308 préserve aussi la méthode HTTP.
 */
export function permanent(response: Response): Response {
  if (response.status !== 307 || !response.headers.get("location")) return response;
  // On recopie les en-têtes tels quels : `location` bien sûr, mais aussi les
  // `set-cookie` posés par next-intl (mémorisation de la langue choisie).
  return new NextResponse(null, { status: 308, headers: response.headers });
}

/**
 * Deux responsabilités à enchaîner sur la même requête :
 *
 *  1. **next-intl** décide de la langue et réécrit `/en/x` vers le segment
 *     `[locale]`. Il passe en premier : s'il redirige, la requête s'arrête là.
 *  2. **Supabase** rafraîchit la session et repose ses cookies.
 *
 * L'ordre inverse perdrait la réécriture de langue. On reporte donc les cookies
 * de session sur la réponse d'i18n plutôt que de n'en garder qu'une des deux.
 */
export async function proxy(request: NextRequest) {
  const intlResponse = handleI18n(request);

  // Redirection décidée par i18n (ex. `/equipes` → `/fr/equipes`).
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    return permanent(intlResponse);
  }

  const sessionResponse = await updateSession(request);
  for (const cookie of sessionResponse.cookies.getAll()) {
    intlResponse.cookies.set(cookie);
  }

  return intlResponse;
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques et les routes techniques.
    // `api` et `auth` sont exclus : ce sont des route handlers, ils n'ont pas
    // de langue — et `/auth/callback` doit rester à cette URL exacte, c'est
    // celle déclarée dans les Redirect URLs de Supabase.
    "/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest|txt|xml)$).*)",
  ],
};
