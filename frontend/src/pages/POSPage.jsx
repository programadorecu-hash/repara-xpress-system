import React, { useState, useEffect, useContext } from "react";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import PaymentModal from "../components/PaymentModal.jsx";

function POSPage() {
  const [searchTerm, setSearchTerm] = useState(""); // Para la búsqueda
  const [searchResults, setSearchResults] = useState([]); // Resultados de búsqueda
  const [cart, setCart] = useState([]); // Los items en el carrito
  const [total, setTotal] = useState(0); // El total de la venta
  const [subtotal, setSubtotal] = useState(0);
  // --- IVA predeterminado (0 o 15) guardado en el navegador ---
  // Clave donde guardaremos la preferencia del usuario
  const DEFAULT_IVA_KEY = "rx_default_iva_percentage";

  // Al iniciar la página, leemos el IVA predeterminado desde localStorage.
  // Si no hay nada guardado, usamos 0% por defecto.
  const [ivaPercentage, setIvaPercentage] = useState(() => {
    const saved = localStorage.getItem(DEFAULT_IVA_KEY);
    const parsed = saved ? Number(saved) : 0; // 0 como predeterminado
    return parsed === 15 ? 15 : 0; // Solo permitimos 0 o 15
  });

  // Función para cambiar el predeterminado y aplicarlo de una
  const setDefaultIVA = (value) => {
    const safe = value === 15 ? 15 : 0;
    localStorage.setItem(DEFAULT_IVA_KEY, String(safe));
    setIvaPercentage(safe);
  };

  const [ivaAmount, setIvaAmount] = useState(0);
  const [loadingSearch, setLoadingSearch] = useState(false); // Indicador de carga
  const { user, activeShift } = useContext(AuthContext); // Info del usuario y turno
  const [searchMode, setSearchMode] = useState("products"); // 'products' or 'workorders'
  const [workOrderResults, setWorkOrderResults] = useState([]); // Resultados para órdenes
  const [loadingWorkOrderSearch, setLoadingWorkOrderSearch] = useState(false); // Carga para órdenes
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [lastSuccessfulSale, setLastSuccessfulSale] = useState(null);
  const [customerCI, setCustomerCI] = useState(""); // Cédula/RUC
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerEmail, setCustomerEmail] = useState(""); // Añadimos email también
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);

  // Calcula el total cada vez que el carrito cambia
  useEffect(() => {
    const rawSubtotal = cart.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );
    const roundedSubtotal = Number(rawSubtotal.toFixed(2));
    const calculatedIva = Number(
      ((roundedSubtotal * ivaPercentage) / 100).toFixed(2)
    );
    const calculatedTotal = Number(
      (roundedSubtotal + calculatedIva).toFixed(2)
    );
    setSubtotal(roundedSubtotal);
    setIvaAmount(calculatedIva);
    setTotal(calculatedTotal);
  }, [cart, ivaPercentage]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      // --- LÓGICA CONDICIONAL SEGÚN searchMode ---
      if (searchMode === "products") {
        fetchProducts(searchTerm); // Llama a buscar productos
      } else if (searchMode === "workorders") {
        fetchReadyWorkOrders(searchTerm); // Llama a buscar órdenes listas
      }
      // --- FIN LÓGICA ---
    }, 500);

    return () => clearTimeout(delayDebounceFn);
    // Añadimos searchMode a las dependencias por si cambia mientras el usuario escribe
  }, [searchTerm, searchMode]);

  // --- NUEVO useEffect PARA LIMPIAR BÚSQUEDA AL CAMBIAR MODO ---
  useEffect(() => {
    setSearchTerm("");
    setSearchResults([]);
    setWorkOrderResults([]);
  }, [searchMode]); // Se ejecuta cada vez que searchMode cambia
  // --- FIN NUEVO useEffect ---

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

  // --- NUEVA FUNCIÓN PARA BUSCAR ÓRDENES ---
  const fetchReadyWorkOrders = async (query) => {
    if (!query || query.length < 2) {
      // No buscar si es corto
      setWorkOrderResults([]);
      return;
    }
    setLoadingWorkOrderSearch(true); // Usamos el nuevo estado de carga
    try {
      const response = await api.get("/work-orders/ready/search", {
        params: { search: query },
      });
      setWorkOrderResults(response.data);
    } catch (error) {
      console.error("Error buscando órdenes de trabajo:", error);
      setWorkOrderResults([]);
    } finally {
      setLoadingWorkOrderSearch(false);
    }
  };
  // --- FIN NUEVA FUNCIÓN ---

  // --- FUNCIÓN ADAPTADA: AÑADIR PRODUCTO O COBRO DE ORDEN ---
  const handleAddToCart = (itemToAdd, itemType = "product") => {
    if (itemType === "product") {
      // Lógica existente para PRODUCTOS
      const existingCartItemIndex = cart.findIndex(
        (item) => item.product_id === itemToAdd.id && !item.isWorkOrder
      ); // Verifica que no sea orden

      if (existingCartItemIndex > -1) {
        // Incrementar cantidad si ya existe
        const updatedCart = cart.map((item, index) => {
          if (index === existingCartItemIndex) {
            // OJO: Aquí podríamos verificar stock antes de añadir más
            return { ...item, quantity: item.quantity + 1 };
          }
          return item;
        });
        setCart(updatedCart);
      } else {
        // Añadir producto nuevo si no existe
        const newCartItem = {
          isWorkOrder: false,
          product_id: itemToAdd.id,
          description: itemToAdd.name,
          quantity: 1,
          // --- GUARDAR TODOS LOS PRECIOS ---
          price_1: itemToAdd.price_1,
          price_2: itemToAdd.price_2,
          price_3: itemToAdd.price_3,
          selected_price_level: 3, // Por defecto usamos P3
          unit_price: itemToAdd.price_3, // El precio unitario actual es P3
          // --- FIN ---
        };

        setCart((prevCart) => [...prevCart, newCartItem]);
      }
    } else if (itemType === "workorder") {
      // Lógica NUEVA para ÓRDENES DE TRABAJO
      // Verificar si el cobro de ESTA orden ya está en el carrito
      const existingCartItemIndex = cart.findIndex(
        (item) => item.isWorkOrder && item.work_order_id === itemToAdd.id
      );

      if (existingCartItemIndex > -1) {
        // Ya está en el carrito, quizás mostrar un mensaje o no hacer nada
        alert(
          `El cobro de la Orden #${itemToAdd.work_order_number} ya está en el carrito.`
        );
        return;
      }

      // ✅ Calcular saldo pendiente y NORMALIZAR a mínimo 0
      const rawPending =
        (itemToAdd.final_cost ?? itemToAdd.estimated_cost ?? 0) -
        (itemToAdd.deposit_amount ?? 0);
      const displayPending = Math.max(0, Number(rawPending || 0));

      if (displayPending <= 0) {
        alert(
          `La Orden #${itemToAdd.work_order_number} no tiene saldo pendiente.`
        );
        return; // No añadir si no hay nada que cobrar
      }

      // Añadir el cobro de la orden como un item especial
      const newCartItem = {
        isWorkOrder: true,
        work_order_id: itemToAdd.id,
        description: `Cobro Orden #${itemToAdd.work_order_number} (${itemToAdd.device_brand} ${itemToAdd.device_model})`,
        quantity: 1,
        unit_price: displayPending, // ✅ usamos el valor normalizado
      };

      // --- NUEVO: AUTO-LLENAR DATOS CLIENTE ---
      // Solo llenamos si los campos están vacíos o si es la primera orden añadida
      // (Podríamos preguntar al usuario si quiere sobrescribir si ya hay datos)
      const isFirstWorkOrder = !cart.some((item) => item.isWorkOrder);
      if (isFirstWorkOrder) {
        // Opcional: podrías quitar esta condición si siempre quieres sobrescribir
        setCustomerCI(itemToAdd.customer_id_card || "");
        setCustomerName(itemToAdd.customer_name || "");
        setCustomerPhone(itemToAdd.customer_phone || "");
        setCustomerAddress(itemToAdd.customer_address || "");
        // No tenemos email en la orden de trabajo, así que no lo llenamos
        // setCustomerEmail(''); // Opcional: Limpiar email si se añade orden
      }
      // --- FIN AUTO-LLENAR ---

      setCart((prevCart) => [...prevCart, newCartItem]);
    }
    // Limpiar búsqueda SOLO si se añadió una orden de trabajo
    if (itemType === "workorder") {
      setSearchTerm("");
      setSearchResults([]);
      setWorkOrderResults([]);
    }
    // Si es 'product', no limpiamos para poder añadir más unidades.
  }; // <-- Cierre de la función
  // --- FIN FUNCIÓN ADAPTADA ---

  // --- FUNCIÓN: QUITAR ITEM COMPLETO ---
  const handleRemoveItem = (indexToRemove) => {
    // Filtra para crear un nuevo array SIN el item en ese índice
    const updatedCart = cart.filter((_item, index) => index !== indexToRemove);
    setCart(updatedCart);
  };
  // --- FIN FUNCIÓN: QUITAR ITEM COMPLETO ---

  // --- NUEVA FUNCIÓN: DECREMENTAR CORREGIDA 25 10 2025 01:23am---
  const handleDecrementQuantity = (indexToDecrement) => {
    // Buscamos el item específico
    const itemToDecrement = cart[indexToDecrement];

    // Si el item no existe, es una orden, o la cantidad ya es 1 o menos...
    if (
      !itemToDecrement ||
      itemToDecrement.isWorkOrder ||
      itemToDecrement.quantity <= 1
    ) {
      // ...entonces eliminamos toda la línea del item.
      handleRemoveItem(indexToDecrement);
    } else {
      // Si la cantidad es mayor que 1, simplemente restamos 1
      const updatedCart = cart.map((item, index) => {
        if (index === indexToDecrement) {
          return { ...item, quantity: item.quantity - 1 };
        }
        return item;
      });
      setCart(updatedCart);
    }
  };
  // --- FIN FUNCIÓN DECREMENTAR ---

  // --- NUEVA FUNCIÓN: INCREMENTAR CANTIDAD ---
  const handleIncrementQuantity = (indexToIncrement) => {
    const updatedCart = cart.map((item, index) => {
      // Si es el item correcto Y NO es una orden de trabajo...
      if (index === indexToIncrement && !item.isWorkOrder) {
        // ...sumamos 1 a la cantidad
        // OJO: Aquí podríamos añadir una verificación de stock si quisiéramos ser estrictos
        return { ...item, quantity: item.quantity + 1 };
      }
      // En cualquier otro caso, el item se queda como está
      return item;
    });
    setCart(updatedCart);
  };
  // --- FIN FUNCIÓN INCREMENTAR CANTIDAD ---

  // --- NUEVA FUNCIÓN: CAMBIAR NIVEL DE PRECIO DEL ITEM ---
  const handleChangePriceLevel = (indexToChange, newLevel) => {
    const updatedCart = cart.map((item, index) => {
      // Si es el item correcto, no es orden, y el nivel es válido (1, 2, o 3)
      if (
        index === indexToChange &&
        !item.isWorkOrder &&
        [1, 2, 3].includes(newLevel)
      ) {
        let newPrice = item.price_3; // Default a P3
        if (newLevel === 1) newPrice = item.price_1;
        else if (newLevel === 2) newPrice = item.price_2;

        // Devolver copia con nivel y precio unitario actualizados
        return {
          ...item,
          selected_price_level: newLevel,
          unit_price: newPrice,
        };
      }
      // Devolver item sin cambios si no aplica
      return item;
    });
    setCart(updatedCart);
  };
  // --- FIN FUNCIÓN CAMBIAR NIVEL DE PRECIO DEL ITEM ---

  // --- NUEVA FUNCIÓN: CAMBIAR NIVEL DE PRECIO GLOBAL ---
  const handleChangeAllPriceLevels = (newLevel) => {
    if (![1, 2, 3].includes(newLevel)) return; // Validar nivel

    const updatedCart = cart.map((item) => {
      // Solo modificar si es un producto (!isWorkOrder)
      if (!item.isWorkOrder) {
        let newPrice = item.price_3; // Default P3
        if (newLevel === 1) newPrice = item.price_1;
        else if (newLevel === 2) newPrice = item.price_2;

        // Devolver copia con nivel y precio unitario actualizados
        return {
          ...item,
          selected_price_level: newLevel,
          unit_price: newPrice,
        };
      }
      // Devolver orden de trabajo sin cambios
      return item;
    });
    setCart(updatedCart);
  };
  // --- FIN FUNCION CAMBIAR PRECIO GLOBAL ---

  // --- NUEVA FUNCIÓN MODIFICADA: Enviar venta incluyendo work_order_id si aplica ---
  const handleSubmitSale = async (saleDataFromModal) => {
    // Buscamos si hay una orden de trabajo en el carrito (tomamos la primera si hay varias)
    const workOrderItem = cart.find((item) => item.isWorkOrder);

    // Preparamos los items para enviar al backend mapeando desde el estado 'cart'
    // - Si el item es una orden de trabajo, dejamos product_id en null (o lo que tu backend espere)
    // - Conservamos description, quantity y unit_price tal como están en el carrito
    const itemsPayload = cart.map((item) => ({
      product_id: item.isWorkOrder ? null : item.product_id,
      description: item.description,
      // Si el item es orden de trabajo, quantity debería ser 1 (ya lo manejas así al añadirlo).
      quantity: item.quantity,
      unit_price: item.unit_price,
    }));

    // Preparamos el objeto final que enviará la petición.
    // Añadimos work_order_id solo si existe un item de orden de trabajo en el carrito.
    const normalizedPhone =
      saleDataFromModal.customer_phone &&
      saleDataFromModal.customer_phone.toString().trim() !== ""
        ? saleDataFromModal.customer_phone.toString().trim()
        : null;
    const normalizedAddress =
      saleDataFromModal.customer_address &&
      saleDataFromModal.customer_address.toString().trim() !== ""
        ? saleDataFromModal.customer_address.toString().trim()
        : null;
    const normalizedEmail =
      saleDataFromModal.customer_email &&
      saleDataFromModal.customer_email.toString().trim() !== ""
        ? saleDataFromModal.customer_email.toString().trim()
        : null;

    const saleData = {
      payment_method: saleDataFromModal.payment_method,
      payment_method_details: saleDataFromModal.payment_method_details,
      pin: saleDataFromModal.pin,
      items: itemsPayload,
      iva_percentage:
        typeof saleDataFromModal.iva_percentage === "number"
          ? saleDataFromModal.iva_percentage
          : ivaPercentage,
      // --- DATOS DEL CLIENTE ---
      customer_ci:
        saleDataFromModal.customer_ci?.toString().trim() || customerCI.trim(),
      customer_name:
        saleDataFromModal.customer_name?.toString().trim() ||
        customerName.trim(),
      customer_phone: normalizedPhone ?? null,
      customer_address: normalizedAddress ?? null,
      customer_email: normalizedEmail ?? null,
      // work_order_id: null si no hay orden; esto facilita que el backend lo reciba siempre
      // y haga la lógica correspondiente.
      work_order_id: workOrderItem ? workOrderItem.work_order_id : null,
    };

    try {
      // Llamada al backend para crear la venta
      const response = await api.post("/sales/", saleData);

      // Si la venta se registra correctamente:
      setCart([]); // Limpiamos el carrito
      setSearchTerm(""); // Limpiamos la búsqueda
      setSearchResults([]); // Limpiamos los resultados de búsqueda
      setLastSuccessfulSale(response.data); // Guardamos info para mostrar el mensaje de éxito
      setIsPaymentModalOpen(false); // Cerramos el modal de pago

      // Devolvemos la respuesta por si quien llama (el modal) la necesita
      return response.data;
    } catch (error) {
      // Log para desarrollo
      console.error(
        "Error al registrar la venta:",
        error.response?.data || error
      );

      // Lanzamos un error con mensaje claro para que el modal lo muestre
      throw new Error(
        error.response?.data?.detail ||
          "No se pudo completar la venta. Revisa el PIN o el stock."
      );
    }
  };
  // --- FIN FUNCIÓN MODIFICADA ---

  const handleDownloadReceipt = async () => {
    if (!lastSuccessfulSale) return;

    try {
      setIsDownloadingReceipt(true);
      const response = await api.get(
        `/sales/${lastSuccessfulSale.id}/receipt`,
        {
          responseType: "blob",
        }
      );

      const blob = new Blob([response.data], { type: "application/pdf" });
      const fileURL = window.URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = fileURL;
      downloadLink.setAttribute(
        "download",
        `recibo_venta_${lastSuccessfulSale.id}.pdf`
      );
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.URL.revokeObjectURL(fileURL);
    } catch (error) {
      console.error("Error al descargar el recibo de la venta:", error);
      alert(
        "No se pudo generar el recibo. Revisa la consola para más detalles."
      );
    } finally {
      setIsDownloadingReceipt(false);
    }
  };

  // --- Diseño Básico de la Interfaz ---
  // --- CORRECCIÓN: Añadido Fragment < > para envolver todo ---
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Búsqueda y Resultados */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-md border">
          {/* --- TABS DE BÚSQUEDA (NUEVO) --- */}
          <div className="flex border-b mb-4">
            <button
              onClick={() => setSearchMode("products")}
              className={`py-2 px-4 font-semibold ${
                searchMode === "products"
                  ? "border-b-2 border-accent text-accent"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Productos
            </button>
            <button
              onClick={() => setSearchMode("workorders")}
              className={`py-2 px-4 font-semibold ${
                searchMode === "workorders"
                  ? "border-b-2 border-accent text-accent"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Órdenes Listas
            </button>
          </div>
          {/* --- FIN TABS --- */}

          <h2 className="text-xl font-bold text-secondary mb-4">
            {searchMode === "products"
              ? "Buscar Productos"
              : "Buscar Órdenes de Trabajo Listas"}
          </h2>
          <div className="mb-4">
            <input
              type="text"
              placeholder={
                searchMode === "products"
                  ? "Buscar por nombre, SKU..."
                  : "Buscar por N° Orden, Cliente, Cédula..."
              } // Placeholder dinámico
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-detail"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="h-96 overflow-y-auto border rounded-lg p-2 bg-gray-50">
            {/* --- CONTENIDO DINÁMICO DE RESULTADOS (MODIFICADO) --- */}
            {searchMode === "products" && ( // MOSTRAR RESULTADOS DE PRODUCTOS
              <>
                {loadingSearch ? (
                  <p className="text-gray-400 text-center py-4">
                    Buscando productos...
                  </p>
                ) : searchResults.length > 0 ? (
                  searchResults.map((product) => (
                    <div
                      key={`prod-${product.id}`} /* ... Clases y contenido para producto ... */
                      className="flex items-center justify-between p-3 mb-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-150 cursor-pointer"
                    >
                      {/* Copia aquí el diseño de item de producto que ya tenías */}
                      {/* Sección Izquierda: Imagen e Info */}
                      <div className="flex items-center space-x-3 flex-grow min-w-0 mr-3">
                        <img
                          // Usamos la "agenda" para saber dónde está el almacén
                          src={`${
                            import.meta.env.VITE_API_URL ||
                            "http://localhost:8000"
                          }${
                            product.images[0]?.image_url || "/placeholder.png"
                          }`}
                          alt={product.name}
                          className="h-12 w-12 object-cover rounded flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-base text-secondary truncate">
                            {product.name}
                          </p>
                          <p className="text-sm text-gray-500">{product.sku}</p>
                          <p
                            className={`text-xs font-bold ${
                              product.stock_quantity > 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            Stock Bodega: {product.stock_quantity}
                          </p>
                          {product.other_locations_stock &&
                            product.other_locations_stock.length > 0 && (
                              <div className="text-xs text-blue-600 mt-1 truncate">
                                <span className="font-medium">Disp:</span>{" "}
                                {product.other_locations_stock.map(
                                  (stockInfo) => (
                                    <span
                                      key={stockInfo.location_name}
                                      className="ml-1"
                                    >
                                      {stockInfo.location_name.substring(0, 3)}(
                                      {stockInfo.quantity})
                                    </span>
                                  )
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                      {/* Sección Derecha: Precio y Botón Añadir */}
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-lg text-secondary">
                          ${product.price_3.toFixed(2)}
                        </p>
                        <button
                          className="mt-1 bg-accent hover:bg-teal-500 text-white font-bold py-1 px-3 rounded-md transition duration-150 text-sm"
                          title="Añadir al carrito"
                          onClick={() => handleAddToCart(product)}
                        >
                          Añadir
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
              </>
            )}

            {searchMode === "workorders" && ( // MOSTRAR RESULTADOS DE ÓRDENES
              <>
                {loadingWorkOrderSearch ? ( // Usamos el nuevo estado de carga
                  <p className="text-gray-400 text-center py-4">
                    Buscando órdenes...
                  </p>
                ) : workOrderResults.length > 0 ? (
                  workOrderResults.map((order) => {
                    // ✅ Calculamos y normalizamos el saldo para NO mostrar valores negativos
                    const rawPending =
                      (order.final_cost ?? order.estimated_cost ?? 0) -
                      (order.deposit_amount ?? 0);

                    // Lo que mostramos visualmente (mínimo 0.00)
                    const displayPending = Math.max(0, Number(rawPending || 0));

                    // Si hay algo que cobrar (> 0)
                    const canCharge = displayPending > 0;

                    return (
                      <div
                        key={`wo-${order.id}`}
                        className="flex items-center justify-between p-3 mb-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-150 cursor-pointer"
                      >
                        {/* Info de la Orden */}
                        <div className="flex-grow min-w-0 mr-3">
                          <p className="font-semibold text-base text-secondary truncate">
                            Orden #{order.work_order_number} -{" "}
                            {order.customer_name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {order.device_brand} {order.device_model}
                          </p>
                          <p className="text-xs text-gray-500">
                            C.I: {order.customer_id_card}
                          </p>
                        </div>

                        {/* Saldo y Botón */}
                        <div className="text-right flex-shrink-0">
                          {/* Monto pendiente NUNCA negativo */}
                          <p className="font-bold text-lg text-secondary">
                            ${displayPending.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">Pendiente</p>

                          {/* Botón deshabilitado si no hay saldo */}
                          <button
                            disabled={!canCharge} // 🔒 deshabilita si no hay nada que cobrar
                            className={`mt-1 font-bold py-1 px-3 rounded-md transition duration-150 text-sm ${
                              !canCharge
                                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                                : "bg-accent text-white hover:bg-teal-500"
                            }`}
                            title={
                              canCharge
                                ? "Añadir cobro al carrito"
                                : "La orden ya no tiene saldo pendiente"
                            }
                            onClick={() =>
                              canCharge && handleAddToCart(order, "workorder")
                            }
                          >
                            Añadir
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : searchTerm.length >= 2 ? (
                  <p className="text-gray-400 text-center py-4">
                    No se encontraron órdenes listas.
                  </p>
                ) : (
                  <p className="text-gray-400 text-center py-4">
                    Escribe N° Orden, Cliente o C.I. (mín 2 car.)...
                  </p>
                )}
              </>
            )}
            {/* --- FIN CONTENIDO DINÁMICO --- */}
          </div>
        </div>

        {/* Columna Derecha: Carrito y Pago */}
        <div className="bg-white p-6 rounded-xl shadow-md border">
          <h2 className="text-xl font-bold text-secondary mb-4">
            Carrito de Venta
          </h2>
          <div className="h-64 overflow-y-auto border rounded-lg p-2 mb-4 bg-gray-50 divide-y divide-gray-200">
            {" "}
            {/* Añadido divide-y */}
            {cart.length === 0 ? (
              <p className="text-gray-400 text-center py-4">Carrito vacío</p>
            ) : (
              cart.map((item, index) => (
                <div
                  key={index}
                  className="py-2 px-1 flex justify-between items-center"
                >
                  {/* -------------------------------------------------------
                      Columna izquierda: descripción + cantidad/precio + P1/P2/P3
                     ------------------------------------------------------- */}
                  <div className="flex-grow min-w-0 mr-2">
                    {/* Descripción del ítem (truncada si hace falta) */}
                    <p className="font-semibold text-sm truncate">
                      {item.description}
                    </p>

                    {/* Mostrar cantidad x precio SOLO para productos (no para órdenes) */}
                    {!item.isWorkOrder && (
                      <p className="text-xs text-gray-500">
                        Cant: {item.quantity} x ${item.unit_price.toFixed(2)}
                      </p>
                    )}

                    {/* Mostrar saldo pendiente SOLO para órdenes de trabajo */}
                    {item.isWorkOrder && (
                      <p className="text-xs text-gray-500">
                        Saldo Pendiente: ${item.unit_price.toFixed(2)}
                      </p>
                    )}

                    {/* -------------------------------------------------------
                      BOTONES P1 / P2 / P3 - solo para productos (no órdenes)
                      - Llaman a handleChangePriceLevel(index, level)
                      - Muestran el nivel activo con estilo distinto
                      - Evitan que el click propague si hay handlers en el contenedor
                      ------------------------------------------------------- */}
                    {!item.isWorkOrder && (
                      <div className="flex space-x-1 mt-1">
                        {[1, 2, 3].map((level) => (
                          <button
                            key={level}
                            type="button"
                            // Evitamos propagación de evento por si el contenedor tiene onClick
                            onClick={(e) => {
                              e.stopPropagation();
                              handleChangePriceLevel(index, level);
                            }}
                            // Clases con Tailwind: estilo activo vs inactivo
                            className={`px-1.5 py-0.5 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-offset-1 ${
                              item.selected_price_level === level
                                ? "bg-blue-500 text-white border-blue-600 font-bold"
                                : "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200"
                            }`}
                            title={`Aplicar Precio ${level}`}
                            aria-pressed={
                              item.selected_price_level === level
                                ? "true"
                                : "false"
                            }
                          >
                            P{level}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* ------------------------------------------------------- */}
                  </div>

                  {/* -------------------------------------------------------
                    Columna derecha: controles de cantidad / eliminar (sin cambios)
                    Mantén aquí tus botones existentes (decrementar, incrementar, eliminar)
                    ------------------------------------------------------- */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-sm mb-1">
                      ${(item.quantity * item.unit_price).toFixed(2)}
                    </p>

                    <div className="flex items-center justify-end space-x-1.5 mt-1">
                      {/* Botón Decrementar (-) - Solo para productos */}
                      {!item.isWorkOrder && (
                        <button
                          type="button"
                          onClick={() => handleDecrementQuantity(index)}
                          className="flex items-center justify-center h-5 w-5 rounded-full bg-gray-200 text-gray-600 hover:bg-red-200 hover:text-red-700 transition-colors duration-150"
                          title="Quitar uno"
                        >
                          <span className="text-sm font-bold leading-none">
                            -
                          </span>
                        </button>
                      )}

                      {/* Botón Incrementar (+) - Solo para productos */}
                      {!item.isWorkOrder && (
                        <button
                          type="button"
                          onClick={() => handleIncrementQuantity(index)}
                          className="flex items-center justify-center h-5 w-5 rounded-full bg-gray-200 text-gray-600 hover:bg-green-200 hover:text-green-700 transition-colors duration-150"
                          title="Añadir uno más"
                        >
                          <span className="text-sm font-bold leading-none">
                            +
                          </span>
                        </button>
                      )}

                      {/* Botón Eliminar Item Completo (X) */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="flex items-center justify-center h-5 w-5 rounded-full bg-red-100 text-red-600 hover:bg-red-500 hover:text-white transition-colors duration-150"
                        title="Quitar todo"
                      >
                        <span className="text-sm font-bold leading-none">
                          &times;
                        </span>
                      </button>
                    </div>
                    {/* --- FIN BOTONES CON ESTILO --- */}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* --- NUEVO: SECCIÓN DATOS DEL CLIENTE --- */}
          <div className="mb-4 border-t pt-4">
            <h3 className="text-lg font-semibold text-secondary mb-2">
              Datos del Cliente
            </h3>
            <div className="space-y-2">
              <div>
                <label
                  htmlFor="customerCI"
                  className="text-xs font-medium text-gray-500 block mb-0.5"
                >
                  Cédula / RUC*
                </label>
                <input
                  id="customerCI"
                  type="text" // Mantenemos text para RUCs que pueden tener guion, pero pattern ayuda
                  value={customerCI}
                  onChange={(e) => setCustomerCI(e.target.value)}
                  className="w-full p-1.5 border rounded-md text-sm"
                  required
                  placeholder="Ej: 1712345678 o 1712345678001"
                  pattern="[0-9]*" // <-- SOLO NÚMEROS (para Cédula) - RUC necesitaría ajuste
                  maxLength="13" // <-- Longitud máxima RUC Ecuador
                  title="Ingrese solo números para Cédula o RUC." // Mensaje de ayuda
                />
              </div>
              <div>
                <label
                  htmlFor="customerName"
                  className="text-xs font-medium text-gray-500 block mb-0.5"
                >
                  Nombre y Apellido*
                </label>
                <input
                  id="customerName"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full p-1.5 border rounded-md text-sm"
                  required
                  placeholder="Nombre Completo"
                  pattern="[A-Za-zñÑáéíóúÁÉÍÓÚ\s]+" // <-- LETRAS Y ESPACIOS
                  title="Ingrese solo letras y espacios."
                />
              </div>
              <div>
                <label
                  htmlFor="customerPhone"
                  className="text-xs font-medium text-gray-500 block mb-0.5"
                >
                  Teléfono
                </label>
                <input
                  id="customerPhone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full p-1.5 border rounded-md text-sm"
                  placeholder="Ej: 0991234567"
                  pattern="[0-9]{7,10}" // <-- 7 a 10 NÚMEROS
                  title="Ingrese un número de teléfono válido (7 a 10 dígitos)."
                />
              </div>
              <div>
                <label
                  htmlFor="customerAddress"
                  className="text-xs font-medium text-gray-500 block mb-0.5"
                >
                  Dirección
                </label>
                <input
                  id="customerAddress"
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full p-1.5 border rounded-md text-sm"
                  placeholder="Dirección Domiciliaria"
                />
              </div>
              <div>
                <label
                  htmlFor="customerEmail"
                  className="text-xs font-medium text-gray-500 block mb-0.5"
                >
                  Correo Electrónico
                </label>
                <input
                  id="customerEmail"
                  type="email" // Tipo email
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full p-1.5 border rounded-md text-sm"
                  placeholder="correo@ejemplo.com"
                />
              </div>
            </div>
          </div>
          {/* --- FIN SECCIÓN CLIENTE --- */}

          {/* --- NUEVO: BOTONES GLOBALES DE PRECIO --- */}
          <div className="flex justify-around items-center my-3 px-1">
            <button
              onClick={() => handleChangeAllPriceLevels(1)}
              className="text-xs font-semibold px-2 py-1 rounded border border-gray-300 bg-gray-100 text-gray-700 hover:bg-blue-100 hover:border-blue-300"
              title="Aplicar Precio 1 (Distribuidor) a todos los productos"
            >
              Todos P1
            </button>
            <button
              onClick={() => handleChangeAllPriceLevels(2)}
              className="text-xs font-semibold px-2 py-1 rounded border border-gray-300 bg-gray-100 text-gray-700 hover:bg-blue-100 hover:border-blue-300"
              title="Aplicar Precio 2 (Descuento) a todos los productos"
            >
              Todos P2
            </button>
            <button
              onClick={() => handleChangeAllPriceLevels(3)}
              className="text-xs font-semibold px-2 py-1 rounded border border-gray-300 bg-gray-100 text-gray-700 hover:bg-blue-100 hover:border-blue-300"
              title="Aplicar Precio 3 (Normal) a todos los productos"
            >
              Todos P3
            </button>
          </div>
          {/* --- FIN BOTONES GLOBALES --- */}

          {/* Total y Botón de Pago */}
          <div className="border-t pt-4 space-y-4">
            <div>
              <p className="text-sm font-semibold text-secondary mb-2">
                IVA aplicado (Ecuador)
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIvaPercentage(0)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-semibold transition ${
                    ivaPercentage === 0
                      ? "bg-accent text-white border-accent shadow"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  IVA 0%
                </button>
                <button
                  type="button"
                  onClick={() => setIvaPercentage(15)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-semibold transition ${
                    ivaPercentage === 15
                      ? "bg-accent text-white border-accent shadow"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  IVA 15%
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Selecciona la tasa vigente según el producto o servicio gravado.
              </p>
              {/* --- Elegir IVA predeterminado (se guarda en el navegador) --- */}
              <div className="mt-3 p-2 bg-gray-50 border rounded-lg">
                <p className="text-xs text-gray-600 mb-2">
                  IVA predeterminado actual:{" "}
                  <span className="font-semibold">
                    {ivaPercentage === 15 &&
                    localStorage.getItem(DEFAULT_IVA_KEY) === "15"
                      ? "15%"
                      : localStorage.getItem(DEFAULT_IVA_KEY) === "15"
                      ? "15%"
                      : "0%"}
                  </span>
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDefaultIVA(0)}
                    className="flex-1 py-1.5 px-2 rounded border text-xs font-semibold bg-white text-gray-700 hover:bg-gray-100 border-gray-300"
                    title="Guardar como IVA predeterminado 0%"
                  >
                    Predeterminado 0%
                  </button>
                  <button
                    type="button"
                    onClick={() => setDefaultIVA(15)}
                    className="flex-1 py-1.5 px-2 rounded border text-xs font-semibold bg-white text-gray-700 hover:bg-gray-100 border-gray-300"
                    title="Guardar como IVA predeterminado 15%"
                  >
                    Predeterminado 15%
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mt-2">
                  *RIMPE usa el 0% | RUC usa el 15%
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2 border border-gray-200">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>IVA ({ivaPercentage}%)</span>
                <span>${ivaAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-300">
                <span className="text-lg font-bold text-secondary">Total</span>
                <span className="text-2xl font-bold text-accent">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              className="w-full bg-highlight hover:bg-yellow-500 text-secondary font-bold py-3 rounded-lg transition duration-300 disabled:bg-gray-300"
              disabled={cart.length === 0}
              onClick={() => setIsPaymentModalOpen(true)}
            >
              Proceder al Pago
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Pago */}

      {lastSuccessfulSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-60 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-sm text-center">
            {/* Icono de Check (opcional, pero mejora la estética) */}
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-secondary mb-2">
              ¡Venta Registrada!
            </h3>
            <p className="text-gray-600 mb-1">
              ID Venta: #{lastSuccessfulSale.id}
            </p>
            <p className="text-gray-600 mb-4">
              Total Cobrado:{" "}
              <span className="font-bold">
                ${lastSuccessfulSale.total_amount.toFixed(2)}
              </span>
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Subtotal: ${lastSuccessfulSale.subtotal_amount.toFixed(2)} | IVA (
              {lastSuccessfulSale.iva_percentage}
              %): ${lastSuccessfulSale.tax_amount.toFixed(2)}
            </p>
            <div className="space-y-3">
              <button
                onClick={handleDownloadReceipt}
                className="w-full bg-highlight hover:bg-yellow-500 text-secondary font-bold py-2 px-4 rounded-lg transition duration-150 disabled:bg-gray-300"
                disabled={isDownloadingReceipt}
              >
                {isDownloadingReceipt
                  ? "Generando recibo..."
                  : "Descargar Recibo"}
              </button>
              <button
                onClick={() => setLastSuccessfulSale(null)} // Limpia el estado para ocultar el mensaje
                className="w-full bg-accent hover:bg-teal-500 text-white font-bold py-2 px-4 rounded-lg transition duration-150"
              >
                Nueva Venta
              </button>
            </div>
          </div>
        </div>
      )}
      {/* --- FIN MENSAJE DE VENTA EXITOSA --- */}

      {/* --- Modal de Pago (ya existente) --- */}
      {isPaymentModalOpen && (
        <PaymentModal
          totalAmount={total}
          subtotalAmount={subtotal}
          ivaPercentage={ivaPercentage}
          ivaAmount={ivaAmount}
          cartItems={cart.map((item) => ({
            product_id: item.isWorkOrder ? null : item.product_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
          }))}
          onClose={() => setIsPaymentModalOpen(false)}
          onSubmitSale={handleSubmitSale}
          // --- AÑADIR ESTAS LÍNEAS ---
          initialCustomerCI={customerCI}
          initialCustomerName={customerName}
          initialCustomerPhone={customerPhone}
          initialCustomerAddress={customerAddress}
          initialCustomerEmail={customerEmail}
          // --- FIN LÍNEAS AÑADIDAS ---
        />
      )}
    </> // --- CORRECCIÓN: Cierre del Fragment ---
  );
}

export default POSPage;
