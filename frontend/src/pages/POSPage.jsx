import React, { useState, useEffect, useContext } from "react";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";

function POSPage() {
  const [searchTerm, setSearchTerm] = useState(""); // Para la búsqueda
  const [searchResults, setSearchResults] = useState([]); // Resultados de búsqueda
  const [cart, setCart] = useState([]); // Los items en el carrito
  const [total, setTotal] = useState(0); // El total de la venta
  const [loadingSearch, setLoadingSearch] = useState(false); // Indicador de carga
  const { user, activeShift } = useContext(AuthContext); // Info del usuario y turno

  // (Aquí añadiremos más lógica después)

  // Calcula el total cada vez que el carrito cambia
  useEffect(() => {
    const newTotal = cart.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );
    setTotal(newTotal);
  }, [cart]);

  useEffect(() => {
    // Configuramos un temporizador
    const delayDebounceFn = setTimeout(() => {
      fetchProducts(searchTerm); // Llama a la búsqueda después del retraso
    }, 500); // Espera 500ms (medio segundo) después de dejar de escribir

    // Esto limpia el temporizador si el usuario sigue escribiendo
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]); // Este efecto se ejecuta cada vez que 'searchTerm' cambia

  // --- NUEVA FUNCIÓN ---
  const fetchProducts = async (query) => {
    if (!query || query.length < 2 || !activeShift) {
      // Añadido chequeo de activeShift
      setSearchResults([]);
      return;
    }
    setLoadingSearch(true);
    try {
      const response = await api.get("/products/", {
        params: {
          search: query,
          location_id: activeShift.location.id, // <-- AÑADE ESTA LÍNEA
        },
      });
      // Ya no necesitamos filtrar en el frontend, el backend debería hacerlo
      setSearchResults(response.data); // <-- MODIFICADO: Usamos directamente response.data
    } catch (error) {
      console.error("Error buscando productos:", error);
      setSearchResults([]);
    } finally {
      setLoadingSearch(false);
    }
  };
  // --- FIN NUEVA FUNCIÓN ---

  // --- NUEVA FUNCIÓN: AÑADIR AL CARRITO ---
  const handleAddToCart = (productToAdd) => {
    // Verificar si el producto ya está en el carrito
    const existingCartItemIndex = cart.findIndex(
      (item) => item.product_id === productToAdd.id
    );

    if (existingCartItemIndex > -1) {
      // Si ya existe, incrementamos la cantidad
      const updatedCart = cart.map((item, index) => {
        if (index === existingCartItemIndex) {
          // Creamos un nuevo objeto para no mutar el estado directamente
          return { ...item, quantity: item.quantity + 1 };
        }
        return item;
      });
      setCart(updatedCart);
    } else {
      // Si es nuevo, lo añadimos al carrito
      const newCartItem = {
        product_id: productToAdd.id, // Guardamos el ID del producto original
        description: productToAdd.name, // Usamos el nombre como descripción
        quantity: 1, // Cantidad inicial
        unit_price: productToAdd.price_3, // Usamos el precio 3 por defecto
        // Añadiremos más detalles si es necesario (ej. SKU)
      };
      // Añadimos el nuevo item a la lista existente en el estado
      setCart((prevCart) => [...prevCart, newCartItem]);
    }
    // Opcional: Limpiar búsqueda o dar feedback visual
    // setSearchTerm('');
    // setSearchResults([]);
  };
  // --- FIN NUEVA FUNCIÓN ---

  // --- NUEVA FUNCIÓN: QUITAR DEL CARRITO ---
  const handleRemoveFromCart = (indexToRemove) => {
    // Creamos una nueva versión del carrito filtrando el item a eliminar
    const updatedCart = cart.filter((item, index) => index !== indexToRemove);
    setCart(updatedCart);
  };
  // --- FIN NUEVA FUNCIÓN ---

  // --- Diseño Básico de la Interfaz ---
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Columna Izquierda: Búsqueda y Resultados */}
      <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-md border">
        <h2 className="text-xl font-bold text-secondary mb-4">
          Buscar Productos o Servicios
        </h2>
        <div className="mb-4">
          <input
            type="text"
            placeholder="Buscar por nombre, SKU o descripción..."
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-detail"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {/* Aquí iría un botón de búsqueda o búsqueda automática */}
        </div>
        <div className="h-96 overflow-y-auto border rounded-lg p-2 bg-gray-50">
          {/* Aquí mostraremos los resultados de la búsqueda */}
          {loadingSearch ? (
            <p className="text-gray-400 text-center py-4">Buscando...</p>
          ) : searchResults.length > 0 ? (
            searchResults.map((product) => (
              <div
                key={product.id}
                className="p-3 border-b flex justify-between items-center hover:bg-gray-100 cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <img
                    src={`http://localhost:8000${
                      product.images[0]?.image_url || "/placeholder.png"
                    }`}
                    alt={product.name}
                    className="h-10 w-10 object-cover rounded"
                  />
                  <div>
                    <p className="font-semibold text-sm">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.sku}</p>
                    {/* --- STOCK LOCAL (MODIFICADO LIGERAMENTE) --- */}
                    <p
                      className={`text-xs font-bold ${
                        product.stock_quantity > 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      Stock Bodega: {product.stock_quantity}
                    </p>
                    {/* --- NUEVO: MOSTRAR STOCK OTRAS UBICACIONES --- */}
                    {product.other_locations_stock &&
                      product.other_locations_stock.length > 0 && (
                        <div className="text-xs text-blue-600 mt-1">
                          También en:{" "}
                          {product.other_locations_stock.map((stockInfo) => (
                            <span
                              key={stockInfo.location_name}
                              className="mr-2"
                            >
                              {stockInfo.location_name}({stockInfo.quantity})
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">
                    ${product.price_3.toFixed(2)}
                  </p>{" "}
                  {/* Usamos precio 3 por defecto */}
                  {/* Botón para añadir al carrito (AHORA CON FUNCIÓN) */}
                  <button
                    className="bg-accent text-white px-3 py-1 rounded text-sm mt-1"
                    onClick={() => handleAddToCart(product)} // <-- AÑADE ESTA LÍNEA
                  >
                    +
                  </button>
                </div>
              </div>
            ))
          ) : searchTerm.length >= 2 ? (
            <p className="text-gray-400 text-center py-4">
              No se encontraron productos.
            </p>
          ) : (
            <p className="text-gray-400 text-center py-4">
              Escribe al menos 2 caracteres para buscar...
            </p>
          )}
        </div>
      </div>

      {/* Columna Derecha: Carrito y Pago */}
      <div className="bg-white p-6 rounded-xl shadow-md border">
        <h2 className="text-xl font-bold text-secondary mb-4">
          Carrito de Venta
        </h2>
        <div className="h-64 overflow-y-auto border rounded-lg p-2 mb-4 bg-gray-50">
          {/* Aquí mostraremos los items del carrito */}
          {cart.length === 0 ? (
            <p className="text-gray-400 text-center py-4">Carrito vacío</p>
          ) : (
            cart.map((item, index) => (
              <div
                key={index}
                className="p-2 border-b flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold">{item.description}</p>
                  <p className="text-sm text-gray-500">
                    Cant: {item.quantity} x ${item.unit_price.toFixed(2)}
                  </p>
                </div>
                {/* Botón para quitar del carrito (AHORA CON FUNCIÓN) */}
                <button
                  className="text-red-500 text-xs hover:text-red-700 font-semibold"
                  onClick={() => handleRemoveFromCart(index)} // <-- AÑADE ESTA LÍNEA
                >
                  Quitar
                </button>
              </div>
            ))
          )}
        </div>

        {/* Total y Botón de Pago */}
        <div className="border-t pt-4">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-bold text-secondary">TOTAL:</span>
            <span className="text-2xl font-bold text-accent">
              ${total.toFixed(2)}
            </span>
          </div>
          <button
            className="w-full bg-highlight hover:bg-yellow-500 text-secondary font-bold py-3 rounded-lg transition duration-300 disabled:bg-gray-300"
            disabled={cart.length === 0} // Deshabilitado si no hay nada en el carrito
          >
            Proceder al Pago
          </button>
        </div>
      </div>
    </div>
  );
}

export default POSPage;
