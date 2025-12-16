// frontend/src/components/AppLayout.jsx
import React, { useState, useEffect, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header.jsx'; 
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import MandatoryNotificationModal from './MandatoryNotificationModal';

function AppLayout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user } = useContext(AuthContext); // Necesitamos saber si hay usuario
  
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
    // CAMBIO CLAVE: Usamos 'h-dvh' (Dynamic Height) para celulares y 'overflow-hidden'
    // para que el scroll sea interno y no se pelee con el navegador.
    <div className="flex h-dvh overflow-hidden text-secondary">
      
      {/* El Header (menú) */}
      <Header isMenuOpen={isMenuOpen} onToggle={toggleMenu} /> 

      <main className={`flex-1 overflow-y-auto pr-8 pb-8 pt-8 pl-28 transition-all duration-300`}>
        <Outlet />
      </main>

      {/* --- MODAL DE ALERTAS PROGRAMADAS --- */}
      <MandatoryNotificationModal 
        rules={scheduledRules} 
        onClose={handleCloseModal} 
      />
    </div>
  );
}

export default AppLayout;