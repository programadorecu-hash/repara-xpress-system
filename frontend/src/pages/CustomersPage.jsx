import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../services/api';
import ModalForm from '../components/ModalForm.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { 
  HiOutlineUserAdd, HiOutlineSearch, HiPencil, HiTrash, 
  HiOutlineOfficeBuilding, HiOutlineUser 
} from 'react-icons/hi';

const emptyForm = {
  name: '',
  id_card: '',
  phone: '',
  email: '',
  address: '',
  notes: ''
};

function CustomersPage() {
  const { user } = useContext(AuthContext);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchCustomers();
    }, 500); 
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = search ? { search } : {};
      const res = await api.get('/customers/', { params });
      setCustomers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE AGRUPACIÓN (LA AGENDA) ---
  const groupedCustomers = useMemo(() => {
    // 1. Agrupar por Sucursal
    const groups = {};
    
    customers.forEach(customer => {
      // Si no tiene location, lo ponemos en "General"
      const locName = customer.location ? customer.location.name : "Sin Sucursal Asignada";
      
      if (!groups[locName]) {
        groups[locName] = [];
      }
      groups[locName].push(customer);
    });

    // 2. Ordenar alfabéticamente dentro de cada grupo
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => a.name.localeCompare(b.name));
    });

    return groups;
  }, [customers]);
  // ----------------------------------------

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormState(emptyForm);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (customer) => {
    setEditingId(customer.id);
    setFormState({
      name: customer.name,
      id_card: customer.id_card,
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      notes: customer.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar cliente?")) return;
    try {
      await api.delete(`/customers/${id}`);
      fetchCustomers();
    } catch (err) {
      alert("No se puede eliminar (posiblemente tenga ventas).");
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...formState,
        name: formState.name.toUpperCase(),
        id_card: formState.id_card.toUpperCase(),
        address: formState.address.toUpperCase(),
        notes: formState.notes
      };

      if (editingId) {
        await api.put(`/customers/${editingId}`, payload);
      } else {
        await api.post('/customers/', payload);
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al guardar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    setFormState({ ...formState, [e.target.name]: e.target.value });
  };

  // Renderizado de una letra (A, B, C)
  const renderLetterHeader = (letter) => (
    <div className="flex items-center mt-4 mb-2">
      <div className="bg-gray-200 text-gray-600 font-bold w-8 h-8 flex items-center justify-center rounded-full text-sm">
        {letter}
      </div>
      <div className="h-px bg-gray-200 flex-1 ml-3"></div>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto min-h-screen">
      
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
            <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Directorio de Clientes</h1>
            <p className="text-sm text-gray-500 mt-1">Base de datos centralizada por sucursal</p>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="bg-gray-900 hover:bg-black text-white font-bold py-3 px-6 rounded-xl shadow-lg flex items-center gap-2 transition-transform transform active:scale-95"
        >
          <HiOutlineUserAdd className="w-5 h-5" /> Nuevo Cliente
        </button>
      </div>

      {/* Buscador */}
      <div className="mb-8 relative">
        <input 
          type="text"
          placeholder="🔍 Buscar por nombre, cédula o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-5 pr-4 py-4 rounded-2xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg transition"
        />
      </div>

      {/* LISTA AGRUPADA (AGENDA) */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">Cargando directorio...</div>
      ) : (
        <div className="space-y-10">
          {Object.keys(groupedCustomers).length === 0 ? (
             <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
               No hay clientes registrados.
             </div>
          ) : (
            Object.entries(groupedCustomers).map(([locationName, customersInLoc]) => (
              <div key={locationName} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                
                {/* Título de la Sucursal */}
                <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
                  <HiOutlineOfficeBuilding className="w-6 h-6 text-blue-600" />
                  <h2 className="text-xl font-bold text-gray-800">{locationName}</h2>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full ml-auto">
                    {customersInLoc.length} clientes
                  </span>
                </div>

                {/* Lista Alfabética */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {customersInLoc.map((customer, index) => {
                    // Lógica para mostrar la letra A, B, C solo cuando cambia
                    const currentLetter = customer.name.charAt(0).toUpperCase();
                    const prevLetter = index > 0 ? customersInLoc[index - 1].name.charAt(0).toUpperCase() : null;
                    const showHeader = currentLetter !== prevLetter;

                    return (
                      <React.Fragment key={customer.id}>
                        {showHeader && (
                           <div className="col-span-full text-xs font-bold text-gray-400 mt-2 mb-1 pl-1">
                             {currentLetter}
                           </div>
                        )}
                        
                        {/* Tarjeta de Cliente */}
                        <div className="group relative bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 p-4 rounded-xl transition-all">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-bold text-gray-900 truncate pr-6">{customer.name}</h3>
                              <p className="text-xs font-mono text-gray-500 mt-0.5">{customer.id_card}</p>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 absolute top-3 right-3 bg-white/80 backdrop-blur rounded-lg p-1 shadow-sm">
                               <button onClick={() => handleOpenEdit(customer)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded">
                                 <HiPencil className="w-4 h-4" />
                               </button>
                               {user?.role === 'admin' && (
                                 <button onClick={() => handleDelete(customer.id)} className="p-1.5 text-red-500 hover:bg-red-100 rounded">
                                   <HiTrash className="w-4 h-4" />
                                 </button>
                               )}
                            </div>
                          </div>
                          
                          <div className="mt-3 space-y-1 text-sm text-gray-600">
                            {customer.phone && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">📱</span> {customer.phone}
                              </div>
                            )}
                            {customer.email && (
                              <div className="flex items-center gap-2 truncate" title={customer.email}>
                                <span className="text-xs text-gray-400">✉️</span> {customer.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal Crear/Editar (Igual que antes) */}
      <ModalForm
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? "Editar Ficha" : "Nuevo Cliente"}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitLabel="Guardar"
      >
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cédula / RUC *</label>
            <input name="id_card" value={formState.id_card} onChange={handleChange} className="w-full border p-3 rounded-lg bg-gray-50 focus:bg-white transition uppercase font-mono" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Completo *</label>
            <input name="name" value={formState.name} onChange={handleChange} className="w-full border p-3 rounded-lg bg-gray-50 focus:bg-white transition uppercase" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Teléfono</label>
                <input name="phone" value={formState.phone} onChange={handleChange} className="w-full border p-3 rounded-lg bg-gray-50 focus:bg-white transition" />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                <input type="email" name="email" value={formState.email} onChange={handleChange} className="w-full border p-3 rounded-lg bg-gray-50 focus:bg-white transition" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dirección</label>
            <input name="address" value={formState.address} onChange={handleChange} className="w-full border p-3 rounded-lg bg-gray-50 focus:bg-white transition uppercase" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notas</label>
            <textarea name="notes" value={formState.notes} onChange={handleChange} rows="2" className="w-full border p-3 rounded-lg bg-gray-50 focus:bg-white transition" />
          </div>
        </div>
      </ModalForm>
    </div>
  );
}

export default CustomersPage;