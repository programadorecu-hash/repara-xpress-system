import React, { useState, useEffect, useRef } from "react";
import api, { deliverWorkOrderUnrepaired, deleteWorkOrderImage } from "../services/api";
import PatternLockModal from "./PatternLockModal"; // <--- IMPORTANTE
import { HiOutlineSearch, HiOutlineCamera, HiOutlineCloudUpload, HiPencilAlt } from "react-icons/hi"; // <--- Iconos añadidos
import SignatureCanvas from 'react-signature-canvas'; // <--- NUEVA LIBRERÍA

// --- COMPONENTE DE SLOT DE FOTO (MEJORADO: BOTONES DIRECTOS) ---
const PhotoSlot = ({ index, image, orderId, onUpload, onView }) => {
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
    } catch (error) {
      console.error(error);
      alert("Error al subir imagen");
    } finally {
      setIsUploading(false);
    }
  };

  // Función de borrado
  const handleDelete = async (e) => {
    e.stopPropagation(); // Evitar abrir el visor
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
            facingMode: { ideal: "environment" },
            width: { ideal: 4096 }, // Pedimos 4K idealmente
            height: { ideal: 2160 } 
        } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
         videoRef.current.srcObject = stream;
         videoRef.current.play().catch(e => console.error(e));
      }
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

      // 3. Guardamos con CALIDAD MÁXIMA (1.0)
      canvas.toBlob(blob => {
        uploadFile(blob);
        closeCamera();
      }, "image/jpeg", 1.0); 
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  // --- RENDERIZADO DEL SLOT ---
  
  // CASO A: Ya hay foto -> Mostrarla (Mismo código de antes)
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
            type="button"
            onClick={handleDelete}
            className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-700 transition-colors z-10 opacity-0 group-hover:opacity-100"
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

  // CASO B: No hay foto -> MOSTRAR BOTONES DIRECTOS (NUEVO DISEÑO)
  return (
    <>
      <div 
        className="relative w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white hover:border-blue-400 transition-colors shadow-sm"
        title={orderId ? "Añadir foto" : "Guarda la orden primero"}
      >
        {isUploading ? (
          <div className="flex items-center justify-center h-full">
             <span className="text-[10px] text-gray-400 animate-pulse">Subiendo...</span>
          </div>
        ) : !orderId ? (
           // Estado deshabilitado
           <div className="flex flex-col items-center justify-center h-full opacity-50 cursor-not-allowed">
              <span className="text-2xl text-gray-300 font-light">+</span>
              <span className="text-[10px] text-gray-400 mt-1">Foto {index + 1}</span>
           </div>
        ) : (
           // Estado Habilitado: Botones divididos
           <div className="flex flex-col h-full">
              {/* Mitad Superior: Cámara */}
              <button 
                  type="button"
                  onClick={openCamera}
                  className="flex-1 flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-600 border-b border-blue-100 transition-colors group"
                  title="Tomar foto con cámara"
              >
                  <HiOutlineCamera className="text-lg mb-0.5 group-hover:scale-110 transition-transform"/>
                  <span className="text-[9px] font-bold uppercase tracking-tight">Cámara</span>
              </button>
              
              {/* Mitad Inferior: Galería */}
              <button 
                  type="button"
                  onClick={() => fileInputRef.current.click()}
                  className="flex-1 flex flex-col items-center justify-center bg-white hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors group"
                  title="Subir archivo"
              >
                  <HiOutlineCloudUpload className="text-lg mb-0.5 group-hover:scale-110 transition-transform"/>
                  <span className="text-[9px] font-bold uppercase tracking-tight">Galería</span>
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
               <button type="button" onClick={closeCamera} className="bg-gray-700 text-white px-4 py-2 rounded text-sm hover:bg-gray-600">Cancelar</button>
               <button type="button" onClick={takePhoto} className="bg-white text-black font-bold px-6 py-2 rounded-full ring-4 ring-gray-500 hover:scale-105 transition-transform">CAPTURAR</button>
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
  // Estilo para ocultar flechas en inputs numéricos
  const noArrowsStyle = `
    input[type=number]::-webkit-inner-spin-button, 
    input[type=number]::-webkit-outer-spin-button { 
      -webkit-appearance: none; 
      margin: 0; 
    }
    input[type=number] {
      -moz-appearance: textfield;
    }
  `;

  // --- Estado para el modal de "Entregar Sin Reparar" ---
  const [showUnrepaired, setShowUnrepaired] = useState(false);
  const [unrepairedData, setUnrepairedData] = useState({ fee: 2.00, reason: "Cliente retiró sin reparar", pin: "" });
  // Estado para el modal de patrón
  const [showPatternModal, setShowPatternModal] = useState(false);

  // --- LÓGICA FIRMA DIGITAL ---
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const sigPadRef = useRef({}); // Referencia al canvas de firma
  const [signatureBlob, setSignatureBlob] = useState(null); // El archivo de la firma temporal
  const [signaturePreview, setSignaturePreview] = useState(null); // Para mostrarla en pequeñito

  const clearSignature = () => {
    sigPadRef.current.clear();
    setSignatureBlob(null);
    setSignaturePreview(null);
  };

  const saveSignatureFromPad = () => {
    if (sigPadRef.current.isEmpty()) {
      alert("Por favor firme antes de guardar.");
      return;
    }
    // CORRECCIÓN: Usamos getCanvas() directo para evitar error de compatibilidad
    // Convertir el dibujo a una imagen (blob)
    sigPadRef.current.getCanvas().toBlob((blob) => {
      setSignatureBlob(blob);
      setSignaturePreview(URL.createObjectURL(blob));
      setShowSignatureModal(false);
    }, 'image/png');
  };
  // ---------------------------

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
  
  // --- NUEVO: Estado para cargar las cuentas bancarias ---
  const [bankAccounts, setBankAccounts] = useState([]);

  useEffect(() => {
    // Cargar cuentas disponibles al abrir el formulario
    const fetchAccounts = async () => {
        try {
            const res = await api.get("/cash-accounts/");
            // FILTRO ESTRICTO: Mostrar SOLO Cuentas Bancarias.
            // Excluimos cualquier cuenta cuyo tipo contenga la palabra "CAJA" (ej: CAJA_VENTAS, CAJA_CHICA).
            // Esto asegura que las transferencias solo vayan a Bancos.
            const banksOnly = res.data.filter(acc => !acc.account_type.toUpperCase().includes("CAJA"));
            setBankAccounts(banksOnly);
        } catch (e) {
            console.error("Error cargando cuentas", e);
        }
    };
    fetchAccounts();
  }, []);
  // -------------------------------------------------------
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
        
        // --- NUEVO: SI HAY FIRMA PENDIENTE, LA SUBIMOS AHORA ---
        if (signatureBlob) {
           const formData = new FormData();
           formData.append("file", signatureBlob, "signature.png");
           // Usamos el ID de la orden recién creada (response.data.id)
           await api.post(`/work-orders/${response.data.id}/upload-signature/`, formData);
        }
        // -------------------------------------------------------

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
    <div className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* HEADER ELEGANTE (Estilo ProductForm) */}
        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-start bg-gradient-to-r from-gray-50 to-white">
            <div>
                <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight">
                    {orderId ? `Orden #${order.work_order_number}` : "Nueva Orden de Trabajo"}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                    {orderId && order.user 
                        ? <>Creada por: <span className="font-semibold text-gray-700">{order.user.email}</span></> 
                        : "Ingresa los datos del cliente y el equipo."}
                </p>
            </div>
            
            {/* Botón Cerrar */}
             <button 
                onClick={onClose} 
                className="p-2 bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 rounded-full transition-all shadow-sm"
                title="Cerrar ventana"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">

        {loading && <p className="text-blue-600 font-bold animate-pulse text-center p-2">Procesando...</p>}
        {error && <p className="bg-red-50 text-red-600 border border-red-100 p-4 rounded-xl text-sm font-medium mb-4">{error}</p>}

        <form onSubmit={(e) => e.preventDefault()} className="space-y-4" autoComplete="off">
          <style>{noArrowsStyle}</style>
          
          {/* SECCIÓN 1: DATOS DEL CLIENTE */}
          <div className="space-y-4">
             <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">1</div>
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Datos del Cliente</h3>
                </div>
                
                {/* BOTÓN / VISTA PREVIA FIRMA */}
                {!orderId && (
                    <button 
                        type="button"
                        onClick={() => setShowSignatureModal(true)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${signaturePreview ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                    >
                        {signaturePreview ? (
                            <>
                                <span className="text-green-600">✓ Firmado</span>
                                <img src={signaturePreview} alt="Firma" className="h-6 w-auto border border-gray-200 bg-white" />
                            </>
                        ) : (
                            <>
                                <HiPencilAlt className="text-lg"/>
                                Firmar Recepción
                            </>
                        )}
                    </button>
                )}
                {/* Si ya existe la orden y tiene firma guardada */}
                {orderId && order.customer_signature && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
                        <span className="text-xs font-bold text-gray-500">Firma Registrada:</span>
                        <img src={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}${order.customer_signature}`} alt="Firma Cliente" className="h-8 w-auto bg-white border" />
                    </div>
                )}
             </div>
             
             <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-200/60 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-5 transition-all focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50/50">
                
                {/* CAMPO NOMBRE (CON BUSCADOR) */}
                <div className="relative">
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Nombre del Cliente</label>
                   <div className="relative">
                       <input 
                         type="text" 
                         name="customer_name" 
                         value={order.customer_name} 
                         onChange={handleChange} 
                         onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchCustomer('name'); } }}
                         placeholder="Ej: Juan Pérez" 
                         className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-700 placeholder-gray-400 transition-all shadow-sm pr-10" 
                         required 
                         disabled={!!orderId} 
                         autoComplete="off" 
                       />
                       {!orderId && (
                         <button
                           type="button"
                           onClick={() => handleSearchCustomer('name')}
                           className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                           title="Buscar por Nombre"
                         >
                           <HiOutlineSearch className="w-5 h-5" />
                         </button>
                       )}
                   </div>
                </div>

                {/* CAMPO CÉDULA (CON BUSCADOR) */}
                <div className="relative">
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Cédula / RUC</label>
                   <div className="relative">
                       <input 
                         type="text" 
                         name="customer_id_card" 
                         value={order.customer_id_card} 
                         onChange={handleChange} 
                         onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchCustomer('ci'); } }}
                         placeholder="Ej: 171..." 
                         className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-700 placeholder-gray-400 transition-all shadow-sm pr-10" 
                         required 
                         disabled={!!orderId} 
                         autoComplete="new-password" 
                       />
                       {!orderId && (
                         <button
                           type="button"
                           onClick={() => handleSearchCustomer('ci')}
                           className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                           title="Buscar por Cédula"
                         >
                           <HiOutlineSearch className="w-5 h-5" />
                         </button>
                       )}
                   </div>
                </div>

                {/* TELÉFONO */}
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Teléfono</label>
                   <input 
                     type="text" 
                     name="customer_phone" 
                     value={order.customer_phone} 
                     onChange={handleChange} 
                     placeholder="Ej: 099..." 
                     className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-700 placeholder-gray-400 transition-all shadow-sm" 
                     required 
                     autoComplete="off" 
                   />
                </div>

                {/* DIRECCIÓN */}
                <div className="md:col-span-2">
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Dirección</label>
                   <input 
                     type="text" 
                     name="customer_address" 
                     value={order.customer_address || ''} 
                     onChange={handleChange} 
                     placeholder="Ej: Av. Amazonas y..." 
                     className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-700 placeholder-gray-400 transition-all shadow-sm" 
                     autoComplete="off" 
                   />
                </div>

                {/* EMAIL */}
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Email (Opcional)</label>
                   <input 
                     type="email" 
                     name="customer_email" 
                     value={order.customer_email || ''} 
                     onChange={handleChange} 
                     placeholder="correo@ejemplo.com" 
                     className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-700 placeholder-gray-400 transition-all shadow-sm" 
                     autoComplete="off" 
                   />
                </div>

             </div>
          </div>

          {/* SECCIÓN 2: DATOS DEL EQUIPO */}
          <div className="space-y-4 pt-2">
             <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">2</div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Datos del Equipo</h3>
             </div>

             <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                
                {/* FILA 1: Identificación Básica */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Tipo</label>
                       <select name="device_type" value={order.device_type} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium shadow-sm" disabled={!!orderId}>
                         <option>Celular</option><option>Tablet</option><option>Laptop</option><option>PC</option><option>Otro</option>
                       </select>
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Marca</label>
                       <input type="text" name="device_brand" value={order.device_brand} onChange={handleChange} placeholder="Ej: SAMSUNG" className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-700 uppercase transition-all shadow-sm" required disabled={!!orderId} />
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Modelo</label>
                       <input type="text" name="device_model" value={order.device_model} onChange={handleChange} placeholder="Ej: A52" className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-700 uppercase transition-all shadow-sm" required disabled={!!orderId} />
                    </div>
                </div>

                {/* FILA 2: Seguridad y Acceso */}
                <div className="p-5 bg-indigo-50/50 rounded-xl border border-indigo-100 grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                       <label className="block text-xs font-bold text-indigo-400 uppercase mb-1.5 ml-1">Serie / IMEI</label>
                       <input type="text" name="device_serial" value={order.device_serial || ""} onChange={handleChange} placeholder="Opcional" className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-600 font-mono text-sm shadow-sm" disabled={!!orderId} />
                    </div>
                    
                    <div>
                       <label className="block text-xs font-bold text-indigo-400 uppercase mb-1.5 ml-1">Contraseña / PIN</label>
                       <input type="text" name="device_password" value={order.device_password || ""} onChange={handleChange} placeholder="****" className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800 font-bold tracking-widest shadow-sm" autoComplete="new-password" />
                    </div>

                    {/* BOTÓN PATRÓN MEJORADO */}
                    <div>
                       <label className="block text-xs font-bold text-indigo-400 uppercase mb-1.5 ml-1">Patrón de Desbloqueo</label>
                       <div className="relative">
                         <button 
                           type="button"
                           onClick={() => setShowPatternModal(true)}
                           className={`w-full px-4 py-2.5 border rounded-xl text-left flex justify-between items-center transition-all shadow-sm ${order.device_unlock_pattern ? "bg-teal-50 border-teal-300 text-teal-700 font-bold" : "bg-white border-indigo-200 text-gray-400 hover:bg-indigo-50"}`}
                         >
                           <span className="text-sm">{order.device_unlock_pattern ? "Patrón Guardado ✓" : "Dibujar Patrón"}</span>
                           <span className="text-lg opacity-60">罒</span>
                         </button>
                         <input type="hidden" name="device_unlock_pattern" value={order.device_unlock_pattern || ""} />
                       </div>
                    </div>
                </div>

                {/* FILA 3: Cuentas Vinculadas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                       <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">Cuenta Vinculada (Google/iCloud)</label>
                       <input type="text" name="device_account" value={order.device_account || ""} onChange={handleChange} placeholder="usuario@gmail.com" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-300 outline-none text-sm transition-all" autoComplete="new-password" />
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">Contraseña de Cuenta</label>
                       <input type="text" name="device_account_password" value={order.device_account_password || ""} onChange={handleChange} placeholder="••••••" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-300 outline-none text-sm transition-all" autoComplete="new-password" />
                    </div>
                </div>

             </div>
          </div>

          {/* SECCIÓN 3: CHECKLIST INICIAL */}
          <div className="space-y-4 pt-2">
             <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-sm">3</div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Estado Inicial (Checklist)</h3>
             </div>
             
             <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 shadow-sm">
                 <div className="mb-4 flex items-center p-3 bg-red-50 border border-red-100 rounded-xl">
                    <input type="checkbox" name="customer_declined_check" checked={order.customer_declined_check} onChange={handleChange} className="w-5 h-5 text-red-600 rounded focus:ring-red-500 border-gray-300" />
                    <label className="ml-3 text-sm font-bold text-red-700">El cliente no desea esperar la revisión</label>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
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
             </div>
          </div>

          {/* SECCIÓN 4: ESTADO FÍSICO Y FOTOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
             
             {/* FOTOS */}
             <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Evidencia Fotográfica</h3>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Máx 3</span>
                </div>
                <div className="flex gap-3 justify-center items-center flex-1">
                    {photoSlots.map((img, idx) => (
                       <PhotoSlot key={idx} index={idx} image={img} orderId={orderId} onUpload={handleImagesUpdated} onView={setViewImage} />
                    ))}
                </div>
                {!orderId && <p className="text-[10px] text-center text-gray-400 mt-3">⚠️ Guarda la orden para habilitar cámara</p>}
             </div>

             {/* TEXTO ESTADO FÍSICO */}
             <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Estado Físico (Recepción)</label>
                <textarea 
                  name="physical_condition" 
                  value={order.physical_condition || ""} 
                  onChange={handleChange} 
                  placeholder="Detalle rayones, golpes, fisuras..." 
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-200 outline-none text-sm bg-gray-50 h-32 resize-none" 
                />
             </div>
          </div>

          {/* SECCIÓN 5: DIAGNÓSTICO Y PRESUPUESTO */}
          <div className="space-y-4 pt-4">
             <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold text-sm">4</div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Diagnóstico y Finanzas</h3>
             </div>

             <div className="bg-green-50/50 p-6 rounded-2xl border border-green-100 shadow-sm space-y-6">
                
                {/* PROBLEMA REPORTADO */}
                <div>
                   <label className="block text-xs font-bold text-green-800 uppercase mb-1.5 ml-1">Daño Reportado / Trabajo a Realizar</label>
                   <textarea 
                     name="reported_issue" 
                     value={order.reported_issue} 
                     onChange={handleChange} 
                     placeholder="Describa el problema detalladamente..." 
                     className="w-full px-4 py-3 bg-white border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-gray-700 placeholder-gray-400 transition-all shadow-sm" 
                     required 
                     rows="2"
                   />
                </div>

                {/* DINERO */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* COSTO */}
                    <div className="relative">
                        <label className="block text-xs font-bold text-green-700 uppercase mb-1.5 ml-1">Costo Estimado</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-600 font-bold text-lg">$</span>
                            <input type="number" step="0.01" name="estimated_cost" value={order.estimated_cost} onChange={handleChange} className="w-full pl-8 pr-4 py-3 bg-white border border-green-300 rounded-xl focus:ring-4 focus:ring-green-100 outline-none font-bold text-2xl text-green-800 shadow-sm" required placeholder="0.00" />
                        </div>
                    </div>

                    {/* ABONO */}
                    <div className="relative">
                        <label className="block text-xs font-bold text-green-700 uppercase mb-1.5 ml-1">Abono Inicial</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">$</span>
                            <input type="number" step="0.01" name="deposit_amount" value={order.deposit_amount} onChange={handleChange} className="w-full pl-8 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-200 outline-none font-bold text-xl text-gray-700 shadow-sm" disabled={!!orderId} placeholder="0.00" />
                        </div>
                    </div>
                </div>

                {/* METODO PAGO ABONO (Solo si hay abono y es nueva orden) */}
                {!orderId && parseFloat(order.deposit_amount) > 0 && (
                    <div className="bg-white p-4 rounded-xl border border-green-200 animate-fade-in">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Método de Pago del Abono</label>
                        <div className="flex gap-4 flex-wrap">
                            <select name="deposit_payment_method" value={order.deposit_payment_method} onChange={handleChange} className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none font-medium text-sm">
                                <option value="EFECTIVO">💵 Efectivo</option>
                                <option value="TRANSFERENCIA">🏦 Transferencia</option>
                                <option value="TARJETA">💳 Tarjeta</option>
                            </select>
                            
                            {order.deposit_payment_method === "TRANSFERENCIA" && (
                                <select name="deposit_bank_account_id" value={order.deposit_bank_account_id || ""} onChange={handleChange} className="flex-1 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg outline-none font-medium text-sm" required>
                                    <option value="">-- Destino --</option>
                                    {bankAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                </select>
                            )}
                        </div>
                    </div>
                )}
             </div>
          </div>

          {/* ESTADO Y PIN (Footer Area de Form) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
             {orderId ? (
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Estado de la Orden</label>
                    <select name="status" value={order.status} onChange={handleChange} className="w-full px-4 py-3 bg-gray-800 text-white font-bold rounded-xl border border-gray-700 outline-none focus:ring-4 focus:ring-gray-600 transition-shadow">
                        <option value="RECIBIDO">📥 Recibido</option>
                        <option value="EN_REVISION">🧐 En Revisión</option>
                        <option value="REPARANDO">🔧 Reparando</option>
                        <option value="LISTO">✅ Listo</option>
                        <option value="ENTREGADO">🚀 Entregado</option>
                        <option value="SIN_REPARACION">❌ Sin Reparación</option>
                    </select>
                 </div>
             ) : (
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Tu PIN de Seguridad</label>
                    <input type="password" name="pin" value={order.pin} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-red-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-center font-bold tracking-[0.5em] text-gray-800 placeholder-red-100" required placeholder="****" autoComplete="new-password" />
                 </div>
             )}
          </div>

        </form>
        </div> {/* --- FIN DEL CONTENEDOR CON SCROLL (Cierre corregido) --- */}

        {/* FOOTER FLOTANTE (FUERA DEL SCROLL) */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center rounded-b-2xl">
            {/* Botón Imprimir */}
            <button type="button" onClick={handlePrint} disabled={!orderId} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                <span className="text-xl">🖨️</span> <span className="hidden sm:inline">Imprimir</span>
            </button>

            <div className="flex gap-3">
                {orderId && (
                    <button type="button" onClick={() => setShowUnrepaired(true)} className="px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 font-bold rounded-xl hover:bg-red-100 transition-colors text-sm">
                        Entregar s/ Reparar
                    </button>
                )}
                
                <button type="button" onClick={onClose} className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-100 transition-colors shadow-sm">
                    Cancelar
                </button>
                
                <button type="button" onClick={handleSaveAndContinue} disabled={loading} className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center gap-2">
                    <HiOutlineCloudUpload className="text-xl"/>
                    {orderId ? "Guardar Cambios" : "Crear Orden"}
                </button>
            </div>
        </div>

        {/* --- MODALES AUXILIARES (REDIBUJADOS IGUAL QUE ANTES) --- */}
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

        {/* --- MODAL DE FIRMA DIGITAL --- */}
        {showSignatureModal && (
            <div className="fixed inset-0 bg-black bg-opacity-80 z-[80] flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                    <div className="bg-gray-100 px-6 py-4 border-b flex justify-between items-center">
                        <h3 className="font-bold text-gray-700 flex items-center gap-2">
                            <HiPencilAlt /> Firma del Cliente
                        </h3>
                        <button onClick={() => setShowSignatureModal(false)} className="text-gray-400 hover:text-red-500 font-bold text-xl">&times;</button>
                    </div>
                    
                    <div className="p-4 bg-gray-50 flex justify-center">
                        <div className="border-2 border-dashed border-gray-300 rounded-xl bg-white shadow-inner">
                            <SignatureCanvas 
                                ref={sigPadRef}
                                penColor="black"
                                canvasProps={{width: 350, height: 200, className: 'cursor-crosshair'}}
                                backgroundColor="rgba(255,255,255,1)"
                            />
                        </div>
                    </div>
                    <p className="text-center text-xs text-gray-400 py-1">Firme con el dedo dentro del recuadro</p>

                    <div className="p-6 border-t bg-white flex justify-between gap-4">
                        <button 
                            type="button" 
                            onClick={clearSignature} 
                            className="px-4 py-2 text-red-500 font-bold hover:bg-red-50 rounded-lg transition-colors text-sm"
                        >
                            Borrar
                        </button>
                        <div className="flex gap-3">
                            <button 
                                type="button" 
                                onClick={() => setShowSignatureModal(false)} 
                                className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors text-sm"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="button" 
                                onClick={saveSignatureFromPad} 
                                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200 transition-transform active:scale-95 text-sm"
                            >
                                Guardar Firma
                            </button>
                        </div>
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