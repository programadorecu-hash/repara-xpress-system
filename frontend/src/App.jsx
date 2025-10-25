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
        <Route path="auditoria" element={<AuditPage />} />
        <Route path="ordenes" element={<WorkOrderPage />} />
        <Route path="pos" element={<POSPage />} />

      </Route>
    </Routes>
  );
}

export default App;