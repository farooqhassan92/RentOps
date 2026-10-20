import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tests/domain.test.ts", "tests/pdf.test.ts", "tests/onboarding.test.ts"] }, resolve: { alias: { "@": new URL("./src", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1") } } });
