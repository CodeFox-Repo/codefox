import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      src: path.resolve(__dirname, './src'),
    },
  },
  esbuild: {
    target: 'esnext', // Allow top-level await
  },
  build: {
    target: 'esnext', // Ensure Vite compiles for a modern target
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined, // avoid sending code by chunk
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
    },
    allowedHosts: true,
  },
});
