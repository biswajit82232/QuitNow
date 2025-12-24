import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    hmr: {
      // Suppress WebSocket connection errors
      overlay: false,
    },
    // Disable HMR to avoid WebSocket errors completely
    // Uncomment the line below if you want to disable HMR entirely
    // hmr: false,
  },
  build: {
    // Optimize build output
    minify: 'esbuild',
    sourcemap: false,
  },
  // Suppress console errors from Vite client
  logLevel: 'warn',
});

