import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Cible d'alias : `server-only` / `client-only` throwent à l'import hors contexte
// RSC. On les neutralise en tests pour pouvoir importer des modules serveur
// (ex. lib/ratelimit → lib/supabase/admin) sans faire planter la suite.
const emptyModule = fileURLToPath(new URL("./test/emptymodule.ts", import.meta.url));

// `next` n'a pas de champ `exports` pour ses sous-chemins : sous le bundler de
// Next ça passe, mais la résolution ESM stricte de Vite refuse le spécificateur
// nu `next/navigation` qu'importe next-intl. On pointe le fichier réel.
// Ancré (`$`) pour ne pas capturer d'éventuels sous-chemins.
const nextNavigation = fileURLToPath(
  new URL("./node_modules/next/navigation.js", import.meta.url),
);

// Tests unitaires (logique pure) + composants client synchrones.
// Les Server Components `async` ne sont pas supportés par Vitest → à couvrir
// en E2E si besoin (cf. node_modules/next/dist/docs/.../testing/vitest.md).
// Les alias `@/*` (tsconfig) sont résolus nativement par Vite (resolve.tsconfigPaths).
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: [
      { find: "server-only", replacement: emptyModule },
      { find: "client-only", replacement: emptyModule },
      { find: /^next\/navigation$/, replacement: nextNavigation },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    server: {
      // Par défaut Vitest externalise node_modules : les fichiers de next-intl
      // sont alors résolus par Node, qui ignore `resolve.alias` — et l'import
      // `next/navigation` échoue. Les traiter en source applique l'alias.
      deps: { inline: ["next-intl"] },
    },
  },
});
