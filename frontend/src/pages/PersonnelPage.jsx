import React, { useState, useEffect } from 'react';
import api from '../services/api';

function PersonnelPage() {
  // Fechas por defecto: Hoy
  const today = new Date().toISOString().slice(0, 10);
  
  const [filters, setFilters] = useState({
    start_date: today,
    end_date: today,
    user_id: '',
    location_id: ''
  });
  
  const [reportData, setReportData] = useState([]);
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);

  // Cargar filtros iniciales (Usuarios y Sucursales)
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [usersRes, locsRes] = await Promise.all([
          api.get('/users/'),
          api.get('/locations/')
        ]);
        setUsers(usersRes.data);
        // Filtramos solo sucursales (no bodegas)
        setLocations(locsRes.data.filter(l => !l.parent_id));
      } catch (error) {
        console.error("Error cargando filtros", error);
      }
    };
    loadFilters();
  }, []);

  // Buscar datos
  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = {
        start_date: filters.start_date,
        end_date: filters.end_date,
      };
      if (filters.user_id) params.user_id = filters.user_id;
      if (filters.location_id) params.location_id = filters.location_id;

      const response = await api.get('/reports/personnel', { params });
      setReportData(response.data);
    } catch (error) {
      alert("Error al generar el reporte");
    } finally {
      setLoading(false);
    }
  };

  // Función para imprimir
  const handlePrint = () => {
    window.print();
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return "En curso";
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      
      {/* Encabezado y Filtros (Se ocultan al imprimir gracias a 'print:hidden') */}
      <div className="bg-white p-6 rounded-xl shadow-md border mb-6 print:hidden">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-secondary">Control de Personal</h1>
          <button 
            onClick={handlePrint}
            className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-black transition"
          >
            🖨️ Imprimir Reporte
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <label className="block">
            <span className="text-sm font-semibold text-gray-700">Desde</span>
            <input 
              type="date" 
              value={filters.start_date}
              onChange={e => setFilters({...filters, start_date: e.target.value})}
              className="mt-1 block w-full border rounded-md p-2"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-gray-700">Hasta</span>
            <input 
              type="date" 
              value={filters.end_date}
              onChange={e => setFilters({...filters, end_date: e.target.value})}
              className="mt-1 block w-full border rounded-md p-2"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-gray-700">Empleado</span>
            <select 
              value={filters.user_id}
              onChange={e => setFilters({...filters, user_id: e.target.value})}
              className="mt-1 block w-full border rounded-md p-2"
            >
              <option value="">Todos</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
              ))}
            </select>
          </label>
          <button 
            onClick={handleSearch}
            disabled={loading}
            className="bg-accent text-white font-bold py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Buscando...' : 'Generar Reporte'}
          </button>
        </div>
      </div>

      {/* Hoja de Reporte (Diseño A4 aprox) */}
      <div className="bg-white p-8 shadow-lg print:shadow-none print:p-0 print:w-full mx-auto max-w-[21cm] min-h-[29.7cm] text-sm">
        
        {/* Cabecera de Impresión */}
        <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
          <h1 className="text-2xl font-bold uppercase">Repara Xpress</h1>
          <h2 className="text-lg font-semibold text-gray-600">Reporte de Asistencia y Turnos</h2>
          <p className="text-sm text-gray-500 mt-1">
            Del {filters.start_date} al {filters.end_date}
          </p>
        </div>

        {/* Tabla de Datos */}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="py-2 font-bold text-gray-700">Fecha</th>
              <th className="py-2 font-bold text-gray-700">Colaborador</th>
              <th className="py-2 font-bold text-gray-700 text-center">Inicio</th>
              <th className="py-2 font-bold text-gray-700 text-center">Fin</th>
              <th className="py-2 font-bold text-gray-700 text-center">Horas</th>
              <th className="py-2 font-bold text-gray-700">Sucursales Visitadas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reportData.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-8 text-center text-gray-400 italic">
                  No hay registros para este periodo.
                </td>
              </tr>
            ) : (
              reportData.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="py-3">{new Date(row.date).toLocaleDateString()}</td>
                  <td className="py-3">
                    <div className="font-semibold">{row.user_name || row.user_email}</div>
                    <div className="text-xs text-gray-500">{row.user_email}</div>
                  </td>
                  <td className="py-3 text-center text-green-700 font-mono">
                    {formatDateTime(row.first_clock_in)}
                  </td>
                  <td className="py-3 text-center text-red-700 font-mono">
                    {formatDateTime(row.last_clock_out)}
                  </td>
                  <td className="py-3 text-center font-bold">
                    {row.total_hours} h
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.locations_visited.map((loc, i) => (
                        <span key={i} className="inline-block bg-gray-100 border rounded px-2 py-0.5 text-xs text-gray-600">
                          {loc}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pie de página de impresión */}
        <div className="mt-12 pt-4 border-t text-center text-xs text-gray-400 hidden print:block">
          Reporte generado el {new Date().toLocaleString()} por Repara Xpress System
        </div>
      </div>

    </div>
  );
}

export default PersonnelPage;