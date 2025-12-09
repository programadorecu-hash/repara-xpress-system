import React, { useState, useEffect } from "react";
import { 
  HiOutlineTrash, 
  HiOutlineCash, 
  HiOutlineCreditCard, 
  HiOutlineLibrary, 
  HiOutlineTag,
  HiX,
  HiOutlinePlus
} from "react-icons/hi";

// Configuración: Colores serios pero distintivos para identificar rápido
const PAYMENT_METHODS_CONFIG = [
  { 
    id: "EFECTIVO", 
    label: "Efectivo", 
    icon: <HiOutlineCash className="w-8 h-8" />, 
    colorClass: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" 
  },
  { 
    id: "TRANSFERENCIA", 
    label: "Transferencia", 
    icon: <HiOutlineLibrary className="w-8 h-8" />, 
    colorClass: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" 
  },
  { 
    id: "TARJETA", 
    label: "Tarjeta", 
    icon: <HiOutlineCreditCard className="w-8 h-8" />, 
    colorClass: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" 
  },
  { 
    id: "OTRO", 
    label: "Otro", 
    icon: <HiOutlineTag className="w-8 h-8" />, 
    colorClass: "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100" 
  },
];

function PaymentModal({
  totalAmount,
  onClose,
  onSubmitSale,
  initialCustomerCI,
  initialCustomerName,
  initialCustomerPhone,
  initialCustomerAddress,
  initialCustomerEmail,
}) {
  const [payments, setPayments] = useState([
    { method: "EFECTIVO", amount: totalAmount, reference: "" }
  ]);
  
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cálculos
  const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const remaining = totalAmount - totalPaid;
  const change = remaining < 0 ? Math.abs(remaining) : 0;
  
  // Ajuste inicial si cambia el total (corrección de seguridad)
  useEffect(() => {
    if (payments.length === 1 && payments[0].method === "EFECTIVO" && payments[0].amount !== totalAmount) {
        setPayments([{ method: "EFECTIVO", amount: totalAmount, reference: "" }]);
    }
  }, [totalAmount]);

  const handleAddPaymentMethod = (methodId) => {
    // Si ya cubrimos el total, no agregamos más (salvo que sea para corregir)
    if (remaining <= 0 && methodId !== "EFECTIVO") return; 
    
    const amountToSuggest = remaining > 0 ? remaining : 0;
    setPayments([...payments, { method: methodId, amount: amountToSuggest, reference: "" }]);
  };

  const handleRemovePayment = (index) => {
    const newPayments = payments.filter((_, i) => i !== index);
    if (newPayments.length === 0) {
        // Siempre debe haber al menos uno, reseteamos a efectivo
        setPayments([{ method: "EFECTIVO", amount: 0, reference: "" }]);
    } else {
        setPayments(newPayments);
    }
  };

  const handlePaymentChange = (index, field, value) => {
    const newPayments = [...payments];
    newPayments[index] = { ...newPayments[index], [field]: value };
    
    if (field === 'method' && value === 'EFECTIVO') {
        newPayments[index].reference = '';
    }
    if (field === 'reference') {
        newPayments[index].reference = value.toUpperCase();
    }
    setPayments(newPayments);
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError("");
    
    // Tolerancia pequeña para errores de decimales
    if (remaining > 0.02) { 
        setError(`⚠️ Aún falta cobrar $${remaining.toFixed(2)}`);
        return;
    }
    if (!pin) {
        setError("🔒 Falta ingresar el PIN de seguridad.");
        return;
    }

    setIsSubmitting(true);

    const finalPayments = payments.map(p => ({...p}));
    // Ajustamos el efectivo si hay vuelto
    if (change > 0) {
        const cashIndex = finalPayments.findIndex(p => p.method === "EFECTIVO");
        if (cashIndex !== -1) {
            finalPayments[cashIndex].amount -= change;
        }
    }

    const saleData = {
      payment_method: "MIXTO", 
      payment_method_details: null,
      pin: pin,
      payments: finalPayments.map(p => ({
          method: p.method,
          amount: parseFloat(p.amount) || 0,
          reference: p.reference
      })),
      customer_ci: initialCustomerCI,
      customer_name: initialCustomerName,
      customer_phone: initialCustomerPhone,
      customer_address: initialCustomerAddress,
      customer_email: initialCustomerEmail,
    };

    try {
      await onSubmitSale(saleData);
      onClose();
    } catch (err) {
      setError(err.message || "Error al procesar la venta.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden">
        
        {/* --- ENCABEZADO --- */}
        <div className="bg-gray-100 px-6 py-4 flex justify-between items-center border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Finalizar Venta</h2>
            <p className="text-sm text-gray-600 font-medium mt-1">Cliente: {initialCustomerName || "Consumidor Final"}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition shadow-sm border border-gray-200">
            <HiX className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-white">
          
          {/* --- RESUMEN DE MONTOS (Grande y Claro) --- */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 bg-gray-50 p-4 rounded-lg border border-gray-200 text-center">
              <span className="block text-xs font-bold text-gray-500 uppercase">Total a Pagar</span>
              <span className="block text-3xl font-bold text-gray-800">${totalAmount.toFixed(2)}</span>
            </div>
            
            <div className={`flex-1 p-4 rounded-lg border text-center transition-colors ${remaining > 0.02 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
              <span className="block text-xs font-bold uppercase">{remaining > 0.02 ? 'Falta' : 'Cubierto'}</span>
              <span className="block text-3xl font-bold">${Math.max(0, remaining).toFixed(2)}</span>
            </div>

            <div className={`flex-1 p-4 rounded-lg border text-center ${change > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
              <span className="block text-xs font-bold uppercase">Vuelto</span>
              <span className="block text-3xl font-bold">${change.toFixed(2)}</span>
            </div>
          </div>

          {/* --- BOTONES DE "AGREGAR PAGO" (Grandes y fáciles de pulsar) --- */}
          <div className="mb-6">
            <p className="text-sm font-bold text-gray-700 mb-2">Selecciona Método de Pago:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {PAYMENT_METHODS_CONFIG.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleAddPaymentMethod(m.id)}
                  className={`flex flex-col items-center justify-center py-4 px-2 rounded-xl border-2 transition-all active:scale-95 shadow-sm ${m.colorClass}`}
                >
                  <div className="mb-1">{m.icon}</div>
                  <span className="text-xs font-bold uppercase">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* --- LISTA DE PAGOS (Inputs limpios y sin flechas) --- */}
          <div className="space-y-3 mb-6">
            <p className="text-sm font-bold text-gray-700">Detalle:</p>
            {payments.map((payment, index) => (
              <div key={index} className="flex flex-col sm:flex-row gap-3 items-center bg-white border border-gray-300 p-3 rounded-lg shadow-sm">
                
                {/* Selector de Método (Visible pero deshabilitado visualmente para que parezca etiqueta) */}
                <div className="w-full sm:w-1/3">
                  <select
                    value={payment.method}
                    onChange={(e) => handlePaymentChange(index, 'method', e.target.value)}
                    className="w-full p-2.5 bg-gray-100 border border-gray-300 rounded-lg text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {PAYMENT_METHODS_CONFIG.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                  </select>
                </div>

                {/* Input de Monto (SIN FLECHAS) */}
                <div className="w-full sm:w-1/3 relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">$</span>
                  {/* AQUÍ ESTÁ EL TRUCO: [appearance:textfield] quita flechas en Firefox, y los webkit en Chrome */}
                  <input
                    type="number"
                    step="0.01"
                    value={payment.amount}
                    onChange={(e) => handlePaymentChange(index, 'amount', e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-lg font-bold text-right text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0.00"
                    onFocus={(e) => e.target.select()}
                  />
                </div>

                {/* Referencia / Botón Borrar */}
                <div className="w-full sm:w-1/3 flex gap-2">
                    {payment.method !== "EFECTIVO" ? (
                        <input 
                            type="text"
                            value={payment.reference}
                            onChange={(e) => handlePaymentChange(index, 'reference', e.target.value)}
                            placeholder="N° REF / BANCO"
                            className="flex-1 p-2.5 border border-gray-300 rounded-lg text-sm uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    ) : (
                        <div className="flex-1"></div> // Espaciador si es efectivo
                    )}

                    {/* Botón de borrar (solo si hay más de 1 o si se quiere limpiar) */}
                    <button 
                      type="button"
                      onClick={() => handleRemovePayment(index)} 
                      className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-200 rounded-lg transition"
                      title="Quitar este pago"
                    >
                      <HiOutlineTrash className="w-6 h-6" />
                    </button>
                </div>
              </div>
            ))}
          </div>

          {/* Mensajes de Error */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded">
              <p className="font-bold">Error:</p>
              <p>{error}</p>
            </div>
          )}

        </div>

        {/* --- FOOTER (PIN Y CONFIRMAR) --- */}
        <div className="bg-gray-50 p-6 border-t border-gray-200">
          <form onSubmit={handleConfirm} className="flex flex-col md:flex-row gap-4">
            
            <div className="w-full md:w-1/3">
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full h-14 text-center border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-0 text-2xl tracking-[0.5em] font-bold placeholder-gray-300 transition-colors"
                maxLength={4}
                placeholder="PIN"
                required
              />
              <p className="text-xs text-gray-400 text-center mt-1">Ingresa tu PIN de 4 dígitos</p>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting || remaining > 0.02} 
              className={`flex-1 h-14 rounded-xl font-bold text-xl text-white shadow-lg transition-all
                ${isSubmitting || remaining > 0.02 
                  ? 'bg-gray-400 cursor-not-allowed shadow-none' 
                  : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 hover:shadow-xl active:scale-95'
                }`}
            >
              {isSubmitting ? "Procesando..." : "CONFIRMAR VENTA 🚀"}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

export default PaymentModal;