import React, { useState, useEffect, useRef } from "react";
import api from "../services/api";
// Importamos íconos modernos para la interfaz de fotos
import { HiOutlineCamera, HiOutlinePhotograph, HiOutlineCloudUpload, HiOutlineTrash, HiOutlineGlobeAlt } from "react-icons/hi";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

function ProductForm({ productToEdit, onSave, onClose }) {
  const { user } = useContext(AuthContext);
  const canEditCost = user?.role === "admin" || user?.role === "inventory_manager";

  // Estilos para ocultar flechas en inputs numéricos
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

  // Estado para almacenar los datos del producto que se está creando o editando.
 const [product, setProduct] = useState({
   sku: "",
    name: "",
    description: "",
    price_1: 0,
    price_2: 0,
    price_3: 0,
    average_cost: 0, // <-- Añadimos el estado para el costo
    category_id: null,
    is_active: true,
    is_public: false, // <--- NUEVO ESTADO POR DEFECTO
    images: [],
  });

  // Estados para la gestión de categorías y proveedores.
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]); 
  
  // Estados para modales internos (Categoría y Proveedor)
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false); // <--- NUEVO
  const [newSupplierName, setNewSupplierName] = useState("");        // <--- NUEVO

  // Estado para saber si la empresa es Distribuidora (para el default inteligente)
  const [isDistributor, setIsDistributor] = useState(false);

  // Estados para la gestión de subida de imágenes.
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // --- Estados y refs para la cámara (captura embebida) ---
  // Muestra/oculta el modal
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  // Para mostrar errores de cámara (si permisos o dispositivo fallan)
  const [cameraError, setCameraError] = useState("");
  // --- MODO BLITZ ---
  const [isBlitzMode, setIsBlitzMode] = useState(false); // Por defecto apagado

  // Función para resetear el formulario (para el modo blitz)
  const resetForm = () => {
    setProduct({
      sku: "", // Se autogenerará si está vacío en el backend, o se deja vacío para llenarlo a mano
      name: "",
      description: "",
      price_1: 0,
      price_2: 0,
      price_3: 0,
      average_cost: 0,
      category_id: product.category_id, // Mantenemos la categoría anterior para agilizar
      is_active: true,
      // Mantenemos la lógica inteligente al resetear:
      is_public: isDistributor, 
      images: [],
    });
    setSelectedFile(null); // Limpiamos selección de archivo
  };
  // Referencias a video/canvas y al stream para poder detenerlo luego
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  // Referencia para activar el input de archivo oculto
  const fileInputRef = useRef(null);

  // Se ejecuta cuando el componente se carga o cuando 'productToEdit' cambia.
  useEffect(() => {
    // Cargar Categorías
    api.get("/categories/").then((response) => {
        setCategories(response.data);
        if (!productToEdit) {
            const generalCat = response.data.find(c => c.name.toUpperCase() === "GENERAL");
            if (generalCat) {
                setProduct(prev => ({ ...prev, category_id: generalCat.id }));
            }
        }
    });

    // Cargar Proveedores
    api.get("/suppliers/").then((response) => setSuppliers(response.data));

    // --- LÓGICA INTELIGENTE: Consultar si soy Distribuidor ---
    api.get("/company/distributor-status").then((response) => {
      const imDistributor = response.data.is_distributor;
      setIsDistributor(imDistributor); // Guardamos el dato para resets futuros

      // SOLO si es un producto NUEVO, aplicamos la regla automática
      if (!productToEdit) {
        setProduct((prev) => ({
          ...prev,
          // Si soy distribuidor -> is_public = true (Visible por defecto)
          // Si soy taller -> is_public = false (Privado por defecto)
          is_public: imDistributor, 
        }));
      }
    });
    // ---------------------------------------------------------

    if (productToEdit) {
      setProduct({
        ...productToEdit,
        category_id: productToEdit.category?.id || null,
        supplier_id: productToEdit.supplier?.id || null, 
        images: productToEdit.images || [],
        // --- ARREGLO ERROR REACT: Asegurar que sea booleano (true/false) ---
        is_public: !!productToEdit.is_public, 
        // -------------------------------------------------------------------
      });
    }
  }, [productToEdit]);
  // Maneja los cambios en los campos del formulario.
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    let val;
    if (type === "checkbox") {
      val = checked;
    } else if (name.startsWith("price") || name === "average_cost") {
      val = value === "" ? "" : parseFloat(value);
    } else if (name === "category_id" || name === "supplier_id") {
      val = value ? parseInt(value) : null;
    } else {
      val = value ? value.toUpperCase() : "";
    }

    setProduct((prev) => {
        const newData = { ...prev, [name]: val };
        
        // AUTO-GENERAR SKU SI ESTÁ VACÍO Y ESTAMOS ESCRIBIENDO EL NOMBRE EN MODO BLITZ
        if (isBlitzMode && name === "name" && !productToEdit) {
            // Genera SKU simple: 3 primeras letras + timestamp corto para evitar duplicados
            const cleanName = val.replace(/[^A-Z0-9]/g, "").substring(0, 3);
            if (cleanName.length >= 3) {
                // Usamos minutos y segundos para algo pseudo-único y corto
                const timeCode = Date.now().toString().slice(-4); 
                newData.sku = `${cleanName}-${timeCode}`;
            }
        }
        return newData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // MODO BLITZ
    if (isBlitzMode && !productToEdit) { 
        await onSave(product, true); 
        
        // Reset inteligente: mantenemos la categoría actual
        const currentCat = product.category_id;
        resetForm();
        setProduct(prev => ({ ...prev, category_id: currentCat })); // Restauramos categoría
        
    } else {
        onSave(product);
    }
  };

  // Maneja la creación de una nueva categoría.
  const handleCreateCategory = async () => {
    if (!newCategoryName) return;
    try {
      const response = await api.post("/categories/", {
        name: newCategoryName,
      });
      const newCategory = response.data;
      setCategories((prev) => [...prev, newCategory]);
      setProduct((prev) => ({ ...prev, category_id: newCategory.id }));
      setIsCreatingCategory(false);
      setNewCategoryName("");
    } catch (error) {
      alert("Error al crear la categoría.");
    }
  };

// Maneja la creación de un nuevo proveedor (Rápido).
  const handleCreateSupplier = async () => {
    if (!newSupplierName) return;
    try {
      // Enviamos solo el nombre para crearlo rápido. Luego se pueden editar los detalles.
      const response = await api.post("/suppliers/", {
        name: newSupplierName,
      });
      const newSupplier = response.data;
      
      // Actualizamos la lista y seleccionamos el nuevo automáticamente
      setSuppliers((prev) => [...prev, newSupplier]);
      setProduct((prev) => ({ ...prev, supplier_id: newSupplier.id }));
      
      setIsCreatingSupplier(false);
      setNewSupplierName("");
    } catch (error) {
      console.error(error);
      alert("Error al crear el proveedor. Verifique que no exista ya.");
    }
  };

  // Sube la imagen seleccionada al backend.
  // Sube la imagen seleccionada o (si se provee) un archivo/Blob directo
  const handleImageUpload = async (fileArg = null, customName = null) => {
    const fileToSend = fileArg || selectedFile;
    if (!fileToSend) {
      alert("Por favor, selecciona una imagen primero.");
      return;
    }
    if (!productToEdit || !productToEdit.id) {
      alert("Primero guarda/selecciona un producto para asociar la imagen.");
      return;
    }
    setIsUploading(true);
    const formData = new FormData();

    // --- ¡AQUÍ ESTÁ EL ARREGLO (30/10/2025)! ---
    // La regla de oro: SIEMPRE re-empaquetamos el archivo para
    // asegurarnos de que el navegador le ponga la etiqueta de "tipo" (Content-Type) correcta.
    
    let finalFile;

    // 1. Generamos un nombre seguro
    const safeName = (product.name || "producto")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_\-]/g, "");
    
    // 2. Determinamos el nombre y el tipo del archivo
    let fileName;
    let fileType;

    if (fileToSend instanceof File) {
      // Si es un ARCHIVO SUBIDO (de la PC), usamos su nombre y tipo original
      fileName = customName || fileToSend.name;
      fileType = fileToSend.type;
    } else {
      // Si es un BLOB (de la cámara), inventamos un nombre .jpg
      fileName = customName || `${safeName}_${Date.now()}.jpg`;
      fileType = "image/jpeg";
    }

    // 3. ¡El re-empaquetado! SIEMPRE creamos un sobre (File) nuevo y estándar.
    // Metemos el contenido (fileToSend) en el sobre nuevo (new File)
    finalFile = new File([fileToSend], fileName, { type: fileType });
    // --- FIN DEL ARREGLO ---

    formData.append("file", finalFile);

    try {
      const response = await api.post(
        `/products/${productToEdit.id}/upload-image/`,
        formData
      );
      // NOTA: NO forzamos 'Content-Type' aquí porque el navegador debe generar el boundary
      // Si lo ponemos a mano, FastAPI recibe un multipart incompleto y responde 422.
      setProduct((prev) => ({ ...prev, images: response.data.images }));
      setSelectedFile(null); // Limpiamos el selector de archivo
    } catch (error) {
      console.error(error);
      alert("Error al subir la imagen.");
    } finally {
      setIsUploading(false);
    }
  };

  // --- CÁMARA: abrir flujo de video con facingMode "environment" en móviles ---
  const openCamera = async () => {
    setCameraError("");
    setIsCameraOpen(true);
    try {
      // En móviles intentamos la cámara trasera; en desktop usará la disponible
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Asegura reproducción en algunos navegadores
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(() => {
            /* autoplay policy */
          });
        };
      }
    } catch (err) {
      console.error("Error al abrir cámara:", err);
      setCameraError(
        "No se pudo acceder a la cámara. Revisa permisos y que no esté en uso por otra app."
      );
    }
  };

  // Cerrar cámara y liberar recursos
  const closeCamera = () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    } catch {}
    setIsCameraOpen(false);
  };

  // Tomar foto del video y subirla como JPEG
  const takePhotoAndUpload = async () => {
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      // Tamaño real del video (evita imagen negra)
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, w, h);

      // Convertir a Blob JPEG y subir
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            alert("No se pudo capturar la imagen.");
            return;
          }
          const safeName = (product.name || "producto")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_\-]/g, "");
          const photoName = `${safeName}_${
            (product.images?.length || 0) + 1
          }.jpg`;

          await handleImageUpload(blob, photoName);
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

  // Envía la orden para eliminar una imagen.
  const handleImageDelete = async (imageId) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar esta imagen?")) {
      try {
        await api.delete(`/product-images/${imageId}`);
        setProduct((prev) => ({
          ...prev,
          images: prev.images.filter((image) => image.id !== imageId),
        }));
      } catch (error) {
        alert("Error al eliminar la imagen.");
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-40 flex items-center justify-center">
      <div
        className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl text-gray-800 overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-secondary">
            {productToEdit ? "Editar" : "Crear"} Producto
            </h2>
            {/* TOGGLE MODO BLITZ (Solo al crear) */}
            {!productToEdit && (
                <div className="flex items-center gap-2 bg-yellow-100 px-3 py-1 rounded-full border border-yellow-300">
                    <label className="text-sm font-bold text-yellow-800 cursor-pointer select-none" htmlFor="blitzToggle">
                        ⚡ Modo Rápido
                    </label>
                    <input 
                        id="blitzToggle"
                        type="checkbox" 
                        checked={isBlitzMode} 
                        onChange={(e) => setIsBlitzMode(e.target.checked)}
                        className="w-4 h-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
                    />
                </div>
            )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* --- CODIGO DEL FORMULARIO --- */}
          {/* FORMULARIO EN INVENTARIOS PARA CREAR O EDITAR NUEVO PRODUCTO Y AÑADIR STOCK INICIAL*/}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold">SKU</label>
              <input
                type="text"
                name="sku"
                value={product.sku}
                onChange={handleChange}
                className="w-full p-2 border rounded "
                required
              />
            </div>
            <div>
              <label className="font-semibold">Nombre</label>
              <input
                type="text"
                name="name"
                value={product.name}
                onChange={handleChange}
                className="w-full p-2 border rounded "
                required
              />
            </div>
          </div>
          {/* Descripción solo visible si NO es modo Blitz */}
          {!isBlitzMode && (
            <div>
                <label className="font-semibold">Descripción</label>
                <textarea
                name="description"
                value={product.description || ""}
                onChange={handleChange}
                className="w-full p-2 border rounded "
                />
            </div>
          )}
          <style>{noArrowsStyle}</style>

          {/* Fila de Precios de Venta (REORDENADA LÓGICAMENTE) */}
          <div className={`grid grid-cols-1 ${isBlitzMode ? 'md:grid-cols-1' : 'md:grid-cols-3'} gap-4`}>
            {/* PRECIO 3: Precio Final PVP (El más alto) */}
            <div>
              <label className="font-bold text-gray-700 text-sm">Precio Final (PVP)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  name="price_3"
                  // [ARREGLO] Si es 0, mostramos vacío para que puedas escribir
                  value={product.price_3 === 0 ? "" : product.price_3}
                  onChange={handleChange}
                  className="w-full p-2 pl-6 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-800"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* PRECIOS SECUNDARIOS: Ocultos en modo Blitz para ir rápido */}
            {!isBlitzMode && (
                <>
                    {/* PRECIO 2: Descuento */}
                    <div>
                    <label className="font-semibold text-gray-600 text-sm">Con Descuento</label>
                    <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-400">$</span>
                        <input
                        type="number"
                        step="0.01"
                        name="price_2"
                        value={product.price_2 === 0 ? "" : product.price_2}
                        onChange={handleChange}
                        className="w-full p-2 pl-6 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="0.00"
                        />
                    </div>
                    </div>

                    {/* PRECIO 1: PRECIO DISTRIBUIDOR (El que sale en la web pública) */}
                    <div>
                    <label className="font-bold text-blue-600 text-sm">Precio para Distribuidor (Web)</label>
                    <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-400">$</span>
                        <input
                        type="number"
                        step="0.01"
                        name="price_1"
                        value={product.price_1 === 0 ? "" : product.price_1}
                        onChange={handleChange}
                        className="w-full p-2 pl-6 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="0.00"
                        />
                    </div>
                    </div>
                </>
            )}
          </div>

          {/* Campo de Costo Promedio (Oculto en Blitz) */}
          {!isBlitzMode && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-2">
                <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-gray-700 text-sm">Costo Promedio (Interno)</label>
                    {!canEditCost && <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">Solo Admin</span>}
                </div>
                <p className="text-xs text-gray-500 mb-2">
                Costo real de compra. Se actualiza automáticamente con las facturas.
                </p>
                <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                    type="number"
                    step="0.0001" // Más precisión para costos
                    name="average_cost"
                    value={product.average_cost === 0 ? "" : product.average_cost}
                    onChange={handleChange}
                    disabled={!canEditCost}
                    className={`w-full p-2 pl-6 border rounded outline-none ${!canEditCost ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white border-gray-300 focus:ring-2 focus:ring-blue-500'}`}
                    placeholder="0.00"
                    />
                </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SECCIÓN CATEGORÍA */}
            <div>
                <label className="font-semibold">Categoría</label>
                <div className="flex items-center space-x-2">
                <select
                    name="category_id"
                    value={product.category_id || ""}
                    onChange={handleChange}
                    className="w-full p-2 border rounded "
                >
                    <option value="">Sin Categoría</option>
                    {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                        {cat.name}
                    </option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={() => setIsCreatingCategory(true)}
                    className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
                    title="Nueva Categoría"
                >
                    +
                </button>
                </div>
            </div>

            {/* SECCIÓN PROVEEDOR */}
            <div>
                <label className="font-semibold">Proveedor (Origen)</label>
                <div className="flex items-center space-x-2">
                    <select
                        name="supplier_id"
                        value={product.supplier_id || ""}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                    >
                        <option value="">-- Seleccionar Proveedor --</option>
                        {suppliers.map((sup) => (
                        <option key={sup.id} value={sup.id}>
                            {sup.name}
                        </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={() => setIsCreatingSupplier(true)}
                        className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 font-bold"
                        title="Nuevo Proveedor"
                    >
                        +
                    </button>
                </div>
            </div>
          </div>

          {/* FORMULARIO RÁPIDO PARA NUEVO PROVEEDOR */}
          {isCreatingSupplier && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mt-2">
              <label className="font-semibold text-blue-800 text-sm">
                Nombre del Nuevo Proveedor
              </label>
              <div className="flex items-center space-x-2 mt-2">
                <input
                  type="text"
                  value={newSupplierName}
                  // Nombre en mayúsculas
                  onChange={(e) => setNewSupplierName(e.target.value.toUpperCase())}
                  className="w-full p-2 border rounded bg-white"
                  placeholder="Ej: DISTRIBUIDORA XYZ"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCreateSupplier}
                  className="py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-sm"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingSupplier(false)}
                  className="py-2 px-4 text-gray-500 hover:text-red-500 font-bold"
                >
                  X
                </button>
              </div>
            </div>
          )}
          
          {/* SECCIÓN CREAR CATEGORÍA (Condicional) */}
          {isCreatingCategory && (
            <div className="p-4 bg-gray-100 rounded-lg">
              <label className="font-semibold">
                Nombre de la Nueva Categoría
              </label>
              <div className="flex items-center space-x-2 mt-2">
                <input
                  type="text"
                  value={newCategoryName}
                  // Categoría en mayúsculas
                  onChange={(e) => setNewCategoryName(e.target.value.toUpperCase())}
                  className="w-full p-2 border rounded"
                  placeholder="Ej: Accesorios de Celular"
                />
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  className="py-2 px-4 bg-accent text-white rounded-lg"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingCategory(false)}
                  className="py-2 px-4"
                >
                  X
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center gap-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            {/* Checkbox Activo (Interno) */}
            <div className="flex items-center">
              <input
                type="checkbox"
                name="is_active"
                checked={product.is_active}
                onChange={handleChange}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
              />
              <label className="ml-2 font-semibold text-gray-700">Activo (Interno)</label>
            </div>

            {/* Checkbox Público (Externo) */}
            <div className="flex items-center">
              <div className="relative flex items-start">
                <div className="flex h-5 items-center">
                  <input
                    id="is_public"
                    name="is_public"
                    type="checkbox"
                    checked={product.is_public}
                    onChange={handleChange}
                    className="h-5 w-5 text-green-600 rounded focus:ring-green-500 border-gray-300"
                  />
                </div>
                <div className="ml-2 text-sm">
                  <label htmlFor="is_public" className="font-bold text-gray-800 flex items-center gap-1 cursor-pointer">
                    <HiOutlineGlobeAlt className="w-5 h-5 text-green-600" />
                    Publicar en Catálogo Web
                  </label>
                  <p className="text-gray-500 text-xs">Visible para otros técnicos en el buscador.</p>
                </div>
              </div>
            </div>
          </div>
          {/* --- FIN DEL CÓDIGO RESTAURADO --- */}

          <div className="mt-6 flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="py-2 px-4 bg-accent text-white font-bold rounded-lg hover:bg-teal-600"
            >
              Guardar Producto
            </button>
          </div>
        </form>

        {productToEdit && (
          <div className="mt-8 border-t pt-6">
            <h3 className="text-xl font-bold text-secondary mb-4">
              Galería de Imágenes
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 mb-4">
              {product.images.map((image) => (
                <div key={image.id} className="relative group">
                  <img
                    // Usamos la "agenda" para saber dónde está el almacén
                    src={`${
                      import.meta.env.VITE_API_URL || "http://localhost:8000"
                    }${image.image_url}`}
                    alt={product.name}
                    className="w-full h-24 object-cover rounded-lg shadow-md"
                  />
                  <button
                    type="button"
                    onClick={() => handleImageDelete(image.id)}
                    className="absolute top-0 right-0 bg-red-500 text-white rounded-full h-6 w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Eliminar imagen"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>

            <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
              <label className="font-bold text-gray-700 block mb-4 text-center">
                Añadir Nueva Imagen
              </label>

              {/* Input Oculto (La tubería invisible) */}
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef} // Conectamos el control remoto
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden" // ¡Invisible!
              />

              {!selectedFile ? (
                // OPCIÓN A: NO HAY ARCHIVO SELECCIONADO -> MOSTRAR BOTONES GRANDES
                <div className="grid grid-cols-2 gap-4">
                  {/* Botón 1: Cámara */}
                  <button
                    type="button"
                    onClick={openCamera}
                    className="flex flex-col items-center justify-center p-6 bg-white border-2 border-dashed border-gray-300 rounded-xl hover:border-accent hover:bg-teal-50 transition-all group"
                  >
                    <div className="bg-teal-100 p-3 rounded-full mb-2 group-hover:bg-teal-200 transition-colors">
                        <HiOutlineCamera className="w-8 h-8 text-accent" />
                    </div>
                    <span className="font-bold text-gray-600 group-hover:text-accent">Tomar Foto</span>
                  </button>

                  {/* Botón 2: Galería / Archivos */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current.click()} // Clic al input oculto
                    className="flex flex-col items-center justify-center p-6 bg-white border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
                  >
                    <div className="bg-blue-100 p-3 rounded-full mb-2 group-hover:bg-blue-200 transition-colors">
                        <HiOutlinePhotograph className="w-8 h-8 text-blue-600" />
                    </div>
                    <span className="font-bold text-gray-600 group-hover:text-blue-600">Subir Archivo</span>
                  </button>
                </div>
              ) : (
                // OPCIÓN B: ARCHIVO SELECCIONADO -> MOSTRAR PREVISUALIZACIÓN Y CONFIRMAR
                <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm flex items-center justify-between animate-fade-in">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="bg-blue-100 p-2 rounded-lg">
                        <HiOutlinePhotograph className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate max-w-[150px]">{selectedFile.name}</p>
                        <p className="text-xs text-green-600 font-semibold">Listo para subir</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Cancelar"
                    >
                        <HiOutlineTrash className="w-5 h-5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => handleImageUpload()}
                        disabled={isUploading}
                        className="flex items-center gap-2 py-2 px-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition-all active:scale-95 disabled:bg-gray-400"
                    >
                        {isUploading ? "..." : <><HiOutlineCloudUpload className="w-5 h-5"/> Subir</>}
                    </button>
                  </div>
                </div>
              )}

              {/* MODAL DE CÁMARA (Solo visible si se activa) */}
              {isCameraOpen && (
                  <div
                    className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4"
                    onClick={closeCamera}
                  >
                    <div
                      className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-4 overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h4 className="text-lg font-bold text-gray-800 mb-3 text-center">
                        Capturar Foto
                      </h4>

                      {cameraError && (
                        <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-3 text-sm text-center">
                          {cameraError}
                        </div>
                      )}

                      <div className="bg-black rounded-xl overflow-hidden shadow-inner aspect-[4/3] relative">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Canvas oculto */}
                      <canvas ref={canvasRef} className="hidden" />

                      <div className="grid grid-cols-2 gap-4 mt-6">
                        <button
                          type="button"
                          onClick={closeCamera}
                          className="py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={takePhotoAndUpload}
                          className="py-3 px-4 bg-accent text-white font-bold rounded-xl hover:bg-teal-600 shadow-lg flex justify-center items-center gap-2"
                        >
                          <HiOutlineCamera className="w-5 h-5" />
                          Capturar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductForm;