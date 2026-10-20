import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tests/integration.spec.ts"], testTimeout: 120000 }, resolve: { alias: { "@": new URL("./src", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1") } } });
