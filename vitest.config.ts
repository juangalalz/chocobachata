import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" rompe fuera de Next; en las pruebas no hace falta.
      "server-only": fileURLToPath(new URL("./tests/helpers/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
    unstubGlobals: true,
    // Las pruebas simulan fallos a propósito; sus logs de error solo ensucian la salida.
    onConsoleLog: () => false,
  },
});
