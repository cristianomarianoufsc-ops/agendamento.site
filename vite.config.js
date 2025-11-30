// vite.config.js (CORRIGIDO )
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy para rotas do backend (server.js)
      // Esta regra parece específica para /ical, vamos corrigir o alvo dela também.
      "/api_ical": {
        target: "http://localhost:4000", // ✅ CORRIGIDO
        changeOrigin: true,
        rewrite: (path ) => path.replace(/^\/api_ical/, "/ical"),
      },
      // Esta é a regra principal para todas as outras chamadas /api
      "/api": {
        target: "http://localhost:4000", // ✅ CORRIGIDO
        changeOrigin: true,
      },

      // Proxy para consulta de CNPJ na API externa (esta regra está correta, não precisa mexer )
      "/api_cnpj": {
        target: "https://receitaws.com.br/v1",
        changeOrigin: true,
        rewrite: (path ) => path.replace(/^\/api_cnpj/, ""), 
      },
    },
  },
});
