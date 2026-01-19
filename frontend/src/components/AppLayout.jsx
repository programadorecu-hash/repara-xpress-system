// frontend/src/components/AppLayout.jsx
import React, { useState, useEffect, useContext } from 'react';
import { Outlet, Link } from 'react-router-dom';
import Header from './Header.jsx'; 
// CAMBIO: Importamos la función específica para obtener datos de la empresa
import api, { getCompanySettings } from '../services/api';
import { HiOutlineMenu } from "react-icons/hi"; // <-- IMPORTACIÓN NUEVA
import { AuthContext } from '../context/AuthContext';
import MandatoryNotificationModal from './MandatoryNotificationModal';

function AppLayout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user } = useContext(AuthContext); 
  
  // --- CAMBIO: Estado para la Identidad de la Empresa ---
  const [companyInfo, setCompanyInfo] = useState({ name: "Cargando...", logo_url: null });
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  // Efecto para cargar los datos de la empresa (Nombre y Logo)
  useEffect(() => {
    if (user) {
      getCompanySettings()
        .then((data) => {
          if (data) setCompanyInfo(data);
        })
        .catch((err) => console.error("Error cargando identidad empresa", err));
    }
  }, [user]);
  // -----------------------------------------------------

  // Estado para las alertas programadas
  const [scheduledRules, setScheduledRules] = useState([]);
  // Memoria para no mostrar la misma alerta dos veces en el mismo minuto
  const [seenAlerts, setSeenAlerts] = useState({}); 

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // --- VIGILANTE DEL RELOJ ---
  useEffect(() => {
    if (!user) return; // Si no hay usuario logueado, no vigilamos

    const checkScheduledAlerts = async () => {
      try {
        // Preguntamos al backend si hay algo para AHORA
        const response = await api.get('/notifications/check', {
          params: { event_type: 'SCHEDULED' }
        });
        
        const activeRules = response.data;
        const now = new Date();
        const currentMinuteKey = `${now.getHours()}:${now.getMinutes()}`; // Ej: "13:30"

        // Filtramos: Solo mostramos si NO la hemos visto en este minuto exacto
        const newRulesToShow = activeRules.filter(rule => {
          const lastSeenTime = seenAlerts[rule.id];
          return lastSeenTime !== currentMinuteKey;
        });

        if (newRulesToShow.length > 0) {
          setScheduledRules(newRulesToShow);
          
          // Marcamos como vistas para este minuto
          setSeenAlerts(prev => {
            const updated = { ...prev };
            newRulesToShow.forEach(r => updated[r.id] = currentMinuteKey);
            return updated;
          });
        }

      } catch (error) {
        console.error("Error chequeando alertas programadas", error);
      }
    };

    // Revisamos cada 45 segundos para asegurar que atrapamos el minuto
    // (Si revisamos cada 60s exactos, podríamos saltarnos un minuto por ms de desface)
    const intervalId = setInterval(checkScheduledAlerts, 45000);
    
    // Chequeo inicial al montar
    checkScheduledAlerts();

    return () => clearInterval(intervalId);
  }, [user, seenAlerts]);

  const handleCloseModal = () => {
    // Limpiamos las reglas para cerrar el modal
    setScheduledRules([]);
  };

  return (
    <div className="flex h-dvh overflow-hidden text-secondary bg-gray-50 flex-col md:flex-row">
      
      {/* --- CINTA DE MODO DEMO (Visible si el usuario es "demo") --- */}
      {user?.email === "demo" && (
        <div className="bg-red-600 text-white text-xs font-bold text-center py-1 absolute top-0 left-0 right-0 z-[60] shadow-md">
          ⚠️ ESTAS EN MODO DEMO - Los datos son públicos y se borran cada 24h - NO USAR PARA VENTAS REALES ⚠️
        </div>
      )}

      {/* --- BARRA SUPERIOR MÓVIL (Solo visible en celulares) --- */}
      {/* Esto crea una franja blanca arriba con el logo centrado y el botón de menú */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-md border-b border-gray-200 z-30 flex items-center px-4 justify-between shadow-sm">
        
        {/* Botón Menú (Izquierda) */}
        <button 
          onClick={() => setIsMenuOpen(true)}
          className="p-2 text-primary hover:bg-gray-100 rounded-lg transition-colors"
        >
          <HiOutlineMenu className="w-7 h-7" />
        </button>

        {/* Logo/Título (Centrado Absoluto y Clickable) */}
        <Link 
          to="/" 
          className="absolute left-1/2 transform -translate-x-1/2 flex items-center justify-center active:opacity-70 transition-opacity"
          title="Ir al Inicio"
        >
          {companyInfo.logo_url ? (
            // Si hay logo, mostramos la imagen
            <img 
              src={`${API_URL}${companyInfo.logo_url}`} 
              alt="Logo" 
              className="h-10 w-auto object-contain" 
            />
          ) : (
            // Si no, mostramos el nombre en texto
            <span className="font-bold text-lg text-primary tracking-wide truncate max-w-[200px]">
              {companyInfo.name}
            </span>
          )}
        </Link>

        {/* Espacio vacío a la derecha (para equilibrar el botón de la izquierda) */}
        <div className="w-10"></div>
      </header>

      {/* El Header (menú lateral) */}
      {/* CAMBIO: Envolvemos el Header en un div que detecta el mouse */}
      <div 
        onMouseEnter={() => setIsMenuOpen(true)}
        onMouseLeave={() => setIsMenuOpen(false)}
        className="relative z-50" 
      >
        {/* Pasamos companyInfo y API_URL como propiedades al Header */}
        <Header 
          isMenuOpen={isMenuOpen} 
          onToggle={toggleMenu} 
          companyInfo={companyInfo} 
          apiUrl={API_URL} 
        /> 
      </div>

      {/* Contenido Principal */}
      {/* CAMBIO: 
          1. md:pl-28: Damos más espacio a la izquierda (antes 20, ahora 28) para que no esté pegado al menú cerrado.
          2. onClick: Si el menú está abierto y tocas aquí, se cierra.
      */}
      <main 
        onClick={() => isMenuOpen && setIsMenuOpen(false)}
        // CAMBIO: 'pl-4' en móvil (margen normal) y 'md:pl-28' en PC (espacio extra para menú)
        className={`flex-1 overflow-y-auto p-4 md:p-8 pt-20 md:pt-8 pl-4 md:pl-28 transition-all duration-300`}
      >
        <Outlet />
      </main>

      {/* Modal de Alertas */}
      <MandatoryNotificationModal 
        rules={scheduledRules} 
        onClose={handleCloseModal} 
      />
    </div>
  );
}

export default AppLayout;