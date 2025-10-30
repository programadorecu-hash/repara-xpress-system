import React, { useState, useEffect } from 'react';
import api from '../services/api';

function ProductDetails({ product, onClose }) {
  const [stock, setStock] = useState([]);
  const [loadingStock, setLoadingStock] = useState(false);

  useEffect(() => {
    if (product) {
      setLoadingStock(true);
      // Hacemos una llamada a la API para obtener el stock de este producto específico
      api.get(`/products/${product.id}/stock`)
        .then(response => {
          setStock(response.data);
        })
        .finally(() => {
          setLoadingStock(false);
        });
    }
  }, [product]);

  if (!product) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose}>
      <div 
        className="fixed top-0 right-0 h-full w-full max-w-2xl bg-primary shadow-xl transform transition-transform duration-300 ease-in-out z-50 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">&times;</button>
          
          <div className="flex items-start space-x-6">
            <img 
              // ARREGLO: Misma lógica que en la tabla. Si hay image_url, usa el backend. Si no, usa el /vite.svg local.
              src={product.images[0]?.image_url ? `http://localhost:8000${product.images[0].image_url}` : '/vite.svg'} 
              alt={product.name}
              className="h-32 w-32 object-cover rounded-lg shadow-md"
            />
            <div>
              <h2 className="text-3xl font-bold text-secondary">{product.name}</h2>
              <p className="text-md font-mono text-gray-500">{product.sku}</p>
              <p className="mt-2 text-gray-600">{product.description}</p>
              <p className="mt-2 text-sm font-semibold text-accent">{product.category?.name}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {/* Columna de Precios */}
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="font-bold text-secondary mb-2 text-lg">Precios</h3>
              <div className="space-y-2 text-md">
                <p><strong>P1 (Distribuidor):</strong><span className="float-right font-semibold">${product.price_1.toFixed(2)}</span></p>
                <p><strong>P2 (Descuento):</strong><span className="float-right font-semibold">${product.price_2.toFixed(2)}</span></p>
                <p><strong>P3 (Normal):</strong><span className="float-right font-semibold">${product.price_3.toFixed(2)}</span></p>
              </div>
            </div>

            {/* Columna de Stock */}
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="font-bold text-secondary mb-2 text-lg">Stock por Ubicación</h3>
              <div className="space-y-2 text-md">
                {loadingStock ? <p>Cargando stock...</p> : (
                  stock.length > 0 ? stock.map(s => (
                    <p key={s.id}><strong>{s.location.name}:</strong><span className="float-right font-extrabold">{s.quantity}</span></p>
                  )) : <p>Sin stock registrado.</p>
                )}
              </div>
            </div>
          </div>

          {/* Galería de Imágenes */}
          <div className="bg-white p-4 rounded-lg border mt-6">
            <h3 className="font-bold text-secondary mb-2 text-lg">Galería</h3>
            <div className="grid grid-cols-3 gap-4">
              {product.images.length > 0 ? product.images.map(image => (
                <img key={image.id} src={`http://localhost:8000${image.image_url}`} alt={product.name} className="w-full h-auto object-cover rounded-lg shadow-md" />
              )) : <p className="col-span-3">Sin imágenes.</p>}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default ProductDetails;