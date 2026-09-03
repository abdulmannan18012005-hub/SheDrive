import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  appType: 'spa',
  base: '/',
  plugins: [react()],
  esbuild: {
    tsconfigRaw: '{}',
  },
  server: {
    port: 3001,
    host: true,
  },
});
