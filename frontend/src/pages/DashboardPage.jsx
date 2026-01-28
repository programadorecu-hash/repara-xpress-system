// useContext nos permite preguntar "¿quién está conectado ahora?"
import React, { useState, useEffect, useContext } from "react";
import api from "../services/api"; // <-- Importamos nuestro mensajero
import { Link } from "react-router-dom"; // <-- Para los botones de acción
// Importamos el "mensajero" que sabe cómo registrar la venta perdida
import { createLostSaleLog } from "../services/lostSales.js";
// Importamos el "contexto" para saber qué usuario y sucursal están activos
import { AuthContext } from "../context/AuthContext.jsx";
// Importamos todos los íconos que usaremos
import {
  HiOutlineCurrencyDollar,
  HiOutlineArrowCircleDown,
  HiOutlineScale,
  HiOutlineArrowRight,
  HiOutlineShoppingCart, // <-- Ícono para "Vender"
  HiOutlineCog, // <-- Ícono para "Orden"
  HiOutlineCash, // <-- Ícono para "Gasto"
  HiOutlineArchive, // <-- Ícono para "Bodega"
  HiOutlineExclamationCircle,
  HiSearch, // <-- NUEVO: Ícono para buscar repuesto
} from "react-icons/hi";
// --- AÑADIMOS EL NUEVO FORMULARIO DE GASTO ---
import ExpenseModal from "../components/ExpenseModal.jsx";

// --- Molde para los Botones de Acción (no cambia) ---
const ActionButton = ({ to, icon, label, colorClass }) => (
  <Link
    to={to}
    className={`flex flex-col items-center justify-center p-6 rounded-lg text-white font-bold text-xl
                shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1
                ${colorClass} `}
  >
    <div className="h-10 w-10 mb-2">{icon}</div>
    <span>{label}</span>
  </Link>
);

// --- NUEVO Molde para botones que abren un POP-UP (Gasto) ---
// Es idéntico, pero usa una etiqueta <button> en lugar de <Link>
const ActionButtonAsButton = ({ onClick, icon, label, colorClass }) => (
  <button
    type="button" // Le decimos que es un botón
    onClick={onClick} // Le decimos qué hacer al hacer clic
    className={`flex flex-col items-center justify-center p-6 rounded-lg text-white font-bold text-xl
                shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1
                ${colorClass} `}
  >
    <div className="h-10 w-10 mb-2">{icon}</div>
    <span>{label}</span>
  </button>
);

// --- NUEVO: Molde para colorear los estados de las órdenes ---
// Esto nos ayudará a pintar el estado de cada orden en la lista
const StatusBadge = ({ status }) => {
  let colorClass = "bg-gray-200 text-gray-800"; // Color por defecto
  // Asignamos colores según el estado de la orden
  if (status === "RECIBIDO") colorClass = "bg-blue-200 text-blue-800";
  if (status === "EN_REVISION") colorClass = "bg-yellow-200 text-yellow-800";
  if (status === "REPARANDO") colorClass = "bg-orange-200 text-orange-800";
  if (status === "LISTO") colorClass = "bg-green-200 text-green-800";

  return (
    <span
      className={`px-2 py-1 text-xs font-semibold rounded-full ${colorClass}`}
    >
      {/* Reemplazamos guiones bajos por espacios, ej: "EN_REVISION" -> "EN REVISION" */}
      {status.replace("_", " ")}
    </span>
  );
};

// --- INICIO DE NUESTRO CÓDIGO (Ayudante de formato) ---
// (Copiado desde SalesHistoryPage.jsx)
const formatPaymentMethod = (method) => {
  if (!method) return "Otro";
  let spacedMethod = method.replace("_", " ");
  let formatted =
    spacedMethod.charAt(0).toUpperCase() + spacedMethod.slice(1).toLowerCase();
  return formatted;
};
// --- FIN DE NUESTRO CÓDIGO ---

