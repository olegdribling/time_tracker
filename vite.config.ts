import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['invairo_logo_180x180.png'],
      manifest: {
        name: 'Invairo',
        short_name: 'Invairo',
        description: 'Track shifts, calculate pay, send invoices.',
        start_url: '/app',
        display: 'standalone',
        background_color: '#0a0f1e',
        theme_color: '#1a2b42',
        icons: [
          {
            src: '/invairo_logo_192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/invairo_logo_512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/invairo_logo_512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: null,
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
