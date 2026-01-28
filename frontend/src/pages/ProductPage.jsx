import React, { useState, useEffect, useContext } from "react";
import { FaEdit, FaBox, FaDownload, FaTimes, FaChevronLeft, FaChevronRight, FaEye, FaFileExcel } from "react-icons/fa";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext.jsx";
import ProductDetails from "../components/ProductDetails.jsx";
import ProductForm from "../components/ProductForm.jsx";
import InventoryAdjustmentForm from "../components/InventoryAdjustmentForm.jsx";
import ExcelImportModal from "../components/ExcelImportModal.jsx";

function ProductPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);
  const [isAdjustmentFormOpen, setIsAdjustmentFormOpen] = useState(false);
  const [productForAdjustment, setProductForAdjustment] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const { user } = useContext(AuthContext);

  // --- ESTADO DEL BUSCADOR ---
  const [searchTerm, setSearchTerm] = useState(""); 

  // --- ESTADO DEL VISOR DE IMÁGENES ---
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImages, setCurrentImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const openImageViewer = (e, product) => {
    e.stopPropagation(); // Evita que se abra la fila al dar click en la imagen
    // Preparamos las URLs completas de las imágenes
    const images = product.images && product.images.length > 0
      ? product.images.map(img => `${import.meta.env.VITE_API_URL || "http://localhost:8000"}${img.image_url}`)
      : ["/vite.svg"]; // Imagen por defecto si no tiene
    setCurrentImages(images);
    setCurrentImageIndex(0);
    setImageViewerOpen(true);
  };

  const closeImageViewer = () => {
    setImageViewerOpen(false);
    setCurrentImages([]);
  };

  const nextImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % currentImages.length);
  };

  const prevImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + currentImages.length) % currentImages.length);
  };

  const downloadImage = (e) => {
    e.stopPropagation();
    const link = document.createElement("a");
    link.href = currentImages[currentImageIndex];
    link.download = `producto_${currentImageIndex + 1}.jpg`; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Nuevo estado para el modo "Auditoría de Costos"
  const [showZeroCostOnly, setShowZeroCostOnly] = useState(false);
  const [zeroCostCount, setZeroCostCount] = useState(0); // <--- Memoria para el contador

  // --- ESTADOS PARA EXPORTAR EXCEL ---
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filterLocation, setFilterLocation] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  // Cargar listas para los filtros (Sucursales y Categorías)
  useEffect(() => {
    const fetchFilters = async () => {
        try {
            const [locRes, catRes] = await Promise.all([
                api.get("/locations/"),
                api.get("/categories/")
            ]);
            setLocations(locRes.data);
            setCategories(catRes.data);
        } catch (error) {
            console.error("Error cargando filtros", error);
        }
    };
    if (user) fetchFilters();
  }, [user]);

  const handleDownloadExcel = async () => {
      try {
          // 1. Preparamos los filtros
          const params = {};
          if (filterLocation) params.location_id = filterLocation;
          if (filterCategory) params.category_id = filterCategory;

          // --- SOLUCIÓN ROBUSTA: FORZAR TOKEN ---
          // Recuperamos el token manualmente del bolsillo (localStorage)
          const token = localStorage.getItem('accessToken');
          
          if (!token) {
              alert("No estás autenticado. Por favor, inicia sesión.");
              return;
          }

          // 2. Pedimos el archivo
          const response = await api.get("/products/export/excel", {
              params: params,
              responseType: 'blob',
              headers: {
                  'Authorization': `Bearer ${token}` // <--- Gafete grapado manualmente
              }
          });
          // --- FIN SOLUCIÓN ROBUSTA ---

          // 3. Convertimos esa "masa de datos" en un enlace descargable invisible
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          
          // Le ponemos nombre al archivo con la fecha de hoy
          const date = new Date().toISOString().split('T')[0];
          link.setAttribute('download', `Inventario_${date}.xlsx`);
          
          // Hacemos "clic" automático en el enlace y luego lo borramos
          document.body.appendChild(link);
          link.click();
          link.parentNode.removeChild(link);
          window.URL.revokeObjectURL(url);

      } catch (error) {
          console.error("Error descargando Excel:", error);
          alert("No se pudo descargar el inventario. Verifica que tengas permisos.");
      }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      // Si estamos en modo "Sin Costo", llamamos al nuevo endpoint
      const endpoint = showZeroCostOnly ? "/products/reports/zero-cost" : "/products/";
      const response = await api.get(endpoint);
      setProducts(response.data);
    } catch (err) {
      setError("No se pudieron cargar los productos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();

    // --- SENSOR DE COSTOS ---
    // Preguntamos silenciosamente cuántos hay sin costo para actualizar el botón
    api.get("/products/reports/zero-cost")
       .then(response => setZeroCostCount(response.data.length))
       .catch(err => console.error("Error actualizando contador del botón", err));

  }, [showZeroCostOnly]); // Se recarga si cambias el modo

  const handleSaveProduct = async (productData, isBlitz = false) => {
    try {
      const dataToSave = { ...productData };
      if (dataToSave.category_id === "") {
        dataToSave.category_id = null;
      }

      if (productToEdit) {
        // --- LÓGICA DE EDICIÓN ---
        await api.put(`/products/${productToEdit.id}`, dataToSave);
        setIsFormOpen(false);
        setProductToEdit(null);
        fetchProducts();
      } else {
        // --- LÓGICA DE CREACIÓN ---
        const response = await api.post("/products/", dataToSave);
        const newProduct = response.data;

        // 1. Actualizamos la lista
        fetchProducts();

        // [MODO BLITZ] Lógica especial
        if (isBlitz) {
            // No cerramos el formulario ni cambiamos a modo edición.
            // El formulario se reseteará solo.
            return; 
        }

        // [MODO NORMAL] Flujo estándar
        setProductToEdit(newProduct);

        if (
          window.confirm(
            `Producto "${newProduct.name}" creado con éxito. ¿Deseas registrar el stock inicial ahora?`
          )
        ) {
          setProductForAdjustment(newProduct);
          setIsAdjustmentFormOpen(true);
        }
      }
    } catch (err) {
      console.error("Error al guardar el producto:", err);
      alert("Error al guardar el producto. Revisa la consola para más detalles.");
    }
  };

  const handleSaveAdjustment = async (productId, adjustmentData) => {
    // La función onSave ahora es una 'Promise' para que el hijo sepa si hubo un error
    return api
      .post("/inventory/adjust", {
        product_id: productId,
        location_id: adjustmentData.location_id,
        new_quantity: parseInt(adjustmentData.new_quantity, 10),
        reason: adjustmentData.reason,
        pin: adjustmentData.pin,
      })
      .then(() => {
        // Opcional: refrescar los detalles del producto para ver el nuevo stock
        if (selectedProduct && selectedProduct.id === productId) {
          api
            .get(`/products/${productId}`)
            .then((res) => setSelectedProduct(res.data));
        }
      });
  };

  const isLoggedIn = !!user;
  const canManageProducts =
    user?.role === "super_admin" || user?.role === "admin" || user?.role === "inventory_manager";

  if (loading) return <p>Cargando productos...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  // --- LÓGICA DE FILTRADO ---
  // Creamos una lista nueva (filteredProducts) que solo contiene lo que coincide con tu búsqueda (Nombre o SKU)
  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-secondary">
          {showZeroCostOnly ? "⚠️ Artículos Sin Valor Inicial" : "Catálogo de Productos"}
        </h1>
        <div className="flex gap-2">
            {/* BOTÓN TOGGLE: VER SIN COSTO */}
            {canManageProducts && (
                <button
                    onClick={() => setShowZeroCostOnly(!showZeroCostOnly)}
                    className={`px-4 py-2 rounded-lg font-bold transition ${showZeroCostOnly ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    {showZeroCostOnly ? "Ver Todos" : `⚠️ Corregir Costos (${zeroCostCount})`}
                </button>
            )}

            {canManageProducts && (
              <>
                {/* BOTÓN IMPORTAR EXCEL */}
                <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 flex items-center gap-2"
                    title="Carga Masiva"
                >
                    <FaFileExcel /> Importar
                </button>

                <button
                    onClick={() => {
                    setProductToEdit(null);
                    setIsFormOpen(true);
                    }}
                    className="bg-accent text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-600"
                >
                    + Nuevo Producto
                </button>
              </>
            )}
        </div>
      </div>

      {/* BARRA DE HERRAMIENTAS: FILTROS Y EXCEL */}
      {canManageProducts && (
        <div className="mb-4 bg-gray-50 p-3 rounded-lg flex flex-wrap gap-4 items-center justify-between border border-gray-200">
            <div className="flex gap-2 items-center">
                <span className="text-sm font-semibold text-gray-600">Exportar:</span>
                
                {/* Selector de Sucursal */}
                <select 
                    className="p-2 border rounded-md text-sm"
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                >
                    <option value="">Todas las Sucursales</option>
                    {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                </select>

                {/* Selector de Categoría */}
                <select 
                    className="p-2 border rounded-md text-sm"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                >
                    <option value="">Todas las Categorías</option>
                    {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>
            </div>

            <button
                onClick={handleDownloadExcel}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-bold shadow-sm"
                title="Descargar en Excel"
            >
                <FaFileExcel /> Descargar Inventario
            </button>
        </div>
      )}

      {/* BARRA DE BÚSQUEDA MEJORADA */}
      <div className="mb-4 flex justify-end">
        <input
          type="text"
          placeholder="🔍 Buscar por Nombre o SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-sm transition-all"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white text-secondary">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-3 px-4 text-left w-20">Imagen</th>
              <th className="py-3 px-4 text-left">SKU</th>
              <th className="py-3 px-4 text-left">Nombre</th>
              <th className="py-3 px-4 text-right">Precio</th>
              {isLoggedIn && (
                <th className="py-3 px-4 text-center">Acciones</th>
              )}
            </tr>
          </thead>
          <tbody>
            {/* CAMBIO: Ahora mostramos filteredProducts en lugar de la lista completa */}
            {filteredProducts.map((product) => (
              <tr key={product.id} className="border-b">
                {/* ARREGLO: 
                  1. Las imágenes reales (image_url) SÍ vienen del backend (:8000).
                  2. La imagen de RELLENO (vite.svg) viene del frontend (de la carpeta 'public').
                  Esta lógica separa las dos cosas.
                */}
                <td className="py-2 px-4">
                  <div 
                    onClick={(e) => openImageViewer(e, product)}
                    className="h-12 w-12 cursor-pointer relative group"
                    title="Click para ampliar imagen"
                  >
                    <img
                      src={
                        product.images[0]?.image_url
                          ? `${import.meta.env.VITE_API_URL || "http://localhost:8000"}${product.images[0].image_url}`
                          : "/vite.svg"
                      }
                      alt={product.name}
                      className="h-full w-full object-cover rounded-md group-hover:opacity-80 transition-opacity border border-gray-200"
                    />
                    {/* Icono pequeño de lupa que aparece al pasar el mouse */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black bg-opacity-30 rounded-md transition-opacity">
                        <FaEye className="text-white text-xs" />
                    </div>
                  </div>
                </td>
                {/* CAMBIO: Hacemos que SKU, Nombre y Precio sean botones clicables */}
                <td 
                  onClick={() => setSelectedProduct(product)}
                  className="py-3 px-4 font-mono text-sm cursor-pointer hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Click para ver detalles"
                >
                  {product.sku}
                </td>
                <td 
                  onClick={() => setSelectedProduct(product)}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Click para ver detalles"
                >
                  {product.name}
                </td>
                <td 
                  onClick={() => setSelectedProduct(product)}
                  className="py-3 px-4 text-right font-semibold cursor-pointer hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Click para ver detalles"
                >
                  ${product.price_1.toFixed(2)}
                </td>
                {isLoggedIn && (
                  <td className="py-3 px-4 text-center space-x-4">
                    {/* Botón Ver eliminado por redundancia (la fila es clicable) */}
                    
                    {canManageProducts && (
                      <>
                        {/* Botón Editar (Icono Lápiz) */}
                        <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setProductToEdit(product);
                              setIsFormOpen(true);
                            }}
                            className="text-green-600 hover:text-green-800 transition-colors"
                            title="Editar Producto"
                        >
                            <FaEdit size={20} />
                        </button>
                        
                        {/* Botón Stock (Icono Caja) */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setProductForAdjustment(product);
                                setIsAdjustmentFormOpen(true);
                            }}
                            className="text-purple-600 hover:text-purple-800 transition-colors"
                            title="Ajuste Rápido de Stock"
                        >
                            <FaBox size={20} />
                        </button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ProductDetails
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      {isFormOpen && (
        <ProductForm
          productToEdit={productToEdit}
          onSave={handleSaveProduct}
          onClose={() => setIsFormOpen(false)}
        />
      )}

      {isAdjustmentFormOpen && (
        <InventoryAdjustmentForm
          product={productForAdjustment}
          onSave={handleSaveAdjustment}
          onClose={() => {
            setIsAdjustmentFormOpen(false);
            setProductForAdjustment(null);
          }}
        />
      )}

      {/* --- VISOR DE IMÁGENES (MODAL/CARRUSEL) --- */}
      {imageViewerOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-95 backdrop-blur-sm p-4" onClick={closeImageViewer}>
            {/* Contenedor relativo para posicionar controles */}
            <div className="relative w-full h-full max-w-6xl flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
                
                {/* Botón Cerrar (Arriba Derecha) */}
                <button 
                    onClick={closeImageViewer}
                    className="absolute top-0 right-0 m-4 text-white/70 hover:text-white text-4xl transition-colors z-50"
                    title="Cerrar (Esc)"
                >
                    <FaTimes />
                </button>

                {/* Imagen Principal */}
                <img 
                    src={currentImages[currentImageIndex]} 
                    alt="Vista detallada" 
                    className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl"
                />

                {/* Flecha Izquierda (Solo si hay más de 1 imagen) */}
                {currentImages.length > 1 && (
                    <button 
                        onClick={prevImage}
                        className="absolute left-0 top-1/2 -translate-y-1/2 ml-4 p-3 bg-black/50 text-white rounded-full hover:bg-white/20 transition-all backdrop-blur-md"
                    >
                        <FaChevronLeft size={30} />
                    </button>
                )}

                {/* Flecha Derecha (Solo si hay más de 1 imagen) */}
                {currentImages.length > 1 && (
                    <button 
                        onClick={nextImage}
                        className="absolute right-0 top-1/2 -translate-y-1/2 mr-4 p-3 bg-black/50 text-white rounded-full hover:bg-white/20 transition-all backdrop-blur-md"
                    >
                        <FaChevronRight size={30} />
                    </button>
                )}

                {/* Barra inferior: Contador y Descarga */}
                <div className="absolute bottom-4 flex items-center gap-6 bg-black/70 px-6 py-3 rounded-full backdrop-blur-md border border-white/10">
                    <span className="text-white font-mono text-sm">
                        {currentImageIndex + 1} / {currentImages.length}
                    </span>
                    <div className="w-px h-6 bg-white/20"></div>
                    <button 
                        onClick={downloadImage}
                        className="flex items-center gap-2 text-white hover:text-green-400 font-bold transition-colors"
                        title="Descargar imagen actual"
                    >
                        <FaDownload /> <span className="text-sm">Descargar</span>
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL DE IMPORTACIÓN */}
      {isImportModalOpen && (
        <ExcelImportModal
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            fetchProducts(); // Recargar la lista al terminar
          }}
        />
      )}
    </div>
  );
}

export default ProductPage;
