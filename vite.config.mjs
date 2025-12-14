// vite.config.js (CORRIGIDO )
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: ['*', '5173-ivf1yu365auxv44fz4sz9-c6a32266.manusvm.computer', '5174-ivf1yu365auxv44fz4sz9-c6a32266.manusvm.computer', '5175-ivf1yu365auxv44fz4sz9-c6a32266.manusvm.computer', '5176-ivf1yu365auxv44fz4sz9-c6a32266.manusvm.computer', '5173-iofqesva6kanz5eczuwht-534e7b2d.manus-asia.computer']
  },
  // Removido o proxy para produção no Render. O frontend deve usar a URL absoluta.
});
