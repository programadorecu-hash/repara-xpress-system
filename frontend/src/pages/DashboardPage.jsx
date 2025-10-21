import React, { useState, useEffect } from 'react';
import api from '../services/api'; // <-- Importamos nuestro mensajero

function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Esta función se ejecuta cuando el componente se carga por primera vez
    const fetchSummary = async () => {
      try {
        const response = await api.get('/reports/dashboard-summary');
        setSummary(response.data);
      } catch (err) {
        setError('No se pudo cargar el resumen. ¿Iniciaste un turno?');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []); // El array vacío asegura que solo se ejecute una vez

  if (loading) {
    return <p className="text-center text-gray-400">Cargando dashboard...</p>;
  }

  if (error) {
    return <p className="text-center text-red-500">{error}</p>;
  }

  const totalBalance = summary.total_sales - summary.total_expenses;

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard 
          title="Ventas del Día" 
          value={summary.total_sales}
          colorClass="bg-accent/20 text-accent"
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
        />
        <StatCard 
          title="Gastos del Día" 
          value={summary.total_expenses}
          colorClass="bg-red-500/20 text-red-500"
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>}
        />
        <StatCard 
          title="Balance Diario" 
          value={totalBalance}
          colorClass="bg-detail/20 text-detail"
          icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 01-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V8.25c0-.621.504-1.125 1.125-1.125h1.5M16.5 18.75v-6.75a4.5 4.5 0 00-4.5-4.5h-1.5a4.5 4.5 0 00-4.5 4.5v6.75" /></svg>}
        />
      </div>
      {/* ... El resto de tu dashboard con el panel de órdenes ... */}
    </div>
  );
}

// Tienes que definir el StatCard aquí también
const StatCard = ({ title, value, icon, colorClass }) => (
  <div className="bg-white p-6 rounded-xl shadow-md flex items-center space-x-4">
    <div className={`rounded-full p-3 ${colorClass}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500 uppercase">{title}</p>
      <p className="text-2xl font-bold text-secondary">${(value || 0).toFixed(2)}</p>
    </div>
  </div>
);

export default DashboardPage;