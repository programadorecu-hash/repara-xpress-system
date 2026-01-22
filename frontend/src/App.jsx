// frontend/src/App.jsx

// --- INICIO DE NUESTRO CÓDIGO (ASISTENTE DE CONFIGURACIÓN) ---
import React, { useState, useEffect, useContext } from "react";
import { HiOutlineRefresh, HiOutlineSparkles, HiOutlineCheck, HiOutlineX } from "react-icons/hi";
import { Routes, Route, useNavigate } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "./context/AuthContext.jsx";

// --- Importamos la librería de notificaciones y sus estilos ---
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
// --------------------------------------------------------------------
// --- FIN DE NUESTRO CÓDIGO ---

import ProductPage from "./pages/ProductPage.jsx";
import AcceptInvitePage from "./pages/AcceptInvitePage";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import SelectShiftPage from "./pages/SelectShiftPage.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AppLayout from "./components/AppLayout.jsx";
import SuperAdminPage from "./pages/SuperAdminPage.jsx"; 
import AuditPage from "./pages/AuditPage.jsx";
import WorkOrderPage from "./pages/WorkOrderPage.jsx";
import POSPage from "./pages/POSPage.jsx";
import SuppliersPage from "./pages/SuppliersPage.jsx";
import PurchaseInvoicesPage from "./pages/PurchaseInvoicesPage.jsx";
import CashAccountsPage from "./pages/CashAccountsPage.jsx";
import CashTransactionsPage from "./pages/CashTransactionsPage.jsx";
import LostSalesPage from "./pages/LostSalesPage.jsx";
import SalesHistoryPage from "./pages/SalesHistoryPage.jsx";
import SetupPage from "./pages/SetupPage.jsx"; 
import LocationsPage from "./pages/LocationsPage.jsx";
import UserManagementPage from "./pages/UserManagementPage.jsx";
import CreatePinPage from "./pages/CreatePinPage.jsx";
import PersonnelPage from "./pages/PersonnelPage.jsx";
import NotificationRulesPage from "./pages/NotificationRulesPage.jsx";
import CustomersPage from "./pages/CustomersPage.jsx";
import CompanySettingsPage from "./pages/CompanySettingsPage.jsx";
import ExpensesPage from "./pages/ExpensesPage.jsx";
import FinancialReportPage from "./pages/FinancialReportPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx"; 
import PasswordRecoveryPage from "./pages/PasswordRecoveryPage.jsx"; 
import ProfilePage from "./pages/ProfilePage.jsx"; 
import PublicCatalogPage from "./pages/PublicCatalogPage.jsx"; 
import TransfersPage from "./pages/TransfersPage.jsx"; 

