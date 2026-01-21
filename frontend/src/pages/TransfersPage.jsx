// frontend/src/pages/TransfersPage.jsx

import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  HiOutlineSearch, HiOutlinePlus, HiOutlineTrash, HiOutlineArrowRight, 
  HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineInboxIn, HiOutlinePaperAirplane,
  HiOutlineSwitchHorizontal, HiPrinter, HiClipboardCheck, HiExclamation,
  HiOutlineTruck, HiOutlineOfficeBuilding, HiOutlineArchive, HiCheckCircle, HiEye
} from 'react-icons/hi';
import { toast } from 'react-toastify';
import api, { getLocations, getProducts, createTransfer, getTransfers, receiveTransfer } from '../services/api';
import { AuthContext } from '../context/AuthContext';

function TransfersPage() {
  const { activeShift, user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('new'); 

  // --- ESTADOS NUEVO ENVÍO ---
  const [locations, setLocations] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState('');
  const [selectedSource, setSelectedSource] = useState(activeShift?.location?.id || '');
  const [note, setNote] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [cart, setCart] = useState([]); 
  
  // --- ESTADOS RECEPCIÓN / MODALES ---
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [tempPin, setTempPin] = useState(''); 
  const [actionType, setActionType] = useState('create'); 
  const [selectedTransfer, setSelectedTransfer] = useState(null); // Objeto completo del envío seleccionado
  
  // Estado para el Checklist de Recepción
  const [receptionItems, setReceptionItems] = useState({}); //Map: { itemId: { qty, note } }

  // --- ESTADOS HISTORIAL ---
  const [transfersList, setTransfersList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // --- REFERENCIA PARA IMPRESIÓN ---
  const printRef = useRef();

  useEffect(() => { loadLocations(); }, []);
  useEffect(() => { if (activeTab === 'history') loadTransfersHistory(); }, [activeTab]);

  // --- NUEVO ESTADO AUXILIAR ---
  const [allLocations, setAllLocations] = useState([]); 

  const loadLocations = async () => {
    try {
      // 1. Pedimos TODO el mapa (Sucursales + Bodegas) para la validación interna de permisos
      const data = await getLocations({ all: true });
      setAllLocations(data); 

      // 2. Para los menús desplegables, filtramos SOLO las Sucursales (Padres)
      // Ocultamos las bodegas hijas (las que tienen parent_id) para no confundir.
      const sucursalesOnly = data.filter(loc => loc.parent_id === null);

      // 3. Aplicamos el filtro de exclusión (no enviarme a mí mismo) sobre la lista limpia
      if (activeShift) {
        setLocations(sucursalesOnly.filter(l => l.id !== activeShift.location?.id));
      } else {
        setLocations(sucursalesOnly);
      }
    } catch (error) { console.error(error); }
  };
  const loadTransfersHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await getTransfers({ limit: 50 });
      setTransfersList(data);
    } catch (error) { toast.error("Error cargando historial"); }
    finally { setLoadingHistory(false); }
  };

  // --- LÓGICA DE BÚSQUEDA EN TIEMPO REAL (DEBOUNCE) ---
  
  // 1. Escuchamos cambios en 'productSearch'
  useEffect(() => {
      // Si está vacío, limpiamos resultados y no hacemos nada
      if (!productSearch.trim()) {
          setSearchResults([]);
          return;
      }

      // 2. Preparamos la función de búsqueda
      const doSearch = async () => {
          const sourceLocationId = activeShift?.location?.id || selectedSource;
          if (!sourceLocationId) return; // Si no hay origen, no buscamos

          try {
              const data = await getProducts({ search: productSearch, location_id: sourceLocationId });
              setSearchResults(data);
          } catch (error) { console.error(error); }
      };

      // 3. Activamos el temporizador de 500ms (0.5s)
      const timerId = setTimeout(() => {
          doSearch();
      }, 500);

      // 4. LIMPIEZA: Si el usuario escribe otra letra antes de los 500ms,
      // cancelamos el temporizador anterior y empezamos uno nuevo.
      return () => clearTimeout(timerId);

  }, [productSearch, activeShift, selectedSource]); // Se ejecuta cada vez que cambia el texto
  const addToCart = (product) => {
    const qtyInput = quantities[product.id];
    const qtyToAdd = qtyInput && !isNaN(parseInt(qtyInput)) ? parseInt(qtyInput) : 1;
    if (qtyToAdd <= 0) return toast.warning("Cantidad inválida");

    const existing = cart.find(item => item.product.id === product.id);
    const currentQtyInCart = existing ? existing.quantity : 0;
    
    if (currentQtyInCart + qtyToAdd > product.stock_quantity) {
      return toast.warning(`Stock insuficiente. Disponible: ${product.stock_quantity}`);
    }

    if (existing) {
      setCart(cart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + qtyToAdd } : item));
    } else {
      setCart([...cart, { product, quantity: qtyToAdd }]);
    }
    setQuantities(prev => ({ ...prev, [product.id]: '' }));
    setSearchResults([]); setProductSearch('');
  };

  const removeFromCart = (index) => {
    const newCart = [...cart]; newCart.splice(index, 1); setCart(newCart);
  };

  // --- PREPARAR MODALES ---
  const handleInitiateCreate = () => {
    if (!selectedDestination || cart.length === 0) return toast.warning("Completa los datos");
    setActionType('create'); setIsPinModalOpen(true);
  };

  const handleOpenReception = (transfer) => {
    // Inicializar el estado de recepción con lo enviado
    const initialItems = {};
    transfer.items.forEach(item => {
        initialItems[item.id] = { qty: item.quantity, note: '' };
    });
    setReceptionItems(initialItems);
    setSelectedTransfer(transfer);
    setActionType('receive_checklist'); // Abrimos el modal de checklist primero
  };

  const confirmChecklist = () => {
    // Abrimos el PIN para confirmar lo que pusimos en el checklist
    setActionType('accept'); 
    setIsPinModalOpen(true);
  };

  const handleReject = (transfer) => {
      setSelectedTransfer(transfer);
      setActionType('reject');
      setIsPinModalOpen(true);
  }

  // --- IMPRESIÓN PROFESIONAL ---
  const handlePrint = async (transfer) => {
      try {
          const token = localStorage.getItem('accessToken');
          const url = `${import.meta.env.VITE_API_URL}/transfers/${transfer.id}/print-manifest`;
          const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
          if (!response.ok) throw new Error("Error al generar PDF");
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          window.open(blobUrl, '_blank'); 
      } catch (error) {
          console.error(error);
          toast.error("No se pudo generar el manifiesto.");
      }
  };

  // --- EJECUCIÓN ---
  const onPinSuccess = async (pin) => {
    setIsPinModalOpen(false);
    try {
      if (actionType === 'create') {
        const finalSourceId = activeShift ? activeShift.location?.id : selectedSource;
        const itemsPayload = cart.map(item => ({ product_id: item.product.id, quantity: item.quantity }));
        
        await createTransfer({
          source_location_id: finalSourceId, destination_location_id: selectedDestination,
          note, items: itemsPayload, pin
        });
        toast.success("Envío creado");
        setCart([]); setNote(''); setSelectedDestination('');
        setSearchResults([]); setProductSearch('');
        setActiveTab('history');

      } else if (actionType === 'accept') {
        const itemsPayload = Object.keys(receptionItems).map(itemId => ({
            item_id: parseInt(itemId),
            received_quantity: parseInt(receptionItems[itemId].qty),
            note: receptionItems[itemId].note
        }));

        let finalStatus = "ACEPTADO";
        const hasMissing = itemsPayload.some(i => {
            const original = selectedTransfer.items.find(t => t.id === i.item_id);
            return i.received_quantity < original.quantity;
        });
        if (hasMissing) finalStatus = "ACEPTADO_PARCIAL";

        await receiveTransfer(selectedTransfer.id, {
          status: finalStatus, pin, items: itemsPayload
        });
        toast.success(`Recepción registrada: ${finalStatus}`);
        setActionType(''); loadTransfersHistory();

      } else if (actionType === 'reject') {
        const reason = prompt("Motivo del rechazo:");
        if (!reason) return;
        await receiveTransfer(selectedTransfer.id, { status: "RECHAZADO", pin, note: reason });
        toast.success("Envío rechazado");
        loadTransfersHistory();
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Error");
    }
  };

  // --- RENDER ---
  return (
    <div className="flex flex-col h-full bg-gray-50/50 p-4 md:p-6 gap-6 relative overflow-hidden">
      
      {/* HEADER ELEGANTE */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <HiOutlineSwitchHorizontal className="w-8 h-8" />
            </div>
            Transferencias de Inventario
          </h1>
          <p className="text-sm text-gray-500 mt-1 ml-14">Gestiona envíos y recepciones entre sucursales.</p>
        </div>
        
        <div className="flex bg-gray-100 p-1.5 rounded-xl shadow-inner">
          <button onClick={() => setActiveTab('new')} className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'new' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}>
            <HiOutlinePaperAirplane className={activeTab === 'new' ? 'rotate-90' : ''}/> Nuevo Envío
          </button>
          <button onClick={() => setActiveTab('history')} className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}>
            <HiOutlineInboxIn /> Historial y Recepción
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL CON EFECTO FADE-IN */}
      <div className="flex-1 min-h-0 relative animate-fade-in-up">
        
        {/* PESTAÑA: NUEVO ENVÍO */}
        {activeTab === 'new' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-0 print:hidden">
               
               {/* COLUMNA IZQUIERDA: CONFIGURACIÓN Y BÚSQUEDA (7/12) */}
               <div className="lg:col-span-7 flex flex-col gap-6 min-h-0">
                  
                  {/* TARJETA 1: DATOS DEL ENVÍO */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                     <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span> 1. Configurar Ruta
                     </h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {!activeShift && (
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Origen (Modo Admin)</label>
                                <div className="relative">
                                    <select value={selectedSource} onChange={(e) => { setSelectedSource(e.target.value); setSearchResults([]); setCart([]); }} className="w-full pl-10 pr-4 py-3 bg-yellow-50 border border-yellow-200 rounded-xl text-gray-700 focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none appearance-none font-medium">
                                        <option value="">-- Selecciona Origen --</option>
                                        {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                                    </select>
                                    <HiOutlineOfficeBuilding className="absolute left-3 top-3.5 text-yellow-500 text-lg" />
                                </div>
                            </div>
                        )}
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Destino</label>
                          <div className="relative">
                              <select value={selectedDestination} onChange={(e) => setSelectedDestination(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none appearance-none font-medium transition-all">
                                <option value="">-- Seleccionar --</option>
                                {locations.filter(l => l.id != (activeShift?.location?.id || selectedSource)).map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                              </select>
                              <HiOutlineTruck className="absolute left-3 top-3.5 text-gray-400 text-lg" />
                          </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Nota / Referencia</label>
                            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="Ej: Urgente, pedido semanal..." />
                        </div>
                     </div>
                  </div>

                  {/* TARJETA 2: BUSCADOR DE PRODUCTOS */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col min-h-0">
                     <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span> 2. Agregar Productos
                     </h3>
                     <div className="flex gap-3 mb-4">
                        <div className="relative flex-1">
                            <input 
                                type="text" 
                                placeholder="Escribe para buscar (Nombre o SKU)..." 
                                value={productSearch} 
                                onChange={(e) => setProductSearch(e.target.value)} 
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner" 
                                autoFocus 
                            />
                            <HiOutlineSearch className="absolute left-3 top-3.5 text-gray-400 text-lg" />
                            
                            {/* Indicador de carga sutil (opcional) */}
                            {productSearch && searchResults.length === 0 && (
                                <div className="absolute right-3 top-3.5">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
                                </div>
                            )}
                        </div>
                     </div>
                     
                     <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                        {searchResults.length === 0 && !productSearch && <div className="text-center text-gray-400 mt-10">Busca productos para agregarlos al envío.</div>}
                        {searchResults.map(prod => (
                            <div key={prod.id} className="group flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:border-indigo-200 hover:bg-indigo-50/30 transition-all">
                               <div className="flex-1">
                                   <p className="font-bold text-gray-800">{prod.name}</p>
                                   <p className="text-xs text-gray-500 font-mono mt-0.5">SKU: {prod.sku} | <span className={prod.stock_quantity > 0 ? "text-green-600 font-bold" : "text-red-500 font-bold"}>{prod.stock_quantity > 0 ? `Stock: ${prod.stock_quantity}` : "SIN STOCK"}</span></p>
                               </div>
                               <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                                   <input type="number" min="1" className="w-16 p-1.5 text-center font-bold text-gray-700 outline-none bg-transparent" placeholder="1" value={quantities[prod.id] || ''} onChange={(e) => setQuantities({...quantities, [prod.id]: e.target.value})} onClick={(e) => e.stopPropagation()}/>
                                   <button onClick={() => addToCart(prod)} disabled={prod.stock_quantity <= 0} className="p-2 bg-indigo-100 text-indigo-600 rounded-md hover:bg-indigo-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                      <HiOutlinePlus className="text-lg" />
                                   </button>
                               </div>
                            </div>
                        ))}
                     </div>
                  </div>
               </div>

               {/* COLUMNA DERECHA: CARRITO (5/12) */}
               <div className="lg:col-span-5 h-full min-h-0">
                  <div className="bg-white p-6 rounded-2xl shadow-lg border border-indigo-100 flex flex-col h-full relative overflow-hidden">
                     {/* Decoración de fondo */}
                     <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-10 -mt-10 z-0"></div>

                     <h3 className="font-bold text-gray-800 mb-6 pb-4 border-b flex items-center justify-between relative z-10">
                        <span className="flex items-center gap-2"><HiOutlineInboxIn className="text-indigo-600 text-xl"/> Paquete a Enviar</span>
                        <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">{cart.reduce((acc, i) => acc + i.quantity, 0)} Items</span>
                     </h3>

                     <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2 custom-scrollbar relative z-10">
                        {cart.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <HiOutlineArchive className="text-5xl mb-2 opacity-20"/>
                                <p>El paquete está vacío.</p>
                            </div>
                        )}
                        {cart.map((item, index) => (
                           <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100 group hover:border-red-200 transition-colors">
                              <div>
                                 <p className="font-bold text-gray-800 text-sm">{item.product.name}</p>
                                 <p className="text-xs text-gray-500 font-mono mt-0.5">{item.product.sku}</p>
                              </div>
                              <div className="flex items-center gap-4">
                                  <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md text-sm">x{item.quantity}</span>
                                  <button onClick={() => removeFromCart(index)} className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-50">
                                      <HiOutlineTrash className="text-lg" />
                                  </button>
                              </div>
                           </div>
                        ))}
                     </div>

                     <button onClick={handleInitiateCreate} disabled={cart.length === 0} className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 relative z-10">
                        CONFIRMAR ENVÍO <HiOutlineArrowRight />
                     </button>
                  </div>
               </div>
          </div>
        )}

        {/* PESTAÑA: HISTORIAL */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col h-full print:hidden">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha / ID</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Ruta</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Contenido</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {transfersList.map((transfer) => {
                    const isAdmin = user.role === 'admin'; 
                    const myShift = activeShift;
                    const myLocId = Number(myShift?.location?.id || myShift?.location_id);
                    const destId = Number(transfer.destination_location_id);
                    const destLocationObj = allLocations.find(l => l.id === destId);
                    const destParentId = destLocationObj?.parent_id;
                    const amIAtDestination = myLocId === destId;
                    const amIParent = destParentId === myLocId; 
                    const canReceive = transfer.status === 'PENDIENTE' && (isAdmin || amIAtDestination || amIParent);
                    
                    return (
                      <tr key={transfer.id} className="hover:bg-indigo-50/30 transition-colors group">
                        <td className="px-6 py-4">
                            <div className="flex flex-col">
                                <span className="font-mono font-bold text-indigo-600">#{String(transfer.id).padStart(5, '0')}</span>
                                <span className="text-xs text-gray-400">{new Date(transfer.created_at).toLocaleDateString()}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span className="w-2 h-2 rounded-full bg-red-400"></span> De: <span className="font-semibold text-gray-700">{transfer.source_location_name}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span className="w-2 h-2 rounded-full bg-green-400"></span> A: <span className="font-semibold text-gray-700">{transfer.destination_location_name}</span>
                              </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                              transfer.status === 'PENDIENTE' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                              transfer.status === 'ACEPTADO' ? 'bg-green-50 text-green-700 border-green-200' :
                              transfer.status === 'ACEPTADO_PARCIAL' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              'bg-red-50 text-red-700 border-red-200'
                          }`}>
                              {transfer.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                            <div className="text-sm text-gray-600">
                                <span className="font-bold">{transfer.items.length}</span> productos
                            </div>
                            {transfer.note && <p className="text-xs text-gray-400 italic max-w-[200px] truncate">{transfer.note}</p>}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-2">
                              {/* Botón Imprimir (Siempre visible) */}
                              <button onClick={() => handlePrint(transfer)} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-transparent hover:border-indigo-100 transition-all" title="Imprimir Manifiesto">
                                  <HiPrinter className="text-lg"/>
                              </button>

                              {/* NUEVO: Botón Ver Detalles (Solo si ya fue procesada) */}
                              {transfer.status !== 'PENDIENTE' && (
                                <button 
                                  onClick={() => { setSelectedTransfer(transfer); setActionType('view_details'); }} 
                                  className="p-2 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg border border-transparent hover:border-teal-100 transition-all" 
                                  title="Ver Detalles de Recepción"
                                >
                                    <HiEye className="text-lg"/>
                                </button>
                              )}
                              
                              {/* Botones de Acción (Solo si está pendiente y tengo permiso) */}
                              {canReceive && (
                                  <>
                                      <button onClick={() => handleOpenReception(transfer)} className="p-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md hover:shadow-lg transition-all" title="Cotejar y Recibir">
                                          <HiClipboardCheck className="text-lg"/>
                                      </button>
                                      <button onClick={() => handleReject(transfer)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-all" title="Rechazar Todo">
                                          <HiOutlineXCircle className="text-lg"/>
                                      </button>
                                  </>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* --- MODAL DE CHECKLIST DE RECEPCIÓN (ESTILO MODERNO) --- */}
      {actionType === 'receive_checklist' && selectedTransfer && (
          <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh] overflow-hidden transform transition-all scale-100">
                  {/* Modal Header */}
                  <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                      <div>
                        <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                           <HiClipboardCheck className="text-blue-600"/> Verificar Mercadería
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                           Envío <span className="font-mono font-bold text-gray-700">#{String(selectedTransfer.id).padStart(5,'0')}</span> desde <span className="font-bold">{selectedTransfer.source_location_name}</span>
                        </p>
                      </div>
                      <button onClick={() => setActionType('')} className="p-2 bg-white text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition border border-gray-200 shadow-sm">
                         <HiOutlineXCircle className="text-xl"/>
                      </button>
                  </div>
                  
                  {/* Modal Body */}
                  <div className="p-0 overflow-y-auto flex-1 bg-gray-50/50">
                      <table className="w-full text-left border-collapse">
                          <thead className="text-xs font-bold uppercase text-gray-500 bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
                              <tr>
                                  <th className="px-6 py-4">Producto</th>
                                  <th className="px-6 py-4 text-center w-24 bg-gray-50">Enviado</th>
                                  <th className="px-6 py-4 text-center w-32 bg-blue-50 text-blue-700 border-x border-blue-100">Recibido</th>
                                  <th className="px-6 py-4">Observación</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                              {selectedTransfer.items.map(item => {
                                  const currentData = receptionItems[item.id] || { qty: 0, note: '' };
                                  const isMissing = currentData.qty < item.quantity;
                                  
                                  return (
                                      <tr key={item.id} className={`transition-colors ${isMissing ? "bg-orange-50/30" : "hover:bg-gray-50"}`}>
                                          <td className="px-6 py-4">
                                             <p className="font-bold text-gray-700 text-sm">{item.product_name}</p>
                                          </td>
                                          <td className="px-6 py-4 text-center">
                                             <span className="inline-block w-8 h-8 leading-8 rounded-full bg-gray-100 text-gray-600 font-bold text-sm border border-gray-200">
                                                {item.quantity}
                                             </span>
                                          </td>
                                          <td className="px-6 py-4 text-center bg-blue-50/30 border-x border-dashed border-blue-100">
                                              <input 
                                                  type="number" 
                                                  min="0" 
                                                  max={item.quantity}
                                                  value={currentData.qty}
                                                  onChange={(e) => {
                                                      const val = Math.min(Math.max(0, parseInt(e.target.value) || 0), item.quantity);
                                                      setReceptionItems({
                                                          ...receptionItems,
                                                          [item.id]: { ...currentData, qty: val }
                                                      });
                                                  }}
                                                  className={`w-16 py-2 px-1 border-2 rounded-lg text-center font-bold outline-none text-lg transition-all focus:ring-2 focus:ring-offset-1 ${
                                                      isMissing 
                                                      ? 'border-orange-300 text-orange-600 focus:ring-orange-200 bg-white' 
                                                      : 'border-green-500 text-green-700 focus:ring-green-200 bg-green-50'
                                                  }`}
                                              />
                                          </td>
                                          <td className="px-6 py-4">
                                              <input 
                                                  type="text" 
                                                  placeholder={isMissing ? "Describa el faltante..." : "Todo ok"}
                                                  value={currentData.note}
                                                  onChange={(e) => setReceptionItems({
                                                      ...receptionItems,
                                                      [item.id]: { ...currentData, note: e.target.value }
                                                  })}
                                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-all"
                                              />
                                          </td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-6 border-t border-gray-100 bg-white flex justify-between items-center">
                      <div className="text-xs text-gray-400">
                         * Revisa cuidadosamente las cantidades físicas antes de confirmar.
                      </div>
                      <div className="flex gap-3">
                          <button onClick={() => setActionType('')} className="px-6 py-3 text-gray-500 hover:bg-gray-100 rounded-xl font-bold transition">
                             Cancelar
                          </button>
                          <button onClick={confirmChecklist} className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:shadow-xl transition-all transform active:scale-95 flex items-center gap-2">
                              <HiCheckCircle className="text-xl"/> Confirmar Recepción
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- NUEVO: MODAL VER DETALLES (AUDITORÍA) --- */}
      {actionType === 'view_details' && selectedTransfer && (
          <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh] overflow-hidden transform transition-all scale-100">
                  <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                      <div>
                        <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                           <HiClipboardCheck className="text-teal-600"/> Detalles de Recepción
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                           Estado Final: <span className={`font-bold ${selectedTransfer.status.includes('ACEPTADO') ? 'text-green-600' : 'text-red-600'}`}>{selectedTransfer.status.replace('_', ' ')}</span>
                        </p>
                      </div>
                      <button onClick={() => setActionType('')} className="p-2 bg-white text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition border border-gray-200 shadow-sm">
                         <HiOutlineXCircle className="text-xl"/>
                      </button>
                  </div>
                  
                  <div className="p-0 overflow-y-auto flex-1 bg-white">
                      <table className="w-full text-left border-collapse">
                          <thead className="text-xs font-bold uppercase text-gray-500 bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                              <tr>
                                  <th className="px-6 py-4">Producto</th>
                                  <th className="px-6 py-4 text-center">Enviado</th>
                                  <th className="px-6 py-4 text-center">Recibido</th>
                                  <th className="px-6 py-4">Notas de Recepción</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {selectedTransfer.items.map(item => {
                                  const received = item.received_quantity !== null ? item.received_quantity : 0;
                                  const isIncomplete = received < item.quantity;
                                  
                                  return (
                                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                          <td className="px-6 py-4">
                                             <p className="font-bold text-gray-700 text-sm">{item.product_name}</p>
                                          </td>
                                          <td className="px-6 py-4 text-center text-gray-500 font-medium">
                                             {item.quantity}
                                          </td>
                                          <td className="px-6 py-4 text-center">
                                              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                                                  isIncomplete 
                                                  ? 'bg-red-100 text-red-700' 
                                                  : 'bg-green-100 text-green-700'
                                              }`}>
                                                  {received}
                                              </span>
                                          </td>
                                          <td className="px-6 py-4 text-sm text-gray-600 italic">
                                              {item.reception_note || "-"}
                                          </td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>
                  <div className="p-6 border-t border-gray-100 bg-gray-50">
                    <p className="text-xs text-gray-500 font-bold uppercase mb-1">Bitácora General:</p>
                    <p className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-200">{selectedTransfer.note || "Sin notas adicionales."}</p>
                  </div>
              </div>
          </div>
      )}

      {/* --- MODAL PIN (ESTILO COHERENTE) --- */}
      {isPinModalOpen && (
        <div className="fixed inset-0 bg-gray-900/80 flex items-center justify-center z-[60] backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 transform transition-all scale-100">
            <h3 className="text-xl font-extrabold text-center text-gray-800 mb-2">Firma Digital</h3>
            <p className="text-center text-gray-500 text-sm mb-6">Ingresa tu PIN de seguridad para autorizar.</p>
            
            <input 
                type="password" 
                autoFocus 
                className="w-full h-16 text-center text-4xl font-bold border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none tracking-[0.5em] text-indigo-900 mb-8 transition-all" 
                placeholder="••••" 
                maxLength={4}
                value={tempPin} 
                onChange={(e)=>setTempPin(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && tempPin && onPinSuccess(tempPin)}
            />
            
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => {setIsPinModalOpen(false); setTempPin('')}} className="px-4 py-3 rounded-xl text-gray-500 font-bold hover:bg-gray-100 transition">
                    Cancelar
                </button>
                <button onClick={() => onPinSuccess(tempPin)} className="px-4 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition transform active:scale-95">
                    Confirmar
                </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default TransfersPage;