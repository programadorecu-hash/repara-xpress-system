import React, { useState, useEffect, useContext } from 'react';
import api from '../services/api'; // El mensajero
import { AuthContext } from '../context/AuthContext'; // Para saber quién soy

// Esta es la nueva página (el "televisor")
function SalesHistoryPage() {
  const [sales, setSales] = useState([]); // El "historial"
  const [loading, setLoading] = useState(true); // Para el "Cargando..."
  const [error, setError] = useState('');
  const { user } = useContext(AuthContext); // Para permisos

  // Esto se ejecuta cuando abres la página
  useEffect(() => {
    fetchSales();
  }, []);

  // Función para pedirle el historial al "servicio de cable" (el backend)
  const fetchSales = async () => {
    setLoading(true);
    try {
      // 1. Usamos la "manguera" /sales/ que creamos en el backend
      const response = await api.get('/sales/'); 
      setSales(response.data); // 2. Guardamos los datos
      setError('');
    } catch (err) {
      setError('No se pudo cargar el historial de ventas.');
    } finally {
      setLoading(false);
    }
  };

  // Función simple para formatear la fecha
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-EC');
  };

  // (El resto es la "carcasa" del televisor)
  return (
    <div className="bg-white p-6 rounded-xl shadow-md border space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Historial de Ventas</h1>
          <p className="text-sm text-gray-500">
            Revisa todas las ventas completadas.
          </p>
        </div>
        {/* Aquí podremos filtros de fecha en el futuro */}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-100 text-red-700">
          {error}
        </div>
      )}
      
      {/* --- INICIO: La "Pantalla" (La tabla de datos) --- */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white text-secondary">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-3 px-4 text-left">ID Venta</th>
              <th className="py-3 px-4 text-left">Fecha</th>
              <th className="py-3 px-4 text-left">Cliente</th>
              <th className="py-3 px-4 text-left">Vendedor</th>
              <th className="py-3 px-4 text-right">Total</th>
              <th className="py-3 px-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="py-6 px-4 text-center text-gray-500">Cargando...</td>
              </tr>
            ) : sales.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-6 px-4 text-center text-gray-500">No se encontraron ventas.</td>
              </tr>
            ) : (
              // Si hay ventas, las mostramos una por una
              sales.map((sale) => (
                <tr key={sale.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono font-bold">#{sale.id}</td>
                  <td className="py-3 px-4 text-sm">{formatDate(sale.created_at)}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-sm">{sale.customer_name}</div>
                    <div className="text-xs text-gray-500">{sale.customer_ci}</div>
                  </td>
                  <td className="py-3 px-4 text-sm">{sale.user.email}</td>
                  <td className="py-3 px-4 text-right font-bold text-base">${sale.total_amount.toFixed(2)}</td>
                  <td className="py-3 px-4 text-center">
                    {/* Este botón nos servirá para reimprimir el recibo más adelante */}
                    <button className="text-accent hover:underline">
                      Ver Recibo
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* --- FIN: La "Pantalla" --- */}
      
    </div>
  );
}

export default SalesHistoryPage;