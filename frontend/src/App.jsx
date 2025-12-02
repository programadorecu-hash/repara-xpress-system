// frontend/src/App.jsx

// --- INICIO DE NUESTRO CÓDIGO (ASISTENTE DE CONFIGURACIÓN) ---
// Importamos las herramientas que necesitamos
import React, { useState, useEffect } from 'react';
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

// Esta es la "Guardia" que revisa si la caja fuerte está configurada
function SetupGuard() {
  // null = "aún no sé"
  const [isSetupComplete, setIsSetupComplete] = useState(null); 
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
        // Si el backend no responde, mostramos un error feo
        console.error("Error grave: No se puede conectar al backend.", error);
        // Esto reemplaza toda la página con un error claro
        document.body.innerHTML = "<h1>Error: No se puede conectar al servidor. Revisa que el backend (repara_xpress_api) esté funcionando.</h1>";
      });
  }, [navigate]); // 'navigate' es una dependencia

  // 3. Si todavía no sabemos la respuesta (isSetupComplete es null)...
  if (isSetupComplete === null) {
    // ...mostramos un mensaje de "Cargando..." en pantalla completa
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary">
        <p className="text-xl text-secondary">Verificando configuración...</p>
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