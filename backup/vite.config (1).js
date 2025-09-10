import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,      // Porta fixa do frontend
    open: false,     // Desativado para o .bat controlar a abertura do navegador
  }
});
