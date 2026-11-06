import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// base "./" keeps every asset URL relative, so the export works at a domain root,
// an IPFS gateway subpath or an ENS name. /overlay/ is a real exported route.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        desk: resolve(import.meta.dirname, "index.html"),
        overlay: resolve(import.meta.dirname, "overlay/index.html"),
      },
    },
  },
});
