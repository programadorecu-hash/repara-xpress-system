// frontend/src/components/ExpenseModal.jsx
// Este es nuestro nuevo componente "Vale de Gasto" (el formulario emergente)

import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import api from '../services/api.js';
import { createCashTransaction } from '../services/cash.js';
import ModalForm from './ModalForm.jsx'; // Usamos el mismo estilo de modal

// El formulario empieza vacío
const emptyForm = {
  amount: '',
  description: '',
  pin: '',
};

function ExpenseModal({ isOpen, onClose, onExpenseSaved }) {
  // Usamos el "Contexto" para saber quién está conectado (user)
  // y en qué sucursal está (activeShift)
  const { user, activeShift } = useContext(AuthContext); 
  const [formState, setFormState] = useState(emptyForm);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Esta función se llama cuando el usuario escribe en el formulario
  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Esta es la función principal que se ejecuta al presionar "Guardar Gasto"
  const handleSubmitExpense = async () => {
    setError('');
    setIsSubmitting(true);

    // 1. Revisiones simples para que el formulario esté lleno
    const parsedAmount = parseFloat(formState.amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('El monto debe ser un número positivo (mayor que cero).');
      setIsSubmitting(false);
      return;
    }
    if (!formState.description.trim()) {
      setError('La descripción es obligatoria.');
      setIsSubmitting(false);
      return;
    }
    if (!formState.pin.trim()) {
      setError('Ingresa tu PIN de seguridad.');
      setIsSubmitting(false);
      return;
    }
    // Revisamos si el empleado tiene un turno activo
    if (!activeShift?.location?.id) {
      setError('No tienes un turno activo. No se puede registrar el gasto.');
      setIsSubmitting(false);
      return;
    }

    try {
      // 2. Esta es la "magia": Buscamos las cajas de la sucursal actual
      // (Usamos la "llave" que vimos en CashAccountsPage.jsx)
      const response = await api.get(`/locations/${activeShift.location.id}/cash-accounts/`);
      const accounts = response.data; // La lista de cajas de esta sucursal

      // 3. Buscamos la "Caja Chica"
      let targetAccount = accounts.find(acc => acc.account_type === 'CAJA_CHICA');
      let accountIdToUse = targetAccount?.id;

      // 4. Si NO hay "Caja Chica" (esta es tu pregunta)
      if (!targetAccount) {
        // Buscamos la "Caja Ventas" como plan B
        const ventasAccount = accounts.find(acc => acc.account_type === 'CAJA_VENTAS');
        
        if (ventasAccount) {
          // Si la encontramos, preguntamos al usuario
          const userConfirmed = window.confirm(
            "No se encontró una 'Caja Chica' para esta sucursal.\n\n¿Deseas que este gasto se descuente de la 'Caja de Ventas' principal?"
          );

          if (userConfirmed) {
            // El usuario dijo "Sí", usaremos la caja de ventas
            accountIdToUse = ventasAccount.id;
          } else {
            // El usuario dijo "No"
            // Verificamos si es admin para darle un consejo extra
            if (user?.role === 'admin') {
              window.alert("Acción cancelada. Como administrador, puedes ir al módulo 'Caja' y crear una nueva cuenta de tipo 'Caja chica' para esta sucursal.");
            } else {
              window.alert("Acción cancelada. Pide a un administrador que configure una 'Caja Chica' para esta sucursal.");
            }
            setError('Acción cancelada por el usuario.');
            setIsSubmitting(false);
            return; // Detenemos todo
          }
        } else {
          // No hay ni "Caja Chica" NI "Caja Ventas"
          setError("Error: No se encontró NI 'Caja Chica' NI 'Caja Ventas' en esta sucursal. No se puede registrar el gasto.");
          setIsSubmitting(false);
          return; // Detenemos todo
        }
      }
      
      // 5. Si llegamos aquí, es porque SÍ tenemos una caja (accountIdToUse)
      // Preparamos el "vale" para enviarlo
      const payload = {
        // Convertimos el monto a NEGATIVO porque es un gasto (una salida de dinero)
        amount: parsedAmount * -1, 
        description: formState.description.trim(),
        account_id: accountIdToUse, // Usamos la caja que encontramos (Chica o Ventas)
        pin: formState.pin,
      };

      // 6. Enviamos el vale al sistema (usando la función de cash.js)
      await createCashTransaction(payload);

      // ¡Éxito!
      
      // --- ESTE ES EL CAMBIO ---
      // 7. Usamos el "walkie-talkie" para avisarle al Dashboard que actualice
      if (onExpenseSaved) {
        onExpenseSaved();
      }
      // --- FIN DEL CAMBIO ---

      alert(`¡Gasto de $${parsedAmount.toFixed(2)} registrado con éxito!`);
      setFormState(emptyForm); // Limpiamos el formulario
      
      // onClose(); // <-- ¡BORRAMOS ESTA LÍNEA! El Dashboard se encarga de cerrar.

    } catch (err) {
      // Si el PIN es incorrecto o algo falla, mostramos el error
      const detail = err.response?.data?.detail;
      setError(detail || 'No se pudo registrar el gasto.');
    } finally {
      setIsSubmitting(false); // Reactivamos el botón
    }
  };

  // Esto define cómo se ve el formulario
  return (
    <ModalForm
      title="Registrar un Gasto (Egreso)"
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmitExpense} // Llama a nuestra función inteligente al guardar
      submitLabel="Guardar Gasto"
      isSubmitting={isSubmitting}
      footer="El monto se descontará de la 'Caja Chica' de tu sucursal."
    >
      {/* Mostramos errores aquí si algo falla */}
      {error && (
        <div className="p-3 rounded-lg bg-red-100 text-red-700 mb-4">
          {error}
        </div>
      )}

      {/* Los campos del formulario */}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700">Monto del Gasto *</label>
          <input
            type="number"
            step="0.01"
            name="amount"
            value={formState.amount}
            onChange={handleFormChange}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Ej: 5.00"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700">Descripción del Gasto *</label>
          <textarea
            name="description"
            rows={3}
            value={formState.description}
            onChange={handleFormChange}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Ej: Compra de botella de agua, pago de taxi, etc."
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700">Tu PIN de seguridad *</label>
          <input
            type="password"
            name="pin"
            value={formState.pin}
            onChange={handleFormChange}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            maxLength="4"
            required
          />
        </div>
      </div>
    </ModalForm>
  );
}

export default ExpenseModal;