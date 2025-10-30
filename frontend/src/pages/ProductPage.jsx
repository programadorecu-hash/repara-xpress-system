import React, { useState, useEffect, useContext } from "react";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext.jsx";
import ProductDetails from "../components/ProductDetails.jsx";
import ProductForm from "../components/ProductForm.jsx";
import InventoryAdjustmentForm from "../components/InventoryAdjustmentForm.jsx";

function ProductPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);
  const [isAdjustmentFormOpen, setIsAdjustmentFormOpen] = useState(false);
  const [productForAdjustment, setProductForAdjustment] = useState(null);
  const { user } = useContext(AuthContext);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get("/products/");
      setProducts(response.data);
    } catch (err) {
      setError("No se pudieron cargar los productos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSaveProduct = async (productData) => {
    try {
      const dataToSave = { ...productData };
      if (dataToSave.category_id === "") {
        dataToSave.category_id = null;
      }

      if (productToEdit) {
        // --- LÓGICA DE EDICIÓN ---
        // Si ya estamos editando, solo guardamos y cerramos.
        await api.put(`/products/${productToEdit.id}`, dataToSave);
        setIsFormOpen(false);
        setProductToEdit(null);
        fetchProducts();
      } else {
        // --- LÓGICA DE CREACIÓN (¡AQUÍ ESTÁ EL ARREGLO!) ---
        const response = await api.post("/products/", dataToSave);
        const newProduct = response.data;

        // 1. Actualizamos la lista de productos en segundo plano.
        fetchProducts();

        // 2. Convertimos el formulario a modo "Editar" para poder subir imágenes.
        setProductToEdit(newProduct);

        // 3. ¡RECUPERAMOS LA PREGUNTA! Le preguntamos al usuario si quiere añadir el stock.
        if (
          window.confirm(
            `Producto "${newProduct.name}" creado con éxito. ¿Deseas registrar el stock inicial ahora?`
          )
        ) {
          // Si dice que sí, preparamos y abrimos el formulario de ajuste de inventario.
          setProductForAdjustment(newProduct);
          setIsAdjustmentFormOpen(true);
        }
      }
    } catch (err) {
      // Usamos 'console.error' para ver más detalles del error en la consola del navegador.
      console.error("Error al guardar el producto:", err);
      alert(
        "Error al guardar el producto. Revisa la consola para más detalles."
      );
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
    user?.role === "admin" || user?.role === "inventory_manager";

  if (loading) return <p>Cargando productos...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-secondary">
          Catálogo de Productos
        </h1>
        {canManageProducts && (
          <button
            onClick={() => {
              setProductToEdit(null);
              setIsFormOpen(true);
            }}
            className="bg-accent text-white font-bold py-2 px-4 rounded-lg"
          >
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
              {isLoggedIn && (
                <th className="py-3 px-4 text-center">Acciones</th>
              )}
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b">
                {/* ARREGLO: 
                  1. Las imágenes reales (image_url) SÍ vienen del backend (:8000).
                  2. La imagen de RELLENO (vite.svg) viene del frontend (de la carpeta 'public').
                  Esta lógica separa las dos cosas.
                */}
                <td className="py-2 px-4">
                  <img
                    src={
                      product.images[0]?.image_url
                        ? `http://localhost:8000${product.images[0].image_url}`
                        : "/vite.svg"
                    }
                    alt={product.name}
                    className="h-12 w-12 object-cover rounded-md"
                  />
                </td>
                <td className="py-3 px-4 font-mono text-sm">{product.sku}</td>
                <td className="py-3 px-4 font-semibold">{product.name}</td>
                <td className="py-3 px-4 text-right font-semibold">
                  ${product.price_3.toFixed(2)}
                </td>
                {isLoggedIn && (
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => setSelectedProduct(product)}
                      className="text-blue-500 hover:underline mr-4"
                    >
                      Ver
                    </button>
                    {canManageProducts && (
                      <button
                        onClick={() => {
                          setProductToEdit(product);
                          setIsFormOpen(true);
                        }}
                        className="text-green-500 hover:underline"
                      >
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
    </div>
  );
}

export default ProductPage;
