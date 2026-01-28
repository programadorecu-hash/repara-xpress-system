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
    average_cost: 0,
    category_id: null,
    supplier_id: null,
    is_active: true,
    is_public: false,
    images: [],
    // --- NUEVO: ATRIBUTOS ESTRUCTURADOS ---
    product_type: "", // <--- EL QUÉ (Pantalla, Cable, Mica)
    brand: "",
    model: "",
    color: "",
    compatibility: "",
    condition: "NUEVO"
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
  
  // --- VISOR DE IMÁGENES (LIGHTBOX) ---
  const [viewImage, setViewImage] = useState(null); // Guarda la imagen que se está viendo en grande

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
        is_public: !!productToEdit.is_public,
        // --- CARGAR ATRIBUTOS ---
        product_type: productToEdit.product_type || "",
        brand: productToEdit.brand || "",
        model: productToEdit.model || "",
        color: productToEdit.color || "",
        compatibility: productToEdit.compatibility || "",
        condition: productToEdit.condition || "NUEVO"
      });
    }
  }, [productToEdit]);
  // --- CEREBRO: GENERADOR DE SKU Y NOMBRE ---
  useEffect(() => {
    // Si estamos editando, NO tocamos nada (para no cambiar SKUs históricos)
    if (productToEdit) return;

    // 1. Obtener código de categoría
    const catObj = categories.find(c => c.id === parseInt(product.category_id));
    const catCode = catObj ? catObj.name.substring(0, 3).toUpperCase() : "GEN";

    // 2. Limpiar atributos
    const clean = (str) => (str || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    
    const typeCode = clean(product.product_type).substring(0, 3); // Ej: PAN (Pantalla)
    const brandCode = clean(product.brand).substring(0, 3);
    const modelCode = clean(product.model).substring(0, 4);
    const colorCode = clean(product.color).substring(0, 3);
    const condCode = clean(product.condition).substring(0, 1);

    // 3. GENERAR SKU: CAT-TIP-MAR-MOD
    let autoSku = `${catCode}`;
    if (typeCode) autoSku += `-${typeCode}`; // Agregamos el Tipo al SKU
    if (brandCode) autoSku += `-${brandCode}`;
    if (modelCode) autoSku += `-${modelCode}`;
    if (colorCode) autoSku += `-${colorCode}`;
    if (condCode) autoSku += `-${condCode}`;

    // Si falta info, añadimos timestamp para evitar duplicados
    if (autoSku.length < 8) autoSku += `-${Date.now().toString().slice(-4)}`;

    // 4. GENERAR NOMBRE: TIPO + MARCA + MODELO + COLOR + CONDICION
    let autoName = "";
    // OJO: Ya no ponemos la Categoría primero, ponemos el TIPO (es más específico)
    if (product.product_type) autoName += `${product.product_type} `; 
    if (product.brand) autoName += `${product.brand} `;
    if (product.model) autoName += `${product.model} `;
    if (product.compatibility) autoName += `(Para ${product.compatibility}) `;
    if (product.color) autoName += `${product.color} `;
    if (product.condition && product.condition !== "NUEVO") autoName += `[${product.condition}]`;

    // Fallback: Si no puso Tipo, usamos la Categoría como respaldo para que no quede vacío
    if (!product.product_type && catObj) autoName = `${catObj.name} ` + autoName;

    setProduct(prev => ({
        ...prev,
        sku: autoSku,
        name: autoName.trim() || ""
    }));
  }, [product.product_type, product.brand, product.model, product.color, product.condition, product.category_id, product.compatibility]);

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
    <div className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* HEADER ELEGANTE */}
        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-start bg-gradient-to-r from-gray-50 to-white">
            <div>
                <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight">
                    {productToEdit ? "Editar Producto" : "Nuevo Producto"}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                    {productToEdit ? "Modifica los detalles del ítem." : "Define los atributos y el sistema generará el SKU."}
                </p>
            </div>
            
            <div className="flex flex-col items-end gap-3">
                {/* PREVISUALIZACIÓN DE SKU */}
                <div className="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 text-right shadow-sm">
                    <span className="block text-[10px] text-indigo-400 font-bold uppercase tracking-wider">SKU Generado</span>
                    <span className="font-mono text-lg font-black text-indigo-700 tracking-tight">
                        {product.sku || "..."}
                    </span>
                </div>

                {/* TOGGLE MODO BLITZ */}
                {!productToEdit && (
                    <label className="flex items-center gap-2 cursor-pointer group bg-white px-3 py-1.5 rounded-lg border border-gray-200 hover:border-yellow-300 transition-all shadow-sm">
                        <input 
                            type="checkbox" 
                            checked={isBlitzMode} 
                            onChange={(e) => setIsBlitzMode(e.target.checked)}
                            className="w-4 h-4 text-yellow-500 focus:ring-yellow-400 border-gray-300 rounded"
                        />
                        <span className="text-xs font-bold text-gray-600 group-hover:text-yellow-600 transition-colors">⚡ Modo Rápido</span>
                    </label>
                )}
            </div>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
            <form onSubmit={handleSubmit}>
              <style>{noArrowsStyle}</style>

              {/* SECCIÓN 1: DEFINICIÓN DEL PRODUCTO */}
              <div className="space-y-4">
                 <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">1</div>
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Identidad del Producto</h3>
                 </div>
                 
                 <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-200/60 shadow-sm grid grid-cols-1 md:grid-cols-6 gap-5 transition-all focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50/50">
                    
                    {/* TIPO DE PRODUCTO (FULL WIDTH) */}
                    <div className="md:col-span-6">
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">¿Qué es? (Tipo)</label>
                       <input 
                            type="text" 
                            name="product_type" 
                            value={product.product_type || ""} 
                            onChange={handleChange} 
                            placeholder="Ej: PANTALLA, CABLE, PARLANTE..." 
                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-bold text-blue-900 placeholder-gray-300 transition-all text-sm uppercase shadow-sm" 
                            autoFocus={!productToEdit} 
                        />
                    </div>

                    {/* MARCA */}
                    <div className="md:col-span-2">
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Marca</label>
                       <input type="text" name="brand" value={product.brand || ""} onChange={handleChange} placeholder="Ej: SAMSUNG" className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm uppercase transition-all shadow-sm" />
                    </div>

                    {/* MODELO */}
                    <div className="md:col-span-2">
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Modelo</label>
                       <input type="text" name="model" value={product.model || ""} onChange={handleChange} placeholder="Ej: A32" className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm uppercase transition-all shadow-sm" />
                    </div>

                    {/* COLOR */}
                    <div className="md:col-span-2">
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Color</label>
                       <input type="text" name="color" value={product.color || ""} onChange={handleChange} placeholder="Ej: NEGRO" className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm uppercase transition-all shadow-sm" />
                    </div>

                    {/* SEGUNDA FILA DE ATRIBUTOS */}
                    <div className="md:col-span-3">
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Compatibilidad</label>
                       <input type="text" name="compatibility" value={product.compatibility || ""} onChange={handleChange} placeholder="Ej: A52 / A72 (Opcional)" className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm uppercase transition-all shadow-sm" />
                    </div>
                    
                    <div className="md:col-span-3">
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Condición</label>
                       <div className="relative">
                            <select name="condition" value={product.condition || "NUEVO"} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm appearance-none shadow-sm cursor-pointer">
                                <option value="NUEVO">✨ NUEVO</option>
                                <option value="USADO">🔄 USADO</option>
                                <option value="GENERICO">📦 GENERICO</option>
                                <option value="ORIGINAL">📦 ORIGINAL</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                                <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                            </div>
                       </div>
                    </div>

                    {/* NOMBRE GENERADO (VISUALIZACIÓN) */}
                    <div className="md:col-span-6 mt-2">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Vista Previa del Nombre</label>
                        <div className="w-full p-3 bg-gray-100 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm tracking-wide">
                            {product.name || "..."}
                        </div>
                    </div>
                 </div>
              </div>

              {/* SECCIÓN 2: PRECIOS (VERDE) */}
              <div className="space-y-4 pt-4">
                 <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold text-sm">2</div>
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Precios y Finanzas</h3>
                 </div>

                 <div className="bg-green-50/50 p-6 rounded-2xl border border-green-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* PVP (EL IMPORTANTE - AHORA ES P1) */}
                    <div className="relative group">
                        <label className="block text-xs font-bold text-green-700 uppercase mb-1.5 ml-1">Precio Público (PVP)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-600 font-bold text-lg">$</span>
                            <input 
                                type="number" step="0.01" name="price_1" 
                                value={product.price_1 === 0 ? "" : product.price_1} 
                                onChange={handleChange} 
                                className="w-full pl-8 pr-4 py-3 bg-white border border-green-300 rounded-xl focus:ring-4 focus:ring-green-100 focus:border-green-500 outline-none font-bold text-2xl text-green-800 placeholder-green-200/50 shadow-sm transition-all" 
                                placeholder="0.00" 
                            />
                        </div>
                    </div>

                    {!isBlitzMode && (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">DESCUENTO</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                    <input 
                                        type="number" step="0.01" name="price_2" 
                                        value={product.price_2 === 0 ? "" : product.price_2} 
                                        onChange={handleChange} 
                                        className="w-full pl-8 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-200 outline-none text-gray-700 placeholder-gray-300 transition-all shadow-sm" 
                                        placeholder="0.00" 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-blue-500 uppercase mb-1.5 ml-1">PRECIO DISTRIBUIDOR</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                    <input 
                                        type="number" step="0.01" name="price_3" 
                                        value={product.price_3 === 0 ? "" : product.price_3} 
                                        onChange={handleChange}
                                        className="w-full pl-8 pr-4 py-3 bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none text-blue-800 font-semibold placeholder-gray-300 transition-all shadow-sm" 
                                        placeholder="0.00" 
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* COSTO (Solo visible si no es Blitz) */}
                    {!isBlitzMode && (
                        <div className="md:col-span-3 pt-4 mt-2 border-t border-green-200/50 flex flex-col md:flex-row gap-4 items-center">
                            <div className="flex-1 w-full">
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">
                                    Costo Promedio
                                    {!canEditCost && <span className="bg-red-50 text-red-500 text-[10px] px-1.5 py-0.5 rounded border border-red-100">LOCKED</span>}
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                    <input 
                                        type="number" step="0.0001" name="average_cost" 
                                        value={product.average_cost === 0 ? "" : product.average_cost} 
                                        onChange={handleChange} 
                                        disabled={!canEditCost}
                                        className={`w-full pl-6 pr-3 py-2 border rounded-lg text-sm outline-none transition-all ${!canEditCost ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' : 'bg-white border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-50'}`} 
                                        placeholder="0.00" 
                                    />
                                </div>
                            </div>
                            
                            {/* PROVEEDOR */}
                            <div className="flex-1 w-full">
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">Proveedor</label>
                                <div className="flex gap-2">
                                    <select name="supplier_id" value={product.supplier_id || ""} onChange={handleChange} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 shadow-sm">
                                        <option value="">-- Seleccionar --</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                    <button type="button" onClick={() => setIsCreatingSupplier(true)} className="px-3 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors font-bold">+</button>
                                </div>
                            </div>
                        </div>
                    )}
                 </div>
              </div>

              {/* SECCIÓN 3: CLASIFICACIÓN Y EXTRAS */}
              {!isBlitzMode && (
                  <div className="space-y-4 pt-4">
                     <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-sm">3</div>
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Clasificación</h3>
                     </div>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-2xl border border-gray-100 shadow-sm">
                        {/* CATEGORÍA */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Categoría</label>
                            <div className="flex gap-2">
                                <select name="category_id" value={product.category_id || ""} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm">
                                    <option value="">-- General --</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <button type="button" onClick={() => setIsCreatingCategory(true)} className="px-4 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors font-bold">+</button>
                            </div>
                        </div>

                        {/* DESCRIPCIÓN */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Detalles Adicionales</label>
                            <textarea name="description" value={product.description || ""} onChange={handleChange} rows="1" className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none shadow-sm" placeholder="Ej: Incluye cargador..."></textarea>
                        </div>
                     </div>
                  </div>
              )}

              {/* SWITCHES DE VISIBILIDAD */}
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                 <label className="flex-1 flex items-center p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                    <input type="checkbox" name="is_active" checked={product.is_active} onChange={handleChange} className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300" />
                    <div className="ml-3">
                        <span className="block text-sm font-bold text-gray-700">Producto Activo</span>
                        <span className="block text-xs text-gray-400">Disponible para vender en POS</span>
                    </div>
                 </label>

                 <label className={`flex-1 flex items-center p-4 rounded-xl border cursor-pointer transition-all ${product.is_public ? 'bg-teal-50 border-teal-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                    <input type="checkbox" name="is_public" checked={product.is_public} onChange={handleChange} className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500 border-gray-300" />
                    <div className="ml-3">
                        <span className={`block text-sm font-bold ${product.is_public ? 'text-teal-800' : 'text-gray-700'}`}>
                            <HiOutlineGlobeAlt className="inline mr-1 text-lg mb-0.5"/> Publicar en Web
                        </span>
                        <span className={`block text-xs ${product.is_public ? 'text-teal-600' : 'text-gray-400'}`}>Visible en el buscador global</span>
                    </div>
                 </label>
              </div>

              {/* MODALES FLOTANTES (CATEGORÍA / PROVEEDOR) */}
              {isCreatingCategory && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 rounded-2xl animate-fade-in">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm">
                        <h4 className="font-bold text-gray-800 mb-4 text-center">Nueva Categoría</h4>
                        <input autoFocus type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value.toUpperCase())} className="w-full p-3 border border-gray-300 rounded-xl mb-4 text-center font-bold uppercase" placeholder="NOMBRE..."/>
                        <div className="flex gap-2">
                            <button onClick={() => setIsCreatingCategory(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200">Cancelar</button>
                            <button onClick={handleCreateCategory} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200">Crear</button>
                        </div>
                    </div>
                </div>
              )}

              {isCreatingSupplier && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 rounded-2xl animate-fade-in">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm">
                        <h4 className="font-bold text-gray-800 mb-4 text-center">Nuevo Proveedor</h4>
                        <input autoFocus type="text" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value.toUpperCase())} className="w-full p-3 border border-gray-300 rounded-xl mb-4 text-center font-bold uppercase" placeholder="NOMBRE EMPRESA..."/>
                        <div className="flex gap-2">
                            <button onClick={() => setIsCreatingSupplier(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200">Cancelar</button>
                            <button onClick={handleCreateSupplier} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200">Crear</button>
                        </div>
                    </div>
                </div>
              )}
            </form>
        </div>

        {/* --- FOOTER FLOTANTE (BOTONES DE ACCIÓN) --- */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-white text-gray-600 border border-gray-200 rounded-xl font-bold hover:bg-gray-100 hover:text-gray-800 transition shadow-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit} // El botón dispara el submit del form manualmente
              className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition transform active:scale-95 flex items-center gap-2"
            >
              <HiOutlineCloudUpload className="text-xl"/>
              {productToEdit ? "Guardar Cambios" : "Crear Producto"}
            </button>
        </div>

        {/* --- GALERÍA DE IMÁGENES (SOLO SI EXISTE) --- */}
        {productToEdit && (
            <div className="px-8 pb-8 pt-2 bg-gray-50 border-t border-gray-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Evidencia Fotográfica</h3>
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{product.images.length} Fotos</span>
                </div>
                
                {/* SOLUCIÓN DE ALTURA: max-h-[300px] y scroll automático */}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                    {product.images.map((image) => (
                        <div 
                            key={image.id} 
                            className="relative group aspect-square bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-all"
                            onClick={() => setViewImage(image)} // <--- ABRIR VISOR AL HACER CLICK
                        >
                            <img src={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}${image.image_url}`} alt="Prod" className="w-full h-full object-cover" />
                            {/* Botón Borrar con stopPropagation para no abrir el visor al borrar */}
                            <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); handleImageDelete(image.id); }} 
                                className="absolute top-1 right-1 bg-white/90 text-red-500 rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50"
                            >
                                <HiOutlineTrash/>
                            </button>
                        </div>
                    ))}
                    
                    {/* Botón 1: Subir de Galería/Archivo */}
                    <button type="button" onClick={() => fileInputRef.current.click()} className="flex flex-col items-center justify-center aspect-square bg-white border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all group">
                        <div className="p-2 bg-gray-50 text-gray-400 rounded-full group-hover:bg-gray-100 group-hover:text-gray-600 transition-colors mb-1">
                            <HiOutlineCloudUpload className="text-xl"/>
                        </div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide group-hover:text-gray-600">Galería</span>
                    </button>

                    {/* Botón 2: Tomar Foto (Usa la función openCamera existente) */}
                    <button type="button" onClick={openCamera} className="flex flex-col items-center justify-center aspect-square bg-white border-2 border-dashed border-indigo-300 rounded-xl hover:bg-indigo-50 hover:border-indigo-500 transition-all group">
                        <div className="p-2 bg-indigo-50 text-indigo-500 rounded-full group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors mb-1">
                            <HiOutlineCamera className="text-xl"/>
                        </div>
                        <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wide group-hover:text-indigo-700">Cámara</span>
                    </button>
                </div>
            </div>
        )}

        {/* --- VISOR DE IMAGEN (LIGHTBOX) --- */}
        {viewImage && (
            <div 
                className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
                onClick={() => setViewImage(null)} // Click fuera cierra
            >
                {/* Botón Cerrar */}
                <button 
                    className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-all"
                    onClick={() => setViewImage(null)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Imagen Grande */}
                <img 
                    src={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}${viewImage.image_url}`} 
                    alt="Detalle" 
                    className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                    onClick={(e) => e.stopPropagation()} // Click en la imagen no cierra
                />

                {/* Botón Descargar */}
                <a 
                    href={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}${viewImage.image_url}`} 
                    download
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-8 bg-white text-gray-900 px-6 py-3 rounded-full font-bold shadow-lg hover:bg-gray-100 transition-transform hover:scale-105 flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Descargar Original
                </a>
            </div>
        )}

        {/* INPUTS OCULTOS Y MODALES DE CÁMARA */}
        <input type="file" accept="image/*" ref={fileInputRef} onChange={(e) => { setSelectedFile(e.target.files[0]); handleImageUpload(e.target.files[0]); }} className="hidden" />
        
        {/* MODAL CÁMARA ROBUSTO (SUPERPOSICIÓN TOTAL) */}
        {isCameraOpen && (
            <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
                {/* 1. Video en pantalla completa (fondo) */}
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="absolute inset-0 w-full h-full object-contain bg-black" 
                />
                
                {/* 2. Botonera Flotante (Siempre visible encima del video) */}
                <div className="absolute bottom-0 left-0 right-0 p-6 flex items-center justify-between bg-gradient-to-t from-black/90 via-black/60 to-transparent z-[110]">
                    <button 
                        type="button" 
                        onClick={closeCamera} 
                        className="text-white font-bold text-sm bg-gray-800/60 px-5 py-3 rounded-full backdrop-blur-md border border-gray-600 hover:bg-gray-700 transition-colors"
                    >
                        Cancelar
                    </button>

                    <button 
                        type="button" 
                        onClick={takePhotoAndUpload} 
                        className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 shadow-2xl active:scale-90 transition-transform flex items-center justify-center hover:border-gray-400"
                    >
                        <div className="w-16 h-16 border-2 border-black/10 rounded-full bg-gray-50"></div>
                    </button>

                    {/* Espaciador invisible para mantener el botón central centrado */}
                    <div className="w-20 hidden sm:block"></div> 
                </div>
                
                <canvas ref={canvasRef} className="hidden" />
            </div>
        )}

      </div>
    </div>
  );
}

export default ProductForm;