import { defineConfig } from "vite";
export default defineConfig({
  define: { global: "globalThis" },
  build: {
    lib: { entry: "src/public.ts", formats: ["es"], fileName: () => "crypto.js" },
    outDir: "../backend/core/static", emptyOutDir: false,
  },
});
