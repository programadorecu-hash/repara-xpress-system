import React, { useState, useEffect, useRef } from "react";
import api, { deliverWorkOrderUnrepaired, deleteWorkOrderImage } from "../services/api";

// --- COMPONENTE DE SLOT DE FOTO (EL CUADRADITO CON +) ---
const PhotoSlot = ({ index, image, orderId, onUpload }) => {
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
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } // Intenta usar la cámara trasera
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
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      canvas.toBlob(blob => {
        uploadFile(blob);
        closeCamera();
      }, "image/jpeg", 0.8);
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
      <div className="relative w-24 h-24 rounded-lg overflow-hidden shadow-sm border border-gray-200 group bg-gray-100">
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
  
  const handleUnrepairedSubmit = async () => {
    try {
      setLoading(true);
      await deliverWorkOrderUnrepaired(orderId, {
        diagnostic_fee: unrepairedData.fee,
        reason: unrepairedData.reason,
        pin: unrepairedData.pin
      });
      alert("Orden cerrada como SIN REPARACIÓN correctamente.");
      onSave(); 
      onClose(); 
    } catch (e) {
      alert(e.response?.data?.detail || "Error al procesar.");
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
        className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl text-gray-800 overflow-y-auto max-h-[95vh]"
        onClick={(e) => e.stopPropagation()} // Evita que el click dentro cierre el modal
      >
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-secondary">
              {orderId ? `Ver / Editar Orden #${order.work_order_number}` : "Crear Nueva Orden de Trabajo"}
            </h2>
            {orderId && order.user && (
              <p className="text-xs text-gray-400 mt-1">Creada por: <span className="font-semibold">{order.user.email}</span></p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none">&times;</button>
        </div>

        {loading && <p className="text-accent animate-pulse">Procesando...</p>}
        {error && <p className="bg-red-100 text-red-800 p-3 rounded-lg my-4">{error}</p>}

        <form onSubmit={(e) => e.preventDefault()} className="space-y-4" autoComplete="off">
          
          {/* CLIENTE */}
          <fieldset className="border p-4 rounded-lg">
            <legend className="text-lg font-semibold px-2 text-gray-700">Datos del Cliente</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input type="text" name="customer_name" value={order.customer_name} onChange={handleChange} placeholder="Nombre y Apellido" className="p-2 border rounded" required disabled={!!orderId} autoComplete="off" />
              
              {/* ARREGLO UX: Bloqueo de autocompletado en cédula */}
              <input 
                type="text" 
                name="customer_id_card" 
                value={order.customer_id_card} 
                onChange={handleChange} 
                placeholder="Cédula" 
                className="p-2 border rounded" 
                required 
                disabled={!!orderId} 
                autoComplete="new-password" // Truco anti-autofill
              />
              
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
               <input type="text" name="device_unlock_pattern" value={order.device_unlock_pattern || ""} onChange={handleChange} placeholder="Patrón" className="p-2 border rounded" />
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
                />
              ))}
              
              {!orderId && <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">⚠️ Guarda la orden para habilitar la cámara.</span>}
            </div>
          </fieldset>
          {/* ------------------------------------- */}

          {/* PROBLEMA Y COSTOS */}
          <fieldset className="border p-4 rounded-lg">
            <fieldset className="border p-4 rounded-lg bg-gray-50 border-gray-200 mt-4">
            <legend className="text-lg font-semibold px-2 text-gray-700">Estado del Equipo (Recepción)</legend>
            <textarea 
              name="physical_condition" 
              value={order.physical_condition || ""} 
              onChange={handleChange} 
              placeholder="Detalle aquí: Pantalla rayada, golpe en esquina, sin tapa, etc..." 
              className="w-full p-2 border rounded focus:ring-2 focus:ring-gray-400 outline-none h-20 text-sm" 
            />
            <p className="text-xs text-gray-500 mt-1">
              * Esta información aparecerá en el recibo impreso.
            </p>
          </fieldset>
          {/* --------------------------------------- */}
            <legend className="text-lg font-semibold px-2 text-gray-700">Diagnóstico y Presupuesto</legend>
            <textarea name="reported_issue" value={order.reported_issue} onChange={handleChange} placeholder="Problema reportado..." className="w-full p-2 border rounded mb-4 focus:ring-2 focus:ring-accent outline-none" required />
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
      </div>
    </div>
  );
}

export default WorkOrderForm;