import ProductPage from './pages/ProductPage.jsx';
import { Routes, Route } from 'react-router-dom';
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

function App() {
  return (
    <Routes>
      {/* Rutas Públicas */}
      <Route path="/login" element={<LoginPage />} />

      {/* Nueva ruta protegida para iniciar turno */}
      <Route path="/iniciar-turno" element={<ProtectedRoute><SelectShiftPage /></ProtectedRoute>} />

      {/* Rutas Privadas (protegidas y con el layout principal) */}
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="inventario" element={<ProductPage />} />
        <Route path="auditoria" element={<ProtectedRoute requiredRoles={['admin']}><AuditPage /></ProtectedRoute>} />
        <Route path="ordenes" element={<WorkOrderPage />} />
        <Route path="pos" element={<POSPage />} />
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

      </Route>
    </Routes>
  );
}

export default App;