import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable sourcemaps for Amplify builds
    rollupOptions: {
      output: {
        manualChunks: undefined, // Simplify chunking for cloud builds
      },
    },
  },
})
