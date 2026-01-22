// frontend/src/pages/SuperAdminPage.jsx
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import { HiOutlineOfficeBuilding, HiOutlineShieldCheck, HiOutlineBan, HiOutlineCube, HiOutlineCurrencyDollar, HiOutlineCog } from 'react-icons/hi';

function SuperAdminPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await api.get('/super-admin/companies');
      setCompanies(res.data);
    } catch (err) {
      toast.error('Error cargando empresas. ¿Eres Super Admin?');
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = async (companyId, moduleKey, currentValue) => {
    try {
      // Optimistic update (actualizar visualmente antes)
      const newCompanies = companies.map(c => {
        if (c.id === companyId) {
          return { ...c, modules: { ...c.modules, [moduleKey]: !currentValue } };
        }
        return c;
      });
      setCompanies(newCompanies);

      await api.patch(`/super-admin/companies/${companyId}/modules`, {
        modules: { [moduleKey]: !currentValue }
      });
      toast.success(`Módulo ${moduleKey} actualizado.`);
    } catch (error) {
      toast.error('Error al actualizar módulo.');
      fetchCompanies(); // Revertir en caso de error
    }
  };

  const toggleStatus = async (companyId, currentStatus) => {
    if (!window.confirm(`¿Seguro que quieres ${currentStatus ? 'BLOQUEAR' : 'ACTIVAR'} esta empresa?`)) return;
    try {
      await api.patch(`/super-admin/companies/${companyId}/status`, { is_active: !currentStatus });
      fetchCompanies();
      toast.success(`Empresa ${!currentStatus ? 'activada' : 'bloqueada'}.`);
    } catch (error) {
      toast.error('Error al cambiar estado.');
    }
  };

  if (loading) return <div className="p-10 text-center">Cargando Torre de Control...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-800 flex items-center gap-3">
          <HiOutlineShieldCheck className="text-indigo-600" />
          Torre de Control (Super Admin)
        </h1>
        <p className="text-gray-500">Administra tus inquilinos y sus suscripciones.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {companies.map((company) => (
          <div key={company.id} className={`bg-white rounded-xl shadow-sm border-l-4 p-6 transition-all ${company.is_active ? 'border-green-500' : 'border-red-500 opacity-75'}`}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <HiOutlineOfficeBuilding className="text-gray-400"/> {company.name}
                </h2>
                <p className="text-sm text-gray-400 font-mono mt-1">ID: {company.id} | Registrado: {new Date(company.created_at).toLocaleDateString()}</p>
              </div>
              
              <div className="flex items-center gap-3 mt-4 md:mt-0">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${company.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {company.is_active ? 'ACTIVA' : 'BLOQUEADA'}
                </span>
                <button 
                  onClick={() => toggleStatus(company.id, company.is_active)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition-colors ${company.is_active ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                >
                  {company.is_active ? <span className="flex items-center gap-1"><HiOutlineBan/> BLOQUEAR ACCESO</span> : 'RESTAURAR ACCESO'}
                </button>
              </div>
            </div>

            {/* PANEL DE MÓDULOS */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider">Módulos Contratados</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                
                {/* Inventario (Gancho) */}
                <ModuleSwitch 
                  label="Inventario" 
                  icon={<HiOutlineCube/>} 
                  // Usamos "|| false" para que no falle si es undefined
                  active={company.modules?.inventory || false} 
                  color="blue"
                  onClick={() => toggleModule(company.id, 'inventory', company.modules?.inventory)}
                />

                {/* POS (Ventas) */}
                <ModuleSwitch 
                  label="Punto de Venta" 
                  icon={<HiOutlineCurrencyDollar/>} 
                  active={company.modules?.pos} 
                  color="green"
                  onClick={() => toggleModule(company.id, 'pos', company.modules?.pos)}
                />

                {/* Órdenes (Taller) */}
                <ModuleSwitch 
                  label="Taller / Órdenes" 
                  icon={<HiOutlineCog/>} 
                  active={company.modules?.work_orders} 
                  color="orange"
                  onClick={() => toggleModule(company.id, 'work_orders', company.modules?.work_orders)}
                />

                 {/* Gastos */}
                 <ModuleSwitch 
                  label="Finanzas / Gastos" 
                  icon={<HiOutlineCurrencyDollar/>} 
                  active={company.modules?.expenses} 
                  color="purple"
                  onClick={() => toggleModule(company.id, 'expenses', company.modules?.expenses)}
                />

              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Componente pequeño para los interruptores
function ModuleSwitch({ label, icon, active, color, onClick }) {
  const colors = {
    blue:   active ? 'bg-blue-500 border-blue-500' : 'bg-gray-200 border-gray-200',
    green:  active ? 'bg-green-500 border-green-500' : 'bg-gray-200 border-gray-200',
    orange: active ? 'bg-orange-500 border-orange-500' : 'bg-gray-200 border-gray-200',
    purple: active ? 'bg-purple-500 border-purple-500' : 'bg-gray-200 border-gray-200',
  };

  return (
    <div 
      onClick={onClick}
      className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all select-none hover:shadow-sm
        ${active ? 'bg-white border-opacity-100' : 'bg-gray-100 border-transparent opacity-60 hover:opacity-100'}
        ${active ? `border-${color}-200` : ''}
      `}
    >
      <div className="flex items-center gap-2">
        <div className={`text-lg ${active ? `text-${color}-600` : 'text-gray-400'}`}>{icon}</div>
        <span className={`text-xs font-bold ${active ? 'text-gray-800' : 'text-gray-500'}`}>{label}</span>
      </div>
      
      {/* Toggle visual */}
      <div className={`w-8 h-4 rounded-full relative transition-colors ${colors[color]}`}>
        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${active ? 'left-4.5' : 'left-0.5'}`} style={{left: active ? '18px' : '2px'}}></div>
      </div>
    </div>
  );
}

export default SuperAdminPage;