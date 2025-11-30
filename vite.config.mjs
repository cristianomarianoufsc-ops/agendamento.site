// vite.config.js (CORRIGIDO )
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Removido o proxy para produção no Render. O frontend deve usar a URL absoluta.
});
