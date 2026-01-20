// frontend/src/pages/TransfersPage.jsx

import React, { useState, useEffect, useContext } from 'react';
import { 
  HiOutlineSearch, 
  HiOutlinePlus, 
  HiOutlineTrash, 
  HiOutlineArrowRight, 
  HiOutlineCheckCircle, 
  HiOutlineXCircle,
  HiOutlineInboxIn,
  HiOutlinePaperAirplane,
  HiOutlineSwitchHorizontal // <--- Agregamos este ícono que faltaba
} from 'react-icons/hi';
import { toast } from 'react-toastify';
import api, { getLocations, getProducts, createTransfer, getTransfers, receiveTransfer } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import PatternLockModal from '../components/PatternLockModal';

function TransfersPage() {
  const { activeShift, user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'history'
  
  // --- ESTADOS PARA NUEVO ENVÍO ---
  const [locations, setLocations] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState('');
  const [note, setNote] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [cart, setCart] = useState([]); // [{ product, quantity }]
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [actionType, setActionType] = useState('create'); // 'create' | 'accept' | 'reject'
  const [selectedTransferId, setSelectedTransferId] = useState(null); // Para recibir

  // --- ESTADOS PARA HISTORIAL ---
  const [transfersList, setTransfersList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Cargar sucursales al inicio
  useEffect(() => {
    loadLocations();
  }, []);

  // Cargar historial cuando cambie la pestaña
  useEffect(() => {
    if (activeTab === 'history') {
      loadTransfersHistory();
    }
  }, [activeTab]);

  const loadLocations = async () => {
    try {
      const data = await getLocations();
      // Filtramos para no enviarnos a nosotros mismos
      if (activeShift) {
        setLocations(data.filter(l => l.id !== activeShift.location_id));
      } else {
        setLocations(data);
      }
    } catch (error) {
      console.error("Error cargando sucursales", error);
    }
  };

  const loadTransfersHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await getTransfers({ limit: 50 }); // Traemos los últimos 50
      setTransfersList(data);
    } catch (error) {
      toast.error("Error cargando historial");
    } finally {
      setLoadingHistory(false);
    }
  };

  // --- BUSCADOR DE PRODUCTOS ---
  const handleSearchProduct = async (e) => {
    e.preventDefault();
    if (!productSearch.trim()) return;
    
    try {
      // Buscamos productos en MI sucursal actual para ver stock real
      const data = await getProducts({ 
        search: productSearch, 
        location_id: activeShift?.location_id 
      });
      setSearchResults(data);
    } catch (error) {
      console.error(error);
    }
  };

  const addToCart = (product) => {
    // Verificar si ya está en el carrito
    const existing = cart.find(item => item.product.id === product.id);
    
    // Verificar stock disponible (product.stock_quantity viene de la búsqueda)
    const currentQtyInCart = existing ? existing.quantity : 0;
    
    if (currentQtyInCart + 1 > product.stock_quantity) {
      toast.warning(`Solo tienes ${product.stock_quantity} unidades disponibles.`);
      return;
    }

    if (existing) {
      setCart(cart.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
    setSearchResults([]); // Limpiar búsqueda
    setProductSearch('');
  };

  const removeFromCart = (index) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  // --- ACCIONES CON PIN ---
  const handleInitiateCreate = () => {
    if (!selectedDestination) return toast.warning("Selecciona una sucursal destino");
    if (cart.length === 0) return toast.warning("Agrega productos al envío");
    setActionType('create');
    setIsPinModalOpen(true);
  };

  const handleInitiateReceive = (transferId, type) => {
    // type: 'accept' | 'reject'
    setSelectedTransferId(transferId);
    setActionType(type);
    setIsPinModalOpen(true);
  };

  const onPinSuccess = async (pin) => {
    setIsPinModalOpen(false);
    
    try {
      if (actionType === 'create') {
        const itemsPayload = cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity
        }));

        await createTransfer({
          destination_location_id: selectedDestination,
          note: note,
          items: itemsPayload,
          pin: pin
        });
        
        toast.success("Envío creado exitosamente");
        // Reset form
        setCart([]);
        setNote('');
        setSelectedDestination('');
        setActiveTab('history'); // Ir al historial para verlo

      } else if (actionType === 'accept' || actionType === 'reject') {
        const status = actionType === 'accept' ? "ACEPTADO" : "RECHAZADO";
        
        // Pedimos nota opcional solo si rechaza (podríamos usar prompt o un modal mejor, 
        // por simplicidad usamos prompt o string vacío)
        let receiveNote = "";
        if (actionType === 'reject') {
           const reason = prompt("Motivo del rechazo (Opcional):");
           if (reason === null) return; // Cancelado por usuario
           receiveNote = reason;
        }

        await receiveTransfer(selectedTransferId, {
          status: status,
          pin: pin,
          note: receiveNote
        });

        toast.success(`Envío ${status.toLowerCase()} correctamente`);
        loadTransfersHistory(); // Recargar lista
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Error procesando la solicitud");
    }
  };

  // --- RENDER ---
  return (
    <div className="flex flex-col h-full bg-gray-50/50 p-2 md:p-6 gap-6">
      
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <HiOutlineSwitchHorizontal className="text-brand" />
            Transferencias
          </h1>
          <p className="text-gray-500 text-sm">Mueve mercadería entre sucursales</p>
        </div>
        
        {/* Pestañas */}
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('new')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'new' ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <HiOutlinePaperAirplane className="rotate-90" /> Nuevo Envío
            </div>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'history' ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <HiOutlineInboxIn /> Historial / Recibir
            </div>
          </button>
        </div>
      </div>

      {/* CONTENIDO PESTAÑAS */}
      
      {/* --- PESTAÑA: NUEVO ENVÍO --- */}
      {activeTab === 'new' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0">
          
          {/* Columna Izquierda: Formulario y Búsqueda */}
          <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
            
            {/* Tarjeta 1: Destino y Nota */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-700 mb-4">Datos del Envío</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Sucursal de Destino</label>
                  <select 
                    value={selectedDestination}
                    onChange={(e) => setSelectedDestination(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                  >
                    <option value="">-- Seleccionar --</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Nota (Opcional)</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Reposición urgente"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Tarjeta 2: Buscador */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col min-h-0">
              <h3 className="font-semibold text-gray-700 mb-4">Agregar Productos</h3>
              
              <form onSubmit={handleSearchProduct} className="flex gap-2 mb-4">
                <input 
                  type="text" 
                  placeholder="Buscar por nombre o SKU..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                  autoFocus
                />
                <button type="submit" className="bg-brand text-white px-4 rounded-lg hover:bg-brand-dark transition-colors">
                  <HiOutlineSearch className="text-xl" />
                </button>
              </form>

              {/* Lista de Resultados de Búsqueda */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {searchResults.map(prod => (
                  <div key={prod.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="font-medium text-gray-800">{prod.name}</p>
                      <p className="text-xs text-gray-500">SKU: {prod.sku} | Stock: <span className={prod.stock_quantity > 0 ? "text-green-600 font-bold" : "text-red-500"}>{prod.stock_quantity}</span></p>
                    </div>
                    <button 
                      onClick={() => addToCart(prod)}
                      disabled={prod.stock_quantity <= 0}
                      className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <HiOutlinePlus />
                    </button>
                  </div>
                ))}
                {searchResults.length === 0 && productSearch && (
                  <p className="text-center text-gray-400 mt-4">Realiza una búsqueda para ver productos...</p>
                )}
              </div>
            </div>
          </div>

          {/* Columna Derecha: Resumen del Envío (Carrito) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
              <HiOutlineInboxIn /> Resumen del Paquete
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1 custom-scrollbar">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                  <p>La caja está vacía</p>
                </div>
              ) : (
                cart.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="font-medium text-gray-800 truncate">{item.product.name}</p>
                      <p className="text-xs text-gray-500">Cant: {item.quantity}</p>
                    </div>
                    <button 
                      onClick={() => removeFromCart(index)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <HiOutlineTrash />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Productos:</span>
                <span className="font-bold text-gray-900">{cart.reduce((acc, item) => acc + item.quantity, 0)}</span>
              </div>
              <button
                onClick={handleInitiateCreate}
                disabled={cart.length === 0 || !selectedDestination}
                className="w-full bg-brand text-white py-3 rounded-xl font-bold hover:bg-brand-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand/20"
              >
                Confirmar Envío
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PESTAÑA: HISTORIAL / RECIBIR --- */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col">
          {/* Tabla de Historial */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-semibold">
                <tr>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Desde / Hacia</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Detalle</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transfersList.map((transfer) => {
                  const isIncoming = transfer.destination_location_name === activeShift?.location.name;
                  // Si soy admin, veo todo, pero para la lógica "isIncoming" supongamos que si el destination 
                  // coincide con mi turno, es incoming. Si no tengo turno, solo veo.
                  
                  return (
                    <tr key={transfer.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {new Date(transfer.created_at).toLocaleDateString()} <br/>
                        <span className="text-xs text-gray-400">{new Date(transfer.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </td>
                      
                      <td className="px-6 py-4">
                        {isIncoming ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                            <HiOutlineInboxIn /> ENTRANTE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-medium">
                            <HiOutlinePaperAirplane className="rotate-90"/> SALIENTE
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{transfer.source_location_name}</span>
                          <HiOutlineArrowRight className="text-gray-400" />
                          <span className="font-medium">{transfer.destination_location_name}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {transfer.status === 'PENDIENTE' && <span className="text-yellow-600 bg-yellow-50 px-2 py-1 rounded-md text-xs font-bold">EN TRÁNSITO</span>}
                        {transfer.status === 'ACEPTADO' && <span className="text-green-600 bg-green-50 px-2 py-1 rounded-md text-xs font-bold">RECIBIDO</span>}
                        {transfer.status === 'RECHAZADO' && <span className="text-red-600 bg-red-50 px-2 py-1 rounded-md text-xs font-bold">RECHAZADO</span>}
                      </td>

                      <td className="px-6 py-4 max-w-xs truncate text-xs text-gray-500" title={transfer.note}>
                        {transfer.items.length} items. {transfer.note || "Sin nota."}
                      </td>

                      <td className="px-6 py-4 text-center">
                        {/* Botones de Acción: Solo si es ENTRANTE y PENDIENTE (y tengo turno ahí o soy admin) */}
                        {transfer.status === 'PENDIENTE' && (user.role === 'admin' || isIncoming) && (
                          <div className="flex justify-center gap-2">
                            <button 
                              onClick={() => handleInitiateReceive(transfer.id, 'accept')}
                              className="text-green-600 hover:bg-green-50 p-2 rounded-lg transition-colors tooltip"
                              title="Aceptar y sumar stock"
                            >
                              <HiOutlineCheckCircle className="text-xl" />
                            </button>
                            <button 
                              onClick={() => handleInitiateReceive(transfer.id, 'reject')}
                              className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors tooltip"
                              title="Rechazar y devolver"
                            >
                              <HiOutlineXCircle className="text-xl" />
                            </button>
                          </div>
                        )}
                        {transfer.status !== 'PENDIENTE' && (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {transfersList.length === 0 && !loadingHistory && (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-gray-400">
                      No hay registros de transferencias.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PatternLockModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={onPinSuccess}
        title={actionType === 'create' ? "Confirmar Envío" : (actionType === 'accept' ? "Firmar Recepción" : "Firmar Rechazo")}
      />
    </div>
  );
}

export default TransfersPage;