// frontend/src/App.jsx

// --- INICIO DE NUESTRO CÓDIGO (ASISTENTE DE CONFIGURACIÓN) ---
// Importamos las herramientas que necesitamos
import React, { useState, useEffect } from 'react';
import { HiOutlineRefresh } from "react-icons/hi";
// Importamos 'useNavigate' para poder redirigir al usuario
import { Routes, Route, useNavigate } from 'react-router-dom';
// Usamos axios directo para la revisión (no necesita token de login)
import axios from 'axios'; 
// --- FIN DE NUESTRO CÓDIGO ---

import ProductPage from './pages/ProductPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SelectShiftPage from './pages/SelectShiftPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppLayout from './components/AppLayout.jsx';
import AuditPage from './pages/AuditPage.jsx';
import WorkOrderPage from './pages/WorkOrderPage.jsx';
import POSPage from './pages/POSPage.jsx';
import SuppliersPage from './pages/SuppliersPage.jsx';
import PurchaseInvoicesPage from './pages/PurchaseInvoicesPage.jsx';
import CashAccountsPage from './pages/CashAccountsPage.jsx';
import CashTransactionsPage from './pages/CashTransactionsPage.jsx';
import LostSalesPage from './pages/LostSalesPage.jsx';
import SalesHistoryPage from './pages/SalesHistoryPage.jsx';
import SetupPage from './pages/SetupPage.jsx'; // <-- Importamos la nueva página que creamos
import LocationsPage from './pages/LocationsPage.jsx';
import UserManagementPage from './pages/UserManagementPage.jsx';
import CreatePinPage from './pages/CreatePinPage.jsx';
import PersonnelPage from './pages/PersonnelPage.jsx';
import NotificationRulesPage from './pages/NotificationRulesPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';

// Esta es la "Guardia" que revisa si la caja fuerte está configurada
function SetupGuard() {
  // null = "aún no sé"
  const [isSetupComplete, setIsSetupComplete] = useState(null);
  const [connectionError, setConnectionError] = useState(false);
  const navigate = useNavigate(); // Para poder redirigir

  useEffect(() => {
    // Usamos la URL base de la "agenda" (.env)
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    
    // 1. Preguntamos al "camarero" (backend) si ya hay usuarios
    axios.get(`${API_URL}/api/setup/status`)
      .then(response => {
        // response.data será 'true' (si hay usuarios) o 'false' (si no hay)
        const siHayUsuarios = response.data; 
        
        setIsSetupComplete(siHayUsuarios); // Guardamos el resultado

        // 2. Lógica de redirección
        if (siHayUsuarios) {
          // Si SÍ hay usuarios (true), y justo estamos en la página /setup...
          if (window.location.pathname === '/setup') {
            navigate('/login'); // ...lo mandamos al login (no tiene nada que hacer en setup).
          }
        } else {
          // Si NO hay usuarios (false)...
          // ...lo FORZAMOS a ir a la página de /setup.
          navigate('/setup');
        }
      })
      .catch(error => {
        console.error("Error conectando al backend:", error);
        // En lugar de matar la página, activamos el estado de error
        setConnectionError(true); 
      });
  }, [navigate]); // 'navigate' es una dependencia

  // 3. ...
  // Si hubo error de conexión, mostramos pantalla de reintento
  if (connectionError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-sm">
          <h2 className="text-xl font-bold text-red-600 mb-2">Conexión Fallida</h2>
          <p className="text-gray-600 mb-6">No pudimos contactar con el sistema.</p>
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

  // Si todavía cargando...
  if (isSetupComplete === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  // 4. Si ya sabemos la respuesta (true o false), mostramos las rutas
  return (
    <Routes>
      {/* Ruta pública para la configuración inicial */}
      <Route path="/setup" element={<SetupPage />} />
      {/* --- INICIO DE NUESTRO CÓDIGO (Ruta para crear PIN) --- */}
      {/* Esta ruta debe estar protegida (necesitas login) pero FUERA del layout principal */}
      <Route path="/crear-pin" element={<ProtectedRoute><CreatePinPage /></ProtectedRoute>} />
      {/* --- FIN DE NUESTRO CÓDIGO --- */}

      {/* El resto de tus rutas (no han cambiado) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/iniciar-turno" element={<ProtectedRoute><SelectShiftPage /></ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="inventario" element={<ProductPage />} />
        <Route path="auditoria" element={<ProtectedRoute requiredRoles={['admin']}><AuditPage /></ProtectedRoute>} />
        <Route path="ordenes" element={<WorkOrderPage />} />
        {/* --- Ruta para Directorio de Clientes --- */}
        
        <Route path="pos" element={<POSPage />} />
        <Route path="historial-ventas" element={<SalesHistoryPage />} />
        <Route
          path="personal"
          element={(
            <ProtectedRoute requiredRoles={['admin', 'inventory_manager']}>
              <PersonnelPage />
            </ProtectedRoute>
          )}
        />
        {/* --- Nueva Ruta para Configurar Alertas --- */}
        <Route
          path="configuracion/notificaciones"
          element={(
            <ProtectedRoute requiredRoles={['admin', 'inventory_manager']}>
              <NotificationRulesPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="proveedores"
          element={(
            <ProtectedRoute requiredRoles={['admin', 'inventory_manager']}>
              <SuppliersPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="compras"
          element={(
            <ProtectedRoute requiredRoles={['admin', 'inventory_manager']}>
              <PurchaseInvoicesPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="ventas-perdidas"
          element={(
            <ProtectedRoute requiredRoles={['admin', 'inventory_manager']}>
              <LostSalesPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="caja"
          element={(
            <ProtectedRoute requiredRoles={['admin']}>
              <CashAccountsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="caja/transacciones"
          element={(
            <ProtectedRoute requiredRoles={['admin']}>
              <CashTransactionsPage />
            </ProtectedRoute>
          )}
        />

          {/* --- INICIO DE NUESTRO CÓDIGO (Ruta para Administrar Sucursales) --- */}
        <Route
          path="sucursales"
          element={(
            <ProtectedRoute requiredRoles={['admin']}>
              <LocationsPage />
            </ProtectedRoute>
          )}
        />
          {/* --- FIN DE NUESTRO CÓDIGO --- */}
          {/* --- INICIO DE NUESTRO CÓDIGO (Ruta para RRHH) --- */}
        <Route
          path="usuarios"
          element={(
            <ProtectedRoute requiredRoles={['admin']}>
              <UserManagementPage />
            </ProtectedRoute>
          )}
        />
        {/* --- FIN DE NUESTRO CÓDIGO --- */}
        <Route
          path="clientes"
          element={(
            <ProtectedRoute requiredRoles={['admin', 'inventory_manager', 'warehouse_operator']}>
              <CustomersPage />
            </ProtectedRoute>
          )}
        />

      </Route>
    </Routes>
  );
}

// El componente App ahora es solo el "Guardia"
// El "Guardia" (SetupGuard) se encarga de decidir qué mostrar.
function App() {
  return <SetupGuard />;
}

export default App;