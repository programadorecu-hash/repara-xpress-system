import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { 
  HiCurrencyDollar, HiTag, HiTrash, 
  HiPlus, HiOutlineCollection, HiOutlineOfficeBuilding
} from 'react-icons/hi';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ExpensesPage = () => {
  const { token, user, activeShift } = useContext(AuthContext);
  
  // Estados Generales
  const [activeTab, setActiveTab] = useState('expenses'); 
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]); // Para el selector de sucursales (Admin)
  
  // Estados para Gastos
  const [expenses, setExpenses] = useState([]);
  const [accounts, setAccounts] = useState([]); // <--- NUEVO: Cuentas disponibles
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(''); // <--- NUEVO: Cuenta elegida
  const [selectedLocation, setSelectedLocation] = useState(''); // Sucursal elegida para el gasto
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [pin, setPin] = useState('');
  
  // Filtros
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Estados para Categorías
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (token) { // Solo si hay token para evitar llamadas fallidas
        fetchCategories();
        fetchExpenses();
        if (isAdmin) fetchLocations();
        
        // --- CAMBIO: Forzamos la carga inicial de cuentas ---
        fetchAccounts(); 
        // ---------------------------------------------------
    }
  }, [token, startDate, endDate]);

  // Nuevo efecto para recargar cuentas si cambia la sucursal elegida
  useEffect(() => {
      fetchAccounts();
  }, [selectedLocation]);

  // --- API CALLS ---
  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API_URL}/expense-categories/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCategories(res.data);
    } catch (error) {
      console.error("Error cargando categorías", error);
    }
  };

  // --- FUNCIÓN CORREGIDA: Carga inteligente de cuentas ---
  const fetchAccounts = async () => {
    try {
        // 1. Decidir qué ID de sucursal usar
        let locationId = selectedLocation;

        // 2. Si no seleccionaste nada manualmente, miramos tu credencial (Turno Activo)
        // Usamos 'activeShift' que ya viene del contexto, sin hacer llamadas lentas a la API
        if (!locationId && activeShift) {
            // Intentamos obtener el ID de forma segura (soporta ambas estructuras de datos)
            locationId = activeShift.location_id || activeShift.location?.id;
            
            // Si eres Admin, actualizamos el selector visual para que sepas dónde estás parado
            if (isAdmin && locationId) {
                setSelectedLocation(locationId); 
            }
        }

        // Si después de todo no hay ubicación (ej. Admin sin turno y sin selección), limpiamos
        if (!locationId) {
            setAccounts([]);
            setSelectedAccount('');
            return;
        }

        // 3. Cargar las cuentas de esa sucursal
        const res = await axios.get(`${API_URL}/locations/${locationId}/cash-accounts/`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        let loadedAccounts = res.data;
        
        // 4. Si no es Admin, ocultamos los BANCOS para simplificar la vista
        if (!isAdmin) {
            loadedAccounts = loadedAccounts.filter(acc => acc.account_type !== 'BANCO');
        }
        
        setAccounts(loadedAccounts);
        
        // 5. Auto-seleccionar la CAJA CHICA automáticamente
        const defaultAcc = loadedAccounts.find(a => a.account_type === 'CAJA_CHICA') || loadedAccounts[0];
        if (defaultAcc) setSelectedAccount(defaultAcc.id);
        
    } catch (error) {
        console.error("Error cargando cuentas", error);
    }
  };
  // --------------------

  const fetchLocations = async () => {
    try {
      const res = await axios.get(`${API_URL}/locations/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLocations(res.data);
    } catch (error) {
      console.error("Error cargando sucursales", error);
    }
  };

  const fetchExpenses = async () => {
    try {
      let url = `${API_URL}/expenses/?limit=100`;
      if (startDate) url += `&start_date=${startDate}`;
      if (endDate) url += `&end_date=${endDate}`;
      
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExpenses(res.data);
    } catch (error) {
      console.error("Error cargando gastos", error);
    }
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    if (!amount || !description || !selectedCategory || !pin) {
      toast.warning("Completa todos los campos obligatorios.");
      return;
    }

    try {
      // Lógica de Sucursal:
      // 1. Si eligió una en el selector (Admin), usamos esa.
      // 2. Si no, intentamos usar la del turno activo.
      let locationIdToUse = selectedLocation;

      if (!locationIdToUse) {
         const profileRes = await axios.get(`${API_URL}/users/me/profile`, {
             headers: { Authorization: `Bearer ${token}` }
         });
         const activeShift = profileRes.data.active_shift;
         if (activeShift) {
             locationIdToUse = activeShift.location_id;
         }
      }

      if (!locationIdToUse) {
        toast.error("Debes seleccionar una sucursal o tener un turno activo.");
        return;
      }

      await axios.post(`${API_URL}/expenses/`, {
        amount: parseFloat(amount),
        description,
        expense_date: new Date(expenseDate).toISOString(),
        category_id: parseInt(selectedCategory),
        location_id: parseInt(locationIdToUse),
        account_id: parseInt(selectedAccount), // <--- NUEVO
        pin
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success("Gasto registrado correctamente");
      // Limpiar formulario
      setAmount('');
      setDescription('');
      setPin('');
      // No limpiamos fecha ni sucursal para facilitar registros masivos
      fetchExpenses(); 
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al registrar gasto");
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar este gasto?")) return;
    try {
      await axios.delete(`${API_URL}/expenses/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Gasto eliminado");
      fetchExpenses();
    } catch (error) {
      toast.error("Error al eliminar gasto");
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName) return;
    try {
      await axios.post(`${API_URL}/expense-categories/`, {
        name: newCategoryName,
        description: newCategoryDesc
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Categoría creada");
      setNewCategoryName('');
      setNewCategoryDesc('');
      fetchCategories();
    } catch (error) {
      toast.error("Error al crear categoría");
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm("¿Eliminar categoría?")) return;
    try {
      await axios.delete(`${API_URL}/expense-categories/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Categoría eliminada");
      fetchCategories();
    } catch (error) {
      toast.error("Error al eliminar categoría");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center">
          <HiCurrencyDollar className="mr-2 text-green-600" /> 
          Gastos y Costos
        </h1>
        
        <div className="bg-gray-200 p-1 rounded-lg flex space-x-2">
            <button onClick={() => setActiveTab('expenses')} className={`px-4 py-2 rounded-md font-medium transition-colors ${activeTab === 'expenses' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:bg-gray-300'}`}>
                Registro de Gastos
            </button>
            <button onClick={() => setActiveTab('categories')} className={`px-4 py-2 rounded-md font-medium transition-colors ${activeTab === 'categories' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:bg-gray-300'}`}>
                Categorías
            </button>
        </div>
      </div>

      {activeTab === 'expenses' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario */}
          <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg h-fit border border-gray-100">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Registrar Nuevo Gasto</h2>
            <form onSubmit={handleCreateExpense} className="space-y-4">
              
              {/* Selector de Sucursal (Solo Admin) */}
              {isAdmin && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal (Opcional)</label>
                    <div className="relative">
                        <select
                            className="w-full p-2 pl-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            value={selectedLocation}
                            onChange={(e) => setSelectedLocation(e.target.value)}
                        >
                            <option value="">-- Usar mi ubicación actual --</option>
                            {locations.map(loc => (
                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                            ))}
                        </select>
                        <HiOutlineOfficeBuilding className="absolute left-2.5 top-3 text-gray-400" />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Si lo dejas vacío, se usa la sucursal de tu turno activo.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto ($)</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input type="number" step="0.01" required className="pl-7 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea required className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Pago luz de Enero" rows="2" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <div className="relative">
                    <select required className="w-full p-2 pl-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                        <option value="">Selecciona una...</option>
                        {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <HiTag className="absolute left-2.5 top-3 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta Origen</label>
                <div className="relative">
                    <select required className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}>
                        {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                </div>
                <p className="text-xs text-gray-400 mt-1">El dinero se descontará de esta caja.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Contable</label>
                <input type="date" required className="w-full p-2 border border-gray-300 rounded-lg" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
              </div>

              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Firma (PIN)</label>
                <input type="password" required className="w-full p-2 border border-gray-300 rounded-lg text-center tracking-widest" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="****" autoComplete="off" />
              </div>

              <button type="submit" className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition-colors shadow-md flex justify-center items-center">
                <HiPlus className="mr-2" /> Guardar Gasto
              </button>
            </form>
          </div>

          {/* Tabla de Historial */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-4 rounded-xl shadow border border-gray-100 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Desde</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 border rounded-md text-sm" />
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Hasta</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 border rounded-md text-sm" />
                </div>
                <button onClick={() => {setStartDate(''); setEndDate('');}} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 text-sm font-medium">Limpiar</button>
            </div>

            <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-100">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Fecha</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Descripción</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Detalles</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Monto</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {expenses.length === 0 ? (
                            <tr><td colSpan="5" className="p-8 text-center text-gray-500">No hay gastos registrados en este periodo.</td></tr>
                        ) : (
                            expenses.map((expense) => (
                                <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 text-sm text-gray-600">{new Date(expense.expense_date).toLocaleDateString()}</td>
                                    <td className="p-4">
                                        <div className="text-sm font-medium text-gray-800">{expense.description}</div>
                                        <div className="text-xs text-gray-400">Reg. por: {expense.user?.email}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium w-fit">
                                                {expense.category?.name || "Sin Cat."}
                                            </span>
                                            <span className="text-xs text-gray-500 flex items-center">
                                                <HiOutlineOfficeBuilding className="mr-1"/> {expense.location?.name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right text-sm font-bold text-red-600">
                                        - ${expense.amount.toFixed(2)}
                                    </td>
                                    <td className="p-4 text-center">
                                        {isAdmin && (
                                            <button onClick={() => handleDeleteExpense(expense.id)} className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition" title="Eliminar Gasto">
                                                <HiTrash size={18} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                        <tr>
                            <td colSpan="3" className="p-4 text-right font-bold text-gray-700">Total Periodo:</td>
                            <td className="p-4 text-right font-bold text-red-600 text-lg">
                                ${expenses.reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <h2 className="text-lg font-semibold mb-4 text-gray-700 flex items-center"><HiOutlineCollection className="mr-2 text-blue-500" /> Crear Nueva Categoría</h2>
                <form onSubmit={handleCreateCategory} className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre</label>
                        <input type="text" required value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Ej: Servicios Básicos" className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500" />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descripción (Opcional)</label>
                        <input type="text" value={newCategoryDesc} onChange={(e) => setNewCategoryDesc(e.target.value)} placeholder="Ej: Luz, agua, internet..." className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500" />
                    </div>
                    <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors h-[42px]">Crear</button>
                </form>
            </div>
            <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-100">
                <div className="p-4 bg-gray-50 border-b border-gray-200"><h3 className="font-bold text-gray-700">Categorías Existentes</h3></div>
                <ul className="divide-y divide-gray-100">
                    {categories.map((cat) => (
                        <li key={cat.id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                            <div><p className="font-medium text-gray-800">{cat.name}</p><p className="text-sm text-gray-500">{cat.description}</p></div>
                            <button onClick={() => handleDeleteCategory(cat.id)} className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition"><HiTrash size={20} /></button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesPage;