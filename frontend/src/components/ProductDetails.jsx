import React, { useState, useEffect } from "react";
import { FaDownload, FaTimes, FaChevronLeft, FaChevronRight } from "react-icons/fa"; // Iconos para el visor
import api from "../services/api";

function ProductDetails({ product, onClose }) {
  const [stock, setStock] = useState([]);
  const [loadingStock, setLoadingStock] = useState(false);

  // --- ESTADO DEL VISOR DE IMÁGENES ---
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Helper para obtener URL completa
  const getImageUrl = (url) => `${import.meta.env.VITE_API_URL || "http://localhost:8000"}${url}`;

  // Funciones del visor
  const openImageViewer = (index) => {
    setCurrentImageIndex(index);
    setImageViewerOpen(true);
  };

  const closeImageViewer = () => setImageViewerOpen(false);

  const nextImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
  };

  // Corrección: Cambiado 'constZbImage' a 'const prevImage'
  const prevImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
  };

  const downloadImage = (e) => {
    e.stopPropagation();
    const link = document.createElement("a");
    link.href = getImageUrl(product.images[currentImageIndex].image_url);
    link.download = `producto_${product.sku}_${currentImageIndex + 1}.jpg`; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (product) {
      setLoadingStock(true);
      // Hacemos una llamada a la API para obtener el stock de este producto específico
      api
        .get(`/products/${product.id}/stock`)
        .then((response) => {
          setStock(response.data);
        })
        .finally(() => {
          setLoadingStock(false);
        });
    }
  }, [product]);

  if (!product) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-40"
      onClick={onClose}
    >
      <div
        className="fixed top-0 right-0 h-full w-full max-w-2xl bg-primary shadow-xl transform transition-transform duration-300 ease-in-out z-50 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
          >
            &times;
          </button>

          <div className="flex items-start space-x-6">
            <img
              onClick={() => product.images.length > 0 && openImageViewer(0)} // Abre la primera imagen
              src={
                product.images[0]?.image_url
                  ? getImageUrl(product.images[0].image_url)
                  : "/vite.svg"
              }
              alt={product.name}
              className={`h-32 w-32 object-cover rounded-lg shadow-md ${product.images.length > 0 ? 'cursor-pointer hover:opacity-90' : ''}`}
              title="Click para ampliar"
            />
            <div>
              <h2 className="text-3xl font-bold text-secondary">
                {product.name}
              </h2>
              <p className="text-md font-mono text-gray-500">{product.sku}</p>
              <p className="mt-2 text-gray-600">{product.description}</p>
              <p className="mt-2 text-sm font-semibold text-accent">
                {product.category?.name}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {/* Columna de Precios */}
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="font-bold text-secondary mb-2 text-lg">Precios</h3>
              <div className="space-y-2 text-md">
                <p>
                  <strong>P1 (Distribuidor):</strong>
                  <span className="float-right font-semibold">
                    ${product.price_1.toFixed(2)}
                  </span>
                </p>
                <p>
                  <strong>P2 (Descuento):</strong>
                  <span className="float-right font-semibold">
                    ${product.price_2.toFixed(2)}
                  </span>
                </p>
                <p>
                  <strong>P3 (Normal):</strong>
                  <span className="float-right font-semibold">
                    ${product.price_3.toFixed(2)}
                  </span>
                </p>
              </div>
            </div>

            {/* Columna de Stock */}
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="font-bold text-secondary mb-2 text-lg">
                Stock por Ubicación
              </h3>
              <div className="space-y-2 text-md">
                {loadingStock ? (
                  <p>Cargando stock...</p>
                ) : stock.length > 0 ? (
                  stock.map((s) => (
                    <p key={s.id}>
                      <strong>{s.location.name}:</strong>
                      <span className="float-right font-extrabold">
                        {s.quantity}
                      </span>
                    </p>
                  ))
                ) : (
                  <p>Sin stock registrado.</p>
                )}
              </div>
            </div>
          </div>

          {/* Galería de Imágenes */}
          <div className="bg-white p-4 rounded-lg border mt-6">
            <h3 className="font-bold text-secondary mb-2 text-lg">Galería</h3>
            <div className="grid grid-cols-3 gap-4">
              {product.images.length > 0 ? (
                product.images.map((image, index) => (
                  <img
                    key={image.id}
                    onClick={() => openImageViewer(index)}
                    src={getImageUrl(image.image_url)}
                    alt={`${product.name} - ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg shadow-md cursor-pointer hover:opacity-80 transition-opacity border border-gray-200"
                    title="Ver en grande"
                  />
                ))
              ) : (
                <p className="col-span-3">Sin imágenes.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- VISOR DE IMÁGENES (MODAL/CARRUSEL) --- */}
      {imageViewerOpen && product.images.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-95 backdrop-blur-sm p-4" onClick={closeImageViewer}>
            <div className="relative w-full h-full max-w-6xl flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
                
                {/* Botón Cerrar */}
                <button 
                    onClick={closeImageViewer}
                    className="absolute top-0 right-0 m-4 text-white/70 hover:text-white text-4xl transition-colors z-50"
                >
                    <FaTimes />
                </button>

                {/* Imagen Principal */}
                <img 
                    src={getImageUrl(product.images[currentImageIndex].image_url)} 
                    alt="Vista detallada" 
                    className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl"
                />

                {/* Flecha Izquierda */}
                {product.images.length > 1 && (
                    <button 
                        onClick={prevImage}
                        className="absolute left-0 top-1/2 -translate-y-1/2 ml-4 p-3 bg-black/50 text-white rounded-full hover:bg-white/20 transition-all backdrop-blur-md"
                    >
                        <FaChevronLeft size={30} />
                    </button>
                )}

                {/* Flecha Derecha */}
                {product.images.length > 1 && (
                    <button 
                        onClick={nextImage}
                        className="absolute right-0 top-1/2 -translate-y-1/2 mr-4 p-3 bg-black/50 text-white rounded-full hover:bg-white/20 transition-all backdrop-blur-md"
                    >
                        <FaChevronRight size={30} />
                    </button>
                )}

                {/* Barra inferior */}
                <div className="absolute bottom-4 flex items-center gap-6 bg-black/70 px-6 py-3 rounded-full backdrop-blur-md border border-white/10">
                    <span className="text-white font-mono text-sm">
                        {currentImageIndex + 1} / {product.images.length}
                    </span>
                    <div className="w-px h-6 bg-white/20"></div>
                    <button 
                        onClick={downloadImage}
                        className="flex items-center gap-2 text-white hover:text-green-400 font-bold transition-colors"
                    >
                        <FaDownload /> <span className="text-sm">Descargar</span>
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}

export default ProductDetails;
