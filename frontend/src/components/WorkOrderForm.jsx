import React, { useState, useEffect, useRef } from "react";
import api, { deliverWorkOrderUnrepaired, deleteWorkOrderImage } from "../services/api";
import PatternLockModal from "./PatternLockModal"; // <--- IMPORTANTE
import { HiOutlineSearch } from "react-icons/hi"; // <--- Importamos la lupa

// --- COMPONENTE DE SLOT DE FOTO (MEJORADO: CON ZOOM) ---
const PhotoSlot = ({ index, image, orderId, onUpload, onView }) => {
  const [showOptions, setShowOptions] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Estados para cámara
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Generamos un tag automático: foto_1, foto_2, etc.
  const tag = `foto_${index + 1}`;

  // Función genérica de subida
  const uploadFile = async (fileArg, suggestedName) => {
    if (!orderId) return;
    setIsUploading(true);
    const formData = new FormData();
    
    // Empaquetamos el archivo
    let finalFile;
    if (fileArg instanceof File) {
      finalFile = new File([fileArg], suggestedName || fileArg.name, { type: fileArg.type });
    } else {
      finalFile = new File([fileArg], suggestedName || `${tag}_${Date.now()}.jpg`, { type: "image/jpeg" });
    }

    formData.append("file", finalFile);
    formData.append("tag", tag); // Tag automático

    try {
      const response = await api.post(`/work-orders/${orderId}/upload-image/`, formData);
      onUpload(response.data.images); // Actualizamos la lista de fotos en el formulario padre
      setShowOptions(false);
    } catch (error) {
      console.error(error);
      alert("Error al subir imagen");
    } finally {
      setIsUploading(false);
    }
  };

  // Función de borrado (NUEVA)
  const handleDelete = async (e) => {
    e.stopPropagation(); // Evitar abrir el menú
    if (!confirm("¿Borrar esta foto permanentemente?")) return;
    
    try {
        setIsUploading(true);
        // Llamamos a la API para borrar
        await deleteWorkOrderImage(image.id);
        
        // Recargamos la orden para refrescar la lista de imágenes
        const response = await api.get(`/work-orders/${orderId}`);
        onUpload(response.data.images); 
        
    } catch (error) {
        alert("Error al borrar imagen.");
    } finally {
        setIsUploading(false);
    }
  };

  // 1. Manejo de archivo local
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  // 2. Manejo de cámara
  const openCamera = async () => {
    setIsCameraOpen(true);
    try {
      // SOLICITAMOS MÁXIMA RESOLUCIÓN POSIBLE (HD/4K)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
            facingMode: "environment",
            width: { ideal: 4096 }, // Pedimos 4K idealmente
            height: { ideal: 2160 } 
        } 
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("No se pudo acceder a la cámara. Revisa permisos.");
      setIsCameraOpen(false);
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      // 1. Usamos la resolución nativa máxima que nos da el video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // 2. Dibujamos con suavizado de imagen desactivado para más nitidez en bordes
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false; 
      ctx.drawImage(video, 0, 0);

      // 3. Guardamos con CALIDAD MÁXIMA (1.0) en lugar de 0.8
      canvas.toBlob(blob => {
        uploadFile(blob);
        closeCamera();
      }, "image/jpeg", 1.0); // <--- AQUÍ ESTÁ EL CAMBIO CLAVE (1.0 es 100% calidad)
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setIsCameraOpen(false);
  };

  // --- RENDERIZADO DEL SLOT ---
  
  // CASO A: Ya hay foto -> Mostrarla
  if (image) {
    return (
      <div 
        className="relative w-24 h-24 rounded-lg overflow-hidden shadow-sm border border-gray-200 group bg-gray-100 cursor-zoom-in hover:shadow-md transition-shadow"
        onClick={() => onView && onView(image)}
      >
        <img 
          src={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}${image.image_url}`} 
          alt={image.tag}
          className="w-full h-full object-cover"
        />
        {/* Botón Borrar (Papelera) */}
        <button 
            onClick={handleDelete}
            className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-700 transition-colors z-10"
            title="Borrar foto"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
        </button>

        {/* Etiqueta pequeña */}
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-[10px] text-center truncate px-1 py-0.5">
          Foto {index + 1}
        </div>

        {isUploading && (
            <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center">
                <span className="text-xs text-gray-600 animate-pulse">...</span>
            </div>
        )}
      </div>
    );
  }

  // CASO B: No hay foto -> Mostrar botón "+"
  return (
    <>
      <div 
        className="relative w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-accent hover:bg-teal-50 transition-colors bg-white"
        onClick={() => !isUploading && orderId && setShowOptions(true)}
        title={orderId ? "Añadir foto" : "Guarda la orden primero"}
      >
        {isUploading ? (
          <span className="text-[10px] text-gray-400 animate-pulse">Subiendo...</span>
        ) : (
          <>
            <span className="text-3xl text-gray-300 font-light group-hover:text-accent">+</span>
            <span className="text-[10px] text-gray-400 mt-1">Foto {index + 1}</span>
          </>
        )}
        
        {/* Menú desplegable (Archivo / Cámara) dentro del cuadradito */}
        {showOptions && (
          <div className="absolute inset-0 bg-white z-10 flex flex-col items-center justify-center p-1 rounded-lg animate-fade-in-down shadow-inner">
             <button 
               onClick={(e) => { e.stopPropagation(); fileInputRef.current.click(); }}
               className="text-[10px] bg-gray-100 hover:bg-gray-200 w-full py-1 mb-1 rounded text-gray-700 font-medium border"
             >
               📁 Archivo
             </button>
             <button 
               onClick={(e) => { e.stopPropagation(); openCamera(); }}
               className="text-[10px] bg-accent text-white hover:opacity-90 w-full py-1 mb-1 rounded font-medium"
             >
               📷 Cámara
             </button>
             <button 
               onClick={(e) => { e.stopPropagation(); setShowOptions(false); }}
               className="text-[9px] text-red-400 hover:text-red-600 underline"
             >
               Cancelar
             </button>
          </div>
        )}
      </div>

      {/* Input oculto para archivo */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileSelect} 
      />

      {/* Modal de Cámara (Pantalla completa sobre el slot) */}
      {isCameraOpen && (
        <div className="fixed inset-0 bg-black z-[70] flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md bg-black rounded-lg overflow-hidden relative shadow-2xl border border-gray-700">
            <video ref={videoRef} autoPlay playsInline className="w-full h-64 bg-gray-900 object-contain" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex justify-center gap-4 p-4 bg-gray-900">
               <button onClick={closeCamera} className="bg-gray-700 text-white px-4 py-2 rounded text-sm hover:bg-gray-600">Cancelar</button>
               <button onClick={takePhoto} className="bg-white text-black font-bold px-6 py-2 rounded-full ring-4 ring-gray-500 hover:scale-105 transition-transform">CAPTURAR</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// --- COMPONENTE CHECKLIST ITEM (REUTILIZADO) ---
const CheckListItem = ({ label, name, value, onChange, disabled }) => (
  <div className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100">
    <label htmlFor={name} className="text-sm font-medium text-gray-700">
      {label}
    </label>
    <div className="flex items-center space-x-2">
      <input type="radio" id={`${name}-si`} name={name} value="si" checked={value === "si"} onChange={onChange} disabled={disabled} className="h-4 w-4 text-accent focus:ring-accent" />
      <label htmlFor={`${name}-si`} className="text-xs mr-2">Sí</label>
      
      <input type="radio" id={`${name}-no`} name={name} value="no" checked={value === "no"} onChange={onChange} disabled={disabled} className="h-4 w-4 text-red-500 focus:ring-red-500" />
      <label htmlFor={`${name}-no`} className="text-xs mr-2">No</label>
      
      <input type="radio" id={`${name}-na`} name={name} value="na" checked={value === "na"} onChange={onChange} disabled={disabled} className="h-4 w-4 text-gray-400 focus:ring-gray-400" />
      <label htmlFor={`${name}-na`} className="text-xs">N/A</label>
    </div>
  </div>
);

// --- COMPONENTE PRINCIPAL DEL FORMULARIO ---

function WorkOrderForm({ orderId, onClose, onSave }) {
  // --- Estado para el modal de "Entregar Sin Reparar" ---
  const [showUnrepaired, setShowUnrepaired] = useState(false);
  const [unrepairedData, setUnrepairedData] = useState({ fee: 2.00, reason: "Cliente retiró sin reparar", pin: "" });
  // Estado para el modal de patrón
  const [showPatternModal, setShowPatternModal] = useState(false);

  // --- LÓGICA DE BÚSQUEDA INTELIGENTE DE CLIENTE ---
  const [customerCandidates, setCustomerCandidates] = useState([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  const handleSearchCustomer = async (queryType) => {
    // Definimos qué texto buscar según el botón presionado
    const query = queryType === 'ci' ? order.customer_id_card : order.customer_name;
    
    if (!query || query.trim().length < 3) {
      alert("Por favor escribe al menos 3 caracteres para buscar.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.get('/customers/', { params: { search: query } });
      const results = response.data;

      if (results.length === 0) {
        alert("No se encontró ningún cliente registrado con esos datos.");
      } else if (results.length === 1) {
        // Solo 1 resultado: Llenado automático
        selectCustomer(results[0]);
      } else {
        // Varios resultados: Mostrar lista para elegir
        setCustomerCandidates(results);
        setShowCustomerModal(true);
      }
    } catch (error) {
      console.error("Error buscando cliente:", error);
      alert("Ocurrió un error al buscar.");
    } finally {
      setLoading(false);
    }
  };

  const selectCustomer = (customer) => {
    // Rellenamos SOLO los datos del cliente
    setOrder(prev => ({
      ...prev,
      customer_name: customer.name,
      customer_id_card: customer.id_card,
      customer_phone: customer.phone || "",
      customer_address: customer.address || "",
      customer_email: customer.email || ""
    }));
    setShowCustomerModal(false);
  };
  // ------------------------------------------------

  const handleUnrepairedSubmit = async () => {
    try {
      setLoading(true);
      // 1. Enviamos el cobro y cerramos la orden en el servidor
      await deliverWorkOrderUnrepaired(orderId, {
        diagnostic_fee: unrepairedData.fee,
        reason: unrepairedData.reason,
        pin: unrepairedData.pin
      });
      
      // 2. Intentamos imprimir el COMPROBANTE DE RETIRO automáticamente
      try {
        const response = await api.get(`/work-orders/${orderId}/print-withdrawal`, { responseType: "blob" });
        const fileURL = window.URL.createObjectURL(response.data);
        window.open(fileURL, "_blank"); // Abre el PDF en una pestaña nueva
      } catch (printErr) {
        console.error("No se pudo imprimir automáticamente:", printErr);
      }

      alert("¡Listo! Orden cerrada y venta registrada.");
      onSave(); // Refresca la lista de órdenes atrás
      onClose(); // Cierra el formulario
    } catch (e) {
      alert(e.response?.data?.detail || "Error al procesar. Revisa tu PIN.");
    } finally {
      setLoading(false);
    }
  };

  const initialState = {
    customer_name: "",
    customer_id_card: "",
    customer_phone: "",
    customer_address: "",
    customer_email: "",
    device_type: "Celular",
    device_brand: "",
    device_model: "",
    device_serial: "",
    reported_issue: "",
    physical_condition: "",
    estimated_cost: 0,
    deposit_amount: 0,
    deposit_payment_method: "EFECTIVO",
    pin: "",
    status: "RECIBIDO",
    device_password: "",
    device_unlock_pattern: "",
    device_account: "",
    device_account_password: "",
    customer_declined_check: false,
    device_initial_check: {
      enciende: "na", camara: "na", microfono: "na", wifi: "na", 
      signal: "na", carga: "na", altavoz: "na", tactil: "na", 
      sim: "na", audifonos: "na",
    },
    images: [], 
  };

  const [order, setOrder] = useState(initialState);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Estado para el visor de fotos (Lightbox)
  const [viewImage, setViewImage] = useState(null);
  // Estados para el Zoom
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState("center center");

  // Función mágica: Calcula dónde está el mouse para mover la lupa
  const handleMouseMove = (e) => {
    if (!isZoomed) return;
    // Obtenemos las coordenadas de la imagen
    const { left, top, width, height } = e.target.getBoundingClientRect();
    // Calculamos el porcentaje exacto donde está el mouse
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    // Movemos el foco del zoom a ese punto
    setZoomOrigin(`${x}% ${y}%`);
  };

  useEffect(() => {
    if (orderId) {
      setLoading(true);
      api.get(`/work-orders/${orderId}`)
        .then((response) => {
          const data = response.data || {};
          setOrder({
            ...initialState,
            ...data,
            device_initial_check: { ...initialState.device_initial_check, ...(data.device_initial_check || {}) },
            customer_email: data.customer_email || "",
          });
        })
        .catch((err) => setError("No se pudieron cargar los datos de la orden."))
        .finally(() => setLoading(false));
    } else {
      setOrder(initialState);
    }
  }, [orderId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let val = type === "checkbox" ? checked : value;

    // Convertir a mayúsculas excepto campos sensibles
    const sensitiveFields = ['customer_email', 'customer_phone', 'device_password', 'device_account', 'device_account_password', 'pin'];
    if (!sensitiveFields.includes(name) && type !== "checkbox" && val) {
      val = val.toUpperCase();
    }
    
    setOrder((prev) => ({ ...prev, [name]: val }));
  };

  const handleChecklistChange = (e) => {
    const { name, value } = e.target;
    setOrder((prev) => ({
      ...prev,
      device_initial_check: { ...prev.device_initial_check, [name]: value },
    }));
  };

  const handleSaveAndContinue = async () => {
    setLoading(true);
    setError("");
    try {
      if (orderId) {
        const response = await api.patch(`/work-orders/${orderId}`, {
          status: order.status,
          customer_phone: order.customer_phone,
          customer_address: order.customer_address || null,
          customer_email: order.customer_email || null,
          estimated_cost: order.estimated_cost, // Enviamos el costo actualizado
          reported_issue: order.reported_issue, // Enviamos el problema actualizado
          physical_condition: order.physical_condition, // <--- AÑADE ESTA LÍNEA
          device_password: order.device_password || null,
          device_unlock_pattern: order.device_unlock_pattern || null,
          device_account: order.device_account || null,
          device_account_password: order.device_account_password || null,
        });
        setOrder((prev) => ({ ...prev, ...response.data, customer_email: response.data.customer_email || "" }));
        onSave(response.data);
      } else {
        const payload = { ...order, customer_address: order.customer_address || null, customer_email: order.customer_email || null };
        const response = await api.post("/work-orders/", payload);
        onSave(response.data);
        return; 
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Ocurrió un error al guardar.");
    } finally {
      setLoading(false);
    }
  };

  const handleImagesUpdated = (newImageList) => {
    setOrder((prev) => ({ ...prev, images: newImageList }));
  };

  const handlePrint = async () => {
    if (!orderId) return;
    try {
      const response = await api.get(`/work-orders/${orderId}/print`, { responseType: "blob" });
      const fileURL = window.URL.createObjectURL(response.data);
      window.open(fileURL, "_blank");
    } catch (error) {
      alert("No se pudo generar el PDF.");
    }
  };

  // --- LÓGICA DE FOTOS (3 CUADRADITOS) ---
  // Creamos un array de 3 elementos. Rellenamos con las imágenes existentes.
  const photoSlots = [0, 1, 2].map(index => {
    return order.images[index] || null; 
  });

  return (
    // ARREGLO UX: NO cerrar al hacer click fuera para evitar pérdida de datos
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
      // Quitamos onClick={onClose} aquí
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl text-gray-800 max-h-[95vh] flex flex-col relative"
        onClick={(e) => e.stopPropagation()} // Evita que el click dentro cierre el modal
      >
        {/* --- NUEVO: Botón X Flotante (Siempre visible) --- */}
        <button 
            onClick={onClose} 
            className="absolute top-3 right-3 z-10 p-2 bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 rounded-full transition-colors shadow-sm"
            title="Cerrar ventana"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>

        {/* --- NUEVO: Contenedor con Scroll para el contenido --- */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          
          <div className="mb-6 flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-secondary">
                {orderId ? `Ver / Editar Orden #${order.work_order_number}` : "Crear Nueva Orden de Trabajo"}
              </h2>
              {orderId && order.user && (
                <p className="text-xs text-gray-400 mt-1">Creada por: <span className="font-semibold">{order.user.email}</span></p>
              )}
            </div>
            {/* Aquí quitamos el botón viejo para no tener dos */}
          </div>

        {loading && <p className="text-accent animate-pulse">Procesando...</p>}
        {error && <p className="bg-red-100 text-red-800 p-3 rounded-lg my-4">{error}</p>}

        <form onSubmit={(e) => e.preventDefault()} className="space-y-4" autoComplete="off">
          
          {/* CLIENTE */}
          <fieldset className="border p-4 rounded-lg">
            <legend className="text-lg font-semibold px-2 text-gray-700">Datos del Cliente</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* CAMPO NOMBRE (CON BUSCADOR) */}
              <div className="relative">
                <input 
                  type="text" 
                  name="customer_name" 
                  value={order.customer_name} 
                  onChange={handleChange} 
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchCustomer('name'); } }}
                  placeholder="Nombre y Apellido" 
                  className="w-full p-2 border rounded pr-10" 
                  required 
                  disabled={!!orderId} 
                  autoComplete="off" 
                />
                {!orderId && (
                  <button
                    type="button"
                    onClick={() => handleSearchCustomer('name')}
                    className="absolute right-1 top-1 p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition"
                    title="Buscar por Nombre"
                  >
                    <HiOutlineSearch className="w-5 h-5" />
                  </button>
                )}
              </div>
              
              {/* CAMPO CÉDULA (CON BUSCADOR) */}
              <div className="relative">
                <input 
                  type="text" 
                  name="customer_id_card" 
                  value={order.customer_id_card} 
                  onChange={handleChange} 
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchCustomer('ci'); } }}
                  placeholder="Cédula" 
                  className="w-full p-2 border rounded pr-10" 
                  required 
                  disabled={!!orderId} 
                  autoComplete="new-password" 
                />
                {!orderId && (
                  <button
                    type="button"
                    onClick={() => handleSearchCustomer('ci')}
                    className="absolute right-1 top-1 p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition"
                    title="Buscar por Cédula"
                  >
                    <HiOutlineSearch className="w-5 h-5" />
                  </button>
                )}
              </div>
              
              <input type="text" name="customer_phone" value={order.customer_phone} onChange={handleChange} placeholder="Teléfono" className="p-2 border rounded" required autoComplete="off" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
               <input type="text" name="customer_address" value={order.customer_address || ''} onChange={handleChange} placeholder="Dirección" className="p-2 border rounded md:col-span-2" autoComplete="off" />
               <input type="email" name="customer_email" value={order.customer_email || ''} onChange={handleChange} placeholder="Correo electrónico" className="p-2 border rounded" autoComplete="off" />
            </div>
          </fieldset>

          {/* EQUIPO */}
          <fieldset className="border p-4 rounded-lg">
            <legend className="text-lg font-semibold px-2 text-gray-700">Datos del Equipo</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select name="device_type" value={order.device_type} onChange={handleChange} className="p-2 border rounded" disabled={!!orderId}>
                <option>Celular</option><option>Tablet</option><option>Laptop</option><option>PC</option><option>Otro</option>
              </select>
              <input type="text" name="device_brand" value={order.device_brand} onChange={handleChange} placeholder="Marca" className="p-2 border rounded" required disabled={!!orderId} />
              <input type="text" name="device_model" value={order.device_model} onChange={handleChange} placeholder="Modelo" className="p-2 border rounded" required disabled={!!orderId} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
               <input type="text" name="device_serial" value={order.device_serial || ""} onChange={handleChange} placeholder="Serie / IMEI" className="p-2 border rounded" disabled={!!orderId} />
               <input type="text" name="device_password" value={order.device_password || ""} onChange={handleChange} placeholder="PIN / Contraseña" className="p-2 border rounded" autoComplete="new-password" />
               
               {/* CAMPO DE PATRÓN INTERACTIVO */}
               <div className="relative">
                 <button 
                   type="button"
                   onClick={() => setShowPatternModal(true)}
                   className={`w-full p-2 border rounded text-left flex justify-between items-center ${order.device_unlock_pattern ? "bg-green-50 border-green-300 text-green-700" : "bg-white text-gray-400"}`}
                 >
                   <span>{order.device_unlock_pattern ? `Patrón: ${order.device_unlock_pattern}` : "Dibujar Patrón"}</span>
                   <span className="text-lg">罒</span>
                 </button>
                 {/* Input oculto para que se guarde en el estado del formulario */}
                 <input type="hidden" name="device_unlock_pattern" value={order.device_unlock_pattern || ""} />
               </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
               <input type="text" name="device_account" value={order.device_account || ""} onChange={handleChange} placeholder="Cuenta Google / iCloud" className="p-2 border rounded" autoComplete="new-password" />
               <input type="text" name="device_account_password" value={order.device_account_password || ""} onChange={handleChange} placeholder="Contraseña de Cuenta" className="p-2 border rounded" autoComplete="new-password" />
             </div>
          </fieldset>

          {/* CHECKLIST */}
          <fieldset className="border p-4 rounded-lg">
             <legend className="text-lg font-semibold px-2 text-gray-700">Checklist Inicial</legend>
             <div className="mb-4">
                <label className="inline-flex items-center text-red-600 font-semibold text-sm cursor-pointer select-none">
                  <input type="checkbox" name="customer_declined_check" checked={order.customer_declined_check} onChange={handleChange} className="mr-2 h-4 w-4" />
                  Cliente no desea esperar revisión
                </label>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
               <CheckListItem label="¿Equipo enciende?" name="enciende" value={order.device_initial_check.enciende} onChange={handleChecklistChange} disabled={order.customer_declined_check} />
               {order.device_initial_check.enciende === "si" && (
                 <>
                   <CheckListItem label="Cámara" name="camara" value={order.device_initial_check.camara} onChange={handleChecklistChange} disabled={order.customer_declined_check} />
                   <CheckListItem label="Micrófono" name="microfono" value={order.device_initial_check.microfono} onChange={handleChecklistChange} disabled={order.customer_declined_check} />
                   <CheckListItem label="Wi-Fi" name="wifi" value={order.device_initial_check.wifi} onChange={handleChecklistChange} disabled={order.customer_declined_check} />
                   <CheckListItem label="Señal" name="signal" value={order.device_initial_check.signal} onChange={handleChecklistChange} disabled={order.customer_declined_check} />
                   <CheckListItem label="Carga" name="carga" value={order.device_initial_check.carga} onChange={handleChecklistChange} disabled={order.customer_declined_check} />
                   <CheckListItem label="Altavoz" name="altavoz" value={order.device_initial_check.altavoz} onChange={handleChecklistChange} disabled={order.customer_declined_check} />
                   <CheckListItem label="Pantalla Táctil" name="tactil" value={order.device_initial_check.tactil} onChange={handleChecklistChange} disabled={order.customer_declined_check} />
                   <CheckListItem label="Lectura SIM" name="sim" value={order.device_initial_check.sim} onChange={handleChecklistChange} disabled={order.customer_declined_check} />
                   <CheckListItem label="Audífonos" name="audifonos" value={order.device_initial_check.audifonos} onChange={handleChecklistChange} disabled={order.customer_declined_check} />
                 </>
               )}
             </div>
          </fieldset>

          {/* --- FOTOS DEL EQUIPO (REDISEÑADO) --- */}
          <fieldset className="border p-4 rounded-lg bg-gray-50">
            <legend className="text-lg font-semibold px-2 text-gray-700">Fotos del Estado Físico (Máx 3)</legend>
            <div className="flex flex-wrap gap-4 items-center">
              {/* Renderizamos los 3 slots fijos */}
              {photoSlots.map((img, idx) => (
                <PhotoSlot 
                  key={idx} 
                  index={idx} 
                  image={img} 
                  orderId={orderId} 
                  onUpload={handleImagesUpdated} 
                  onView={setViewImage}
                />
              ))}
              
              {!orderId && <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">⚠️ Guarda la orden para habilitar la cámara.</span>}
            </div>
          </fieldset>
          {/* ------------------------------------- */}

          {/* 1. ESTADO FÍSICO (Separado para que no se pegue) */}
          <fieldset className="border p-4 rounded-lg bg-gray-50 border-gray-200">
            <legend className="text-lg font-semibold px-2 text-gray-700">Estado del Equipo (Recepción)</legend>
            <textarea 
              name="physical_condition" 
              value={order.physical_condition || ""} 
              onChange={handleChange} 
              placeholder="Detalle aquí: Pantalla rayada, golpe en esquina, sin tapa, etc..." 
              className="w-full p-2 border rounded focus:ring-2 focus:ring-gray-400 outline-none h-20 text-sm bg-white" 
            />
            <p className="text-xs text-gray-500 mt-1">
              * Esta información aparecerá en el recibo impreso.
            </p>
          </fieldset>

          {/* 2. DIAGNÓSTICO Y PRESUPUESTO (Con título corregido) */}
          <fieldset className="border p-4 rounded-lg">
            <legend className="text-lg font-semibold px-2 text-gray-700">Diagnóstico y Presupuesto</legend>
            
            {/* Título agregado */}
            <label className="font-semibold block mb-2 text-gray-700">Daño o Trabajo a realizar</label>
            <textarea 
              name="reported_issue" 
              value={order.reported_issue} 
              onChange={handleChange} 
              placeholder="Describa el problema o trabajo a realizar..." 
              className="w-full p-2 border rounded mb-4 focus:ring-2 focus:ring-accent outline-none" 
              required 
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold block mb-1 text-sm">Costo Estimado ($)</label>
                <input type="number" step="0.01" name="estimated_cost" value={order.estimated_cost} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-accent outline-none" required />
              </div>
              <div>
                <label className="font-semibold block mb-1 text-sm">Abono Inicial ($)</label>
                <input type="number" step="0.01" name="deposit_amount" value={order.deposit_amount} onChange={handleChange} className="w-full p-2 border rounded bg-gray-100" disabled={!!orderId} />
              </div>
              {!orderId && parseFloat(order.deposit_amount) > 0 && (
                <div className="md:col-span-2">
                   <label className="block text-sm font-medium mb-1">Método de Pago (Anticipo)</label>
                   <select name="deposit_payment_method" value={order.deposit_payment_method} onChange={handleChange} className="w-full p-2 border rounded bg-yellow-50 font-bold">
                     <option value="EFECTIVO">💵 Efectivo</option>
                     <option value="TRANSFERENCIA">🏦 Transferencia</option>
                     <option value="TARJETA">💳 Tarjeta</option>
                   </select>
                </div>
              )}
            </div>
          </fieldset>

          {orderId && (
            <div>
              <label className="font-semibold text-gray-600 block mb-2">Estado Actual</label>
              <select name="status" value={order.status} onChange={handleChange} className="w-full p-2 border rounded-lg bg-gray-100 font-medium">
                <option value="RECIBIDO">Recibido</option>
                <option value="EN_REVISION">En Revisión</option>
                <option value="REPARANDO">Reparando</option>
                <option value="LISTO">Listo</option>
                <option value="ENTREGADO">Entregado</option>
                <option value="SIN_REPARACION">Sin Reparación</option>
              </select>
            </div>
          )}

          {!orderId && (
            <div>
               <label className="font-semibold text-gray-600 block mb-2">Tu PIN de Seguridad</label>
               <input type="password" name="pin" value={order.pin} onChange={handleChange} className="w-full p-2 border rounded" required placeholder="****" autoComplete="new-password" />
            </div>
          )}

          <div className="mt-6 flex justify-between items-center border-t pt-4">
             <button type="button" onClick={handlePrint} disabled={!orderId} className="py-2 px-4 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm">🖨️ Imprimir</button>
             
             <div className="flex space-x-3">
               {orderId && (
                 <button type="button" onClick={() => setShowUnrepaired(true)} className="py-2 px-4 bg-red-100 text-red-700 font-bold rounded-lg hover:bg-red-200 border border-red-300 text-sm">
                   Entregar s/ Reparar
                 </button>
               )}
               <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm font-medium">Cancelar</button>
               <button type="submit" onClick={handleSaveAndContinue} disabled={loading} className="py-2 px-6 bg-accent text-white font-bold rounded-lg hover:bg-teal-600 shadow-md text-sm">
                 {orderId ? "Actualizar Orden" : "Guardar Orden"}
               </button>
             </div>
          </div>
        </form>
        
        {/* Modal "Entregar sin reparar" */}
        {showUnrepaired && (
          <div className="fixed inset-0 bg-black bg-opacity-70 z-[60] flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded shadow-xl max-w-sm w-full border-l-4 border-red-500 animate-scale-in" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-red-600 mb-4">Entregar Sin Reparar</h3>
              <label className="block text-sm font-semibold mb-1">Costo Revisión ($)</label>
              <input type="number" step="0.01" value={unrepairedData.fee} onChange={e => setUnrepairedData({...unrepairedData, fee: e.target.value})} className="w-full border p-2 rounded mb-3" />
              <label className="block text-sm font-semibold mb-1">Razón / Nota</label>
              <input type="text" value={unrepairedData.reason} onChange={e => setUnrepairedData({...unrepairedData, reason: e.target.value})} className="w-full border p-2 rounded mb-3" />
              <label className="block text-sm font-semibold mb-1">Tu PIN</label>
              <input type="password" value={unrepairedData.pin} onChange={e => setUnrepairedData({...unrepairedData, pin: e.target.value})} className="w-full border p-2 rounded mb-4" placeholder="****" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowUnrepaired(false)} className="px-3 py-1 bg-gray-300 rounded text-sm">Cancelar</button>
                <button type="button" onClick={handleUnrepairedSubmit} className="px-3 py-1 bg-red-600 text-white font-bold rounded text-sm">Confirmar</button>
              </div>
            </div>
          </div>
        )}

        {/* --- NUEVO: MODAL DE DIBUJO DE PATRÓN --- */}
        <PatternLockModal 
          isOpen={showPatternModal}
          onClose={() => setShowPatternModal(false)}
          initialPattern={order.device_unlock_pattern}
          onSave={(patternString) => setOrder(prev => ({ ...prev, device_unlock_pattern: patternString }))}
        />

        {/* --- MODAL DE SELECCIÓN DE CLIENTES (BÚSQUEDA) --- */}
        {showCustomerModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
              <div className="bg-gray-100 px-4 py-3 border-b flex justify-between items-center">
                <h3 className="font-bold text-gray-700">Seleccionar Cliente</h3>
                <button onClick={() => setShowCustomerModal(false)} className="text-gray-500 hover:text-gray-700 font-bold text-xl">&times;</button>
              </div>
              <div className="p-4 max-h-80 overflow-y-auto">
                <p className="text-sm text-gray-600 mb-3">Encontramos varios clientes. Por favor elige uno:</p>
                <ul className="space-y-2">
                  {customerCandidates.map((c) => (
                    <li 
                      key={c.id} 
                      onClick={() => selectCustomer(c)}
                      className="p-3 border rounded hover:bg-blue-50 cursor-pointer transition flex justify-between items-center"
                    >
                      <div>
                        <p className="font-bold text-sm text-gray-800">{c.name}</p>
                        <p className="text-xs text-gray-500">CI: {c.id_card}</p>
                      </div>
                      <span className="text-blue-600 text-sm font-semibold">Seleccionar &rarr;</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-gray-50 px-4 py-3 text-right">
                <button 
                  onClick={() => setShowCustomerModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm font-bold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
        
        </div> {/* --- FIN DEL CONTENEDOR CON SCROLL --- */}
      </div>

      {/* --- VISOR DE IMAGEN (LIGHTBOX CON ZOOM TÁCTICO) --- */}
      {viewImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black bg-opacity-95 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => { setViewImage(null); setIsZoomed(false); }} // Al cerrar, reseteamos el zoom
        >
          {/* Botón Cerrar Gigante */}
          <button 
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-[110] bg-black bg-opacity-50 rounded-full p-2"
            onClick={() => { setViewImage(null); setIsZoomed(false); }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Imagen Grande (Contenedor relativo para el zoom) */}
          <div 
            className="relative overflow-hidden rounded shadow-2xl transition-all duration-200 ease-out"
            style={{ 
                // Si está zoomed, ocupamos más espacio, si no, nos ajustamos
                maxWidth: isZoomed ? '100vw' : '90vw', 
                maxHeight: isZoomed ? '100vh' : '85vh',
                cursor: isZoomed ? 'zoom-out' : 'zoom-in'
            }}
          >
            <img 
              src={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}${viewImage.image_url}`} 
              alt="Evidencia Grande" 
              className="w-full h-full object-contain transition-transform duration-100 ease-linear"
              style={{
                // Aquí ocurre la magia: Escala 2.5x y se mueve según el mouse
                transform: isZoomed ? "scale(2.5)" : "scale(1)",
                transformOrigin: zoomOrigin
              }}
              // Eventos del mouse
              onClick={(e) => { e.stopPropagation(); setIsZoomed(!isZoomed); }} 
              onMouseMove={handleMouseMove}
            />
          </div>

          {/* Barra de Acciones Inferior (Solo visible si NO hay zoom, para no estorbar) */}
          {!isZoomed && (
            <div className="absolute bottom-6 flex flex-col items-center gap-2 z-[110]" onClick={(e) => e.stopPropagation()}>
              <p className="text-white text-xs opacity-70 mb-1">Click en la imagen para hacer Zoom</p>
              <a 
                href={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}${viewImage.image_url}`} 
                download 
                target="_blank"
                rel="noreferrer"
                className="bg-white text-black px-6 py-3 rounded-full font-bold hover:bg-gray-200 flex items-center gap-2 shadow-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Descargar Original
              </a>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default WorkOrderForm;