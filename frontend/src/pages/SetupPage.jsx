// frontend/src/pages/SetupPage.jsx
// Esta es la nueva página (la "pantalla de configuración de la caja fuerte")

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// Importamos axios directamente porque 'api.js' (el teléfono) 
// añade un "token de autorización" que aquí todavía no tenemos.
import axios from 'axios'; 

function SetupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate(); // Para redirigir al usuario al login

  // Usamos la URL base de la "agenda" (.env)
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    
    // Validaciones simples
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    // Esta expresión regular (/\d{4}$/) significa:
    // ^ = Dede empezar aquí
    // \d{4} = debe tener 4 dígitos numéricos
    // $ = Dede terminar aquí
    if (!/^\d{4}$/.test(pin)) {
      setError('El PIN debe ser exactamente de 4 números.');
      return;
    }

    setIsLoading(true);

    try {
      // Creamos el "formulario" para enviar al backend
      const payload = {
        email: email,
        password: password,
        pin: pin,
      };

      // Usamos axios para llamar a la nueva "URL" que creamos en main.py
      await axios.post(`${API_URL}/api/setup/create-first-admin`, payload);

      // ¡Éxito!
      alert('¡Usuario administrador creado con éxito! Ahora serás redirigido al Login.');
      navigate('/login'); // Redirigimos al login
      
    } catch (err) {
      // Si el backend nos da un error (ej: "Ya hay usuarios")
      setError(err.response?.data?.detail || 'No se pudo completar la configuración.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-primary">
      <div className="p-8 bg-white rounded-lg shadow-lg w-full max-w-md border">
        <h2 className="text-3xl font-bold text-center text-secondary mb-4">
          Configuración Inicial
        </h2>
        <p className="text-center text-gray-600 mb-6">
          Parece que es la primera vez que ejecutas la aplicación.
          Por favor, crea el primer usuario Administrador.
        </p>
        
        <form onSubmit={handleSubmit}>
          {error && <p className="bg-red-200 text-red-800 p-3 rounded-lg mb-4">{error}</p>}
          
          <div className="mb-4">
            <label className="block text-gray-500 mb-2" htmlFor="email">
              Correo del Administrador
            </label>
            <input 
              type="email" 
              id="email" 
              className="w-full p-3 bg-gray-100 rounded-lg text-secondary border border-gray-300 focus:outline-none focus:border-detail" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-500 mb-2" htmlFor="password">
              Contraseña (mín. 8 caracteres)
            </label>
            <input 
              type="password" 
              id="password" 
              className="w-full p-3 bg-gray-100 rounded-lg text-secondary border border-gray-300 focus:outline-none focus:border-detail" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-500 mb-2" htmlFor="pin">
              PIN de 4 dígitos (para ventas y ajustes)
            </label>
            <input 
              type="password" // Usamos tipo 'password' para ocultar el PIN
              id="pin" 
              className="w-full p-3 bg-gray-100 rounded-lg text-secondary border border-gray-300 focus:outline-none focus:border-detail" 
              value={pin} 
              onChange={(e) => setPin(e.target.value)} 
              required 
              maxLength="4" // Máximo 4 dígitos
              pattern="\d{4}" // Solo acepta 4 números
            />
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-accent hover:bg-teal-500 text-white font-bold py-3 rounded-lg transition duration-300 disabled:bg-gray-400"
            disabled={isLoading}
          >
            {isLoading ? 'Creando...' : 'Crear Administrador'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default SetupPage;