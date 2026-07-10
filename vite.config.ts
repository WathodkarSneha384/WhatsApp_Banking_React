import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/dmCmsService': {
        target: 'http://10.2.0.121:8182',
        changeOrigin: true,
        secure: false,
      },
      '/whatsapp': {
        target: 'http://10.2.0.121:8182',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});