import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Cible d'alias : `server-only` / `client-only` throwent à l'import hors contexte
// RSC. On les neutralise en tests pour pouvoir importer des modules serveur
// (ex. lib/ratelimit → lib/supabase/admin) sans faire planter la suite.
const emptyModule = fileURLToPath(new URL("./test/emptymodule.ts", import.meta.url));

// Tests unitaires (logique pure) + composants client synchrones.
// Les Server Components `async` ne sont pas supportés par Vitest → à couvrir
// en E2E si besoin (cf. node_modules/next/dist/docs/.../testing/vitest.md).
// Les alias `@/*` (tsconfig) sont résolus nativement par Vite (resolve.tsconfigPaths).
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": emptyModule,
      "client-only": emptyModule,
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
