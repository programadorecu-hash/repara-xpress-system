import React, { useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext.jsx';
import ProductDetails from '../components/ProductDetails.jsx';
import ProductForm from '../components/ProductForm.jsx';

function ProductPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);

  const { user } = useContext(AuthContext); // Obtenemos el usuario del contexto

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/products/');
      setProducts(response.data);
    } catch (err) {
      setError('No se pudieron cargar los productos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSave = async (productData) => {
    try {
      // Limpiamos los campos que no se deben enviar si están vacíos
      const dataToSave = { ...productData };
      if (dataToSave.category_id === '') {
        dataToSave.category_id = null;
      }

      if (productToEdit) {
        await api.put(`/products/${productToEdit.id}`, dataToSave);
      } else {
        await api.post('/products/', dataToSave);
      }
      setIsFormOpen(false);
      setProductToEdit(null);
      fetchProducts();
    } catch (err) {
      // Aquí podrías mostrar un mensaje de error más específico
      alert('Error al guardar el producto.');
    }
  };

  // --- LÓGICA DE PERMISOS MEJORADA ---
  // El usuario está logueado
  const isLoggedIn = !!user;
  // El usuario tiene permisos de gestión
  const canManageProducts = user?.role === 'admin' || user?.role === 'inventory_manager';

  if (loading) return <p>Cargando productos...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-secondary">Catálogo de Productos</h1>
        {canManageProducts && (
          <button onClick={() => { setProductToEdit(null); setIsFormOpen(true); }} className="bg-accent text-white font-bold py-2 px-4 rounded-lg">
            + Nuevo Producto
          </button>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white text-secondary">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-3 px-4 text-left w-20">Imagen</th>
              <th className="py-3 px-4 text-left">SKU</th>
              <th className="py-3 px-4 text-left">Nombre</th>
              <th className="py-3 px-4 text-right">Precio</th>
              {/* Mostramos la columna "Acciones" si el usuario está logueado */}
              {isLoggedIn && <th className="py-3 px-4 text-center">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b">
                <td className="py-2 px-4"><img src={`http://localhost:8000${product.images[0]?.image_url || '/placeholder.png'}`} alt={product.name} className="h-12 w-12 object-cover rounded-md"/></td>
                <td className="py-3 px-4 font-mono text-sm">{product.sku}</td>
                <td className="py-3 px-4 font-semibold">{product.name}</td>
                <td className="py-3 px-4 text-right font-semibold">${product.price_3.toFixed(2)}</td>
                {/* Mostramos la celda de acciones si el usuario está logueado */}
                {isLoggedIn && (
                  <td className="py-3 px-4 text-center">
                    {/* El botón "Ver" lo pueden ver todos los logueados */}
                    <button onClick={() => setSelectedProduct(product)} className="text-blue-500 hover:underline mr-4">
                      Ver
                    </button>
                    {/* El botón "Editar" solo lo ven los gerentes */}
                    {canManageProducts && (
                      <button onClick={() => { setProductToEdit(product); setIsFormOpen(true); }} className="text-green-500 hover:underline">
                        Editar
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <ProductDetails product={selectedProduct} onClose={() => setSelectedProduct(null)} />

      {isFormOpen && (
        <ProductForm 
          productToEdit={productToEdit}
          onSave={handleSave}
          onClose={() => setIsFormOpen(false)}
        />
      )}
    </div>
  );
}

export default ProductPage;