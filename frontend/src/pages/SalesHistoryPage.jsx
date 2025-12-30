// frontend/src/pages/SalesHistoryPage.jsx
import React, { useState, useEffect, useContext, useMemo } from "react";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import ModalForm from '../components/ModalForm.jsx'; // Asegúrate de tener este componente
import { 
    HiOutlineSearch, HiOutlinePrinter, HiOutlineRefresh, 
    HiOutlineReceiptRefund, HiOutlineExclamation 
} from 'react-icons/hi';

// Función para obtener la fecha de hoy en formato 'YYYY-MM-DD'
const getTodayString = () => {
  return new Date().toISOString().slice(0, 10);
};

function SalesHistoryPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user } = useContext(AuthContext);
  const [isPrintingId, setIsPrintingId] = useState(null);

  // --- Filtros ---
  const [startDate, setStartDate] = useState(getTodayString());
  const [endDate, setEndDate] = useState(getTodayString());
  const [searchTerm, setSearchTerm] = useState("");
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");

  const canSeeAllLocations = user?.role === "admin" || user?.role === "inventory_manager";

  // --- Estados para Reembolso ---
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [refundForm, setRefundForm] = useState({
    amount: '',
    reason: '',
    type: 'CREDIT_NOTE',
    pin: ''
  });
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundResult, setRefundResult] = useState(null);
  const [refundError, setRefundError] = useState('');

  // --- Calculadoras ---
  const totalFilteredSales = useMemo(() => {
    return sales.reduce((total, sale) => total + sale.total_amount, 0);
  }, [sales]);

  const paymentMethodSummary = useMemo(() => {
    const summary = {};
    for (const sale of sales) {
      const method = sale.payment_method;
      const amount = sale.total_amount;
      if (!summary[method]) summary[method] = 0;
      summary[method] += amount;
    }
    return summary;
  }, [sales]);

  // --- Efectos ---
  useEffect(() => {
    fetchSales();
    if (canSeeAllLocations) {
      api.get("/locations/").then(res => setLocations(res.data)).catch(console.error);
    }
  }, [canSeeAllLocations]);

  const fetchSales = async () => {
    setLoading(true);
    setError("");
    const params = { skip: 0, limit: 100 };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (searchTerm) params.search = searchTerm;
    if (selectedLocationId) params.location_id = selectedLocationId;

    try {
      const response = await api.get("/sales/", { params });
      setSales(response.data);
    } catch (err) {
      setError("No se pudo cargar el historial.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchSales();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("es-EC", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const formatPaymentMethod = (method) => {
    if (!method) return "Otro";
    let spaced = method.replace("_", " ");
    return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
  };

  const handleViewReceipt = async (saleId) => {
    setIsPrintingId(saleId);
    try {
      // Pedimos el archivo como 'blob' (datos crudos)
      const response = await api.get(`/sales/${saleId}/receipt`, { responseType: "blob" });
      
      // --- CORRECCIÓN: AÑADIMOS EL TIPO 'application/pdf' ---
      const pdfBlob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(pdfBlob);
      
      // Abrimos el PDF en una nueva pestaña
      window.open(url, "_blank");
      
      // (Opcional) Liberamos memoria después de un rato, aunque window.open suele requerir que la URL siga viva un momento
      // setTimeout(() => window.URL.revokeObjectURL(url), 1000); 
    } catch (err) {
      console.error(err);
      alert("Error al generar recibo.");
    } finally {
      setIsPrintingId(null);
    }
  };

  // --- LÓGICA REEMBOLSO ---
  const openRefundModal = (sale) => {
    setSelectedSale(sale);
    setRefundForm({
      amount: sale.total_amount, // Sugerir total
      reason: '',
      type: 'CREDIT_NOTE', // Default seguro
      pin: ''
    });
    setRefundResult(null);
    setRefundError('');
    setRefundModalOpen(true);
  };

  const handleRefundSubmit = async () => {
    if (!refundForm.pin || !refundForm.reason || !refundForm.amount) {
      setRefundError("Todos los campos son obligatorios.");
      return;
    }
    
    setIsRefunding(true);
    setRefundError('');

    try {
      const payload = {
        sale_id: selectedSale.id,
        amount: parseFloat(refundForm.amount),
        reason: refundForm.reason,
        type: refundForm.type,
        pin: refundForm.pin
      };

      const { data } = await api.post('/sales/refund', payload);

      if (refundForm.type === 'CREDIT_NOTE') {
        setRefundResult({
          title: '¡Nota de Crédito Generada!',
          message: 'Entregue este código al cliente:',
          code: data.code,
          amount: data.amount
        });
      } else {
        setRefundResult({
          title: 'Devolución Exitosa',
          message: 'El dinero ha sido descontado de la caja.',
          code: null
        });
      }
    } catch (err) {
      setRefundError(err.response?.data?.detail || "Error al procesar reembolso.");
    } finally {
      setIsRefunding(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Historial de Ventas</h1>
          <p className="text-sm text-gray-500">Gestión de transacciones y devoluciones.</p>
        </div>
      </div>

      {/* Filtros de Sucursal */}
      {canSeeAllLocations && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-100 rounded-lg border">
          <span className="text-sm font-semibold mr-2 text-gray-800">Sucursal:</span>
          <button
            onClick={() => setSelectedLocationId("")}
            className={`py-1 px-3 rounded-full text-sm font-medium ${selectedLocationId === "" ? "bg-accent text-white" : "bg-white text-gray-700 border"}`}
          >
            Todas
          </button>
          {locations.map((loc) => (
            <button
              key={loc.id}
              onClick={() => setSelectedLocationId(loc.id)}
              className={`py-1 px-3 rounded-full text-sm font-medium ${selectedLocationId === loc.id ? "bg-accent text-white" : "bg-white text-gray-700 border"}`}
            >
              {loc.name}
            </button>
          ))}
        </div>
      )}

      {/* Buscador */}
      <form onSubmit={handleSearchSubmit} className="p-4 bg-gray-50 rounded-lg border flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-bold text-gray-500 uppercase">Desde</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 border rounded" />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-bold text-gray-500 uppercase">Hasta</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 border rounded" />
        </div>
        <div className="flex-[2] min-w-[200px]">
          <label className="block text-xs font-bold text-gray-500 uppercase">Buscar</label>
          <div className="relative">
            <input 
              type="text" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              placeholder="Cliente..." 
              className="w-full p-2 pl-8 border rounded" 
            />
            <HiOutlineSearch className="absolute left-2 top-3 text-gray-400" />
          </div>
        </div>
        <button type="submit" className="py-2 px-6 bg-brand text-white font-bold rounded hover:bg-brand/90">
          <HiOutlineRefresh className="inline mr-1" /> Filtrar
        </button>
      </form>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded border border-blue-100">
          <h3 className="text-xs font-bold text-blue-800 uppercase">Total Filtrado</h3>
          <p className="text-2xl font-bold text-blue-900">${totalFilteredSales.toFixed(2)}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded border border-blue-100">
          <h3 className="text-xs font-bold text-blue-800 uppercase">Cant. Ventas</h3>
          <p className="text-2xl font-bold text-blue-900">{sales.length}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded border border-gray-200">
          <h3 className="text-xs font-bold text-gray-600 uppercase mb-2">Desglose</h3>
          <div className="text-sm space-y-1">
            {Object.entries(paymentMethodSummary).map(([method, total]) => (
              <div key={method} className="flex justify-between">
                <span>{formatPaymentMethod(method)}:</span>
                <span className="font-bold">${total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white text-sm">
          <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
            <tr>
              <th className="py-3 px-4 text-left">ID</th>
              <th className="py-3 px-4 text-left">Fecha</th>
              <th className="py-3 px-4 text-left">Cliente</th>
              <th className="py-3 px-4 text-left">Vendedor</th>
              <th className="py-3 px-4 text-right">Total</th>
              <th className="py-3 px-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan="6" className="p-4 text-center">Cargando...</td></tr>
            ) : sales.map((sale) => (
              <tr key={sale.id} className="hover:bg-gray-50">
                <td className="py-3 px-4 font-mono">#{sale.id}</td>
                <td className="py-3 px-4">{formatDate(sale.created_at)}</td>
                <td className="py-3 px-4">
                  <div className="font-medium">{sale.customer_name}</div>
                  <div className="text-xs text-gray-500">{sale.customer_ci}</div>
                </td>
                <td className="py-3 px-4">{sale.user.email}</td>
                <td className="py-3 px-4 text-right font-bold">${sale.total_amount.toFixed(2)}</td>
                <td className="py-3 px-4 flex justify-center gap-2">
                  <button 
                    onClick={() => handleViewReceipt(sale.id)}
                    className="text-gray-500 hover:text-brand"
                    title="Ver Recibo"
                  >
                    <HiOutlinePrinter className="w-5 h-5" />
                  </button>
                  
                  {/* Botón Reembolsar (Rojo) */}
                  <button 
                    onClick={() => openRefundModal(sale)}
                    className="text-red-400 hover:text-red-600"
                    title="Procesar Devolución / Garantía"
                  >
                    <HiOutlineReceiptRefund className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- MODAL DE REEMBOLSO --- */}
      <ModalForm
        isOpen={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
        title={refundResult ? "Resultado" : "Procesar Devolución"}
        onSubmit={!refundResult ? handleRefundSubmit : () => setRefundModalOpen(false)}
        isSubmitting={isRefunding}
        submitLabel={!refundResult ? "Autorizar" : "Cerrar"}
        footer={!refundResult && refundForm.type === 'CASH' ? "⚠️ Requiere autorización de Administrador." : ""}
      >
        {refundResult ? (
          <div className="text-center py-4">
            <div className="text-green-500 text-5xl mb-4 flex justify-center"><HiOutlineReceiptRefund /></div>
            <h3 className="text-xl font-bold text-gray-800">{refundResult.title}</h3>
            <p className="text-gray-600 mb-4">{refundResult.message}</p>
            {refundResult.code && (
              <div className="bg-gray-100 p-4 rounded border-dashed border-2 border-gray-300">
                <span className="block text-xs uppercase text-gray-500">Código</span>
                <span className="block text-3xl font-mono font-bold text-brand tracking-widest">{refundResult.code}</span>
                <span className="block text-sm mt-1">Valor: ${refundResult.amount?.toFixed(2)}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {refundError && <div className="bg-red-100 text-red-700 p-2 rounded text-sm">{refundError}</div>}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700">Monto</label>
                <input 
                  type="number" step="0.01" 
                  className="w-full border rounded p-2"
                  value={refundForm.amount}
                  onChange={e => setRefundForm({...refundForm, amount: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700">Tipo</label>
                <select 
                  className="w-full border rounded p-2"
                  value={refundForm.type}
                  onChange={e => setRefundForm({...refundForm, type: e.target.value})}
                >
                  <option value="CREDIT_NOTE">Nota de Crédito (Garantía)</option>
                  <option value="CASH">Devolución Efectivo (Solo Admin)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700">Motivo</label>
              <textarea 
                className="w-full border rounded p-2" rows="2"
                placeholder="Ej: Producto defectuoso sin stock..."
                value={refundForm.reason}
                onChange={e => setRefundForm({...refundForm, reason: e.target.value})}
              />
            </div>

            <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
              <label className="block text-sm font-bold text-yellow-800 mb-1">PIN de Autorización</label>
              <input 
                type="password" 
                className="w-full border rounded p-2 text-center text-lg tracking-widest"
                placeholder="****" maxLength="4"
                value={refundForm.pin}
                onChange={e => setRefundForm({...refundForm, pin: e.target.value})}
              />
              <p className="text-xs text-yellow-700 mt-2">
                {refundForm.type === 'CASH' 
                  ? "Solo un Administrador puede autorizar esto." 
                  : "Cualquier empleado puede generar una Nota de Crédito."}
              </p>
            </div>
          </div>
        )}
      </ModalForm>
    </div>
  );
}

export default SalesHistoryPage;