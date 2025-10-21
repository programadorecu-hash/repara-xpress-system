import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';

function SelectShiftPage() {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { startShift } = useContext(AuthContext);

  // Al cargar la página, obtenemos la lista de sucursales desde el backend
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await api.get('/locations/');
        // Filtramos para mostrar solo las sucursales principales, no las bodegas
        const mainLocations = response.data.filter(loc => loc.parent_id === null);
        setLocations(mainLocations);
        if (mainLocations.length > 0) {
          setSelectedLocation(mainLocations[0].id); // Seleccionamos la primera por defecto
        }
      } catch (err) {
        setError('No se pudieron cargar las sucursales.');
      }
    };
    fetchLocations();
  }, []);

const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      // --- MODIFICACIÓN AQUÍ ---
      // 1. Capturamos la respuesta de la API en una variable 'response'
      const response = await api.post('/shifts/clock-in', { location_id: selectedLocation });
      
      // 2. Usamos los datos de esa respuesta para avisar al context del nuevo turno
      startShift(response.data);

      // 3. Redirigimos al dashboard
      navigate('/');

    } catch (err) {
      setError(err.response?.data?.detail || 'Error al iniciar el turno.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-primary">
      <div className="p-8 bg-white rounded-lg shadow-lg w-full max-w-sm border">
        <h2 className="text-2xl font-bold text-center text-secondary mb-6">Iniciar Turno</h2>
        <form onSubmit={handleSubmit}>
          {error && <p className="bg-red-200 text-red-800 p-3 rounded-lg mb-4">{error}</p>}
          <div className="mb-6">
            <label className="block text-gray-500 mb-2" htmlFor="location">
              Selecciona tu Sucursal
            </label>
            <select
              id="location"
              className="w-full p-3 bg-gray-100 rounded-lg text-secondary border border-gray-300 focus:outline-none focus:border-detail"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
            >
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="w-full bg-accent hover:bg-teal-500 text-white font-bold py-3 rounded-lg transition duration-300"
          >
            Confirmar e Ingresar
          </button>
        </form>
      </div>
    </div>
  );
}

export default SelectShiftPage;