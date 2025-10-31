import React, { useState, useEffect, useContext } from 'react';
import api from '../services/api'; // El mensajero
import { AuthContext } from '../context/AuthContext'; // Para saber quién soy

// --- INICIO DE NUESTRO CÓDIGO ---
// Función para obtener la fecha de hoy en formato 'YYYY-MM-DD'
const getTodayString = () => {
  return new Date().toISOString().slice(0, 10);
};
// --- FIN DE NUESTRO CÓDIGO ---

// Esta es la nueva página (el "televisor")
function SalesHistoryPage() {
  const [sales, setSales] = useState([]); // El "historial"
  const [loading, setLoading] = useState(true); // Para el "Cargando..."
  const [error, setError] = useState('');
  const { user } = useContext(AuthContext); // Para permisos
  const [isPrintingId, setIsPrintingId] = useState(null);

  // --- INICIO: "Blocs de notas" para nuestro buscador ---
  const [startDate, setStartDate] = useState(getTodayString()); // Calendario Inicio (default HOY)
  const [endDate, setEndDate] = useState(getTodayString());   // Calendario Fin (default HOY)
  const [searchTerm, setSearchTerm] = useState(''); // Barra de búsqueda
  // --- FIN: "Blocs de notas" ---

  // Esto se ejecuta cuando abres la página
  useEffect(() => {
    // Al cargar la página, busca automáticamente las ventas de "hoy"
    fetchSales(); 
  }, []); // El array vacío asegura que solo se ejecute 1 vez al cargar

  // Función para pedirle el historial al "servicio de cable" (el backend)
  const fetchSales = async () => {
    setLoading(true);
    setError(''); // Limpiamos errores viejos
    
    // --- INICIO: Preparamos los filtros para la "manguera" ---
    const params = {
      skip: 0,
      limit: 100, // Por ahora cargamos 100
    };
    
    // Solo añadimos los filtros si tienen un valor
    if (startDate) {
      params.start_date = startDate;
    }
    if (endDate) {
      params.end_date = endDate;
    }
    if (searchTerm) {
      params.search = searchTerm;
    }
    // --- FIN: Preparamos los filtros ---

    try {
      // 1. Usamos la "manguera" /sales/ y le pasamos los filtros
      const response = await api.get('/sales/', { params: params }); 
      setSales(response.data); // 2. Guardamos los datos
    } catch (err) {
      setError('No se pudo cargar el historial de ventas.');
    } finally {
      setLoading(false);
    }
  };
  
  // --- INICIO: Función para el botón "Buscar" ---
  // Se llama cuando el usuario presiona "Buscar" en el formulario
  const handleSearchSubmit = (e) => {
    e.preventDefault(); // Evita que la página se recargue
    fetchSales(); // Llama a la función de búsqueda con los filtros actuales
  };
  // --- FIN: Función para el botón "Buscar" ---

  // Función simple para formatear la fecha
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-EC');
  };

  // Esta es la nueva función (CORREGIDA) para programar el botón "Ver Recibo"
  const handleViewReceipt = async (saleId) => {
    // ... (esta función no cambia, la dejamos como estaba)
    setIsPrintingId(saleId);
    setError('');
    try {
      const response = await api.get(`/sales/${saleId}/receipt`, {
        responseType: 'blob', 
      });
      const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = fileURL;
      link.target = '_blank'; 
      document.body.appendChild(link); 
      link.click(); 
      document.body.removeChild(link); 
      setTimeout(() => window.URL.revokeObjectURL(fileURL), 1000);
    } catch (err) {
      console.error("Error al generar PDF:", err); 
      setError('No se pudo generar el recibo PDF. (Revisa la consola)');
    } finally {
      setIsPrintingId(null);
    }
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
      </div>

      {/* --- INICIO: NUESTRO "BUSCADOR INTELIGENTE" (Formulario) --- */}
      <form onSubmit={handleSearchSubmit} className="p-4 bg-gray-50 rounded-lg border flex flex-wrap items-end gap-4">
        {/* Filtro Fecha Inicio */}
        <div>
          <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">Fecha Inicio</label>
          <input
            type="date"
            id="start_date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 p-2 border rounded-md w-full"
          />
        </div>
        
        {/* Filtro Fecha Fin */}
        <div>
          <label htmlFor="end_date" className="block text-sm font-medium text-gray-700">Fecha Fin</label>
          <input
            type="date"
            id="end_date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 p-2 border rounded-md w-full"
          />
        </div>

        {/* Filtro Búsqueda por Texto */}
        <div className="flex-grow">
          <label htmlFor="search_term" className="block text-sm font-medium text-gray-700">Buscar (Cliente / Cédula)</label>
          <input
            type="text"
            id="search_term"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Nombre o Cédula"
            className="mt-1 p-2 border rounded-md w-full"
          />
        </div>

        {/* Botón de Búsqueda */}
        <button
          type="submit"
          disabled={loading} // Desactivado mientras carga
          className="py-2 px-6 bg-accent text-white font-bold rounded-lg hover:bg-teal-600 disabled:bg-gray-400"
        >
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </form>
      {/* --- FIN: NUESTRO "BUSCADOR INTELIGENTE" --- */}


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
                <td colSpan="6" className="py-6 px-4 text-center text-gray-500">
                  No se encontraron ventas para los filtros seleccionados.
                </td>
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
                    {/* Este es el botón "control remoto" */}
                    <button 
                      onClick={() => handleViewReceipt(sale.id)}
                      disabled={isPrintingId === sale.id}
                      className="text-accent hover:underline disabled:text-gray-400 disabled:no-underline"
                    >
                      {isPrintingId === sale.id ? 'Generando...' : 'Ver Recibo'}
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