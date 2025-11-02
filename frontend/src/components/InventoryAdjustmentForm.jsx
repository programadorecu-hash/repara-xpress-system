import React, { useState, useEffect } from 'react';
import api from '../services/api';

function InventoryAdjustmentForm({ product, onSave, onClose }) {
  const [adjustment, setAdjustment] = useState({
    new_quantity: 0,
    reason: 'Stock Inicial',
    pin: ''
  });
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // --- INICIO DE NUESTRO CÓDIGO (Arreglo del Plomero) ---
    // Le decimos al "plomero" que use la nueva URL /api/bodegas/
    api.get('/api/bodegas/').then(response => {
      // Ya no necesitamos filtrar, la API nos da solo las bodegas
      const bodegas = response.data; 
      setLocations(bodegas);
      if (bodegas.length > 0) {
        setSelectedLocation(bodegas[0].id);
      }
    });
    // --- FIN DE NUESTRO CÓDIGO ---
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setAdjustment(prev => ({ ...prev, [name]: value }));
  };

  const handleLocationChange = (e) => {
    setSelectedLocation(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Pasamos todos los datos necesarios a la función de guardado
      await onSave(product.id, { ...adjustment, location_id: parseInt(selectedLocation, 10) });
      onClose(); // Cerramos el modal solo si el guardado fue exitoso
    } catch (err) {
      setError(err.response?.data?.detail || 'Ocurrió un error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center" >
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg text-gray-800" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-secondary mb-4">Ajustar Stock para: <span className="text-accent">{product.name}</span></h2>
        
        {/* Mostramos el error dentro del modal */}
        {error && <p className="bg-red-200 text-red-800 p-3 rounded-lg my-4">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-semibold text-gray-600 block mb-2">Bodega de Destino</label>
            <select value={selectedLocation} onChange={handleLocationChange} className="w-full p-2 border rounded-lg">
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-semibold text-gray-600 block mb-2">Nueva Cantidad Total</label>
            <input 
              type="number" 
              name="new_quantity"
              min="0" // No permite números negativos
              value={adjustment.new_quantity} 
              onChange={handleChange} 
              className="w-full p-2 border rounded-lg" 
              required 
            />
          </div>
          <div>
            <label className="font-semibold text-gray-600 block mb-2">Motivo del Ajuste</label>
            <input type="text" name="reason" value={adjustment.reason} onChange={handleChange} className="w-full p-2 border rounded" required />
          </div>
          <div>
            <label className="font-semibold text-gray-600 block mb-2">Tu PIN de Seguridad</label>
            <input type="password" name="pin" value={adjustment.pin} onChange={handleChange} className="w-full p-2 border rounded" required />
          </div>
          <div className="mt-6 flex justify-end space-x-4">
            <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 rounded-lg hover:bg-gray-300">Cancelar</button>
            <button type="submit" disabled={loading} className="py-2 px-4 bg-accent text-white font-bold rounded-lg hover:bg-teal-600 disabled:bg-gray-400">
              {loading ? 'Guardando...' : 'Confirmar Ajuste'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default InventoryAdjustmentForm;