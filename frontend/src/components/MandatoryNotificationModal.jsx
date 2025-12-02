import React, { useState, useEffect } from 'react';
import { HiOutlineExclamation } from 'react-icons/hi';

function MandatoryNotificationModal({ rules, onClose }) {
  // Si no hay reglas, no mostramos nada
  if (!rules || rules.length === 0) return null;

  // Tomamos la primera regla de la lista (mostramos una por una si hubiera varias)
  const currentRule = rules[0];
  
  // Estado para la cuenta regresiva
  const [secondsLeft, setSecondsLeft] = useState(currentRule.delay_seconds);

  useEffect(() => {
    // El reloj que cuenta hacia atrás
    if (secondsLeft > 0) {
      const timerId = setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [secondsLeft]);

  const handleAcknowledge = () => {
    // Al dar click en "Entendido", llamamos a onClose. 
    // (Podrías pasarle el ID de la regla para marcarla como leída si quisiéramos avanzar a la siguiente)
    onClose(); 
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-bounce-slight">
        {/* Encabezado Rojo */}
        <div className="bg-red-600 p-6 flex flex-col items-center text-white">
          <HiOutlineExclamation className="w-16 h-16 mb-2" />
          <h2 className="text-2xl font-bold uppercase tracking-wider">Mensaje Obligatorio</h2>
        </div>

        {/* Contenido del Mensaje */}
        <div className="p-8 text-center">
          <p className="text-gray-800 text-xl font-medium leading-relaxed">
            {currentRule.message}
          </p>
        </div>

        {/* Botón con Candado */}
        <div className="bg-gray-100 p-6 flex justify-center border-t">
          <button
            onClick={handleAcknowledge}
            disabled={secondsLeft > 0}
            className={`w-full py-4 rounded-lg font-bold text-lg transition-all duration-300
              ${secondsLeft > 0 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-red-600 text-white hover:bg-red-700 shadow-lg scale-105'
              }`}
          >
            {secondsLeft > 0 
              ? `Espera ${secondsLeft} segundos para continuar...` 
              : 'ENTENDIDO Y CONFIRMADO'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MandatoryNotificationModal;