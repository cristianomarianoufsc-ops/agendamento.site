// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy para rotas do backend (server.js)
      "/api_ical": {
        target: "http://localhost:3000", // Backend Node/Express
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api_ical/, "/ical"),
      },
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },

      // Proxy para consulta de CNPJ na API externa
      "/api_cnpj": {
        target: "https://receitaws.com.br/v1",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api_cnpj/, ""), 
      },
    },
  },
});
