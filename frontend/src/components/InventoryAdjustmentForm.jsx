import React, { useState, useEffect } from 'react';
import api from '../services/api';

function InventoryAdjustmentForm({ product, onSave, onClose }) {
  // --- ESTADOS ---
  const [adjustment, setAdjustment] = useState({
    reason: 'CONTEO INICIAL',
    pin: ''
  });
  
  // Estado para las bodegas
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(''); 
  
  // Estado para el Stock
  const [currentStock, setCurrentStock] = useState(0); 
  const [quantityInput, setQuantityInput] = useState(''); 
  
  // Eliminamos el selector de modo, ahora SIEMPRE es 'set' (Definir Total)
  const mode = 'set'; 
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingStock, setFetchingStock] = useState(false);

  // --- EFECTOS ---

  // 1. Cargar Bodegas al abrir
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await api.get('/api/bodegas/');
        const bodegas = response.data;
        setLocations(bodegas);
        
        // AUTO-SELECCIÓN INTELIGENTE
        if (bodegas.length > 0) {
          setSelectedLocation(bodegas[0].id);
        }
      } catch (err) {
        console.error("Error cargando bodegas", err);
        setError("No se pudieron cargar las bodegas.");
      }
    };
    fetchLocations();
  }, []);

  // 2. Cargar Stock (CON LA LÓGICA CORREGIDA QUE SÍ FUNCIONA)
  useEffect(() => {
    if (product && selectedLocation) {
      setFetchingStock(true);
      api.get(`/products/${product.id}/stock`)
          .then(res => {
            const rawStockList = res.data;
            
            // [LÓGICA BLINDADA] Buscamos el ID ya sea afuera o dentro del objeto location
            const stockEntry = rawStockList.find(s => {
                const idEncontrado = s.location_id || (s.location && s.location.id);
                return String(idEncontrado) === String(selectedLocation);
            });
            
            setCurrentStock(stockEntry ? stockEntry.quantity : 0);
          })
          .catch(err => {
              console.error("Error cargando stock", err);
              // Fallo silencioso en producción para no asustar, o mensaje simple
          })
          .finally(() => setFetchingStock(false));
    }
  }, [product, selectedLocation]);

  // --- MANEJADORES ---

  const handleChange = (e) => {
    const { name, value } = e.target;
    setAdjustment(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (quantityInput === '') {
        setError("Por favor ingresa la cantidad contada.");
        setLoading(false);
        return;
    }

    // Lógica Matemática Simplificada (Siempre es 'set')
    const inputVal = parseInt(quantityInput, 10);
    const finalQuantityToSend = inputVal;

    // Razón automática
    const reasonDetail = `${adjustment.reason} (Fijado a ${inputVal})`;

    try {
      await onSave(product.id, { 
          new_quantity: finalQuantityToSend,
          reason: reasonDetail,
          pin: adjustment.pin,
          location_id: parseInt(selectedLocation, 10) 
      });
      onClose(); 
    } catch (err) {
      setError(err.response?.data?.detail || 'Ocurrió un error al guardar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 my-8" 
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* ENCABEZADO */}
        <div className="bg-accent p-4 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              📦 Ajustar Inventario
            </h2>
            <p className="text-accent-content text-sm opacity-90 mt-1">
              Producto: <span className="font-bold">{product?.name}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-1 transition">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* SECCIÓN 1: DÓNDE Y CUÁNTO HAY */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">
              Ubicación y Stock Actual
            </label>
            <div className="flex gap-3">
              <div className="flex-1">
                <select 
                  value={selectedLocation} 
                  onChange={(e) => setSelectedLocation(e.target.value)} 
                  className="w-full bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-accent focus:border-accent p-2.5 shadow-sm"
                >
                  {locations.map(loc => (
                    // LIMPIEZA: Quitamos el (ID: X) visualmente
                    <option key={loc.id} value={loc.id}>🏭 {loc.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="bg-white border border-blue-200 text-blue-800 px-4 py-2 rounded-lg flex flex-col items-center justify-center min-w-[80px] shadow-sm">
                <span className="text-xs font-bold text-blue-400">ACTUAL</span>
                <span className="text-xl font-black">
                  {fetchingStock ? '...' : currentStock}
                </span>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: INPUT DIRECTO (Sin Tabs) */}
          <div>
            <label className="text-sm font-bold text-gray-700 mb-2 block text-center">
               ¿Cuántas unidades contaste físicamente?
            </label>
            <div className="relative">
              <input 
                type="number" 
                value={quantityInput} 
                onChange={(e) => setQuantityInput(e.target.value)} 
                className="w-full p-4 text-center text-4xl font-black border-2 border-accent text-accent rounded-xl outline-none focus:ring-4 focus:ring-accent/20 transition-all shadow-inner bg-white"
                placeholder="0"
                autoFocus
                required 
              />
            </div>
          </div>

          {/* TARJETA DE RESUMEN (CONFIRMACIÓN VISUAL) */}
          {quantityInput !== '' && (
            <div className="flex items-center justify-between bg-gray-800 text-white p-3 rounded-lg shadow-lg">
              <div className="text-center flex-1 opacity-60">
                <div className="text-xs">Antes</div>
                <div className="font-bold text-lg">{currentStock}</div>
              </div>
              <div className="text-gray-500 font-bold">➔</div>
              <div className="text-center flex-1">
                 <div className="text-xs text-green-300">Nuevo Total</div>
                 <div className="font-black text-2xl text-green-400">
                    {parseInt(quantityInput) || 0}
                 </div>
              </div>
            </div>
          )}

          {error && <p className="bg-red-100 text-red-700 p-2 rounded text-sm text-center">{error}</p>}

          {/* DATOS FINALES Y PIN */}
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Motivo</label>
                <input 
                  type="text" 
                  name="reason" 
                  value={adjustment.reason} 
                  onChange={handleChange} 
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white uppercase"
                  placeholder="Ej: CONTEO"
                  required
                />
             </div>
             <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">PIN Seguridad</label>
                <input 
                  type="password" 
                  name="pin" 
                  value={adjustment.pin} 
                  onChange={handleChange} 
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm text-center tracking-widest bg-gray-50 focus:bg-white focus:border-accent outline-none"
                  placeholder="****"
                  required
                  maxLength={4}
                />
             </div>
          </div>

          {/* BOTONES */}
          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-3 px-4 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="flex-1 py-3 px-4 bg-accent text-white font-bold rounded-xl hover:bg-teal-600 transition shadow-lg shadow-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando...' : 'Confirmar Ajuste'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default InventoryAdjustmentForm;