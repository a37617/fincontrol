import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001'
    },
    watch: {
      usePolling: true,
      interval: 1000,
      ignored: ['**/.849C9593-*', '**/~*', '**/*.tmp']
    }
  }
});
