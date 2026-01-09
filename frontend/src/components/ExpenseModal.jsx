import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import api from '../services/api.js';
import ModalForm from './ModalForm.jsx';

// Estado inicial
const emptyForm = { amount: '', description: '', category_id: '', account_id: '', pin: '', work_order_id: '' };

// Aceptamos un nuevo prop: initialWorkOrderId (el ID de la orden si viene desde la tabla)
function ExpenseModal({ isOpen, onClose, onExpenseSaved, initialWorkOrderId }) {
  const { activeShift } = useContext(AuthContext); 
  const [formState, setFormState] = useState(emptyForm);
  const [categories, setCategories] = useState([]); 
  const [accounts, setAccounts] = useState([]); 
  // --- NUEVO: Lista de Órdenes Activas ---
  const [activeOrders, setActiveOrders] = useState([]); 
  
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && activeShift?.location?.id) {
      // 1. Cargar Categorías
      api.get('/expense-categories/').then(res => setCategories(res.data));
      
      // 2. Cargar Cajas
      api.get(`/locations/${activeShift.location.id}/cash-accounts/`)
         .then(res => {
             setAccounts(res.data);
             const defaultAcc = res.data.find(a => a.account_type === 'CAJA_CHICA') || res.data[0];
             if (defaultAcc) setFormState(prev => ({ ...prev, account_id: defaultAcc.id }));
         });

      // 3. --- NUEVO: Cargar Órdenes Activas (Para asociar gastos) ---
      // Traemos las que están en taller (RECIBIDO, REPARANDO, etc)
      api.get('/work-orders/', { params: { limit: 50 } }) // Traemos las últimas 50
          .then(res => {
              // Filtramos solo las que no se han entregado
              const orders = res.data.filter(o => o.status !== 'ENTREGADO' && o.status !== 'SIN_REPARACION');
              setActiveOrders(orders);
          })
          .catch(err => console.error("Error cargando órdenes", err));

      // 4. Si nos pasaron una orden específica (desde la tabla), la pre-seleccionamos
      if (initialWorkOrderId) {
        setFormState(prev => ({ ...prev, work_order_id: initialWorkOrderId }));
      }
    }
  }, [isOpen, activeShift, initialWorkOrderId]); // Añadimos initialWorkOrderId a las dependencias

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: name === 'description' ? value.toUpperCase() : value }));
  };

  const handleSubmit = async () => {
    setError(''); setIsSubmitting(true);
    
    if (!formState.account_id) { setError('Selecciona una cuenta de caja.'); setIsSubmitting(false); return; }
    
    try {
      const payload = {
        amount: parseFloat(formState.amount),
        description: formState.description.trim(),
        expense_date: new Date().toISOString(),
        category_id: parseInt(formState.category_id),
        location_id: activeShift.location.id,
        account_id: parseInt(formState.account_id),
        pin: formState.pin,
      };

      // Si seleccionó una orden, la añadimos al payload
      if (formState.work_order_id) {
          payload.work_order_id = parseInt(formState.work_order_id);
      }

      await api.post('/expenses/', payload);
      
      if (onExpenseSaved) onExpenseSaved();
      alert(`Gasto registrado correctamente.`);
      setFormState(emptyForm);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al registrar.');
    } finally { setIsSubmitting(false); }
  };

  return (
    <ModalForm title="Registrar Gasto / Costo" isOpen={isOpen} onClose={onClose} onSubmit={handleSubmit} submitLabel="Guardar" isSubmitting={isSubmitting}>
      {error && <div className="p-3 bg-red-100 text-red-700 rounded mb-4">{error}</div>}
      <div className="grid gap-4">
        
        {/* --- NUEVO: Selector de Orden de Trabajo --- */}
        <div className="bg-blue-50 p-2 rounded border border-blue-100">
            <label className="block text-xs font-bold text-blue-800 mb-1">¿Es un costo de una reparación? (Opcional)</label>
            <select 
                name="work_order_id" 
                value={formState.work_order_id} 
                onChange={handleFormChange} 
                className="w-full border p-1 rounded text-sm"
            >
                <option value="">-- No, es un gasto general --</option>
                {activeOrders.map(order => (
                    <option key={order.id} value={order.id}>
                        Orden #{order.work_order_number} - {order.customer_name} ({order.device_model})
                    </option>
                ))}
            </select>
        </div>
        {/* ------------------------------------------ */}

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-bold">Categoría *</label>
                <select name="category_id" value={formState.category_id} onChange={handleFormChange} className="w-full border p-2 rounded" required>
                    <option value="">-- Selecciona --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-bold">Cuenta Origen *</label>
                <select name="account_id" value={formState.account_id} onChange={handleFormChange} className="w-full border p-2 rounded" required>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-bold">Monto *</label><input type="number" step="0.01" name="amount" value={formState.amount} onChange={handleFormChange} className="w-full border p-2 rounded" required /></div>
            <div><label className="block text-sm font-bold">PIN *</label><input type="password" name="pin" value={formState.pin} onChange={handleFormChange} className="w-full border p-2 rounded text-center" required /></div>
        </div>
        <div><label className="block text-sm font-bold">Descripción *</label><textarea name="description" value={formState.description} onChange={handleFormChange} className="w-full border p-2 rounded uppercase" required /></div>
      </div>
    </ModalForm>
  );
}
export default ExpenseModal;