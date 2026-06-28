import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Game loop runs on Canvas outside React (see SPEC.md "React / Canvas Boundary").
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:8013', // dev only — same-origin in production
    },
  },
  build: {
    outDir: 'dist',
  },
})
