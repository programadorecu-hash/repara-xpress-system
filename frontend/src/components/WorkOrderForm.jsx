import React, { useState, useEffect, useRef } from "react";
import api from "../services/api";

// --- Componente para un solo item del Checklist ---
// Lo creamos aparte para no repetir código.
const CheckListItem = ({ label, name, value, onChange, disabled }) => (
  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
    <label htmlFor={name} className="text-sm font-medium text-gray-700">
      {label}
    </label>
    <div className="flex items-center space-x-2">
      <input
        type="radio"
        id={`${name}-si`}
        name={name}
        value="si"
        checked={value === "si"}
        onChange={onChange}
        disabled={disabled}
        className="h-4 w-4 text-accent focus:ring-accent"
      />
      <label htmlFor={`${name}-si`} className="text-sm">
        Sí
      </label>
      <input
        type="radio"
        id={`${name}-no`}
        name={name}
        value="no"
        checked={value === "no"}
        onChange={onChange}
        disabled={disabled}
        className="h-4 w-4 text-red-500 focus:ring-red-500"
      />
      <label htmlFor={`${name}-no`} className="text-sm">
        No
      </label>
      <input
        type="radio"
        id={`${name}-na`}
        name={name}
        value="na"
        checked={value === "na"}
        onChange={onChange}
        disabled={disabled}
        className="h-4 w-4 text-gray-400 focus:ring-gray-400"
      />
      <label htmlFor={`${name}-na`} className="text-sm">
        N/A
      </label>
    </div>
  </div>
);

