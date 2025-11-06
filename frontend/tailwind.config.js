/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // --- PALETA ELEGANTE (2025) ---
      colors: {
        // Superficies y texto
        surface: "#F2F2F2", // Fondo claro principal
        onSurface: "#00010D", // Texto sobre fondo claro (profundo)

        // Marca (oscura)
        brand: "#283540", // Principal (headers/botones)
        "brand-deep": "#00010D", // Hover/activo muy oscuro
        "brand-soft": "#636B73", // Muted (secundario/bordes activos)
        "brand-mist": "#9FA3A6", // Muy suave (dividers/hover claro)

        // Alias para compatibilidad con tu código actual:
        primary: "#F2F2F2", // = surface (mantiene text/bg-primary existentes)
        secondary: "#00010D", // = onSurface (mantiene text-secondary existentes)

        // Acentos existentes (no tocamos para no romper otras pantallas)
        accent: "#63A1F2", // Azul para botones de "Orden"
        highlight: "#F2B33D", // Amarillo para "Gasto"
        detail: "#5550F2", // Púrpura para "Balance"
        'action-green': '#14B8A6', // El nuevo verde/turquesa para "Vender" y "Bodega"
      },
    },
  },

  plugins: [],
};
