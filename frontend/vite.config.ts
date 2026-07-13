import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// BASE_PATH permite servir bajo una subruta (p. ej. GitHub Pages de proyecto:
// "/radar/"). Por defecto "/" (Cloudflare Pages, dominio propio, user-site).
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react()],
});
