// frontend/src/pages/SuperAdminPage.jsx
import React, { useState, useEffect } from 'react';
import api, { getCompanyUsers, toggleUserStatus as apiToggleUserStatus, sendSaasInvitation } from '../services/api';
import { toast } from 'react-toastify';
import { 
  HiOutlineOfficeBuilding, 
  HiOutlineShieldCheck, 
  HiOutlineBan, 
  HiOutlineCube, 
  HiOutlineCurrencyDollar, 
  HiOutlineCog,
  HiOutlineUsers,
  HiOutlineCheckCircle,
  HiOutlineMail,
  HiOutlinePhone,
  HiOutlineLocationMarker,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineIdentification,
  HiOutlineKey // <--- ÍCONO NUEVO
} from 'react-icons/hi';

function SuperAdminPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [expandedCompanyId, setExpandedCompanyId] = useState(null);
  const [companyUsers, setCompanyUsers] = useState({});
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await api.get('/super-admin/companies');
      const sorted = res.data.sort((a, b) => a.is_active === b.is_active ? 0 : a.is_active ? 1 : -1);
      setCompanies(sorted);
    } catch (err) {
      toast.error('Error cargando datos.');
    } finally {
      setLoading(false);
    }
  };

  const handleExpandUsers = async (companyId) => {
    if (expandedCompanyId === companyId) {
      setExpandedCompanyId(null); 
      return;
    }
    setExpandedCompanyId(companyId);
    if (!companyUsers[companyId]) {
      setLoadingUsers(true);
      try {
        const users = await getCompanyUsers(companyId);
        setCompanyUsers(prev => ({ ...prev, [companyId]: users }));
      } catch (error) {
        toast.error("Error cargando personal.");
      } finally {
        setLoadingUsers(false);
      }
    }
  };

  const handleToggleUser = async (userId, currentStatus, companyId) => {
    const action = currentStatus ? 'desactivar' : 'activar';
    if(!window.confirm(`¿Seguro que deseas ${action} a este usuario?`)) return;

    try {
      await apiToggleUserStatus(userId, !currentStatus);
      const updatedUsers = companyUsers[companyId].map(u => 
        u.id === userId ? { ...u, is_active: !currentStatus } : u
      );
      setCompanyUsers(prev => ({ ...prev, [companyId]: updatedUsers }));
      toast.success(`Usuario ${!currentStatus ? 'activado' : 'desactivado'}.`);
    } catch (error) {
      toast.error("Error al cambiar estado del usuario.");
    }
  };

  // --- NUEVA FUNCIÓN: ENTREGAR LLAVES ---
  const handleSendKeys = async (companyId, companyName) => {
    const email = prompt(`🔑 ENTREGA DE PROPIEDAD: ${companyName}\n\nIngresa el correo del nuevo Dueño/Admin:`);
    if (!email) return; 

    // Opcional: Podrías preguntar el rol, pero "admin" es lo lógico para un dueño.
    const role = 'admin'; 

    if(!window.confirm(`CONFIRMACIÓN:\n\nSe enviará un enlace único a: ${email}\n\nEsta persona podrá registrarse como DUEÑO (Admin) de ${companyName}.\n\n¿Proceder?`)) return;

    try {
      await sendSaasInvitation(companyId, email, role);
      toast.success(`✅ Enlace de propiedad enviado a ${email}`);
    } catch (error) {
      console.error(error);
      // Extraemos el mensaje de error del backend si existe
      const msg = error.response?.data?.detail || "Error enviando invitación.";
      toast.error(msg);
    }
  };
  // --------------------------------------

  const toggleModule = async (companyId, moduleKey, currentValue) => {
    const newValue = !currentValue;
    const originalCompanies = [...companies];
    setCompanies(prev => prev.map(c => {
      if (c.id === companyId) {
        const currentModules = c.modules || {};
        return { ...c, modules: { ...currentModules, [moduleKey]: newValue } };
      }
      return c;
    }));

    try {
      await api.patch(`/super-admin/companies/${companyId}/modules`, {
        modules: { [moduleKey]: newValue }
      });
      toast.success(`Módulo actualizado.`);
    } catch (error) {
      setCompanies(originalCompanies);
      toast.error('Error al actualizar módulo.');
    }
  };

  const toggleStatus = async (companyId, currentStatus, companyName) => {
    const action = currentStatus ? 'BLOQUEAR' : 'ACTIVAR';
    if (!window.confirm(`⚠️ ¿${action} acceso a "${companyName}"?`)) return;
    try {
      await api.patch(`/super-admin/companies/${companyId}/status`, { is_active: !currentStatus });
      fetchCompanies();
      toast.success(`Empresa ${!currentStatus ? 'ACTIVADA' : 'BLOQUEADA'}.`);
    } catch (error) {
      toast.error('Error al cambiar estado.');
    }
  };

  if (loading) return <div className="p-10 text-center">Cargando Torre de Control...</div>;

  return (
    <div className="p-6 bg-slate-50 min-h-screen pb-20">
      <div className="mb-8 bg-indigo-700 text-white p-8 rounded-2xl shadow-lg relative overflow-hidden">
        <h1 className="text-3xl font-extrabold flex items-center gap-3 relative z-10">
          <HiOutlineShieldCheck className="text-yellow-400 text-4xl" /> CONSOLA SUPER ADMIN
        </h1>
        <p className="text-indigo-100 mt-2 relative z-10">Gestión Total de Empresas y Personal.</p>
        <HiOutlineShieldCheck className="absolute -bottom-10 -right-10 text-9xl text-white/10 rotate-12"/>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {companies.map((company) => (
          <div key={company.id} className={`bg-white rounded-xl shadow-lg border-l-8 transition-all ${company.is_active ? 'border-green-500' : 'border-red-500'}`}>
            <div className="p-6">
              
              <div className="flex flex-col lg:flex-row justify-between items-start mb-6 border-b border-gray-100 pb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold text-gray-800">{company.name}</h2>
                    {!company.is_active && <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded font-bold">SUSPENDIDA</span>}
                    <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded font-mono">ID: {company.id}</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <HiOutlineIdentification className="text-indigo-500 text-lg"/>
                      <div>
                        <span className="block font-bold text-xs uppercase text-gray-400">Admin / Dueño</span>
                        <span className="font-semibold">{company.admin_name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <HiOutlineMail className="text-indigo-500 text-lg"/>
                      <div>
                        <span className="block font-bold text-xs uppercase text-gray-400">Email Admin</span>
                        <span>{company.admin_email}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <HiOutlinePhone className="text-indigo-500 text-lg"/>
                      <div>
                        <span className="block font-bold text-xs uppercase text-gray-400">Teléfono</span>
                        <span>{company.contact_phone}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <HiOutlineLocationMarker className="text-indigo-500 text-lg"/>
                      <div>
                        <span className="block font-bold text-xs uppercase text-gray-400">Dirección</span>
                        <span className="truncate max-w-[200px]" title={company.contact_address}>{company.contact_address}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 lg:mt-0 lg:ml-6 flex flex-col gap-3 min-w-[200px]">
                  {/* --- BOTÓN NUEVO: ENTREGAR LLAVES --- */}
                  <button 
                    onClick={() => handleSendKeys(company.id, company.name)}
                    className="w-full py-2 px-4 rounded-lg font-bold text-yellow-700 bg-yellow-100 hover:bg-yellow-200 text-sm border border-yellow-300 flex items-center justify-center gap-2 transition-colors"
                  >
                    <HiOutlineKey className="text-lg"/> ENTREGAR LLAVES
                  </button>
                  {/* ------------------------------------ */}

                  <button 
                    onClick={() => toggleStatus(company.id, company.is_active, company.name)}
                    className={`w-full py-2 px-4 rounded-lg font-bold text-white text-sm shadow-sm flex items-center justify-center gap-2 ${company.is_active ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    {company.is_active ? <><HiOutlineBan/> BLOQUEAR EMPRESA</> : <><HiOutlineCheckCircle/> ACTIVAR SERVICIO</>}
                  </button>
                  
                  <button 
                    onClick={() => handleExpandUsers(company.id)}
                    className="w-full py-2 px-4 rounded-lg font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 text-sm border border-indigo-200 flex items-center justify-center gap-2"
                  >
                    {expandedCompanyId === company.id ? <HiOutlineChevronUp/> : <HiOutlineChevronDown/>}
                    {expandedCompanyId === company.id ? 'OCULTAR PERSONAL' : `VER PERSONAL (${company.user_count})`}
                  </button>
                </div>
              </div>

              {expandedCompanyId === company.id && (
                <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                    <h3 className="text-sm font-bold text-indigo-800 uppercase mb-3 flex items-center gap-2">
                      <HiOutlineUsers/> Nómina de Empleados
                    </h3>
                    
                    {loadingUsers ? (
                      <div className="text-center py-4 text-gray-500">Cargando personal...</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-gray-500 uppercase bg-indigo-100/50">
                            <tr>
                              <th className="px-3 py-2 rounded-l-lg">Nombre</th>
                              <th className="px-3 py-2">Email</th>
                              <th className="px-3 py-2">Rol</th>
                              <th className="px-3 py-2">Estado</th>
                              <th className="px-3 py-2 rounded-r-lg text-right">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-indigo-100">
                            {companyUsers[company.id]?.map(user => (
                              <tr key={user.id} className="hover:bg-white transition-colors">
                                <td className="px-3 py-2 font-medium text-gray-800">
                                  {user.full_name || "Sin Nombre"}
                                  {user.role === 'admin' && <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded border border-yellow-200">DUEÑO</span>}
                                </td>
                                <td className="px-3 py-2 text-gray-600">{user.email}</td>
                                <td className="px-3 py-2">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                    user.role === 'admin' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                    user.role === 'inventory_manager' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                    'bg-gray-100 text-gray-600 border-gray-200'
                                  }`}>
                                    {user.role === 'inventory_manager' ? 'GERENTE' : user.role === 'warehouse_operator' ? 'TÉCNICO' : user.role.toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  {user.is_active 
                                    ? <span className="text-green-600 font-bold text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Activo</span> 
                                    : <span className="text-red-500 font-bold text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Bloqueado</span>
                                  }
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    onClick={() => handleToggleUser(user.id, user.is_active, company.id)}
                                    className={`text-xs font-bold px-3 py-1 rounded border transition-colors ${
                                      user.is_active 
                                      ? 'text-red-600 border-red-200 hover:bg-red-50' 
                                      : 'text-green-600 border-green-200 hover:bg-green-50'
                                    }`}
                                  >
                                    {user.is_active ? 'BLOQUEAR' : 'ACTIVAR'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-slate-50 rounded-xl p-5 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <HiOutlineCube/> Módulos Activos
                  </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <ModuleSwitch label="Inventario" icon={<HiOutlineCube/>} active={company.modules?.inventory} color="blue" onClick={() => toggleModule(company.id, 'inventory', company.modules?.inventory)}/>
                  <ModuleSwitch label="Punto de Venta" icon={<HiOutlineCurrencyDollar/>} active={company.modules?.pos} color="green" onClick={() => toggleModule(company.id, 'pos', company.modules?.pos)}/>
                  <ModuleSwitch label="Taller" icon={<HiOutlineCog/>} active={company.modules?.work_orders} color="orange" onClick={() => toggleModule(company.id, 'work_orders', company.modules?.work_orders)}/>
                  <ModuleSwitch label="Finanzas" icon={<HiOutlineCurrencyDollar/>} active={company.modules?.expenses} color="purple" onClick={() => toggleModule(company.id, 'expenses', company.modules?.expenses)}/>
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModuleSwitch({ label, icon, active, color, onClick }) {
  const isActive = !!active;
  const colors = {
    blue:   isActive ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-400 hover:border-blue-300',
    green:  isActive ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-400 hover:border-green-300',
    orange: isActive ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-gray-200 text-gray-400 hover:border-orange-300',
    purple: isActive ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-200 text-gray-400 hover:border-purple-300',
  };

  return (
    <button onClick={onClick} className={`group flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 ${colors[color]}`}>
      <div className={`text-xl mb-1 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : ''}`}>{icon}</div>
      <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
    </button>
  );
}

export default SuperAdminPage;