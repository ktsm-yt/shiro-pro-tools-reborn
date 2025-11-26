/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
  },
  server: {
    proxy: {
      // Wiki取得用プロキシ（CORS回避）
      '/api/wiki': {
        target: 'https://scre.swiki.jp',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/wiki/, ''),
      },
    },
  },
})
