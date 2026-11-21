import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// The Worker (src/index.ts) keeps serving /login, /auth and /api; Vite builds the page into its assets.
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  resolve: { alias: { "@": path.resolve(__dirname, "app") } },
  server: { port: 8787 }, // matches the local Google redirect URI
});