// --- Componente para un solo campo de subida de foto (con cámara) ---
const ImageUploader = ({ tag, label, orderId, onUpload }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Cámara
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Subida genérica: archivo o Blob desde cámara
  const uploadFile = async (fileArg, suggestedName = null) => {
    if (!orderId) return;
    setIsUploading(true);
    const formData = new FormData();

    // --- INICIO DEL ARREGLO (30/10/2025) ---
    // Aplicamos la misma lógica del ProductForm: SIEMPRE re-empaquetamos.

    let finalFile;
    let fileName;
    let fileType;

    if (fileArg instanceof File) {
      // Si es un ARCHIVO SUBIDO (de la PC), usamos su nombre y tipo original
      fileName = suggestedName || fileArg.name;
      fileType = fileArg.type;
    } else {
      // Si es un BLOB (de la cámara), inventamos un nombre .jpg
      const safeTag = (tag || "foto")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_\-]/g, "");
      fileName = suggestedName || `${safeTag}_${Date.now()}.jpg`;
      fileType = "image/jpeg";
    }
    
    // ¡El re-empaquetado! SIEMPRE creamos un sobre (File) nuevo y estándar.
    finalFile = new File([fileArg], fileName, { type: fileType });
    // --- FIN DEL ARREGLO ---

    formData.append("file", finalFile);
    formData.append("tag", tag);

    try {
      // 1. Enviamos el paquete (formData) sin ponerle etiquetas a mano.
      // El navegador (api) se encargará de poner la etiqueta correcta
      // con el código secreto (el "boundary") que el servidor necesita.
      const response = await api.post(
        `/work-orders/${orderId}/upload-image/`,
        formData
      );
      // 2. Si todo sale bien, actualizamos la galería.
      onUpload(response.data.images); // Actualiza galería
      setFile(null); // Limpiamos el selector de archivo
    } catch (error) {
      console.error(error);
      alert(`Error al subir la imagen: ${label}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpload = async () => {
    if (!file || !orderId) return;
    // Usamos el 'tag' (ej. "frontal") para el nombre del archivo
    await uploadFile(file, `${tag}_${Date.now()}.jpg`);
  };

  // Cámara: abrir/cerrar
  const openCamera = async () => {
    setCameraError("");
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(() => {
            /* autoplay policy */
          });
        };
      }
    } catch (err) {
      console.error("Error cámara:", err);
      setCameraError(
        "No se pudo acceder a la cámara. Revisa permisos o si otra app la usa."
      );
    }
  };

  const closeCamera = () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    } catch {}
    setIsCameraOpen(false);
  };

  const takePhotoAndUpload = async () => {
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, w, h);

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            alert("No se pudo capturar la imagen.");
            return;
          }
          await uploadFile(blob, `${tag}_${Date.now()}.jpg`);
          closeCamera();
        },
        "image/jpeg",
        0.9
      );
    } catch (e) {
      console.error(e);
      alert("No se pudo capturar la foto.");
    }
  };

  return (
    <div className="border p-2 rounded-lg">
      <label className="text-sm font-semibold">{label}</label>

      <div className="flex items-center gap-2 mt-1">
        {/* Input archivo */}
        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
          className="text-sm w-full"
          disabled={!orderId}
          accept="image/*"
        />

        {/* Subir archivo */}
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || isUploading || !orderId}
          className="text-xs bg-detail text-white px-2 py-1 rounded hover:bg-indigo-700 disabled:bg-gray-400"
          title="Subir desde archivo"
        >
          {isUploading ? "..." : "Subir"}
        </button>

        {/* Abrir cámara */}
        <button
          type="button"
          onClick={openCamera}
          disabled={!orderId}
          className="text-xs bg-secondary text-white px-2 py-1 rounded hover:opacity-90 disabled:bg-gray-400"
          title="Tomar foto con la cámara"
        >
          Cámara
        </button>
      </div>

      {!orderId && (
        <p className="text-xs text-gray-500 mt-1">
          Guarda la orden para poder subir fotos.
        </p>
      )}

      {/* Modal cámara */}
      {isCameraOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
          onClick={closeCamera}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-lg p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-semibold text-secondary mb-2">
              Tomar foto: {label}
            </h4>
            {cameraError ? (
              <p className="text-red-600 text-xs mb-3">{cameraError}</p>
            ) : null}

            <div className="bg-black rounded-md overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-64 object-contain bg-black"
              />
            </div>

            <canvas ref={canvasRef} className="hidden" />

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={closeCamera}
                className="py-1.5 px-3 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={takePhotoAndUpload}
                className="py-1.5 px-3 bg-accent text-white font-bold rounded-lg hover:bg-teal-600"
              >
                Tomar foto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function WorkOrderForm({ orderId, onClose, onSave }) {
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
    estimated_cost: 0,
    deposit_amount: 0,
    // --- NUEVO: Por defecto el adelanto es en Efectivo ---
    deposit_payment_method: "EFECTIVO", 
    // ----------------------------------------------------
    pin: "",
    status: "RECIBIDO",
    // --- NUEVOS CAMPOS ---
    device_password: "", // Para PIN o Contraseña de texto
    device_unlock_pattern: "", // Para el patrón
    device_account: "", // Para la cuenta de Google/iCloud
    device_account_password: "",
    customer_declined_check: false,
    device_initial_check: {
      // Objeto para el checklist
      enciende: "na",
      camara: "na",
      microfono: "na",
      wifi: "na",
      signal: "na",
      carga: "na",
      altavoz: "na",
      tactil: "na",
      sim: "na",
      audifonos: "na",
    },
    images: [], // Para mostrar las imágenes ya subidas
  };
  const [order, setOrder] = useState(initialState);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (orderId) {
      setLoading(true);
      api
        .get(`/work-orders/${orderId}`)
        .then((response) => {
          const data = response.data || {};
          setOrder({
            ...initialState,
            ...data,
            device_initial_check: {
              ...initialState.device_initial_check,
              ...(data.device_initial_check || {}),
            },
            // Asegurarnos que el email nunca sea 'null' en el estado
            customer_email: data.customer_email || "",
          });
        })
        .catch((err) =>
          setError("No se pudieron cargar los datos de la orden.")
        )
        .finally(() => setLoading(false));
    } else {
      setOrder(initialState);
    }
  }, [orderId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    let val;
    if (type === "checkbox") {
      val = checked;
    } else {
      // Lista negra: campos que NO deben ser mayúsculas (correos, claves, pines)
      const sensitiveFields = [
        'customer_email', 
        'customer_phone', 
        'device_password', 
        'device_account', 
        'device_account_password', 
        'pin'
      ];

      // Si el campo NO está en la lista negra, lo hacemos mayúscula
      if (!sensitiveFields.includes(name)) {
        val = value ? value.toUpperCase() : "";
      } else {
        // Si es sensible, lo dejamos tal cual
        val = value;
      }
    }
    
    setOrder((prev) => ({ ...prev, [name]: val }));
  };

  // Función especial para manejar los cambios en el checklist anidado
  const handleChecklistChange = (e) => {
    const { name, value } = e.target;
    setOrder((prev) => ({
      ...prev,
      device_initial_check: {
        ...prev.device_initial_check,
        [name]: value,
      },
    }));
  };

  const handleSaveAndContinue = async () => {
    setLoading(true);
    setError("");
    try {
      // Esta función SOLO guarda, no cierra el modal, para poder subir fotos.
      if (orderId) {
        // En modo edición, usamos PATCH para actualizar los campos clave
        const response = await api.patch(`/work-orders/${orderId}`, {
          status: order.status,
          customer_phone: order.customer_phone,
          customer_address: order.customer_address || null,
          customer_email: order.customer_email || null,
          // Añadimos los campos que faltaban
          device_password: order.device_password || null,
          device_unlock_pattern: order.device_unlock_pattern || null,
          device_account: order.device_account || null,
          device_account_password: order.device_account_password || null,
        });
        setOrder((prev) => ({
          ...prev,
          ...response.data,
          // Re-aseguramos que email no sea null
          customer_email: response.data.customer_email || "",
        }));
        onSave(response.data);
      } else {
        const payload = {
          ...order,
          customer_address: order.customer_address || null,
          customer_email: order.customer_email || null,
        };
        const response = await api.post("/work-orders/", payload);
        // MUY IMPORTANTE: Después de crear, obtenemos el ID de la nueva orden
        // y actualizamos el estado para "convertir" el formulario a modo edición.
        onSave(response.data); // Esto refrescará la lista en segundo plano
        return; // Salimos para que el useEffect se encargue de recargar los datos
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Ocurrió un error al guardar.");
    } finally {
      setLoading(false);
    }
  };

  // La función que se pasa al componente de subida de imágenes
  const handleImagesUpdated = (newImageList) => {
    setOrder((prev) => ({ ...prev, images: newImageList }));
  };

  const handlePrint = async () => {
    if (!orderId) return;
    try {
      const response = await api.get(`/work-orders/${orderId}/print`, {
        responseType: "blob", // ¡Muy importante! Le decimos a Axios que esperamos un archivo.
      });

      // Creamos una URL temporal para el archivo PDF que recibimos.
      const fileURL = window.URL.createObjectURL(response.data);

      // Abrimos esa URL en una nueva pestaña del navegador.
      window.open(fileURL, "_blank");
    } catch (error) {
      console.error("Error al generar el PDF:", error);
      alert("No se pudo generar el PDF. Revise la consola para más detalles.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl text-gray-800 overflow-y-auto max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-secondary">
            {orderId
              ? `Ver / Editar Orden #${order.work_order_number}`
              : "Crear Nueva Orden de Trabajo"}
          </h2>
          {/* --- NUEVA LÍNEA --- Mostramos quién creó la orden si ya existe */}
          {orderId && order.user && (
            <p className="text-sm text-gray-500 mt-1">
              Orden creada por:{" "}
              <span className="font-semibold">{order.user.email}</span>
            </p>
          )}
        </div>

        {loading && <p>Cargando...</p>}
        {error && (
          <p className="bg-red-200 text-red-800 p-3 rounded-lg my-4">{error}</p>
        )}

        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          {/* ... (Las secciones de Cliente y Equipo no cambian, solo se añaden los nuevos campos) ... */}
          <fieldset className="border p-4 rounded-lg">
            <legend className="text-lg font-semibold px-2">
              Datos del Cliente
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                name="customer_name"
                value={order.customer_name}
                onChange={handleChange}
                placeholder="Nombre y Apellido"
                className="p-2 border rounded"
                required
                disabled={!!orderId}
              />
              <input
                type="text"
                name="customer_id_card"
                value={order.customer_id_card}
                onChange={handleChange}
                placeholder="Cédula"
                className="p-2 border rounded"
                required
                disabled={!!orderId}
              />
              <input
                type="text"
                name="customer_phone"
                value={order.customer_phone}
                onChange={handleChange}
                placeholder="Teléfono"
                className="p-2 border rounded"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <input
                type="text"
                name="customer_address"
                value={order.customer_address || ''} // Controlado para no ser null
                onChange={handleChange}
                placeholder="Dirección"
                className="p-2 border rounded md:col-span-2"
              />
              <input
                type="email"
                name="customer_email"
                value={order.customer_email || ''} // Controlado para no ser null
                onChange={handleChange}
                placeholder="Correo electrónico"
                className="p-2 border rounded"
              />
            </div>
          </fieldset>

          <fieldset className="border p-4 rounded-lg">
            <legend className="text-lg font-semibold px-2">
              Datos del Equipo
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                name="device_type"
                value={order.device_type}
                onChange={handleChange}
                className="p-2 border rounded"
                disabled={!!orderId}
              >
                <option>Celular</option> <option>Tablet</option>{" "}
                <option>Laptop</option> <option>PC</option>{" "}
                <option>Otro</option>
              </select>
              <input
                type="text"
                name="device_brand"
                value={order.device_brand}
                onChange={handleChange}
                placeholder="Marca (Ej: Samsung)"
                className="p-2 border rounded"
                required
                disabled={!!orderId}
              />
              <input
                type="text"
                name="device_model"
                value={order.device_model}
                onChange={handleChange}
                placeholder="Modelo (Ej: Galaxy S22)"
                className="p-2 border rounded"
                required
                disabled={!!orderId}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <input
                type="text"
                name="device_serial"
                value={order.device_serial || ""}
                onChange={handleChange}
                placeholder="Serie / IMEI"
                className="p-2 border rounded"
                disabled={!!orderId}
              />
              <input
                type="text"
                name="device_password"
                value={order.device_password || ""}
                onChange={handleChange}
                placeholder="PIN / Contraseña"
                className="p-2 border rounded"
              />
              <input
                type="text"
                name="device_unlock_pattern"
                value={order.device_unlock_pattern || ""}
                onChange={handleChange}
                placeholder="Patrón de Desbloqueo"
                className="p-2 border rounded"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <input
                type="text"
                name="device_account"
                value={order.device_account || ""}
                onChange={handleChange}
                placeholder="Cuenta Google / iCloud"
                className="p-2 border rounded"
              />
              <input
                type="text"
                name="device_account_password"
                value={order.device_account_password || ""}
                onChange={handleChange}
                placeholder="Contraseña de la Cuenta"
                className="p-2 border rounded"
              />
            </div>
          </fieldset>

          {/* --- NUEVA SECCIÓN: CHECKLIST DE INGRESO --- */}
          <fieldset className="border p-4 rounded-lg">
            <legend className="text-lg font-semibold px-2">
              Checklist de Ingreso
            </legend>
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="customer_declined_check"
                name="customer_declined_check"
                checked={order.customer_declined_check}
                onChange={handleChange}
                className="h-4 w-4 rounded"
              />
              <label
                htmlFor="customer_declined_check"
                className="ml-2 font-semibold text-sm text-red-600"
              >
                Cliente no desea esperar por la revisión
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              <CheckListItem
                label="¿Equipo enciende?"
                name="enciende"
                value={order.device_initial_check.enciende}
                onChange={handleChecklistChange}
                disabled={order.customer_declined_check}
              />
              {/* El resto de la lista solo se muestra si el equipo enciende */}
              {order.device_initial_check.enciende === "si" && (
                <>
                  <CheckListItem
                    label="Cámara"
                    name="camara"
                    value={order.device_initial_check.camara}
                    onChange={handleChecklistChange}
                    disabled={order.customer_declined_check}
                  />
                  <CheckListItem
                    label="Micrófono"
                    name="microfono"
                    value={order.device_initial_check.microfono}
                    onChange={handleChecklistChange}
                    disabled={order.customer_declined_check}
                  />
                  <CheckListItem
                    label="Wi-Fi"
                    name="wifi"
                    value={order.device_initial_check.wifi}
                    onChange={handleChecklistChange}
                    disabled={order.customer_declined_check}
                  />
                  <CheckListItem
                    label="Señal"
                    name="signal"
                    value={order.device_initial_check.signal}
                    onChange={handleChecklistChange}
                    disabled={order.customer_declined_check}
                  />
                  <CheckListItem
                    label="Carga"
                    name="carga"
                    value={order.device_initial_check.carga}
                    onChange={handleChecklistChange}
                    disabled={order.customer_declined_check}
                  />
                  <CheckListItem
                    label="Altavoz"
                    name="altavoz"
                    value={order.device_initial_check.altavoz}
                    onChange={handleChecklistChange}
                    disabled={order.customer_declined_check}
                  />
                  <CheckListItem
                    label="Pantalla Táctil"
                    name="tactil"
                    value={order.device_initial_check.tactil}
                    onChange={handleChecklistChange}
                    disabled={order.customer_declined_check}
                  />
                  <CheckListItem
                    label="Lectura de SIM"
                    name="sim"
                    value={order.device_initial_check.sim}
                    onChange={handleChecklistChange}
                    disabled={order.customer_declined_check}
                  />
                  <CheckListItem
                    label="Audífonos"
                    name="audifonos"
                    value={order.device_initial_check.audifonos}
                    onChange={handleChecklistChange}
                    disabled={order.customer_declined_check}
                  />
                </>
              )}
            </div>
          </fieldset>

          {/* --- NUEVA SECCIÓN: FOTOS DEL EQUIPO --- */}
          <fieldset className="border p-4 rounded-lg">
            <legend className="text-lg font-semibold px-2">
              Fotos del Estado Físico
            </legend>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <ImageUploader
                tag="frontal"
                label="Frontal"
                orderId={orderId}
                onUpload={handleImagesUpdated}
              />
              <ImageUploader
                tag="trasera"
                label="Trasera"
                orderId={orderId}
                onUpload={handleImagesUpdated}
              />
              <ImageUploader
                tag="superior"
                label="Borde Superior"
                orderId={orderId}
                onUpload={handleImagesUpdated}
              />
              <ImageUploader
                tag="inferior"
                label="Borde Inferior"
                orderId={orderId}
                onUpload={handleImagesUpdated}
              />
              <ImageUploader
                tag="izquierdo"
                label="Borde Izquierdo"
                orderId={orderId}
                onUpload={handleImagesUpdated}
              />
              <ImageUploader
                tag="derecho"
                label="Borde Derecho"
                orderId={orderId}
                onUpload={handleImagesUpdated}
              />
            </div>
            {/* Galería de imágenes ya subidas */}
            <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
              {order.images.map((img) => (
                <div key={img.id} className="relative">
                  <img
                    src={`${
                      import.meta.env.VITE_API_URL || "http://localhost:8000"
                    }${img.image_url}`}
                    alt={img.tag}
                    className="w-full h-20 object-cover rounded shadow-md"
                  />
                  <span className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs text-center p-0.5">
                    {img.tag}
                  </span>
                </div>
              ))}
            </div>
          </fieldset>

          {/* El resto del formulario no cambia mucho */}
          <fieldset className="border p-4 rounded-lg">
            <legend className="text-lg font-semibold px-2">
              Problema y Costos
            </legend>
            <textarea
              name="reported_issue"
              value={order.reported_issue}
              onChange={handleChange}
              placeholder="Problema reportado por el cliente..."
              className="w-full p-2 border rounded mb-4"
              required
              disabled={!!orderId}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold">Costo Estimado ($)</label>
                <input
                  type="number"
                  step="0.01"
                  name="estimated_cost"
                  value={order.estimated_cost}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                  required
                  disabled={!!orderId}
                />
              </div>
              <div>
                <label className="font-semibold">Abono Inicial ($)</label>
                <input
                  type="number"
                  step="0.01"
                  name="deposit_amount"
                  value={order.deposit_amount}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                  disabled={!!orderId}
                />
              </div>
              {/* --- NUEVO: Selector de Pago para el Adelanto --- */}
            {/* Solo aparece si es orden nueva (no tiene ID) y hay un monto mayor a 0 */}
            {!orderId && parseFloat(order.deposit_amount) > 0 && (
              <div className="animate-fade-in-down">
                <label className="block text-sm font-medium text-gray-700">Método de Pago (Anticipo)</label>
                <select
                  name="deposit_payment_method"
                  value={order.deposit_payment_method}
                  onChange={handleChange}
                  className="w-full p-2 border rounded bg-yellow-50 border-yellow-200 text-yellow-800 font-bold"
                >
                  <option value="EFECTIVO">💵 Efectivo</option>
                  <option value="TRANSFERENCIA">🏦 Transferencia</option>
                  <option value="TARJETA">💳 Tarjeta</option>
                  <option value="OTRO">🔖 Otro</option>
                </select>
              </div>
            )}
            {/* ------------------------------------------------ */}
            </div>
          </fieldset>

          {orderId && (
            <div>
              <label className="font-semibold text-gray-600 block mb-2">
                Actualizar Estado
              </label>
              <select
                name="status"
                value={order.status}
                onChange={handleChange}
                className="w-full p-2 border rounded-lg bg-gray-100"
              >
                <option>RECIBIDO</option>
                <option>EN_REVISION</option>
                <option>REPARANDO</option>
                <option>LISTO</option>
                <option>ENTREGADO</option>
                <option>SIN_REPARACION</option>
              </select>
            </div>
          )}

          {!orderId && (
            <div>
              <label className="font-semibold text-gray-600 block mb-2">
                Tu PIN de Seguridad
              </label>
              <input
                type="password"
                name="pin"
                value={order.pin}
                onChange={handleChange}
                className="w-full p-2 border rounded"
                required
              />
            </div>
          )}

          <div className="mt-6 flex justify-between items-center">
            <div>
              {/* Botón de Imprimir, por ahora desactivado */}
              <button
                type="button"
                onClick={handlePrint}
                disabled={!orderId}
                className="py-2 px-4 bg-detail text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-gray-300"
              >
                Imprimir
              </button>
            </div>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-4 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleSaveAndContinue}
                disabled={loading}
                className="py-2 px-6 bg-accent text-white font-bold rounded-lg hover:bg-teal-600 disabled:bg-gray-400"
              >
                {orderId ? "Actualizar" : "Guardar y Continuar"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default WorkOrderForm;