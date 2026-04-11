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
        id: '/app',
        start_url: '/app',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a0f1e',
        theme_color: '#1a2b42',
        categories: ['productivity', 'business', 'finance'],
        screenshots: [
          { src: '/screenshot-1.png', sizes: '1012x1516', type: 'image/png', form_factor: 'narrow', label: 'Invairo' },
          { src: '/screenshot-2.png', sizes: '1012x1516', type: 'image/png', form_factor: 'narrow', label: 'Invairo' },
          { src: '/screenshot-3.png', sizes: '1012x1516', type: 'image/png', form_factor: 'narrow', label: 'Invairo' },
          { src: '/screenshot-4.png', sizes: '1012x1516', type: 'image/png', form_factor: 'narrow', label: 'Invairo' },
          { src: '/screenshot-5.png', sizes: '1012x1516', type: 'image/png', form_factor: 'narrow', label: 'Invairo' },
        ],
        icons: [
          {
            src: '/invairo_logo_192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/invairo_logo_512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/invairo_logo_maskable_192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/invairo_logo_maskable_512x512.png',
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
