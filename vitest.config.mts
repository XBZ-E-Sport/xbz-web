import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Tests unitaires (logique pure) + composants client synchrones.
// Les Server Components `async` ne sont pas supportés par Vitest → à couvrir
// en E2E si besoin (cf. node_modules/next/dist/docs/.../testing/vitest.md).
// Les alias `@/*` (tsconfig) sont résolus nativement par Vite (resolve.tsconfigPaths).
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
