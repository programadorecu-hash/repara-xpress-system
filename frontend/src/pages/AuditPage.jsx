import React, { useState, useEffect } from 'react';
import api from '../services/api';

function AuditPage() {
  const [movements, setMovements] = useState([]);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ start_date: '', end_date: '', user_id: '' });
  const [loading, setLoading] = useState(false);

  // Cargar la lista de usuarios para el filtro
  useEffect(() => {
    api.get('/users/').then(res => setUsers(res.data));
  }, []);

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSearch = async () => {
    setLoading(true);
try {
      // --- LÓGICA DE LIMPIEZA DE FILTROS ---
      const params = {};
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.user_id) params.user_id = filters.user_id;
      // --- FIN DE LA LÓGICA ---

      // Pasamos los filtros limpios a la petición
      const response = await api.get('/reports/inventory-audit', { params });
      setMovements(response.data);
    } catch (error) {
      alert('Error al cargar el reporte.');
    } finally {
      setLoading(false);
    }
  };
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('es-EC', options);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border text-secondary">
      <h1 className="text-2xl font-bold mb-4">Auditoría de Movimientos de Inventario</h1>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-4 p-4 bg-gray-50 rounded-lg mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Fecha de Inicio</label>
          <input type="date" name="start_date" value={filters.start_date} onChange={handleFilterChange} className="mt-1 p-2 border rounded-md w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Fecha de Fin</label>
          <input type="date" name="end_date" value={filters.end_date} onChange={handleFilterChange} className="mt-1 p-2 border rounded-md w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Usuario</label>
          <select name="user_id" value={filters.user_id} onChange={handleFilterChange} className="mt-1 p-2 border rounded-md w-full">
            <option value="">Todos</option>
            {users.map(user => <option key={user.id} value={user.id}>{user.email}</option>)}
          </select>
        </div>
        <button onClick={handleSearch} disabled={loading} className="py-2 px-6 bg-accent text-white font-bold rounded-lg hover:bg-teal-600 disabled:bg-gray-400">
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {/* Tabla de Resultados */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-3 px-4 text-left">Fecha y Hora</th>
              <th className="py-3 px-4 text-left">Producto</th>
              <th className="py-3 px-4 text-left">Ubicación</th>
              <th className="py-3 px-4 text-center">Cambio</th>
              <th className="py-3 px-4 text-left">Tipo</th>
              <th className="py-3 px-4 text-left">Usuario</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((mov) => (
              <tr key={mov.id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4">{formatDate(mov.timestamp)}</td>
                <td className="py-3 px-4 font-semibold">{mov.product.name}</td>
                <td className="py-3 px-4">{mov.location.name}</td>
                <td className={`py-3 px-4 text-center font-bold ${mov.quantity_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {mov.quantity_change > 0 ? `+${mov.quantity_change}` : mov.quantity_change}
                </td>
                <td className="py-3 px-4">{mov.movement_type}</td>
                <td className="py-3 px-4">{mov.user.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AuditPage;