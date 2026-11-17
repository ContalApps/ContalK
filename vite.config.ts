import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'path'
import { readFileSync } from 'node:fs'

export default defineConfig({
  base: './',
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(JSON.parse(readFileSync('package.json','utf8')).version) },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: { build: { emptyOutDir: true } },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('@xterm')) return 'vendor-xterm'
            if (id.includes('lucide-react')) return 'vendor-icons'
            if (id.includes('react') || id.includes('scheduler')) return 'vendor-react'
            if (id.includes('mediasoup-client')) return 'vendor-mediasoup'
          }
        },
      },
    },
  },
})
