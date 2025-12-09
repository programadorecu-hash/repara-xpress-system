import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import api from '../services/api.js';
import { createCashTransaction } from '../services/cash.js';
import ModalForm from './ModalForm.jsx';

const emptyForm = {
  amount: '',
  description: '',
  pin: '',
  account_id: '' // Nuevo campo para elegir caja
};

function ExpenseModal({ isOpen, onClose, onExpenseSaved }) {
  const { user, activeShift } = useContext(AuthContext); 
  const [formState, setFormState] = useState(emptyForm);
  const [accounts, setAccounts] = useState([]); // Lista de cajas disponibles
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar cajas al abrir
  useEffect(() => {
    if (isOpen && activeShift?.location?.id) {
      api.get(`/locations/${activeShift.location.id}/cash-accounts/`)
        .then(res => {
            setAccounts(res.data);
            // Intentar seleccionar CAJA_CHICA por defecto, si no, la primera
            const defaultAcc = res.data.find(a => a.account_type === 'CAJA_CHICA') || res.data[0];
            if (defaultAcc) {
                setFormState(prev => ({ ...prev, account_id: defaultAcc.id }));
            }
        })
        .catch(err => console.error("Error cargando cajas", err));
    }
  }, [isOpen, activeShift]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    // Si es descripción, mayúsculas
    const val = name === 'description' ? value.toUpperCase() : value;
    setFormState((prev) => ({ ...prev, [name]: val }));
  };

  const handleSubmitExpense = async () => {
    setError('');
    setIsSubmitting(true);

    const parsedAmount = parseFloat(formState.amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('El monto debe ser un número positivo.');
      setIsSubmitting(false); return;
    }
    if (!formState.account_id) {
      setError('Selecciona una cuenta de caja.');
      setIsSubmitting(false); return;
    }

    try {
      const payload = {
        amount: parsedAmount * -1, // Gasto es negativo
        description: formState.description.trim(),
        account_id: formState.account_id,
        pin: formState.pin,
      };

      await createCashTransaction(payload);
      
      if (onExpenseSaved) onExpenseSaved();
      
      alert(`¡Gasto de $${parsedAmount.toFixed(2)} registrado!`);
      setFormState(emptyForm);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || 'No se pudo registrar el gasto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalForm
      title="Registrar Gasto (Egreso)"
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmitExpense}
      submitLabel="Guardar Gasto"
      isSubmitting={isSubmitting}
    >
      {error && <div className="p-3 bg-red-100 text-red-700 rounded mb-4">{error}</div>}

      <div className="grid grid-cols-1 gap-4">
        {/* Selector de Caja */}
        <div>
            <label className="block text-sm font-bold text-gray-700">Cuenta de Origen *</label>
            <select
                name="account_id"
                value={formState.account_id}
                onChange={handleFormChange}
                className="w-full border p-2 rounded bg-white"
                required
            >
                {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.account_type.replace('_', ' ')})
                    </option>
                ))}
            </select>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700">Monto *</label>
          <input
            type="number" step="0.01" name="amount"
            value={formState.amount} onChange={handleFormChange}
            className="w-full border p-2 rounded" placeholder="Ej: 5.00" required
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700">Descripción *</label>
          <textarea
            name="description" rows={2}
            value={formState.description} onChange={handleFormChange}
            className="w-full border p-2 rounded uppercase" placeholder="EJ: TAXI, ALMUERZO" required
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700">PIN *</label>
          <input
            type="password" name="pin"
            value={formState.pin} onChange={handleFormChange}
            className="w-full border p-2 rounded" required
          />
        </div>
      </div>
    </ModalForm>
  );
}

export default ExpenseModal;