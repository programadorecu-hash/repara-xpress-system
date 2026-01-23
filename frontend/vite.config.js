import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // --- INICIO DEL TATUAJE ---
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('/api')
  },
  // --- FIN DEL TATUAJE ---
  
  // --- CONFIGURACIÓN PARA DOCKER ---
  server: {
    host: true,        // Escuchar en todas las IPs (0.0.0.0)
    strictPort: true,  // Si el puerto 5173 está ocupado, fallar en vez de cambiarlo (para que Nginx no se pierda)
    port: 5173,        // Puerto fijo
    allowedHosts: true, // <--- ESTA ES LA LLAVE MAESTRA PARA CLOUDFLARE
    watch: {
      usePolling: true // <--- ¡LA CLAVE! Obliga a vigilar cambios activamente (vital para Windows/Docker)
    }
  }
})