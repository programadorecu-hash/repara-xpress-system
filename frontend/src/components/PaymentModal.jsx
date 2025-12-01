import React, { useState, useEffect } from "react";

// Lista de métodos de pago (podríamos obtenerla de la API en el futuro)
const PAYMENT_METHODS = ["Efectivo", "Tarjeta", "Transferencia", "Otro"];

function PaymentModal({
  totalAmount,
  subtotalAmount = 0,
  ivaPercentage = 15,
  ivaAmount = 0,
  cartItems,
  onClose,
  onSubmitSale,
  initialCustomerCI,
  initialCustomerName,
  initialCustomerPhone,
  initialCustomerAddress,
  initialCustomerEmail,
}) {
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]); // Inicia con Efectivo
  const [amountReceived, setAmountReceived] = useState(""); // Dinero recibido (para efectivo)
  const [reference, setReference] = useState(""); // Referencia (para otros métodos)
  const [pin, setPin] = useState(""); // PIN del vendedor
  const [change, setChange] = useState(0); // Vuelto (calculado)
  const [error, setError] = useState(""); // Mensajes de error
  const [isSubmitting, setIsSubmitting] = useState(false); // Para deshabilitar botón

  // Calcula el vuelto cuando cambia el monto recibido o el total (si es efectivo)
  useEffect(() => {
    if (paymentMethod === "Efectivo") {
      const received = parseFloat(amountReceived) || 0;
      const calculatedChange = received - totalAmount;
      setChange(calculatedChange >= 0 ? calculatedChange : 0); // Muestra 0 si no alcanza
    } else {
      setChange(0); // No hay vuelto para otros métodos
    }
  }, [amountReceived, totalAmount, paymentMethod]);

  // Función que se llamará al confirmar el pago
  const handleConfirmPayment = async (e) => {
    e.preventDefault(); // Evita que el formulario recargue la página
    setError("");
    setIsSubmitting(true);

    // Validaciones básicas
    if (
      paymentMethod === "Efectivo" &&
      (parseFloat(amountReceived) || 0) < totalAmount
    ) {
      setError("El monto recibido es menor que el total.");
      setIsSubmitting(false);
      return;
    }
    if (!pin) {
      setError("Debes ingresar tu PIN.");
      setIsSubmitting(false);
      return;
    }

    // Prepara los datos para enviar al backend
    const saleData = {
      payment_method: paymentMethod.toUpperCase().replace(/\s+/g, "_"),
      payment_method_details:
        paymentMethod !== "Efectivo" ? { reference: reference } : null,
      pin: pin,
      items: cartItems,
      work_order_id:
        cartItems.find((item) => item.work_order_id)?.work_order_id || null,
      iva_percentage: ivaPercentage,
      // --- CORRECCIÓN AQUÍ ---
      // Asegúrate que los nombres a la DERECHA coincidan con los de la definición de la función
      customer_ci: initialCustomerCI, // Correcto si la prop se llama initialCustomerCI
      customer_name: initialCustomerName, // Correcto si la prop se llama initialCustomerName
      customer_phone: initialCustomerPhone, // Correcto si la prop se llama initialCustomerPhone
      customer_address: initialCustomerAddress, // Correcto si la prop se llama initialCustomerAddress
      customer_email: initialCustomerEmail, // Correcto si la prop se llama initialCustomerEmail
      // --- FIN CORRECCIÓN ---
    };

    try {
      // Llama a la función que nos pasaron desde POSPage para registrar la venta
      await onSubmitSale(saleData);
      // Si onSubmitSale no lanza error, asumimos éxito y cerramos
      onClose();
    } catch (submissionError) {
      setError(submissionError.message || "Error al registrar la venta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // Fondo oscuro semitransparente
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
      {/* Contenedor del modal */}
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md text-gray-800">
        <h2 className="text-2xl font-bold text-onSurface mb-4 text-center">
          Confirmar Pago
        </h2>

        {/* Total a Pagar */}
        <div className="bg-gray-100 p-4 rounded-lg mb-4 text-center space-y-1">
          <p className="text-xs uppercase tracking-wide text-gray-500">Resumen</p>
          <p className="text-sm text-gray-600">
            Subtotal: <span className="font-semibold text-onSurface">${subtotalAmount.toFixed(2)}</span>
          </p>
          <p className="text-sm text-gray-600">
            IVA ({ivaPercentage}%): <span className="font-semibold text-onSurface">${ivaAmount.toFixed(2)}</span>
          </p>
          <p className="text-lg font-bold text-gray-700">Total a Pagar</p>
          <p className="text-3xl font-bold text-brand">
            ${totalAmount.toFixed(2)}
          </p>
        </div>

        {/* Muestra errores aquí */}
        {error && (
          <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-sm">
            {error}
          </p>
        )}

        {/* Formulario de Pago */}
        <form onSubmit={handleConfirmPayment} className="space-y-4">
          {/* Método de Pago */}
          <div>
            <label className="font-semibold text-gray-600 block mb-1">
              Método de Pago
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full p-2 border rounded-lg bg-white"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          {/* Campos Condicionales */}
          {paymentMethod === "Efectivo" ? (
            // Si es Efectivo: Monto Recibido y Vuelto
            <>
              <div>
                <label
                  htmlFor="amountReceived"
                  className="font-semibold text-gray-600 block mb-1"
                >
                  Monto Recibido ($)
                </label>
                <input
                  id="amountReceived"
                  type="number"
                  step="0.01"
                  min={totalAmount.toFixed(2)} // Mínimo a recibir es el total
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                  required
                  placeholder={totalAmount.toFixed(2)} // Sugiere el monto exacto
                />
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Vuelto:</p>
                <p className="text-xl font-semibold text-green-600">
                  ${change.toFixed(2)}
                </p>
              </div>
            </>
          ) : (
            // Si NO es Efectivo: Campo de Referencia
            <div>
              <label
                htmlFor="reference"
                className="font-semibold text-gray-600 block mb-1"
              >
                Referencia (Opcional)
              </label>
              <input
                  id="reference"
                  type="text"
                  value={reference}
                  // Referencia en mayúsculas
                  onChange={(e) => setReference(e.target.value.toUpperCase())}
                  className="w-full p-2 border rounded-lg"
                placeholder="Ej: # Transf, Lote Tarjeta"
              />
            </div>
          )}

          {/* PIN del Vendedor */}
          <div>
            <label
              htmlFor="pin"
              className="font-semibold text-gray-600 block mb-1"
            >
              Tu PIN de Seguridad
            </label>
            <input
              id="pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full p-2 border rounded-lg"
              required
            />
          </div>

          {/* Botones de Acción */}
          <div className="mt-6 flex justify-between space-x-3">
            <button
              type="button" // Importante: type="button" para no enviar el form
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-gray-200 rounded-lg hover:bg-gray-300 transition duration-150"
              disabled={isSubmitting} // Deshabilitar si se está enviando
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-4 bg-brand text-white font-bold rounded-lg hover:bg-brand-deep transition duration-150 disabled:bg-gray-400"
              disabled={isSubmitting} // Deshabilitar si se está enviando
            >
              {isSubmitting ? "Procesando..." : "Confirmar Venta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PaymentModal;
