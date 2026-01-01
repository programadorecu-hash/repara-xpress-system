// frontend/src/App.jsx

// --- INICIO DE NUESTRO CÓDIGO (ASISTENTE DE CONFIGURACIÓN) ---
import React, { useState, useEffect } from "react";
import { HiOutlineRefresh } from "react-icons/hi";
import { Routes, Route, useNavigate } from "react-router-dom";
import axios from "axios";

// --- NUEVO: Importamos la librería de notificaciones y sus estilos ---
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
// --------------------------------------------------------------------
// --- FIN DE NUESTRO CÓDIGO ---

import ProductPage from "./pages/ProductPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import SelectShiftPage from "./pages/SelectShiftPage.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AppLayout from "./components/AppLayout.jsx";
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

// Esta es la "Guardia" que revisa si la caja fuerte está configurada
function SetupGuard() {
  const [isSetupComplete, setIsSetupComplete] = useState(null);
  const [connectionError, setConnectionError] = useState(false);
  const navigate = useNavigate(); 

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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
          navigate("/setup");
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
      {/* Esto permite que los mensajes aparezcan encima de todo */}
      <ToastContainer position="bottom-right" autoClose={3000} />
      
      <Routes>
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

          {/* --- RUTAS DE GASTOS Y UTILIDAD --- */}
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
          {/* ---------------------------------- */}

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

export default App;