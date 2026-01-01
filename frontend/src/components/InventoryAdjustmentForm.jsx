import React, { useState, useEffect } from 'react';
import api from '../services/api';

function InventoryAdjustmentForm({ product, onSave, onClose }) {
  // Estado para los datos del formulario (Razón y PIN)
  const [adjustment, setAdjustment] = useState({
    reason: 'CONTEO INICIAL',
    pin: ''
  });
  
  // Estados para la lógica matemática
  const [quantityInput, setQuantityInput] = useState(''); // Lo que escribe el usuario
  const [currentStock, setCurrentStock] = useState(0); // Lo que hay en la BD
  const [mode, setMode] = useState('set'); // 'set' (=) o 'add' (+/-)

  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 1. Cargar Bodegas
  useEffect(() => {
    api.get('/api/bodegas/').then(response => {
      const bodegas = response.data; 
      setLocations(bodegas);
      if (bodegas.length > 0) {
        setSelectedLocation(bodegas[0].id);
      }
    });
  }, []);

  // 2. Cargar Stock Actual cuando cambia la bodega o el producto
  useEffect(() => {
    if (product && selectedLocation) {
      // Pedimos el stock de este producto
      api.get(`/products/${product.id}/stock`)
         .then(res => {
           // Buscamos la entrada que coincida con la bodega seleccionada
           const stockEntry = res.data.find(s => s.location_id === parseInt(selectedLocation));
           setCurrentStock(stockEntry ? stockEntry.quantity : 0);
         })
         .catch(err => console.error("Error cargando stock", err));
    }
  }, [product, selectedLocation]);

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

    // Validación básica
    if (quantityInput === '') {
        setError("Por favor ingresa una cantidad.");
        setLoading(false);
        return;
    }

    // Lógica Matemática
    let finalQuantityToSend;
    const inputVal = parseInt(quantityInput, 10);

    if (mode === 'add') {
        // Modo Sumar: Stock Actual + Input (ej: 12 + 1 = 13)
        finalQuantityToSend = currentStock + inputVal;
    } else {
        // Modo Fijar: El stock ES el input (ej: = 12)
        finalQuantityToSend = inputVal;
    }

    // Preparamos la razón para que quede registro claro en el Kardex
    const reasonDetail = `${adjustment.reason} (${mode === 'add' ? (inputVal >= 0 ? '+' : '') + inputVal : 'Fijado a ' + inputVal})`;

    try {
      await onSave(product.id, { 
          new_quantity: finalQuantityToSend,
          reason: reasonDetail,
          pin: adjustment.pin,
          location_id: parseInt(selectedLocation, 10) 
      });
      onClose(); 
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
          
          {/* Selector de Bodega */}
          <div>
            <label className="font-semibold text-gray-600 block mb-1">Bodega de Destino</label>
            <select value={selectedLocation} onChange={handleLocationChange} className="w-full p-2 border rounded-lg bg-gray-50">
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
            {/* Visualización del Stock Actual */}
            <p className="text-right text-sm text-blue-600 font-bold mt-1">
               Stock Actual en Bodega: {currentStock} u.
            </p>
          </div>

          {/* Selector de Modo (Tabs) */}
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
                type="button"
                onClick={() => { setMode('set'); setQuantityInput(''); }}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition ${mode === 'set' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Definir Total (=)
            </button>
            <button
                type="button"
                onClick={() => { setMode('add'); setQuantityInput(''); }}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition ${mode === 'add' ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Sumar / Restar (+/-)
            </button>
          </div>

          {/* Input de Cantidad Inteligente */}
          <div>
            <label className="font-semibold text-gray-600 block mb-2">
                {mode === 'set' ? 'Nueva Cantidad Total (Conteo)' : 'Cantidad a Añadir (o restar con -)'}
            </label>
            <input 
              type="number" 
              value={quantityInput} 
              onChange={(e) => setQuantityInput(e.target.value)} 
              className={`w-full p-3 border-2 rounded-lg text-lg text-center font-bold outline-none focus:ring-2 ${mode === 'add' ? 'border-green-200 focus:ring-green-400 text-green-700' : 'border-blue-200 focus:ring-blue-400 text-blue-700'}`} 
              placeholder={mode === 'set' ? "Ej: 13" : "Ej: 1"}
              required 
              autoFocus
            />
            
            {/* Feedback Matemático en tiempo real */}
            {mode === 'add' && quantityInput !== '' && (
                <div className="mt-2 text-center bg-gray-50 p-2 rounded border border-gray-200">
                    <span className="text-gray-500">Stock Actual ({currentStock})</span>
                    <span className="mx-2 font-bold">{parseInt(quantityInput) >= 0 ? '+' : ''} {quantityInput}</span>
                    <span className="text-gray-500">=</span>
                    <span className="mx-2 text-xl font-bold text-green-600">
                        {currentStock + (parseInt(quantityInput) || 0)}
                    </span>
                    <span className="text-gray-500">unidades finales</span>
                </div>
            )}
          </div>

          <div>
            <label className="font-semibold text-gray-600 block mb-2">Motivo del Ajuste</label>
            <input 
                type="text" 
                name="reason" 
                value={adjustment.reason} 
                onChange={handleChange} 
                className="w-full p-2 border rounded uppercase" 
                placeholder="Ej: ENCONTRADO EN VITRINA, CONTEO..."
                required 
            />
          </div>

          <div>
            <label className="font-semibold text-gray-600 block mb-2">Tu PIN de Seguridad</label>
            <input type="password" name="pin" value={adjustment.pin} onChange={handleChange} className="w-full p-2 border rounded text-center tracking-widest" required />
          </div>

          <div className="mt-6 flex justify-end space-x-4">
            <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 rounded-lg hover:bg-gray-300">Cancelar</button>
            <button type="submit" disabled={loading} className="py-2 px-4 bg-accent text-white font-bold rounded-lg hover:bg-teal-600 disabled:bg-gray-400 shadow-md">
              {loading ? 'Guardando...' : 'Confirmar Ajuste'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default InventoryAdjustmentForm;