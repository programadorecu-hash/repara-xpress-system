// useContext nos permite preguntar "¿quién está conectado ahora?"
import React, { useState, useEffect, useContext } from 'react'; 
import api from '../services/api'; // <-- Importamos nuestro mensajero
import { Link } from 'react-router-dom'; // <-- Para los botones de acción
// Importamos el "mensajero" que sabe cómo registrar la venta perdida
import { createLostSaleLog } from '../services/lostSales.js'; 
// Importamos el "contexto" para saber qué usuario y sucursal están activos
import { AuthContext } from '../context/AuthContext.jsx'; 
// Importamos todos los íconos que usaremos
import { 
  HiOutlineCurrencyDollar, 
  HiOutlineArrowCircleDown, 
  HiOutlineScale,
  HiOutlineShoppingCart, // <-- Ícono para "Vender"
  HiOutlineCog,           // <-- Ícono para "Orden"
  HiOutlineCash,          // <-- Ícono para "Gasto"
  HiOutlineArchive        // <-- Ícono para "Bodega"
} from 'react-icons/hi';
// --- AÑADIMOS EL NUEVO FORMULARIO DE GASTO ---
import ExpenseModal from '../components/ExpenseModal.jsx';

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
  let colorClass = 'bg-gray-200 text-gray-800'; // Color por defecto
  // Asignamos colores según el estado de la orden
  if (status === 'RECIBIDO') colorClass = 'bg-blue-200 text-blue-800';
  if (status === 'EN_REVISION') colorClass = 'bg-yellow-200 text-yellow-800';
  if (status === 'REPARANDO') colorClass = 'bg-orange-200 text-orange-800';
  if (status === 'LISTO') colorClass = 'bg-green-200 text-green-800';

  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colorClass}`}>
      {/* Reemplazamos guiones bajos por espacios, ej: "EN_REVISION" -> "EN REVISION" */}
      {status.replace('_', ' ')}
    </span>
  );
};

// --- INICIO DE NUESTRO CÓDIGO (Ayudante de formato) ---
// (Copiado desde SalesHistoryPage.jsx)
const formatPaymentMethod = (method) => {
  if (!method) return "Otro";
  let spacedMethod = method.replace('_', ' ');
  let formatted = spacedMethod.charAt(0).toUpperCase() + 
                  spacedMethod.slice(1).toLowerCase();
  return formatted;
};
// --- FIN DE NUESTRO CÓDIGO ---


function DashboardPage() {
  // --- Estados para las tarjetas de dinero (no cambian) ---
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true); // Renombrado para claridad
  const [error, setError] = useState('');

  // --- NUEVO "interruptor" para mostrar/ocultar el pop-up de gastos ---
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  // --- Estados para el formulario de Venta Perdida (no cambian) ---
  const [lostSaleProduct, setLostSaleProduct] = useState('');
  const [lostSaleReason, setLostSaleReason] = useState('');
  const [lostSaleLoading, setLostSaleLoading] = useState(false);
  const [lostSaleMessage, setLostSaleMessage] = useState('');

  // --- NUEVO: Estados para las nuevas listas ---
  const [todaysSales, setTodaysSales] = useState([]); // "Hilo de recibos"
  const [activeOrders, setActiveOrders] = useState([]); // "Pizarra de tareas"
  const [loadingLists, setLoadingLists] = useState(true); // "Cargando..." para ambas listas

  // Traemos el turno activo para saber la sucursal (no cambia)
  const { activeShift } = useContext(AuthContext);

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
      setLostSaleMessage('Error: No tienes un turno activo. No se puede registrar la venta perdida.');
      return;
    }
    if (!lostSaleProduct || !lostSaleReason) {
      setLostSaleMessage('Error: Debes llenar ambos campos.');
      return;
    }
    setLostSaleLoading(true);
    setLostSaleMessage('');
    try {
      const payload = {
        product_name: lostSaleProduct,
        reason: lostSaleReason,
        location_id: activeShift.location.id, // ¡Usamos la sucursal del turno activo!
      };
      await createLostSaleLog(payload);
      setLostSaleMessage('¡Venta perdida registrada! Gracias.');
      setLostSaleProduct('');
      setLostSaleReason('');
      setTimeout(() => setLostSaleMessage(''), 5000);
    } catch (err) {
      setLostSaleMessage('Error al guardar. Intenta de nuevo.');
      console.error(err);
    } finally {
      setLostSaleLoading(false);
    }
  };

  // DashboardPage.jsx

  // --- Lógica de Carga de Datos (RE-MODIFICADA) ---

  // 1. "Actualizar Tablero" (Tarjetas de Resumen)
  // La sacamos de useEffect para poder llamarla desde el "walkie-talkie"
  const fetchSummary = async () => {
    setLoadingSummary(true); // Poner "cargando..."
    try {
      const response = await api.get('/reports/dashboard-summary');
      setSummary(response.data);
      setError(''); // Limpiar errores viejos si la carga es exitosa
    } catch (err) {
      setError('No se pudo cargar el resumen. ¿Iniciaste un turno?');
    } finally {
      setLoadingSummary(false); // Quitar "cargando..."
    }
  };

  // 2. "Actualizar Lista" (Listas de abajo)
  // También la sacamos para poder recargarla
  const fetchDashboardLists = async () => {
    // Revisamos si tenemos un turno activo antes de llamar
    if (!activeShift?.location?.id) {
      setLoadingLists(false);
      return; // No podemos cargar listas sin una sucursal
    }

    try {
      setLoadingLists(true);
      const today = new Date().toISOString().slice(0, 10);

      // Pedimos el "hilo de recibos" (Ventas)
      const salesPromise = api.get('/sales/', {
        params: {
          start_date: today,
          end_date: today,
          limit: 20, 
          // --- ¡AQUÍ ESTÁ EL ARREGLO DEL DESFASE! ---
          // Le decimos que filtre por la sucursal activa.
          // Ahora el "Archivo" (lista) y "Contabilidad" (tarjeta) mostrarán lo mismo.
          location_id: activeShift.location.id 
        }
      });

      // Pedimos la "pizarra de tareas" (Órdenes)
      const ordersPromise = api.get('/work-orders/', {
        params: { 
          limit: 20 
          // (Esta ya filtra por sucursal en el backend si no eres admin)
        }
      });

      // Esperamos a que ambas peticiones terminen
      const [salesResponse, ordersResponse] = await Promise.all([salesPromise, ordersPromise]);

      setTodaysSales(salesResponse.data);

      const allOrders = ordersResponse.data;
      const activeOrders = allOrders.filter(order => 
        order.status !== 'ENTREGADO' && order.status !== 'SIN_REPARACION'
      );
      setActiveOrders(activeOrders);

    } catch (err) {
      setError('No se pudieron cargar las listas de ventas y órdenes.');
    } finally {
      setLoadingLists(false);
    }
  };


  // 3. Este es el "Arranque" de la página
  useEffect(() => {
    // Cuando la página carga, llama a las dos funciones
    fetchSummary();
    fetchDashboardLists();
    // IMPORTANTE: Le decimos que se re-ejecute si el turno cambia
  }, [activeShift]);

// --- NUEVO "ESCUCHA-CAMPANAS" (PARA VENTAS) ---
  // Este useEffect se encarga de escuchar la "campana" de otras pestañas
  useEffect(() => {
    
    // 1. Definimos la función que se ejecuta al oír la campana
    const handleStorageEvent = (event) => {
      // Si la campana que sonó es la de 'rx-sale-event'
      if (event.key === 'rx-sale-event') {
        // ¡Actualizamos AMBAS cosas!
        fetchSummary(); // El tablero de puntuación
        fetchDashboardLists(); // La lista de ventas de abajo
      }
    };

    // 2. Le decimos al navegador que "escuche"
    window.addEventListener('storage', handleStorageEvent);

    // 3. Le decimos cómo "dejar de escuchar" si salimos de la página
    return () => {
      window.removeEventListener('storage', handleStorageEvent);
    };
    
    // 4. Le decimos que "re-arme" esta función si las funciones de recarga cambian
  }, [fetchSummary, fetchDashboardLists]); 
  // --- FIN DEL "ESCUCHA-CAMPANAS" ---

  // --- Cálculo de Balance (no cambia) ---
  const totalBalance = (summary?.total_sales || 0) - (summary?.total_expenses || 0);

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
              label="BODEGA"
              colorClass="bg-action-green hover:bg-teal-600"
            />
          </div>

          {/* 2. Venta Perdida (no cambia) */}
          <form onSubmit={handleLostSaleSubmit} className="bg-white p-6 rounded-xl shadow-md border">
            <h2 className="text-xl font-bold text-secondary mb-2">VENTAS PERDIDAS</h2>
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
                {lostSaleLoading ? 'Registrando...' : 'REGISTRAR VENTA PERDIDA'}
              </button>
              {lostSaleMessage && (
                <p className={`text-sm text-center font-medium ${lostSaleMessage.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
                  {lostSaleMessage}
                </p>
              )}
            </div>
          </form>

          {/* --- 5. NUEVO: Panel "Ventas de Hoy" --- */}
          <div className="bg-white p-6 rounded-xl shadow-md border">
            <h2 className="text-xl font-bold text-secondary mb-4">Ventas de Hoy</h2>
            {/* Le damos un alto máximo y scroll */}
            <div className="space-y-3 max-h-64 overflow-y-auto"> 
              {todaysSales.length === 0 ? (
                <p className="text-gray-500 text-sm">No hay ventas registradas hoy.</p>
              ) : (
                // Creamos la lista (hilo de recibos)
              todaysSales.map(sale => (
                // 1. Quitamos el "flex justify-between" del contenedor principal
                <div key={sale.id} className="border-b pb-2 last:border-b-0 pt-2">
                  
                  {/* 2. Fila Principal: Cliente y Total (esto es igual que antes) */}
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-sm">{sale.customer_name}</p>
                    <p className="font-bold text-action-green">${sale.total_amount.toFixed(2)}</p>
                  </div>

                  {/* 3. Fila de Sub-detalles: Vendedor y Sucursal */}
                  <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                    <span>Venta #{sale.id} por: {sale.user.email}</span>
                    <span className="font-medium">{sale.location.name}</span>
                  </div>

                  {/* 4. Lista de Productos Vendidos (Qué y Cuántos) */}
                  <div className="mt-2 pl-2 border-l-2 border-gray-200">
                    {sale.items.map(item => (
                      <p key={item.id} className="text-xs text-gray-700">
                        {/* (Cuántos) x (Qué) */}
                        <span className="font-medium">{item.quantity}x</span> {item.description}
                      </p>
                    ))}
                  </div>

                  {/* 5. Método de Pago (usando nuestro ayudante) */}
                  <p className="text-xs text-gray-500 mt-1 pl-2">
                    Pagado con: <span className="font-semibold text-gray-800">{formatPaymentMethod(sale.payment_method)}</span>
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
                <p className="text-sm font-medium text-action-green uppercase">Ventas de Hoy</p>
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
                <p className="text-sm font-medium text-highlight uppercase">Gastos de Hoy</p>
                <p className="text-2xl font-bold text-secondary">
                  ${(summary?.total_expenses || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          
          {/* 4. Tarjeta de Balance Diario (no cambia) */}
          <div className="bg-detail p-6 rounded-xl shadow-md text-white">
            <div className="flex justify-between items-center mb-2">
              <p className="text-lg font-medium uppercase">Balance Diario</p>
              <HiOutlineScale className="h-8 w-8 text-white/70" />
            </div>
            <p className="text-5xl font-bold">
              ${(totalBalance || 0).toFixed(2)}
            </p>
            <p className="text-sm text-white/80 mt-2">
              Tu meta de esta sucursal: $150.00
            </p>
          </div>

          {/* --- 6. NUEVO: Panel "Órdenes Activas" --- */}
          <div className="bg-white p-6 rounded-xl shadow-md border">
            <h2 className="text-xl font-bold text-secondary mb-4">Órdenes Activas en Sucursal</h2>
            {/* Le damos un alto máximo y scroll */}
            <div className="space-y-3 max-h-64 overflow-y-auto"> 
              {activeOrders.length === 0 ? (
                <p className="text-gray-500 text-sm">No hay órdenes pendientes.</p>
              ) : (
                // Creamos la lista (pizarra de tareas)
                activeOrders.map(order => (
                  <div key={order.id} className="flex justify-between items-center border-b pb-2 last:border-b-0">
                    <div>
                      {/* Hacemos que el N° de orden sea un enlace a la página de órdenes */}
                      <Link to={`/ordenes`} className="font-semibold text-sm text-accent hover:underline">
                        #{order.work_order_number} - {order.customer_name}
                      </Link>
                      <p className="text-xs text-gray-500">{order.device_brand} {order.device_model}</p>
                    </div>
                    {/* Usamos nuestro "molde" de colores para el estado */}
                    <StatusBadge status={order.status} />
                  </div>
                ))
              )}
            </div>
          </div>

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