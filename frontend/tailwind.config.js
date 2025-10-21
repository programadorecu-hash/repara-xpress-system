/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // --- COLORES DE ESTA APP WEB (TENGO SUEÑO! :( ) ---
      colors: {
        'primary': '#F2F2F2',   // Fondo principal claro
        'secondary': '#027368', // Texto principal, oscuro y legible
        'accent': '#63A1F2',    // Botones y elementos activos
        'highlight': '#F2B33D', // Alertas o elementos a destacar
        'detail': '#5550F2',     // Detalles, bordes al enfocar, enlaces
      },
    },
  },
  plugins: [],
}