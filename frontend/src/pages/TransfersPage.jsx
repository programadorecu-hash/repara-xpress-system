// frontend/src/pages/TransfersPage.jsx

import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  HiOutlineSearch, HiOutlinePlus, HiOutlineTrash, HiOutlineArrowRight, 
  HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineInboxIn, HiOutlinePaperAirplane,
  HiOutlineSwitchHorizontal, HiPrinter, HiClipboardCheck, HiExclamation
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
      const data = await getLocations();
      setAllLocations(data); // Guardamos la lista completa para referencia
      
      if (activeShift) {
        // En el selector, ocultamos la propia para no enviarse a sí mismo
        setLocations(data.filter(l => l.id !== activeShift.location?.id));
      } else {
        setLocations(data);
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

  // --- LÓGICA DE BÚSQUEDA Y CARRITO (Igual que antes) ---
  const handleSearchProduct = async (e) => {
    e.preventDefault();
    if (!productSearch.trim()) return;
    const sourceLocationId = activeShift?.location?.id || selectedSource;
    if (!sourceLocationId) return toast.warning("Selecciona una sucursal de origen primero");

    try {
      const data = await getProducts({ search: productSearch, location_id: sourceLocationId });
      setSearchResults(data);
    } catch (error) { console.error(error); }
  };

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
          // 1. Pedimos al token actual
          const token = localStorage.getItem('accessToken');
          // 2. Construimos la URL segura
          const url = `${import.meta.env.VITE_API_URL}/transfers/${transfer.id}/print-manifest`;

          // 3. Abrimos el PDF. 
          // Truco: Para enviar el token en una nueva pestaña, a veces es complejo.
          // Opción A (Simple): window.open(url + "?token=" + token) -> REQUIERE CAMBIO EN BACKEND (INSEGURO)
          // Opción B (Fetch Blob): Descargamos y mostramos. -> MEJOR Y MÁS SEGURO.

          const response = await fetch(url, {
              headers: { 'Authorization': `Bearer ${token}` }
          });

          if (!response.ok) throw new Error("Error al generar PDF");

          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          window.open(blobUrl, '_blank'); // Abre el PDF listo para imprimir (Ctrl+P)

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
        // Preparamos el payload DETALLADO
        const itemsPayload = Object.keys(receptionItems).map(itemId => ({
            item_id: parseInt(itemId),
            received_quantity: parseInt(receptionItems[itemId].qty),
            note: receptionItems[itemId].note
        }));

        // Detectar si falta algo para cambiar el estado
        let finalStatus = "ACEPTADO";
        const hasMissing = itemsPayload.some(i => {
            const original = selectedTransfer.items.find(t => t.id === i.item_id);
            return i.received_quantity < original.quantity;
        });
        if (hasMissing) finalStatus = "ACEPTADO_PARCIAL";

        await receiveTransfer(selectedTransfer.id, {
          status: finalStatus,
          pin,
          items: itemsPayload
        });
        toast.success(`Recepción registrada: ${finalStatus}`);
        setActionType(''); // Cerrar todo
        loadTransfersHistory();

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
    <div className="flex flex-col h-full bg-gray-50/50 p-2 md:p-6 gap-6 relative">
      
      

      {/* HEADER Y TABS (Igual que antes) */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <HiOutlineSwitchHorizontal className="text-brand" /> Transferencias
          </h1>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button onClick={() => setActiveTab('new')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'new' ? 'bg-white text-brand shadow-sm' : 'text-gray-500'}`}>Nuevo Envío</button>
          <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-white text-brand shadow-sm' : 'text-gray-500'}`}>Historial</button>
        </div>
      </div>

      {/* PESTAÑA: NUEVO ENVÍO (Lógica intacta, solo render) */}
      {activeTab === 'new' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0 print:hidden">
             {/* ... (Aquí va tu código de búsqueda y carrito, igual que antes. Lo resumo para no exceder caracteres, PEGA LO TUYO AQUÍ SI ES NECESARIO, PERO USA EL handleSearchProduct y addToCart ACTUALIZADOS ARRIBA) ... */}
             {/* COPIA AQUÍ EL CONTENIDO DE LA PESTAÑA 'NEW' QUE YA TENÍAS FUNCIONANDO */}
             <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
               <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="font-semibold text-gray-700 mb-4">Datos del Envío</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {!activeShift && (
                        <div className="md:col-span-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-2">
                            <label className="block text-sm font-bold text-yellow-800 mb-1">📍 Origen (Admin)</label>
                            <select value={selectedSource} onChange={(e) => { setSelectedSource(e.target.value); setSearchResults([]); setCart([]); }} className="w-full border border-yellow-300 rounded-lg p-2.5 outline-none">
                                <option value="">-- Selecciona Origen --</option>
                                {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Destino</label>
                      <select value={selectedDestination} onChange={(e) => setSelectedDestination(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none">
                        <option value="">-- Seleccionar --</option>
                        {locations.filter(l => l.id != (activeShift?.location?.id || selectedSource)).map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                      </select>
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-gray-600 mb-1">Nota</label>
                       <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none" />
                    </div>
                  </div>
               </div>
               <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col min-h-0">
                  <form onSubmit={handleSearchProduct} className="flex gap-2 mb-4">
                     <input type="text" placeholder="Buscar..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="flex-1 border border-gray-300 rounded-lg p-2.5 outline-none" autoFocus />
                     <button type="submit" className="bg-brand text-white px-4 rounded-lg"><HiOutlineSearch /></button>
                  </form>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                     {searchResults.map(prod => (
                         <div key={prod.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                             <div className="flex-1">
                                 <p className="font-medium">{prod.name}</p>
                                 <p className="text-xs text-gray-500">Stock: {prod.stock_quantity}</p>
                             </div>
                             <div className="flex items-center gap-2">
                                 <input type="number" min="1" className="w-16 p-2 border rounded-lg text-center" value={quantities[prod.id] || ''} onChange={(e) => setQuantities({...quantities, [prod.id]: e.target.value})} onClick={(e) => e.stopPropagation()}/>
                                 <button onClick={() => addToCart(prod)} disabled={prod.stock_quantity <= 0} className="p-2 bg-blue-50 text-blue-600 rounded-full"><HiOutlinePlus /></button>
                             </div>
                         </div>
                     ))}
                  </div>
               </div>
             </div>
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
                <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">📦 Paquete ({cart.reduce((acc, i) => acc + i.quantity, 0)})</h3>
                <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                    {cart.map((item, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <div><p className="font-medium">{item.product.name}</p><p className="text-xs text-gray-500">Cant: {item.quantity}</p></div>
                            <button onClick={() => removeFromCart(index)} className="text-red-500"><HiOutlineTrash /></button>
                        </div>
                    ))}
                </div>
                <button onClick={handleInitiateCreate} disabled={cart.length === 0} className="w-full bg-brand text-white py-3 rounded-xl font-bold">Confirmar Envío</button>
             </div>
        </div>
      )}

      {/* --- PESTAÑA: HISTORIAL --- */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col print:hidden">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-semibold">
                <tr>
                  <th className="px-6 py-4">Fecha/ID</th>
                  <th className="px-6 py-4">Ruta</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Items</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transfersList.map((transfer) => {
                  // LÓGICA DE PERMISOS DE RECEPCIÓN (V3 - DEFINITIVA)
                  let isMyDestination = false;

                  if (user.role === 'admin') {
                      isMyDestination = true; // Admin puede todo
                  } 
                  else if (activeShift) {
                      const myLocId = activeShift.location?.id;

                      // CASO 1: Soy la bodega destino (Exacto)
                      if (myLocId === transfer.destination_location_id) {
                          isMyDestination = true;
                      }
                      // CASO 2: Soy la OFICINA PADRE de la bodega destino
                      else {
                          // Buscamos en la lista completa quién es el destino
                          const destLocation = allLocations.find(l => l.id === transfer.destination_location_id);
                          // Si el destino existe Y su padre soy YO (mi ID de turno)
                          if (destLocation && destLocation.parent_id === myLocId) {
                              isMyDestination = true;
                          }
                      }
                  }

                  const canReceive = isMyDestination && transfer.status === 'PENDIENTE';
                  
                  return (
                    <tr key={transfer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                          <span className="font-bold text-gray-800">#{transfer.id}</span><br/>
                          {new Date(transfer.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-400">De: {transfer.source_location_name}</span>
                            <span className="text-xs text-gray-400">Para: {transfer.destination_location_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                            transfer.status === 'PENDIENTE' ? 'bg-yellow-100 text-yellow-700' :
                            transfer.status === 'ACEPTADO' ? 'bg-green-100 text-green-700' :
                            transfer.status === 'ACEPTADO_PARCIAL' ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                        }`}>
                            {transfer.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs">
                          {transfer.items.length} productos.<br/>
                          <span className="italic">{transfer.note}</span>
                      </td>
                      <td className="px-6 py-4 text-center flex justify-center gap-2">
                        <button onClick={() => handlePrint(transfer)} className="p-2 text-gray-500 hover:text-brand hover:bg-gray-100 rounded-lg tooltip" title="Imprimir Manifiesto">
                            <HiPrinter className="text-xl"/>
                        </button>
                        
                        {canReceive && (
                            <>
                                <button onClick={() => handleOpenReception(transfer)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg tooltip" title="Cotejar y Recibir">
                                    <HiClipboardCheck className="text-xl"/>
                                </button>
                                <button onClick={() => handleReject(transfer)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg tooltip" title="Rechazar Todo">
                                    <HiOutlineXCircle className="text-xl"/>
                                </button>
                            </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- MODAL DE CHECKLIST DE RECEPCIÓN --- */}
      {actionType === 'receive_checklist' && selectedTransfer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm print:hidden">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                      <div>
                        <h2 className="text-xl font-bold text-gray-800">Verificar Mercadería</h2>
                        <p className="text-sm text-gray-500">Envío #{selectedTransfer.id} de {selectedTransfer.source_location_name}</p>
                      </div>
                      <button onClick={() => setActionType('')} className="text-gray-400 hover:text-gray-600"><HiOutlineXCircle className="text-3xl"/></button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1">
                      <table className="w-full text-left border-collapse">
                          <thead className="text-xs uppercase text-gray-500 bg-gray-50 sticky top-0">
                              <tr>
                                  <th className="p-3">Producto</th>
                                  <th className="p-3 text-center">Enviado</th>
                                  <th className="p-3 text-center w-24">Recibido</th>
                                  <th className="p-3">Nota / Novedad</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y">
                              {selectedTransfer.items.map(item => {
                                  const currentData = receptionItems[item.id] || { qty: 0, note: '' };
                                  const isMissing = currentData.qty < item.quantity;
                                  
                                  return (
                                      <tr key={item.id} className={isMissing ? "bg-orange-50/50" : ""}>
                                          <td className="p-3 font-medium text-gray-700">{item.product_name}</td>
                                          <td className="p-3 text-center text-gray-500">{item.quantity}</td>
                                          <td className="p-3 text-center">
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
                                                  className={`w-16 p-2 border rounded-lg text-center font-bold outline-none ${isMissing ? 'border-orange-500 text-orange-600 bg-white' : 'border-green-500 text-green-600 bg-green-50'}`}
                                              />
                                          </td>
                                          <td className="p-3">
                                              <input 
                                                  type="text" 
                                                  placeholder={isMissing ? "Describa el faltante..." : "Todo ok"}
                                                  value={currentData.note}
                                                  onChange={(e) => setReceptionItems({
                                                      ...receptionItems,
                                                      [item.id]: { ...currentData, note: e.target.value }
                                                  })}
                                                  className="w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand"
                                              />
                                          </td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>

                  <div className="p-6 border-t bg-gray-50 rounded-b-2xl flex justify-end gap-3">
                      <button onClick={() => setActionType('')} className="px-6 py-2 text-gray-600 hover:bg-gray-200 rounded-xl font-medium">Cancelar</button>
                      <button onClick={confirmChecklist} className="px-6 py-2 bg-brand text-white hover:bg-brand-dark rounded-xl font-bold shadow-lg shadow-brand/20 flex items-center gap-2">
                          <HiClipboardCheck /> Confirmar Recepción
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- MODAL PIN --- */}
      {isPinModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-xl font-bold text-center mb-2">Firma de Seguridad</h3>
            <input type="password" autoFocus className="w-full text-center text-3xl font-bold border-b-2 border-gray-300 py-2 mb-6 outline-none" placeholder="••••" value={tempPin} onChange={(e)=>setTempPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && tempPin && onPinSuccess(tempPin)}/>
            <div className="grid grid-cols-2 gap-3">
                <button onClick={() => {setIsPinModalOpen(false); setTempPin('')}} className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100">Cancelar</button>
                <button onClick={() => onPinSuccess(tempPin)} className="px-4 py-2 rounded-xl bg-brand text-white font-bold">Confirmar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default TransfersPage;