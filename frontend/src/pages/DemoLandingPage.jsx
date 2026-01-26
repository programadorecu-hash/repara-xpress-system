import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Joyride, { STATUS } from "react-joyride"; // <--- IMPORTACIÓN DEL TOUR
import {
  HiOutlineCurrencyDollar,
  HiOutlineArrowCircleDown,
  HiOutlineScale,
  HiOutlineArrowRight,
  HiOutlineShoppingCart,
  HiOutlineCog,
  HiOutlineCash,
  HiOutlineArchive,
  HiOutlineExclamationCircle,
  HiMenu,
  HiX,
  HiHome,
  HiTemplate,
  HiUserGroup,
  HiTruck,
  HiDocumentText,
  HiPresentationChartLine,
  HiSparkles,
  HiOfficeBuilding,
  HiCreditCard,      // <--- NUEVO
  HiSwitchHorizontal
} from "react-icons/hi";

// Función auxiliar para obtener la fecha actual formateada
const getCurrentDateText = () => {
  const date = new Date();
  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();
  return `${monthName} ${year}`;
};

// --- DATOS FALSOS (EL "MAQUILLAJE") ---
const FAKE_SUMMARY = {
  total_sales: 213.50,
  total_expenses: 6.25,
  daily_goal: 200.00
};

const FAKE_SALES = [
  { id: 1040, customer_name: "Andrés V.", total_amount: 20.00, user: { email: "tu@taller.com" }, location: { name: "Matriz" }, items: [{ description: "Mica Privacidad iPhone 13" }], payment_method: "EFECTIVO" },
  { id: 1039, customer_name: "Kevin J.", total_amount: 10.00, user: { email: "tu@taller.com" }, location: { name: "Matriz" }, items: [{ description: "Cable Lightning 1m" }], payment_method: "EFECTIVO" },
  { id: 1038, customer_name: "Diana R.", total_amount: 20.00, user: { email: "tu@taller.com" }, location: { name: "Matriz" }, items: [{ description: "Revisión Software Xiaomi" }], payment_method: "TRANSFERENCIA" },
  { id: 1037, customer_name: "Miguel A.", total_amount: 5.00, user: { email: "tu@taller.com" }, location: { name: "Matriz" }, items: [{ description: "Protector Lente Cámara" }], payment_method: "EFECTIVO" },
  { id: 1036, customer_name: "Elena D.", total_amount: 30.00, user: { email: "tu@taller.com" }, location: { name: "Matriz" }, items: [{ description: "Cambio Batería J7 Prime" }], payment_method: "TARJETA" },
  { id: 1035, customer_name: "Andrés G.", total_amount: 8.00, user: { email: "tu@taller.com" }, location: { name: "Matriz" }, items: [{ description: "Soporte Magnético Auto" }], payment_method: "EFECTIVO" },
  { id: 1034, customer_name: "Lucía C.", total_amount: 5.00, user: { email: "tu@taller.com" }, location: { name: "Matriz" }, items: [{ description: "Chip Prepago Claro" }], payment_method: "EFECTIVO" },
  { id: 1033, customer_name: "Jorge V.", total_amount: 25.00, user: { email: "tu@taller.com" }, location: { name: "Matriz" }, items: [{ description: "Reparación Pin Carga A10" }], payment_method: "EFECTIVO" },
  { id: 1032, customer_name: "Luis T.", total_amount: 10.00, user: { email: "tu@taller.com" }, location: { name: "Matriz" }, items: [{ description: "Mica Hidrogel Mate" }], payment_method: "EFECTIVO" },
  { id: 1031, customer_name: "Sofía B.", total_amount: 15.00, user: { email: "tu@taller.com" }, location: { name: "Matriz" }, items: [{ description: "Case Silicona iPhone 11" }], payment_method: "TARJETA" },
  { id: 1030, customer_name: "Pedro M.", total_amount: 15.00, user: { email: "tu@taller.com" }, location: { name: "Matriz" }, items: [{ description: "Mantenimiento Preventivo" }], payment_method: "EFECTIVO" },
  { id: 1029, customer_name: "Ana S.", total_amount: 12.00, user: { email: "tu@taller.com" }, location: { name: "Matriz" }, items: [{ description: "Audífonos Básicos Sony" }], payment_method: "EFECTIVO" },
  { id: 1028, customer_name: "Carlos R.", total_amount: 25.00, user: { email: "tu@taller.com" }, location: { name: "Matriz" }, items: [{ description: "Cargador Samsung 25W" }], payment_method: "TRANSFERENCIA" },
  { id: 1027, customer_name: "María L.", total_amount: 8.50, user: { email: "tu@taller.com" }, location: { name: "Matriz" }, items: [{ description: "Cable USB-C Reforzado" }], payment_method: "EFECTIVO" },
  { id: 1026, customer_name: "Juan P.", total_amount: 5.00, user: { email: "tu@taller.com" }, location: { name: "Matriz" }, items: [{ description: "Mica Vidrio 9D A32" }], payment_method: "EFECTIVO" },
];

