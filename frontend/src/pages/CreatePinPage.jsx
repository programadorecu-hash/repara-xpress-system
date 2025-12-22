// frontend/src/pages/CreatePinPage.jsx
// Esta es la página del "escritorio" para que el empleado cree su PIN secreto

import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api'; // Usamos el teléfono normal
import { AuthContext } from '../context/AuthContext';

function CreatePinPage() {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Traemos 'setUser' para actualizar el "gafete" (perfil)
  const { user, setUser } = useContext(AuthContext);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    // Validaciones
    if (!/^\d{4}$/.test(pin)) {
      setError('El PIN debe ser exactamente de 4 números.');
      return;
    }
    if (pin !== confirmPin) {
      setError('Los PINs no coinciden.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Llamamos a la URL especial del "camarero" (/users/me/set-pin)
      const response = await api.post('/users/me/set-pin', { pin: pin });

      // 2. ¡Éxito! El PIN se guardó.
      // Ahora actualizamos el "gafete" (AuthContext) con la info nueva
      setUser(response.data);

      alert('¡PIN creado con éxito! Ahora serás redirigido.');

      // 3. Lo mandamos a "Iniciar Turno"
      navigate('/iniciar-turno');
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar el PIN.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-primary px-4">
      {/* Agregamos px-4 para que la caja no toque los bordes en celular */}
      <div className="p-8 bg-white rounded-lg shadow-lg w-full max-w-sm border">
        <h2 className="text-2xl font-bold text-center text-secondary mb-4">
          Crea tu PIN Secreto
        </h2>
        <p className="text-center text-gray-600 mb-6">
          Hola, {user?.email}.<br />
          Por seguridad, debes crear un PIN de 4 dígitos para autorizar ventas y movimientos.
        </p>

        <form onSubmit={handleSubmit}>
          {error && (
            <p className="bg-red-200 text-red-800 p-3 rounded-lg mb-4">
              {error}
            </p>
          )}

          <div className="mb-4">
            <label className="block text-gray-500 mb-2" htmlFor="pin">
              Nuevo PIN de 4 dígitos
            </label>
            <input
              type="password"
              id="pin"
              className="w-full p-3 bg-gray-100 rounded-lg text-secondary border border-gray-300 focus:outline-none focus:border-detail"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
              maxLength="4"
              pattern="\d{4}"
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-500 mb-2" htmlFor="confirmPin">
              Confirmar PIN
            </label>
            <input
              type="password"
              id="confirmPin"
              className="w-full p-3 bg-gray-100 rounded-lg text-secondary border border-gray-300 focus:outline-none focus:border-detail"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              required
              maxLength="4"
              pattern="\d{4}"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-accent hover:bg-teal-500 text-white font-bold py-3 rounded-lg transition duration-300"
            disabled={isLoading}
          >
            {isLoading ? 'Guardando...' : 'Guardar y Continuar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreatePinPage;
