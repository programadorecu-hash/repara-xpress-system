// frontend/src/pages/SuperAdminPage.jsx
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import { 
  HiOutlineOfficeBuilding, 
  HiOutlineShieldCheck, 
  HiOutlineBan, 
  HiOutlineCube, 
  HiOutlineCurrencyDollar, 
  HiOutlineCog,
  HiOutlineUsers,
  HiOutlineCheckCircle
} from 'react-icons/hi';

function SuperAdminPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await api.get('/super-admin/companies');
      // Ordenamos: Inactivas primero para ver quién debe dinero
      const sorted = res.data.sort((a, b) => a.is_active === b.is_active ? 0 : a.is_active ? 1 : -1);
      setCompanies(sorted);
    } catch (err) {
      console.error(err);
      toast.error('Error cargando datos. Verifica tu rol de Super Admin.');
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = async (companyId, moduleKey, currentValue) => {
    // Definimos el nuevo valor (lo contrario al actual)
    const newValue = !currentValue;
    
    // 1. Actualización Optimista (Visual inmediata)
    const originalCompanies = [...companies];
    setCompanies(prev => prev.map(c => {
      if (c.id === companyId) {
        // Aseguramos que modules exista
        const currentModules = c.modules || {};
        return { ...c, modules: { ...currentModules, [moduleKey]: newValue } };
      }
      return c;
    }));

    // 2. Llamada al Backend
    try {
      await api.patch(`/super-admin/companies/${companyId}/modules`, {
        modules: { [moduleKey]: newValue }
      });
      toast.success(`Módulo actualizado correctamente.`);
    } catch (error) {
      // 3. Si falla, revertimos
      setCompanies(originalCompanies);
      toast.error('Error al actualizar módulo. ¿Base de datos actualizada?');
    }
  };

  const toggleStatus = async (companyId, currentStatus, companyName) => {
    const action = currentStatus ? 'BLOQUEAR' : 'ACTIVAR';
    if (!window.confirm(`⚠️ ¿Estás seguro de ${action} el acceso a "${companyName}"?\n\nSi bloqueas, nadie de esa empresa podrá entrar.`)) return;
    
    try {
      await api.patch(`/super-admin/companies/${companyId}/status`, { is_active: !currentStatus });
      fetchCompanies(); // Recargamos para estar seguros
      toast.success(`Empresa ${!currentStatus ? 'ACTIVADA' : 'BLOQUEADA'} exitosamente.`);
    } catch (error) {
      toast.error('Error al cambiar estado.');
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <HiOutlineShieldCheck className="text-6xl text-indigo-300 mx-auto animate-pulse"/>
        <p className="mt-4 text-gray-500 font-medium">Validando credenciales de Nivel 5...</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 bg-slate-50 min-h-screen pb-20">
      {/* Encabezado */}
      <div className="mb-8 bg-indigo-700 text-white p-8 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <HiOutlineShieldCheck className="text-yellow-400 text-4xl" />
            CONSOLA SUPER ADMIN
          </h1>
          <p className="text-indigo-100 mt-2 text-lg">
            Control de Inquilinos y Suscripciones SaaS.
          </p>
          <div className="mt-6 flex gap-4">
            <div className="bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm">
              <span className="block text-2xl font-bold">{companies.length}</span>
              <span className="text-xs opacity-75">Empresas Totales</span>
            </div>
            <div className="bg-green-500/20 px-4 py-2 rounded-lg backdrop-blur-sm">
              <span className="block text-2xl font-bold">{companies.filter(c => c.is_active).length}</span>
              <span className="text-xs opacity-75">Activas (Pagando)</span>
            </div>
            <div className="bg-red-500/20 px-4 py-2 rounded-lg backdrop-blur-sm">
              <span className="block text-2xl font-bold">{companies.filter(c => !c.is_active).length}</span>
              <span className="text-xs opacity-75">Bloqueadas</span>
            </div>
          </div>
        </div>
        {/* Decoración de fondo */}
        <HiOutlineShieldCheck className="absolute -bottom-10 -right-10 text-9xl text-white/10 rotate-12"/>
      </div>

      {/* Lista de Empresas */}
      <div className="grid grid-cols-1 gap-6">
        {companies.map((company) => (
          <div key={company.id} className={`bg-white rounded-xl shadow-sm border-l-8 transition-all hover:shadow-md ${company.is_active ? 'border-green-500' : 'border-red-500'}`}>
            <div className="p-6">
              
              {/* Cabecera de la Tarjeta */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-6 border-b border-gray-100">
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center text-xl font-bold ${company.is_active ? 'bg-indigo-50 text-indigo-600' : 'bg-red-50 text-red-600'}`}>
                    {company.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                      {company.name}
                      {!company.is_active && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded uppercase">Suspendida</span>}
                    </h2>
                    <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                      <span className="font-mono">ID: {company.id}</span>
                      <span className="flex items-center gap-1"><HiOutlineUsers/> {company.user_count || 0} Usuarios</span>
                      <span>Plan: {company.plan_type}</span>
                    </div>
                  </div>
                </div>
                
                {/* Botón Maestro de Activación */}
                <button 
                  onClick={() => toggleStatus(company.id, company.is_active, company.name)}
                  className={`mt-4 md:mt-0 px-6 py-2 rounded-lg text-sm font-bold text-white shadow-sm transition-transform active:scale-95 flex items-center gap-2 ${company.is_active ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  {company.is_active ? (
                    <><HiOutlineBan className="text-lg"/> BLOQUEAR EMPRESA</>
                  ) : (
                    <><HiOutlineCheckCircle className="text-lg"/> ACTIVAR SERVICIO</>
                  )}
                </button>
              </div>

              {/* Panel de Control de Módulos */}
              <div className="bg-slate-50 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <HiOutlineCube/> Configuración de Módulos
                  </h3>
                  <span className="text-[10px] text-slate-400 bg-slate-200 px-2 py-1 rounded">
                    Clic para activar/desactivar
                  </span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <ModuleSwitch 
                    label="Inventario" 
                    icon={<HiOutlineCube/>} 
                    active={company.modules?.inventory} 
                    color="blue"
                    onClick={() => toggleModule(company.id, 'inventory', company.modules?.inventory)}
                  />
                  <ModuleSwitch 
                    label="Punto de Venta" 
                    icon={<HiOutlineCurrencyDollar/>} 
                    active={company.modules?.pos} 
                    color="green"
                    onClick={() => toggleModule(company.id, 'pos', company.modules?.pos)}
                  />
                  <ModuleSwitch 
                    label="Taller / Órdenes" 
                    icon={<HiOutlineCog/>} 
                    active={company.modules?.work_orders} 
                    color="orange"
                    onClick={() => toggleModule(company.id, 'work_orders', company.modules?.work_orders)}
                  />
                  <ModuleSwitch 
                    label="Finanzas" 
                    icon={<HiOutlineCurrencyDollar/>} 
                    active={company.modules?.expenses} 
                    color="purple"
                    onClick={() => toggleModule(company.id, 'expenses', company.modules?.expenses)}
                  />
                </div>
              </div>

            </div>
          </div>
        ))}

        {companies.length === 0 && (
          <div className="text-center p-10 bg-white rounded-xl shadow border border-gray-100">
            <p className="text-gray-400">No hay empresas registradas aún.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente visual del Switch
function ModuleSwitch({ label, icon, active, color, onClick }) {
  // Manejo defensivo por si active es undefined
  const isActive = !!active;

  const colors = {
    blue:   isActive ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-400 hover:border-blue-300',
    green:  isActive ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-400 hover:border-green-300',
    orange: isActive ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-gray-200 text-gray-400 hover:border-orange-300',
    purple: isActive ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-200 text-gray-400 hover:border-purple-300',
  };

  return (
    <button 
      onClick={onClick}
      className={`group flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 ${colors[color]}`}
    >
      <div className={`text-2xl mb-2 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : ''}`}>
        {icon}
      </div>
      <span className="text-xs font-bold uppercase tracking-wide">
        {label}
      </span>
      <div className={`mt-2 text-[10px] px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
        {isActive ? 'ACTIVADO' : 'INACTIVO'}
      </div>
    </button>
  );
}

export default SuperAdminPage;