const FAKE_ORDERS = [
  { id: 501, work_order_number: "00501", customer_name: "Ana G.", device_brand: "Xiaomi", device_model: "Note 10", status: "LISTO" },
  { id: 502, work_order_number: "00502", customer_name: "Pedro P.", device_brand: "Samsung", device_model: "A51", status: "REPARANDO" },
  { id: 503, work_order_number: "00503", customer_name: "Luis M.", device_brand: "iPhone", device_model: "X", status: "EN_REVISION" },
];

const FAKE_LOW_STOCK = [
  { location_name: "Bodega Principal", product_name: "Pin de Carga Tipo C", sku: "PIN-C-GEN", quantity: 2 },
  { location_name: "Bodega Principal", product_name: "Mica Glass A10s", sku: "GLASS-A10S", quantity: 0 },
];

// --- COMPONENTE: MODAL TRAMPA ---
function RegisterTrapModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden text-center relative transform transition-all scale-100">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-2 bg-gray-100 rounded-full">
          <HiX className="w-5 h-5" />
        </button>
        
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white">
          <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md shadow-inner">
            <HiSparkles className="w-8 h-8 text-yellow-300 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold mb-2">¡VENDE RÁÍDO, FÁCIL Y MEJOR!</h2>
          <p className="text-blue-100 text-sm">
            ORDENES DE TRABAJO, INVENTARIO, REGISTRO DE GASTO, FACTURA ELECTRONICA
          </p>
        </div>

        <div className="p-8 space-y-4">
          <button 
            onClick={() => navigate('/register')}
            className="w-full py-4 px-6 bg-green-500 hover:bg-green-600 text-white font-extrabold text-lg rounded-xl shadow-xl shadow-green-500/30 transition-all transform hover:-translate-y-1 hover:scale-[1.02]"
          >
            CREA UNA CUENTA
          </button>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-sm font-medium hover:underline"
          >
            Seguir viendo la demo
          </button>
        </div>
      </div>
    </div>
  );
}

// --- COMPONENTES VISUALES (CLONES) ---
const StatusBadge = ({ status }) => {
  let colorClass = "bg-gray-200 text-gray-800";
  if (status === "RECIBIDO") colorClass = "bg-blue-200 text-blue-800";
  if (status === "EN_REVISION") colorClass = "bg-yellow-200 text-yellow-800";
  if (status === "REPARANDO") colorClass = "bg-orange-200 text-orange-800";
  if (status === "LISTO") colorClass = "bg-green-200 text-green-800";
  return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colorClass}`}>{status.replace("_", " ")}</span>;
};

const FakeSidebar = ({ onTrap }) => {
  const menuItems = [
    { icon: <HiHome />, label: "Inicio" },
    { icon: <HiTemplate />, label: "Inventario" },
    { icon: <HiOutlineShoppingCart />, label: "Punto de Venta" },
    { icon: <HiOutlineCog />, label: "Órdenes Taller" },
    { icon: <HiOutlineCash />, label: "Caja y Bancos" },
    { icon: <HiPresentationChartLine />, label: "Reportes" },
    { icon: <HiUserGroup />, label: "Clientes" },
    { icon: <HiOfficeBuilding />, label: "Mi Empresa" },
  ];

  return (
    <div className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 h-full fixed left-0 top-0 bottom-0 z-40">
      <div className="h-16 flex items-center justify-center border-b border-gray-100 bg-gradient-to-r from-blue-600 to-blue-700">
        <h1 className="text-white font-black text-xl tracking-tight italic">Repara<span className="text-yellow-400">System</span></h1>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item, idx) => (
          <button
            key={idx}
            onClick={onTrap}
            className={`flex items-center w-full px-4 py-3 rounded-xl text-sm font-medium transition-colors ${idx === 0 ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <span className="w-6 h-6 mr-3">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-100">
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs font-bold text-blue-800 uppercase mb-1">Tu Plan</p>
          <p className="text-sm text-blue-600 font-medium">Demo Gratuita</p>
        </div>
      </div>
    </div>
  );
};

