// frontend/src/components/AppLayout.jsx
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header.jsx'; 

function AppLayout() {
  
  // --- INICIO DE NUESTRO CÓDIGO (¡CORREGIDO!) ---

  // 1. Arreglo #1: El "interruptor" ahora empieza en 'false' (contraído).
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };
  // --- FIN DE NUESTRO CÓDIGO ---

  return (
    <div className="flex h-screen text-secondary">
      
      {/* El Header (menú) sigue recibiendo el interruptor */}
      <Header isMenuOpen={isMenuOpen} onToggle={toggleMenu} /> 

      {/* 2. Arreglo #2: El "plano" del contenido principal.
           - 'flex-1': Ocupa todo el espacio.
           - 'overflow-y-auto': Permite scroll solo en el contenido.
           - 'p-8': Padding general.
           - 'pl-20': ¡Esta es la clave! Le damos un padding izquierdo FIJO
             que coincide con el ancho del menú "contraído" (w-20).
           - Ya no hay lógica condicional (isMenuOpen ? ... : ...).
      */}
      {/* Arreglo:
        - 'p-8': Lo quitamos de aquí, porque 'pl-20' lo estaba sobreescribiendo.
        - 'pl-20': Lo mantenemos para dejar el espacio del menú contraído (5rem).
        - 'pr-8 pb-8 pt-8': Añadimos el padding para arriba, abajo y la derecha manualmente.
        - 'pl-28': (pl-20 + p-8 = 5rem + 2rem = 7rem) 
                   Ajustamos el padding izquierdo para que sea el espacio del menú (20) MÁS el padding normal (8).
      */}
      <main className={`flex-1 overflow-y-auto pr-8 pb-8 pt-8 pl-28 transition-all duration-300`}>
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;