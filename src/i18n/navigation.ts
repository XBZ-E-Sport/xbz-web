import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Remplaçants de `next/link` et `useRouter` conscients de la langue : un
 * `<Link href="/equipes">` mène à `/equipes` en français et `/en/equipes` en
 * anglais, sans que l'appelant ait à s'en soucier.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
