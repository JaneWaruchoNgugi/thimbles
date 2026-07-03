import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // split the heavy, rarely-changing libraries into their own long-lived cache
    // chunks so app updates don't force users to re-download three.js / react.
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
})
