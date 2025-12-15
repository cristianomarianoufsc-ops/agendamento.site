// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      '5173-ixou6pmbgqsisi0sv7yv1-833201c2.manusvm.computer',
      '5174-ixou6pmbgqsisi0sv7yv1-833201c2.manusvm.computer',
      'localhost',
      '127.0.0.1',
      '0.0.0.0'
    ]
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
