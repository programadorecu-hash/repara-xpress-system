import React, { useState, useEffect, useRef } from "react";
import api from "../services/api";

function ProductForm({ productToEdit, onSave, onClose }) {
  // Estado para almacenar los datos del producto que se está creando o editando.
  const [product, setProduct] = useState({
    sku: "",
    name: "",
    description: "",
    price_1: 0,
    price_2: 0,
    price_3: 0,
    category_id: null,
    is_active: true,
    images: [],
  });

  // Estados para la gestión de categorías.
  const [categories, setCategories] = useState([]);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Estados para la gestión de subida de imágenes.
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // --- Estados y refs para la cámara (captura embebida) ---
  // Muestra/oculta el modal
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  // Para mostrar errores de cámara (si permisos o dispositivo fallan)
  const [cameraError, setCameraError] = useState("");
  // Referencias a video/canvas y al stream para poder detenerlo luego
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Se ejecuta cuando el componente se carga o cuando 'productToEdit' cambia.
  useEffect(() => {
    api.get("/categories/").then((response) => setCategories(response.data));
    if (productToEdit) {
      setProduct({
        ...productToEdit,
        category_id: productToEdit.category?.id || null,
        images: productToEdit.images || [],
      });
    }
  }, [productToEdit]);

  // Maneja los cambios en los campos del formulario.
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val =
      type === "checkbox"
        ? checked
        : name.startsWith("price") || name === "category_id"
        ? value
          ? parseFloat(value)
          : null
        : value;
    setProduct((prev) => ({ ...prev, [name]: val }));
  };

  // Se ejecuta al enviar el formulario principal para guardar el producto.
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(product);
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

    // Si viene de la cámara (Blob), lo convertimos a File con un nombre limpio
    let finalFile = fileToSend;
    if (fileToSend instanceof Blob && !(fileToSend instanceof File)) {
      const safeName = (product.name || "producto")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_\-]/g, "");
      const fname = customName || `${safeName}_${Date.now()}.jpg`;
      finalFile = new File([fileToSend], fname, { type: "image/jpeg" });
    }

    formData.append("file", finalFile);

    try {
      const response = await api.post(
        `/products/${productToEdit.id}/upload-image/`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      setProduct((prev) => ({ ...prev, images: response.data.images }));
      setSelectedFile(null);
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
        <h2 className="text-2xl font-bold text-secondary mb-6">
          {productToEdit ? "Editar" : "Crear"} Producto
        </h2>

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
          <div>
            <label className="font-semibold">Descripción</label>
            <textarea
              name="description"
              value={product.description || ""}
              onChange={handleChange}
              className="w-full p-2 border rounded "
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="font-semibold">Precio 1 (Distribuidor)</label>
              <input
                type="number"
                step="0.01"
                name="price_1"
                value={product.price_1}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="font-semibold">Precio 2 (Descuento)</label>
              <input
                type="number"
                step="0.01"
                name="price_2"
                value={product.price_2}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="font-semibold">Precio 3 (Normal)</label>
              <input
                type="number"
                step="0.01"
                name="price_3"
                value={product.price_3}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              />
            </div>
          </div>
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
                className="py-2 px-4 bg-gray-200 rounded-lg hover:bg-gray-300 whitespace-nowrap"
              >
                + Nueva
              </button>
            </div>
          </div>
          {isCreatingCategory && (
            <div className="p-4 bg-gray-100 rounded-lg">
              <label className="font-semibold">
                Nombre de la Nueva Categoría
              </label>
              <div className="flex items-center space-x-2 mt-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
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
          <div className="flex items-center">
            <input
              type="checkbox"
              name="is_active"
              checked={product.is_active}
              onChange={handleChange}
              className="h-4 w-4 rounded"
            />
            <label className="ml-2 font-semibold">Activo para la venta</label>
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
                    src={`http://localhost:8000${image.image_url}`}
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

            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="font-semibold block mb-2">
                Añadir Nueva Imagen
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full p-2 border rounded-lg bg-white"
                />

                {/* Botón para abrir cámara */}
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={openCamera}
                    className="py-2 px-4 bg-secondary text-white font-bold rounded-lg hover:opacity-90"
                    title="Tomar foto con la cámara"
                  >
                    Cámara
                  </button>
                </div>

                {/* Modal de cámara */}
                {isCameraOpen && (
                  <div
                    className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
                    onClick={closeCamera}
                  >
                    <div
                      className="bg-white rounded-lg shadow-xl w-full max-w-lg p-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h4 className="text-lg font-semibold text-secondary mb-2">
                        Tomar foto del producto
                      </h4>

                      {cameraError ? (
                        <p className="text-red-600 text-sm mb-3">
                          {cameraError}
                        </p>
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

                      {/* Canvas oculto para capturar el frame */}
                      <canvas ref={canvasRef} className="hidden" />

                      <div className="flex justify-end gap-2 mt-4">
                        <button
                          type="button"
                          onClick={closeCamera}
                          className="py-2 px-4 bg-gray-200 rounded-lg hover:bg-gray-300"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={takePhotoAndUpload}
                          className="py-2 px-4 bg-accent text-white font-bold rounded-lg hover:bg-teal-600"
                        >
                          Tomar foto
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={handleImageUpload}
                  disabled={isUploading || !selectedFile}
                  className="py-2 px-4 bg-detail text-white font-bold rounded-lg hover:bg-indigo-600 disabled:bg-gray-400 whitespace-nowrap"
                >
                  {isUploading ? "Subiendo..." : "Subir Imagen"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default ProductForm;