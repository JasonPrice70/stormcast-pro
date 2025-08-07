import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Simplified Vite config for Amplify builds
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})
