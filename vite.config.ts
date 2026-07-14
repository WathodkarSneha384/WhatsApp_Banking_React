import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://demo.datavsn.com';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/dmCmsService': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        '/whatsapp': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});