function DashboardPage() {
  // --- Estados para las tarjetas de dinero (no cambian) ---
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true); // Renombrado para claridad
  const [error, setError] = useState("");

  // --- NUEVO "interruptor" para mostrar/ocultar el pop-up de gastos ---
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  // --- Estados para el formulario de Venta Perdida (no cambian) ---
  const [lostSaleProduct, setLostSaleProduct] = useState("");
  const [lostSaleReason, setLostSaleReason] = useState("");
  const [lostSaleLoading, setLostSaleLoading] = useState(false);
  const [lostSaleMessage, setLostSaleMessage] = useState("");

  // --- NUEVO: Estados para las nuevas listas ---
  const [todaysSales, setTodaysSales] = useState([]); // "Hilo de recibos"
  const [activeOrders, setActiveOrders] = useState([]); // "Pizarra de tareas"
  const [loadingLists, setLoadingLists] = useState(true); // "Cargando..." para ambas listas

  // --- NUEVO: Estado para las alertas de stock ---
  const [lowStockItems, setLowStockItems] = useState([]);

  // Traemos el USUARIO y el turno activo
  const { user, activeShift } = useContext(AuthContext);

  // --- NUEVA FUNCIÓN "WALKIE-TALKIE" ---
  // Esto es lo que se ejecutará cuando el "vale de gasto" nos avise.
  const handleExpenseSaved = () => {
    // 1. Cierra el formulario emergente
    setIsExpenseModalOpen(false);
    // 2. Llama a nuestra función para actualizar el tablero de puntuación
    fetchSummary();
  };

  // Función para guardar Venta Perdida (no cambia)
  const handleLostSaleSubmit = async (e) => {
    e.preventDefault();
    if (!activeShift || !activeShift.location) {
      setLostSaleMessage(
        "Error: No tienes un turno activo. No se puede registrar la venta perdida."
      );
      return;
    }
    if (!lostSaleProduct || !lostSaleReason) {
      setLostSaleMessage("Error: Debes llenar ambos campos.");
      return;
    }
    setLostSaleLoading(true);
    setLostSaleMessage("");
    try {
      const payload = {
        product_name: lostSaleProduct,
        reason: lostSaleReason,
        location_id: activeShift.location.id, // ¡Usamos la sucursal del turno activo!
      };
      await createLostSaleLog(payload);
      setLostSaleMessage("¡Venta perdida registrada! Gracias.");
      setLostSaleProduct("");
      setLostSaleReason("");
      setTimeout(() => setLostSaleMessage(""), 5000);
    } catch (err) {
      setLostSaleMessage("Error al guardar. Intenta de nuevo.");
      console.error(err);
    } finally {
      setLostSaleLoading(false);
    }
  };

  // DashboardPage.jsx

  // DashboardPage.jsx

  // --- Lógica de Carga de Datos (ORIGINAL) ---

  // 1. "Actualizar Tablero" (Tarjetas de Resumen)
  const fetchSummary = async () => {
    setLoadingSummary(true); 
    try {
      // Usamos el endpoint normal (el backend decide qué mostrar según el usuario)
      const response = await api.get("/reports/dashboard-summary");
      setSummary(response.data);
      setError(""); 
    } catch (err) {
      setError("No se pudo cargar el resumen.");
    } finally {
      setLoadingSummary(false); 
    }
  };

  // 2. "Actualizar Lista" (Listas de abajo y Alertas)
  const fetchDashboardLists = async () => {
    try {
      setLoadingLists(true);
      const today = new Date().toLocaleDateString("en-CA");

      // 1. Pedimos Ventas (Hilo de recibos)
      const salesPromise = api.get("/sales/", {
        params: {
          start_date: today,
          end_date: today,
          limit: 20,
          location_id: activeShift?.location?.id,
        },
      });

      // 2. Pedimos Órdenes (Pizarra de tareas)
      // Usamos active_only=true para que el servidor filtre por nosotros
      const ordersPromise = api.get("/work-orders/", { 
        params: { 
          limit: 50, 
          active_only: true 
        } 
      });

      // 3. Pedimos Alertas de Stock
      const stockPromise = api.get("/reports/low-stock");

      // --- AQUÍ ESTABA EL ERROR ---
      // Esperamos a que lleguen los 3 mensajeros.
      // Corregimos "ordersResponse" por "ordersPromise" dentro de la lista.
      const [salesResponse, ordersResponse, stockResponse] = await Promise.all([
        salesPromise,
        ordersPromise, // <--- ¡CORREGIDO! Usamos la promesa (el pedido), no la respuesta.
        stockPromise,
      ]);

      setTodaysSales(salesResponse.data);

      // Como el servidor ya filtró, usamos los datos directos
      // (Mantenemos un filtro extra por seguridad, pero ya debería venir limpio)
      const allOrders = ordersResponse.data;
      const activeOrders = allOrders.filter(
        (order) =>
          order.status !== "ENTREGADO" && 
          order.status !== "SIN_REPARACION"
      );
      setActiveOrders(activeOrders);

      setLowStockItems(stockResponse.data);
    } catch (err) {
      console.error("Error cargando listas:", err);
      setError("No se pudieron cargar los datos del tablero.");
    } finally {
      setLoadingLists(false);
    }
  };

  // 3. Este es el "Arranque" de la página
  useEffect(() => {
    fetchSummary();
    fetchDashboardLists();
  }, [activeShift]);

  // --- NUEVO "ESCUCHA-CAMPANAS" (PARA VENTAS) ---
  // Este useEffect se encarga de escuchar la "campana" de otras pestañas
  useEffect(() => {
    // 1. Definimos la función que se ejecuta al oír la campana
    const handleStorageEvent = (event) => {
      // Si la campana que sonó es la de 'rx-sale-event'
      if (event.key === "rx-sale-event") {
        // ¡Actualizamos AMBAS cosas!
        fetchSummary(); // El tablero de puntuación
        fetchDashboardLists(); // La lista de ventas de abajo
      }
    };

    // 2. Le decimos al navegador que "escuche"
    window.addEventListener("storage", handleStorageEvent);

    // 3. Le decimos cómo "dejar de escuchar" si salimos de la página
    return () => {
      window.removeEventListener("storage", handleStorageEvent);
    };

    // 4. Le decimos que "re-arme" esta función si las funciones de recarga cambian
  }, [fetchSummary, fetchDashboardLists]);
  // --- FIN DEL "ESCUCHA-CAMPANAS" ---

  // --- Cálculo de Balance (no cambia) ---
  const totalBalance =
    (summary?.total_sales || 0) - (summary?.total_expenses || 0);

  // --- ESTADO DE CARGA PRINCIPAL ---
  // Mostramos "Cargando..." solo si CUALQUIERA de las cargas está activa
  if (loadingSummary || loadingLists) {
    return <p className="text-center text-gray-400">Cargando dashboard...</p>;
  }

  // Si falló el resumen (que es lo más importante), mostramos el error
  if (error && !summary) {
    return <p className="text-center text-red-500">{error}</p>;
  }

  return (
    <>
      {/* Contenedor principal (no cambia) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- COLUMNA IZQUIERDA --- */}
        <div className="space-y-6">
          
          {/* NUEVO: Botón Visible y Elegante para Buscar Repuestos Externos */}
          <Link 
            to="/catalogo-repuestos" 
            // CAMBIO: Fondo azul muy claro, borde visible, texto azul corporativo y un poco más grande (text-xs)
            className="w-full mb-4 py-3 text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50/50 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 hover:shadow-md transition-all rounded-xl flex justify-center items-center gap-2 shadow-sm"
          >
            <HiSearch className="w-4 h-4" />
            BUSCAR REPUESTO - ECUADOR
          </Link>

          {/* 1. Botones de Acción (MODIFICADO) */}
          <div className="grid grid-cols-2 gap-4">
            <ActionButton
              to="/pos"
              icon={<HiOutlineShoppingCart className="h-10 w-10" />}
              label="VENDER"
              colorClass="bg-action-green hover:bg-teal-600"
            />
            <ActionButton
              to="/ordenes"
              icon={<HiOutlineCog className="h-10 w-10" />}
              label="ORDEN"
              colorClass="bg-accent hover:bg-blue-600"
            />

            {/* --- ESTE ES EL BOTÓN QUE CAMBIAMOS --- */}
            {/* Ya no es un "Link", ahora es un "Button" que abre el pop-up */}
            <ActionButtonAsButton
              onClick={() => setIsExpenseModalOpen(true)} // Le decimos que "encienda el interruptor"
              icon={<HiOutlineCash className="h-10 w-10" />}
              label="GASTO"
              colorClass="bg-highlight hover:bg-yellow-500"
            />
            {/* --- FIN DEL CAMBIO --- */}

            <ActionButton
              to="/inventario"
              icon={<HiOutlineArchive className="h-10 w-10" />}
              label="INVENTARIO"
              colorClass="bg-action-green hover:bg-teal-600"
            />
          </div>

          {/* 2. Venta Perdida (no cambia) */}
          <form
            onSubmit={handleLostSaleSubmit}
            className="bg-white p-6 rounded-xl shadow-md border"
          >
            <h2 className="text-xl font-bold text-secondary mb-2">
              VENTAS PERDIDAS
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              ANOTA AQUÍ CADA VEZ QUE UNA VENTA NO LOGRE COMPLETARSE
            </p>
            <div className="space-y-4">
              <input
                type="text"
                value={lostSaleProduct}
                onChange={(e) => setLostSaleProduct(e.target.value)}
                placeholder="Producto que no se vendió"
                className="w-full p-2 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-accent"
                disabled={lostSaleLoading}
              />
              <input
                type="text"
                value={lostSaleReason}
                onChange={(e) => setLostSaleReason(e.target.value)}
                placeholder="Motivo porqué no se vendió (Ej: Sin stock, muy caro, etc.)"
                className="w-full p-2 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-accent"
                disabled={lostSaleLoading}
              />
              <button
                type="submit"
                className="w-full py-2 px-4 bg-accent text-white font-semibold rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
                disabled={lostSaleLoading}
              >
                {lostSaleLoading ? "Registrando..." : "REGISTRAR VENTA PERDIDA"}
              </button>
              {lostSaleMessage && (
                <p
                  className={`text-sm text-center font-medium ${
                    lostSaleMessage.startsWith("Error")
                      ? "text-red-500"
                      : "text-green-600"
                  }`}
                >
                  {lostSaleMessage}
                </p>
              )}
            </div>
          </form>

          {/* --- 5. NUEVO: Panel "Ventas de Hoy" --- */}
          <div className="bg-white p-6 rounded-xl shadow-md border">
            <h2 className="text-xl font-bold text-secondary mb-4">
              Ventas de Hoy
            </h2>
            {/* Le damos un alto máximo y scroll */}
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {todaysSales.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  No hay ventas registradas hoy.
                </p>
              ) : (
                // Creamos la lista (hilo de recibos)
                todaysSales.map((sale) => (
                  // 1. Quitamos el "flex justify-between" del contenedor principal
                  <div
                    key={sale.id}
                    className="border-b pb-2 last:border-b-0 pt-2"
                  >
                    {/* 2. Fila Principal: Cliente y Total (esto es igual que antes) */}
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-sm">
                        {sale.customer_name}
                      </p>
                      <p className="font-bold text-action-green">
                        ${sale.total_amount.toFixed(2)}
                      </p>
                    </div>

                    {/* 3. Fila de Sub-detalles: Vendedor y Sucursal */}
                    <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                      <span>
                        Venta #{sale.id} por: {sale.user.email}
                      </span>
                      <span className="font-medium">{sale.location.name}</span>
                    </div>

                    {/* 4. Lista de Productos Vendidos (Qué y Cuántos) */}
                    <div className="mt-2 pl-2 border-l-2 border-gray-200">
                      {sale.items.map((item) => (
                        <p key={item.id} className="text-xs text-gray-700">
                          {/* (Cuántos) x (Qué) */}
                          <span className="font-medium">
                            {item.quantity}x
                          </span>{" "}
                          {item.description}
                        </p>
                      ))}
                    </div>

                    {/* 5. Método de Pago (usando nuestro ayudante) */}
                    <p className="text-xs text-gray-500 mt-1 pl-2">
                      Pagado con:{" "}
                      <span className="font-semibold text-gray-800">
                        {formatPaymentMethod(sale.payment_method)}
                      </span>
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* --- COLUMNA DERECHA --- */}
        <div className="space-y-6">
          
          

          {/* 3. Tarjetas de Dinero (no cambia) */}
          <div className="bg-white p-6 rounded-xl shadow-md border space-y-4">
            <div className="flex items-center p-4 bg-action-green/10 rounded-lg">
              <div className="p-3 rounded-full bg-action-green text-white">
                <HiOutlineCurrencyDollar className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-action-green uppercase">
                  Ventas de Hoy
                </p>
                <p className="text-2xl font-bold text-secondary">
                  ${(summary?.total_sales || 0).toFixed(2)}
                </p>
              </div>
            </div>
            <div className="flex items-center p-4 bg-highlight/10 rounded-lg">
              <div className="p-3 rounded-full bg-highlight text-white">
                <HiOutlineArrowCircleDown className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-highlight uppercase">
                  Gastos de Hoy
                </p>
                <p className="text-2xl font-bold text-secondary">
                  ${(summary?.total_expenses || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* 4. Tarjeta de Balance Diario (ESTILO CYAN AESTHETIC) */}
          <Link
            to={(user?.role === "super_admin" || user?.role === "admin" || user?.role === "inventory_manager") ? "/reporte-financiero" : "#"}
            onClick={(e) => { if (user?.role !== "super_admin" && user?.role !== "admin" && user?.role !== "inventory_manager") e.preventDefault(); }}
            className="group relative block bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-cyan-200"
          >
            {/* Barra lateral de color (Detalle elegante) */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300
              ${(totalBalance || 0) >= 0 ? "bg-cyan-500" : "bg-red-500"}
            `}></div>

            <div className="p-6 pl-8 flex flex-col justify-between h-full">
              
              {/* Encabezado */}
              <div className="flex justify-between items-start mb-2">
                 <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                       UTILIDAD DEL DÍA
                    </h3>
                    {/* Badge Sutil */}
                    <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wide
                       ${(totalBalance || 0) >= 0 ? "bg-cyan-50 text-cyan-700" : "bg-red-50 text-red-700"}
                    `}>
                       {(totalBalance || 0) >= 0 ? "En Verde" : "Déficit"}
                    </span>
                 </div>
                 
                 {/* Ícono Sutil */}
                 <div className={`p-2 rounded-full ${(totalBalance || 0) >= 0 ? "bg-cyan-50 text-cyan-600" : "bg-red-50 text-red-600"}`}>
                    <HiOutlineScale className="h-6 w-6" />
                 </div>
              </div>

              {/* El Número (Protagonista) */}
              <div className="mt-2 mb-4">
                 <p className="text-4xl font-extrabold text-gray-800 tracking-tight">
                    ${(totalBalance || 0).toFixed(2)}
                 </p>
              </div>

              {/* Footer: Barra de Meta */}
              <div className="mt-auto">
                 <div className="flex justify-between items-center text-xs font-medium text-gray-500 mb-1.5">
                    <span>Meta: ${(summary?.daily_goal || 0).toFixed(2)}</span>
                    <span className="text-cyan-600 font-bold">
                       {summary?.daily_goal > 0 ? `${Math.round(((summary?.total_sales || 0) / summary.daily_goal) * 100)}%` : "0%"}
                    </span>
                 </div>
                 {/* Barra de progreso */}
                 <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                       className={`h-full rounded-full transition-all duration-1000 ease-out
                          ${(totalBalance || 0) >= 0 ? "bg-gradient-to-r from-cyan-400 to-blue-500" : "bg-red-500"}
                       `}
                       style={{ width: `${Math.min(((summary?.total_sales || 0) / (summary?.daily_goal || 1)) * 100, 100)}%` }}
                    ></div>
                 </div>
              </div>

              {/* Icono flotante al hacer hover (Solo Admin) */}
              {(user?.role === "super_admin" || user?.role === "admin" || user?.role === "inventory_manager") && (
                 <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                    <HiOutlineArrowRight className="text-gray-300 hover:text-cyan-600 text-2xl" />
                 </div>
              )}

            </div>
          </Link>

          {/* --- 6. Panel "Órdenes Activas" (AGRUPADO POR SUCURSAL) --- */}
          <div className="bg-white p-6 rounded-xl shadow-md border">
            <h2 className="text-xl font-bold text-secondary mb-4">
              Órdenes Activas
            </h2>
            <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
              {activeOrders.length === 0 ? (
                <p className="text-gray-500 text-sm">No hay órdenes pendientes.</p>
              ) : (
                // Lógica de agrupación en tiempo real
                Object.entries(
                  activeOrders.reduce((groups, order) => {
                    // Usamos el nombre de la sucursal como clave para agrupar
                    const locName = order.location?.name || "Sin Sucursal";
                    if (!groups[locName]) groups[locName] = [];
                    groups[locName].push(order);
                    return groups;
                  }, {})
                ).map(([locationName, orders]) => (
                  <div key={locationName} className="mb-4 last:mb-0">
                    {/* Cabecera de Sucursal (DISEÑO SLIM: Estilo Corporativo Fino) */}
                    {/* Redujimos el padding vertical (py-1.5) y el margen inferior (mb-2) */}
                    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-l-4 border-accent shadow-sm px-3 py-1.5 mb-2 rounded-r flex items-center justify-between">
                      <span className="font-bold text-secondary uppercase tracking-wider text-xs flex items-center gap-2">
                        {/* Pequeño punto decorativo */}
                        <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                        {locationName}
                      </span>
                      {/* Etiqueta discreta a la derecha (Texto más pequeño) */}
                      <span className="text-[9px] font-semibold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                        SUCURSAL
                      </span>
                    </div>
                    
                    {/* Lista de órdenes de esa sucursal */}
                    <div className="space-y-2 pl-2">
                        {orders.map((order) => (
                          <div
                            key={order.id}
                            className="flex justify-between items-center border-b border-gray-100 pb-2 last:border-b-0 hover:bg-gray-50 p-2 rounded transition-colors"
                          >
                            <div>
                              <Link
                                to={`/ordenes`}
                                className="font-semibold text-sm text-accent hover:underline flex items-center gap-2"
                              >
                                <span>#{order.work_order_number}</span>
                                <span className="text-gray-800 font-normal truncate max-w-[150px]">- {order.customer_name}</span>
                              </Link>
                              <p className="text-xs text-gray-500 flex gap-2 mt-0.5">
                                <span className="bg-gray-100 px-1 rounded text-[10px] border">{order.device_brand} {order.device_model}</span>
                              </p>
                            </div>
                            <StatusBadge status={order.status} />
                          </div>
                        ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          {/* --- NUEVO: Alertas de Stock Bajo (AGRUPADO) --- */}
          {lowStockItems.length > 0 && (
            <div className="bg-red-50 p-6 rounded-xl shadow-md border border-red-200 mt-6">
              <div className="flex items-center mb-4 text-red-700">
                <HiOutlineExclamationCircle className="h-6 w-6 mr-2" />
                <h2 className="text-lg font-bold">¡Atención! Stock Bajo</h2>
              </div>
              
              <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                {/* Lógica de Agrupación Visual */}
                {(() => {
                  let lastLocation = null;
                  return lowStockItems.map((item, index) => {
                    const showHeader = item.location_name !== lastLocation;
                    lastLocation = item.location_name;

                    return (
                      <div key={index}>
                        {/* Cabecera de Grupo (Sucursal/Bodega) */}
                        {showHeader && (
                          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 mt-3 border-b pb-1">
                            {item.location_name}
                          </h3>
                        )}

                        {/* Item del Producto */}
                        <div className="flex justify-between items-center bg-white p-3 rounded border border-red-100 shadow-sm mb-1">
                          <div>
                            <p className="font-semibold text-sm text-gray-800">{item.product_name}</p>
                            <p className="text-xs text-gray-500 font-mono">{item.sku}</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${item.quantity === 0 ? 'bg-red-600 text-white' : 'bg-red-100 text-red-800'}`}>
                              {item.quantity === 0 ? 'AGOTADO' : `Quedan: ${item.quantity}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
          {/* --- FIN Alertas de Stock Bajo --- */}
        </div>
      </div>

      {/* Esto "dibuja" nuestro formulario emergente, pero lo mantiene oculto */}
      {/* hasta que el interruptor (isExpenseModalOpen) se encienda */}
      {/* Ahora le pasamos el "walkie-talkie" (onExpenseSaved) */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onExpenseSaved={handleExpenseSaved} // 1. Le pasamos el "walkie-talkie"
      />
    </>
  );
}

export default DashboardPage;