// --- PÁGINA PRINCIPAL ---
function DemoLandingPage() {
  const navigate = useNavigate();
  const { user, activeShift } = useAuth(); // <--- Conectamos con el sistema de seguridad
  const [showTrap, setShowTrap] = useState(false);
  
  // --- ESTADO DEL TOUR ---
  const [runTour, setRunTour] = useState(true);
  
  // Pasos del Tour
  const tourSteps = [
    {
      target: '.price-list-button', // Apunta a la clase del botón
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">¡COMPRA Y <strong>VENDE</strong> TUS REPUESTOS! 🔍</h3>
          <p className="text-sm text-gray-600">
            Aquí puedes COMPRAR o <strong>VENDER</strong> cualquier <strong>REPUESTO</strong> que necesites O TENGAS en tu servicio técnico.
          </p>
        </div>
      ),
      disableBeacon: true,
      disableOverlayClose: true,
      hideCloseButton: true,
      spotlightClicks: false, // Bloquea clics en el botón
      placement: 'bottom',
    }
  ];

  // --- PORTERO INTELIGENTE ---
  // Si el usuario ya trabaja aquí (tiene sesión y turno), lo dejamos pasar al Dashboard.
  // Si es un visitante (o no tiene turno), le mostramos la invitación de registro.
  const handleTrap = () => {
    if (user && activeShift) {
      navigate("/"); // Pase adelante, jefe.
    } else {
      setShowTrap(true); // Alto ahí, regístrese primero.
    }
  };

  // Callback del Tour
  const handleJoyrideCallback = (data) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRunTour(false);
    }
  };

  const totalBalance = FAKE_SUMMARY.total_sales - FAKE_SUMMARY.total_expenses;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      
      {/* --- EL COMPONENTE TOUR --- */}
      <Joyride
        steps={tourSteps}
        run={runTour}
        continuous={true}
        showProgress={false}
        showSkipButton={false}
        callback={handleJoyrideCallback}
        styles={{
          options: {
            arrowColor: '#fff',
            backgroundColor: '#fff',
            overlayColor: 'rgba(0, 0, 0, 0.85)',
            primaryColor: '#3b82f6',
            textColor: '#333',
            zIndex: 1000,
          },
          buttonNext: {
            backgroundColor: '#10b981',
            fontSize: '14px',
            fontWeight: 'bold',
            padding: '10px 20px',
            borderRadius: '8px',
            color: '#fff',
            animation: 'joyride-pulse 2s infinite' // <--- ¡AQUÍ ESTÁ LA MAGIA!
          }
        }}
        locale={{ 
          last: "¡ENTENDIDO!",
        }}
      />

      {/* Fake Sidebar */}
      <FakeSidebar onTrap={handleTrap} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:pl-64 h-full relative">
        
        {/* Fake Header Mobile */}
        <div className="md:hidden h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 z-30">
          <button onClick={handleTrap} className="p-2 text-gray-600"><HiMenu className="w-6 h-6" /></button>
          <span className="font-bold text-blue-700">ReparaSystem</span>
          <div className="w-8"></div>
        </div>

        {/* Content Scrollable */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          
          {/* Top Bar (Usuario Fake) */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Hola, técnico PRO 👋</h1>
              <p className="text-gray-500 text-sm">Así se ve un día productivo en tu taller.</p>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600">tu@taller.com</span>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border-2 border-white shadow-sm">
                YO
              </div>
            </div>
          </div>

          {/* --- BOTÓN GANCHO CON CLASE PARA EL TOUR --- */}
          <div className="mb-8">
            <button
              onClick={() => navigate("/catalogo-repuestos")}
              className="price-list-button w-full md:w-auto bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-blue-900 font-extrabold py-4 px-8 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-300 flex items-center justify-center space-x-3 group mx-auto md:mx-0"
            >
              <span className="text-2xl filter drop-shadow-sm">🔍</span>
              <span className="uppercase tracking-wide text-lg">Lista de Precios {getCurrentDateText()}</span>
            </button>
          </div>
          {/* ------------------------------------------- */}

          {/* --- DASHBOARD CLONADO --- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* COLUMNA IZQUIERDA */}
            <div className="space-y-6">
              
              {/* Botones de Acción */}
              <div className="grid grid-cols-2 gap-4">
                <button onClick={handleTrap} className="flex flex-col items-center justify-center p-6 rounded-xl text-white font-bold text-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 bg-emerald-500 hover:bg-emerald-600">
                  <div className="h-10 w-10 mb-2"><HiOutlineShoppingCart className="w-full h-full" /></div>
                  <span>VENDER</span>
                </button>
                <button onClick={handleTrap} className="flex flex-col items-center justify-center p-6 rounded-xl text-white font-bold text-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 bg-blue-500 hover:bg-blue-600">
                  <div className="h-10 w-10 mb-2"><HiOutlineCog className="w-full h-full" /></div>
                  <span>ORDEN</span>
                </button>
                <button onClick={handleTrap} className="flex flex-col items-center justify-center p-6 rounded-xl text-white font-bold text-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 bg-amber-500 hover:bg-amber-600">
                  <div className="h-10 w-10 mb-2"><HiOutlineCash className="w-full h-full" /></div>
                  <span>GASTO</span>
                </button>
                <button onClick={handleTrap} className="flex flex-col items-center justify-center p-6 rounded-xl text-white font-bold text-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 bg-indigo-500 hover:bg-indigo-600">
                  <div className="h-10 w-10 mb-2"><HiOutlineArchive className="w-full h-full" /></div>
                  <span>INVENTARIO</span>
                </button>
              </div>

              {/* Ventas de Hoy (FEED DE ÉXITO) */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[600px]">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                    <span className="text-2xl">💰</span> Ventas de Hoy
                  </h2>
                  <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    En vivo
                  </span>
                </div>
                
                {/* Contenedor con Scroll */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                  {FAKE_SALES.map((sale) => {
                    // Lógica visual según pago
                    let icon = <HiOutlineCash className="w-6 h-6" />;
                    let iconBg = "bg-emerald-100 text-emerald-600";
                    
                    if (sale.payment_method === "TARJETA") {
                      icon = <HiCreditCard className="w-6 h-6" />;
                      iconBg = "bg-purple-100 text-purple-600";
                    } else if (sale.payment_method === "TRANSFERENCIA") {
                      icon = <HiSwitchHorizontal className="w-6 h-6" />;
                      iconBg = "bg-blue-100 text-blue-600";
                    }

                    return (
                      <div 
                        key={sale.id} 
                        onClick={handleTrap}
                        className="group flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:shadow-lg hover:border-emerald-200 transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
                      >
                        {/* Izquierda: Icono y Datos */}
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${iconBg} group-hover:scale-110 transition-transform duration-300`}>
                            {icon}
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-800 group-hover:text-emerald-700 transition-colors">
                              {sale.customer_name}
                            </h4>
                            <p className="text-xs text-gray-400 font-medium mt-0.5 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 group-hover:bg-emerald-400"></span>
                              {sale.items[0].description}
                            </p>
                          </div>
                        </div>

                        {/* Derecha: Dinero */}
                        <div className="text-right">
                          <p className="font-black text-emerald-600 text-lg tracking-tight group-hover:scale-105 transition-transform origin-right">
                            +${sale.total_amount.toFixed(2)}
                          </p>
                          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider group-hover:text-gray-500">
                            {sale.payment_method}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Degradado inferior para indicar más contenido */}
                <div className="h-6 bg-gradient-to-t from-white to-transparent mt-[-24px] pointer-events-none relative z-10"></div>
              </div>

            </div>

            {/* COLUMNA DERECHA */}
            <div className="space-y-6">
              
              {/* Resumen Financiero */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="p-3 rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                    <HiOutlineCurrencyDollar className="h-6 w-6" />
                  </div>
                  <div className="ml-4">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Ventas de Hoy</p>
                    <p className="text-3xl font-black text-gray-800">${FAKE_SUMMARY.total_sales.toFixed(2)}</p>
                  </div>
                </div>
                
                <div className="flex items-center p-4 bg-rose-50 rounded-xl border border-rose-100">
                  <div className="p-3 rounded-full bg-rose-500 text-white shadow-lg shadow-rose-500/30">
                    <HiOutlineArrowCircleDown className="h-6 w-6" />
                  </div>
                  <div className="ml-4">
                    <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Gastos de Hoy</p>
                    <p className="text-3xl font-black text-gray-800">${FAKE_SUMMARY.total_expenses.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* TARJETA DE ÉXITO (UTILIDAD) */}
              <div onClick={handleTrap} className="group relative block bg-white rounded-2xl shadow-lg border border-cyan-100 overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform duration-300">
                <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-cyan-400 to-blue-600"></div>
                <div className="p-8 pl-10">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xs font-black text-cyan-600 uppercase tracking-widest mb-1">UTILIDAD DEL DÍA</h3>
                      <span className="bg-cyan-100 text-cyan-800 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Excelente</span>
                    </div>
                    <HiOutlineScale className="h-8 w-8 text-cyan-500 opacity-50" />
                  </div>
                  
                  <p className="text-5xl font-black text-slate-800 mt-4 tracking-tight">
                    ${totalBalance.toFixed(2)}
                  </p>

                  <div className="mt-6">
                    <div className="flex justify-between text-xs font-bold text-gray-400 mb-2">
                      <span>META: ${FAKE_SUMMARY.daily_goal.toFixed(2)}</span>
                      <span className="text-green-500">106%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div className="bg-gradient-to-r from-green-400 to-emerald-500 h-full rounded-full w-full animate-pulse"></div>
                    </div>
                    {/* MENSAJE DE ÉXITO */}
                    <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-3">
                      <HiSparkles className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm font-bold text-green-800 leading-tight">
                        ¡FELICIDADES! GRACIAS A REPARASYSTEM EXCEDISTE TUS VENTAS DE HOY.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Órdenes Activas */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-800 mb-4"><strong>SERVICIO TÉCNICO:</strong> ESTADO</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border-l-4 border-blue-500">
                    <span className="text-xs font-bold text-gray-500 uppercase">Matriz</span>
                  </div>
                  {FAKE_ORDERS.map(order => (
                    <div key={order.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded cursor-pointer" onClick={handleTrap}>
                      <div>
                        <p className="font-bold text-sm text-blue-600">#{order.work_order_number} - {order.customer_name}</p>
                        <p className="text-xs text-gray-500">{order.device_brand} {order.device_model}</p>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Alertas Stock */}
              <div className="bg-red-50 p-6 rounded-2xl shadow-sm border border-red-100">
                <div className="flex items-center gap-2 mb-4 text-red-700 font-bold">
                  <HiOutlineExclamationCircle className="w-6 h-6" />
                  <h2>Stock Crítico</h2>
                </div>
                {FAKE_LOW_STOCK.map((item, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border border-red-100 shadow-sm mb-2 flex justify-between items-center cursor-pointer" onClick={handleTrap}>
                    <div>
                      <p className="font-bold text-sm text-gray-800">{item.product_name}</p>
                      <p className="text-xs text-gray-500">Bodega Principal</p>
                    </div>
                    <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded">{item.quantity === 0 ? "AGOTADO" : `Quedan: ${item.quantity}`}</span>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </main>
      </div>

      <RegisterTrapModal isOpen={showTrap} onClose={() => setShowTrap(false)} />
    </div>
  );
}

export default DemoLandingPage;