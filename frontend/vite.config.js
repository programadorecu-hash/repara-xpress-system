import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // --- INICIO DEL TATUAJE ---
  // Esto obliga a Vite a reemplazar "import.meta.env.VITE_API_URL"
  // por el texto "/api" en todo tu código, ignorando todo lo demás.
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('/api')
  },
  // --- FIN DEL TATUAJE ---
  server: {
    allowedHosts: true, 
    host: true 
  }
})