// Esta es la "Guardia" que revisa si la caja fuerte está configurada
function SetupGuard() {
  // --- CORRECCIÓN: HOOKS SIEMPRE AL PRINCIPIO ---
  // 1. Contexto (Paywall) - Debe ir ANTES de cualquier return
  const { showPaywall, setShowPaywall, paywallMessage } = useContext(AuthContext);
  
  // 2. Estados locales
  const [isSetupComplete, setIsSetupComplete] = useState(null);
  const [connectionError, setConnectionError] = useState(false);
  
  // 3. Router
  const navigate = useNavigate(); 
  // ----------------------------------------------

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

    // Permitimos acceso a las rutas públicas sin chequeo de setup
    const publicRoutes = ["/register", "/recuperar-clave", "/catalogo-repuestos"];
    if (publicRoutes.includes(window.location.pathname)) {
        setIsSetupComplete(true); 
        return;
    }

    axios
      .get(`${API_URL}/api/setup/status`)
      .then((response) => {
        const siHayUsuarios = response.data;
        setIsSetupComplete(siHayUsuarios); 

        if (siHayUsuarios) {
          if (window.location.pathname === "/setup") {
            navigate("/login"); 
          }
        } else {
          // Bloqueamos acceso si no está configurado, EXCEPTO para las rutas públicas
          const publicPaths = ["/register", "/recuperar-clave", "/catalogo-repuestos"];
          if (!publicPaths.includes(window.location.pathname)) {
             navigate("/setup");
          }
        }
      })
      .catch((error) => {
        console.error("Error conectando al backend:", error);
        setConnectionError(true);
      });
  }, [navigate]); 

  if (connectionError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-sm">
          <h2 className="text-xl font-bold text-red-600 mb-2">
            Conexión Fallida
          </h2>
          <p className="text-gray-600 mb-6">
            No pudimos contactar con el sistema.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <HiOutlineRefresh className="mr-2 text-xl" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (isSetupComplete === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <>
      {/* --- AQUÍ COLOCAMOS EL CONTENEDOR DE NOTIFICACIONES --- */}
      <ToastContainer position="bottom-right" autoClose={3000} />

      {/* --- EL MURO DE PAGO (PAYWALL) --- */}
      {showPaywall && (
        <PaywallModal 
          message={paywallMessage} 
          onClose={() => setShowPaywall(false)} 
        />
      )}
      {/* --------------------------------- */}
      
      <Routes>
        {/* Agregamos la ruta pública de registro */}
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        {/* Agregamos la ruta pública de recuperación */}
        <Route path="/recuperar-clave" element={<PasswordRecoveryPage />} />
        {/* --- NUEVO: RUTA DEL CATÁLOGO PÚBLICO --- */}
        <Route path="/catalogo-repuestos" element={<PublicCatalogPage />} />
        {/* ---------------------------------------- */}

        <Route path="/setup" element={<SetupPage />} />
        
        <Route
          path="/crear-pin"
          element={
            <ProtectedRoute>
              <CreatePinPage />
            </ProtectedRoute>
          }
        />

        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/iniciar-turno"
          element={
            <ProtectedRoute>
              <SelectShiftPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          
          {/* --- RUTA DE SUPER ADMIN (OFICINA PRIVADA) --- */}
          <Route 
            path="super-admin" 
            element={
              <ProtectedRoute requiredRoles={["super_admin"]}>
                <SuperAdminPage />
              </ProtectedRoute>
            } 
          />
          {/* --------------------------------------------- */}

          <Route path="perfil" element={<ProfilePage />} />
          <Route path="inventario" element={<ProductPage />} />
          <Route
            path="auditoria"
            element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <AuditPage />
              </ProtectedRoute>
            }
          />
          <Route path="ordenes" element={<WorkOrderPage />} />
          
          <Route path="pos" element={<POSPage />} />
          <Route path="historial-ventas" element={<SalesHistoryPage />} />
          <Route
            path="personal"
            element={
              <ProtectedRoute requiredRoles={["admin", "inventory_manager"]}>
                <PersonnelPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="configuracion/notificaciones"
            element={
              <ProtectedRoute requiredRoles={["admin", "inventory_manager"]}>
                <NotificationRulesPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="configuracion/empresa"
            element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <CompanySettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="proveedores"
            element={
              <ProtectedRoute requiredRoles={["admin", "inventory_manager"]}>
                <SuppliersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="compras"
            element={
              <ProtectedRoute requiredRoles={["admin", "inventory_manager"]}>
                <PurchaseInvoicesPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="transferencias"
            element={
              <ProtectedRoute>
                <TransfersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="ventas-perdidas"
            element={
              <ProtectedRoute requiredRoles={["admin", "inventory_manager"]}>
                <LostSalesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="caja"
            element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <CashAccountsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="caja/transacciones"
            element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <CashTransactionsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="gastos"
            element={
              <ProtectedRoute requiredRoles={["admin", "inventory_manager"]}>
                <ExpensesPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="reporte-financiero"
            element={
              <ProtectedRoute requiredRoles={["admin", "inventory_manager"]}>
                <FinancialReportPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="sucursales"
            element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <LocationsPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="usuarios"
            element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <UserManagementPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="clientes"
            element={
              <ProtectedRoute
                requiredRoles={[
                  "admin",
                  "inventory_manager",
                  "warehouse_operator",
                ]}
              >
                <CustomersPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </>
  );
}

function App() {
  return <SetupGuard />;
}

// ==============================================================================
// --- COMPONENTE: MURO DE PAGO (PAYWALL) ---
// ==============================================================================
function PaywallModal({ message, onClose }) {
  const whatsappNumber = "+593984959401";
  const whatsappMessage = encodeURIComponent("Hola, quiero activar el PLAN PRO para mi taller. Me interesa el precio de $19/mes.");
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden relative border-4 border-yellow-400">
        
        {/* Botón Cerrar */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors z-10"
        >
          <HiOutlineX className="text-xl text-gray-500"/>
        </button>

        {/* Cabecera Premium */}
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-8 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
          <HiOutlineSparkles className="text-6xl mx-auto mb-4 animate-bounce" />
          <h2 className="text-3xl font-extrabold uppercase tracking-tight leading-none">
            ¡Felicidades!
          </h2>
          <p className="text-yellow-100 font-bold mt-1 text-lg">Ahora eres un técnico PRO</p>
        </div>

        {/* Contenido */}
        <div className="p-8">
          <div className="text-center mb-6">
            <p className="text-gray-600 font-medium mb-2">
              Estás intentando acceder a una función exclusiva:
            </p>
            <p className="text-red-500 font-bold bg-red-50 py-2 px-4 rounded-lg inline-block border border-red-100">
              {message || "Función Premium Bloqueada"}
            </p>
          </div>

          <div className="space-y-4 mb-8">
            <h3 className="text-center font-bold text-gray-800 uppercase text-sm tracking-wider">
              Pasa al siguiente nivel:
            </h3>
            <ul className="grid grid-cols-2 gap-2 text-sm text-gray-600">
              {[
                "Facturas Electrónicas", "Ventas Inmediatas",
                "Registro de Gastos", "Pagos y Proveedores",
                "Informe Utilidad Real", "Soporte Prioritario"
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <HiOutlineCheck className="text-green-500 flex-shrink-0" /> {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Precios */}
          <div className="bg-gray-50 rounded-xl p-4 mb-8 border border-gray-200 text-center">
            <p className="text-gray-500 text-xs uppercase font-bold mb-1">Inversión Mensual</p>
            <div className="flex items-end justify-center gap-1 leading-none text-gray-800">
              <span className="text-4xl font-extrabold">$19.00</span>
              <span className="text-sm font-medium mb-1">/mes</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              O ahorra pagando <span className="line-through">$228</span> <strong className="text-green-600">$190 al año</strong>
            </p>
          </div>

          {/* Botones de Acción */}
          <div className="space-y-3">
            <a 
              href={whatsappUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block w-full py-4 px-6 bg-green-500 hover:bg-green-600 text-white font-extrabold text-center rounded-xl transition-all shadow-lg hover:shadow-green-500/30 transform hover:-translate-y-1"
            >
              🚀 ACTIVAR MI CUENTA AHORA
            </a>
            
            <button 
              onClick={() => {
                alert("Redirigiendo a la empresa de demostración...");
                onClose();
              }}
              className="block w-full py-3 px-6 bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-600 font-bold text-center rounded-xl transition-colors"
            >
              🧪 PRUEBA GRATIS (Modo Demo)
            </button>
          </div>
          
          <p className="text-center text-xs text-gray-400 mt-4">
            ¿Dudas? Escríbenos al +593 98 495 9401
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;