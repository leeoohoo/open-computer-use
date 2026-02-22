import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import { config } from 'dotenv'

// Load .env at build time so we can inject values into the bundle
config({ path: resolve(__dirname, '.env') })

export default defineConfig({
  main: {
    define: {
      'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL || ''),
      'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''),
      'process.env.COASTY_BACKEND_URL': JSON.stringify(process.env.COASTY_BACKEND_URL || ''),
    },
    build: {
      rollupOptions: {
        external: ['screenshot-desktop', 'puppeteer-core']
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    plugins: [react()],
    css: {
      postcss: {
        plugins: [tailwindcss, autoprefixer]
      }
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8001',
          changeOrigin: true,
        }
      }
    }
  }
})
