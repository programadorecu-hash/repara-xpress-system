import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { 
  HiChartPie, HiCurrencyDollar, HiArrowSmDown, HiArrowSmUp, 
  HiTrendingUp, HiTrendingDown 
} from 'react-icons/hi';
import { toast } from 'react-toastify';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const FinancialReportPage = () => {
  const { token, user } = useContext(AuthContext);
  
  // Fechas por defecto: Primer día del mes hasta hoy
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [reportData, setReportData] = useState(null);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLocations();
  }, [token]);

  useEffect(() => {
    fetchReport();
  }, [token, startDate, endDate, selectedLocation]);

  const fetchLocations = async () => {
    try {
      // Si es admin, puede ver sucursales para filtrar
      if (user.role === 'admin' || user.role === 'inventory_manager') {
        const res = await axios.get(`${API_URL}/locations/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLocations(res.data);
      }
    } catch (error) {
      console.error("Error cargando sucursales", error);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/reports/financial?start_date=${startDate}&end_date=${endDate}`;
      if (selectedLocation) {
        url += `&location_id=${selectedLocation}`;
      }

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReportData(res.data);
    } catch (error) {
      toast.error("Error cargando el reporte financiero.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!reportData) return <div className="p-8 text-center">Cargando reporte...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Encabezado y Filtros */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center">
          <HiChartPie className="mr-3 text-indigo-600" />
          Reporte de Utilidad
        </h1>

        <div className="flex flex-wrap gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)}
            className="p-2 border rounded-lg text-sm outline-none focus:border-indigo-500"
          />
          <span className="self-center text-gray-400">a</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)}
            className="p-2 border rounded-lg text-sm outline-none focus:border-indigo-500"
          />
          
          {(user.role === 'admin' || user.role === 'inventory_manager') && (
            <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="p-2 border rounded-lg text-sm outline-none focus:border-indigo-500 bg-white"
            >
                <option value="">Todas las Sucursales</option>
                {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
            </select>
          )}
        </div>
      </div>

      {/* Tarjetas de Resumen (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        {/* 1. Ingresos Totales */}
        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-blue-500">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-wide">Ventas Totales</p>
                    <h3 className="text-2xl font-bold text-gray-800 mt-1">
                        ${reportData.total_revenue.toFixed(2)}
                    </h3>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                    <HiCurrencyDollar size={24} />
                </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Ingresos netos (sin IVA)</p>
        </div>

        {/* 2. Costo de Ventas */}
        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-orange-400">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-wide">Costo Productos</p>
                    <h3 className="text-2xl font-bold text-gray-800 mt-1">
                        -${reportData.total_cogs.toFixed(2)}
                    </h3>
                </div>
                <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
                    <HiArrowSmDown size={24} />
                </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Valor de mercadería vendida</p>
        </div>

        {/* 3. Gastos Operativos */}
        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-red-500">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-wide">Gastos Operativos</p>
                    <h3 className="text-2xl font-bold text-gray-800 mt-1">
                        -${reportData.total_expenses.toFixed(2)}
                    </h3>
                </div>
                <div className="p-2 bg-red-50 rounded-lg text-red-600">
                    <HiTrendingDown size={24} />
                </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Luz, Agua, Nómina, etc.</p>
        </div>

        {/* 4. Utilidad Neta (El Rey) */}
        <div className={`bg-white p-6 rounded-xl shadow-md border-l-4 ${reportData.net_utility >= 0 ? 'border-green-500' : 'border-red-600'}`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-wide">Utilidad Neta</p>
                    <h3 className={`text-3xl font-extrabold mt-1 ${reportData.net_utility >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${reportData.net_utility.toFixed(2)}
                    </h3>
                </div>
                <div className={`p-2 rounded-lg ${reportData.net_utility >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    <HiTrendingUp size={24} />
                </div>
            </div>
            <p className="text-xs font-semibold mt-2 text-gray-500">
                Margen Neto: <span className={reportData.net_margin_percent >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {reportData.net_margin_percent.toFixed(1)}%
                </span>
            </p>
        </div>
      </div>

      {/* Detalle de Gastos */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-gray-700">Desglose de Gastos Operativos</h3>
        </div>
        
        {reportData.expenses_breakdown.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
                No hay gastos registrados en este periodo.
            </div>
        ) : (
            <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                    <tr>
                        <th className="p-4 font-semibold">Categoría</th>
                        <th className="p-4 font-semibold text-right">Monto</th>
                        <th className="p-4 font-semibold text-right">% del Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {reportData.expenses_breakdown.map((item, idx) => {
                        const percent = (item.total_amount / reportData.total_expenses) * 100;
                        return (
                            <tr key={idx} className="hover:bg-gray-50">
                                <td className="p-4 font-medium text-gray-700">{item.category_name}</td>
                                <td className="p-4 text-right text-gray-800">${item.total_amount.toFixed(2)}</td>
                                <td className="p-4 text-right text-gray-500">
                                    <div className="flex items-center justify-end gap-2">
                                        <span>{percent.toFixed(1)}%</span>
                                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-red-400 rounded-full" 
                                                style={{ width: `${percent}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        )}
      </div>
    </div>
  );
};

export default FinancialReportPage;