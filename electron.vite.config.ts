import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@core': resolve('core')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@core': resolve('core')
      }
    },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react-router') ||
              id.includes('node_modules/react/')
            ) {
              return 'vendor-react'
            }
            if (id.includes('node_modules/xlsx')) {
              return 'vendor-xlsx'
            }
            if (id.includes('node_modules/recharts')) {
              return 'vendor-recharts'
            }
          }
        }
      }
    }
  }
})
// MAIN_VITE_* se carga desde .env / .env.production (electron-vite) y queda
// disponible en main como import.meta.env.MAIN_VITE_MEBSY_API_URL.
