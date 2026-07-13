import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = 'http://demo.datavsn.com';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/dmCmsService': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
      '/whatsapp': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});