import React, { useState, useEffect } from 'react';
import api from '../services/api';

function ProductForm({ productToEdit, onSave, onClose }) {
  const [product, setProduct] = useState({
    sku: '', name: '', description: '', 
    price_1: 0, price_2: 0, price_3: 0, 
    category_id: null, is_active: true
  });
  const [categories, setCategories] = useState([]);

  // --- NUEVOS ESTADOS PARA CREAR CATEGORÍAS ---
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  // --- FIN DE NUEVOS ESTADOS ---

  useEffect(() => {
    // Carga las categorías existentes
    api.get('/categories/').then(response => setCategories(response.data));
    if (productToEdit) {
      setProduct({ ...productToEdit, category_id: productToEdit.category?.id || null });
    }
  }, [productToEdit]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : (name.startsWith('price') || name === 'category_id') ? (value ? parseInt(value, 10) : null) : value;
    setProduct(prev => ({ ...prev, [name]: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(product);
  };

  // --- NUEVA FUNCIÓN PARA GUARDAR LA CATEGORÍA ---
  const handleCreateCategory = async () => {
    if (!newCategoryName) return;
    try {
      // Llamamos a la API para crear la nueva categoría
      const response = await api.post('/categories/', { name: newCategoryName });
      const newCategory = response.data;
      
      // La añadimos a nuestra lista de categorías y la seleccionamos automáticamente
      setCategories(prev => [...prev, newCategory]);
      setProduct(prev => ({ ...prev, category_id: newCategory.id }));

      // Ocultamos el formulario de nueva categoría
      setIsCreatingCategory(false);
      setNewCategoryName('');
    } catch (error) {
      alert('Error al crear la categoría. ¿Quizás ya existe?');
    }
  };
  // --- FIN DE NUEVA FUNCIÓN ---

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-40 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl text-gray-800" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-secondary mb-6">{productToEdit ? 'Editar' : 'Crear'} Producto</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ... (resto de campos del formulario sin cambios) ... */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold">SKU</label>
              <input type="text" name="sku" value={product.sku} onChange={handleChange} className="w-full p-2 border rounded" required />
            </div>
            <div>
              <label className="font-semibold">Nombre</label>
              <input type="text" name="name" value={product.name} onChange={handleChange} className="w-full p-2 border rounded" required />
            </div>
          </div>
          <div>
            <label className="font-semibold">Descripción</label>
            <textarea name="description" value={product.description || ''} onChange={handleChange} className="w-full p-2 border rounded" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="font-semibold">Precio 1 (Distribuidor)</label>
              <input type="number" step="0.01" name="price_1" value={product.price_1} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="font-semibold">Precio 2 (Descuento)</label>
              <input type="number" step="0.01" name="price_2" value={product.price_2} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="font-semibold">Precio 3 (Normal)</label>
              <input type="number" step="0.01" name="price_3" value={product.price_3} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
          </div>
          
          {/* --- SECCIÓN DE CATEGORÍA MEJORADA --- */}
          <div>
            <label className="font-semibold">Categoría</label>
            <div className="flex items-center space-x-2">
              <select name="category_id" value={product.category_id || ''} onChange={handleChange} className="w-full p-2 border rounded">
                <option value="">Sin Categoría</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => setIsCreatingCategory(true)} className="py-2 px-4 bg-gray-200 rounded-lg hover:bg-gray-300 whitespace-nowrap">
                + Nueva
              </button>
            </div>
          </div>

          {/* Formulario para crear nueva categoría (solo aparece si isCreatingCategory es true) */}
          {isCreatingCategory && (
            <div className="p-4 bg-gray-100 rounded-lg">
              <label className="font-semibold">Nombre de la Nueva Categoría</label>
              <div className="flex items-center space-x-2 mt-2">
                <input 
                  type="text" 
                  value={newCategoryName} 
                  onChange={(e) => setNewCategoryName(e.target.value)} 
                  className="w-full p-2 border rounded" 
                  placeholder="Ej: Accesorios de Celular"
                />
                <button type="button" onClick={handleCreateCategory} className="py-2 px-4 bg-accent text-white rounded-lg">Guardar</button>
                <button type="button" onClick={() => setIsCreatingCategory(false)} className="py-2 px-4">X</button>
              </div>
            </div>
          )}
          {/* --- FIN DE SECCIÓN MEJORADA --- */}

          <div className="flex items-center">
            <input type="checkbox" name="is_active" checked={product.is_active} onChange={handleChange} className="h-4 w-4 rounded" />
            <label className="ml-2 font-semibold">Activo para la venta</label>
          </div>
          <div className="mt-6 flex justify-end space-x-4">
            <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 rounded-lg hover:bg-gray-300">Cancelar</button>
            <button type="submit" className="py-2 px-4 bg-accent text-white font-bold rounded-lg hover:bg-teal-600">Guardar Producto</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProductForm;