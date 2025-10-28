import React, { useState, useEffect, useContext } from "react";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
// --- 1. IMPORTAMOS NUESTRO NUEVO FORMULARIO ---
import WorkOrderForm from "../components/WorkOrderForm.jsx";

import WorkOrderNotes from "../components/WorkOrderNotes.jsx"; // Panel de notas internas

function WorkOrderPage() {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user } = useContext(AuthContext);

  // --- 2. NUEVOS ESTADOS PARA MANEJAR EL FORMULARIO ---
  // 'isFormOpen': Un interruptor para mostrar u ocultar el formulario.
  const [isFormOpen, setIsFormOpen] = useState(false);
  // 'selectedOrderId': Guarda el ID de la orden que queremos editar. Si es null, creamos una nueva.
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  // Controla qué orden tiene su panel de "Notas" abierto (id) o null si ninguna
  const [notesOpenFor, setNotesOpenFor] = useState(null);

  // Función para cargar o recargar la lista de órdenes.
  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get("/work-orders/");
      setWorkOrders(response.data);
    } catch (err) {
      setError("No se pudieron cargar las órdenes de trabajo.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const formatDate = (dateString) => {
    const options = { year: "numeric", month: "short", day: "numeric" };
    return new Date(dateString).toLocaleDateString("es-EC", options);
  };

  const groupOrdersByLocation = (orders) => {
    // ... (esta función no cambia)
    return orders.reduce((acc, order) => {
      const locationName = order.location.name;
      if (!acc[locationName]) {
        acc[locationName] = [];
      }
      acc[locationName].push(order);
      return acc;
    }, {});
  };

  const isManager =
    user?.role === "admin" || user?.role === "inventory_manager";
  const groupedOrders =
    isManager && workOrders.length > 0
      ? groupOrdersByLocation(workOrders)
      : null;

  // --- 3. FUNCIONES PARA CONTROLAR EL FORMULARIO ---
  const handleOpenCreateForm = () => {
    setSelectedOrderId(null); // No hay ID seleccionado, es para crear.
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (orderId) => {
    setSelectedOrderId(orderId); // Guardamos el ID de la orden a editar.
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedOrderId(null); // Limpiamos la selección al cerrar.
  };

  const handleSave = (savedOrder) => {
    // Si 'savedOrder' tiene datos (lo que sucede al crear una nueva orden)
    // y actualmente no tenemos ningún ID seleccionado, actualizamos el ID.
    if (savedOrder && !selectedOrderId) {
      setSelectedOrderId(savedOrder.id);
    }
    // Siempre refrescamos la lista principal.
    fetchWorkOrders();
  };

  if (loading && workOrders.length === 0)
    return (
      <p className="text-center text-gray-500">
        Cargando órdenes de trabajo...
      </p>
    );
  if (error) return <p className="text-center text-red-500">{error}</p>;

  return (
    <>
      <div className="bg-white p-6 rounded-xl shadow-md border text-secondary">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Gestión de Órdenes de Trabajo</h1>
          {/* El botón ahora abre el formulario de creación */}
          <button
            onClick={handleOpenCreateForm}
            className="bg-accent text-white font-bold py-2 px-4 rounded-lg"
          >
            + Nueva Orden
          </button>
        </div>

        {isManager ? (
          <div className="space-y-8">
            {groupedOrders &&
              Object.keys(groupedOrders).map((locationName) => (
                <div key={locationName}>
                  <h2 className="text-xl font-semibold mb-3 border-b pb-2">
                    {locationName}
                  </h2>
                  <WorkOrderTable
                    orders={groupedOrders[locationName]}
                    formatDate={formatDate}
                    onEdit={handleOpenEditForm}
                    notesOpenFor={notesOpenFor}
                    setNotesOpenFor={setNotesOpenFor}
                  />
                </div>
              ))}
          </div>
        ) : (
          <WorkOrderTable
            orders={workOrders}
            formatDate={formatDate}
            onEdit={handleOpenEditForm}
            notesOpenFor={notesOpenFor}
            setNotesOpenFor={setNotesOpenFor}
          />
        )}
      </div>

      {/* --- 4. RENDERIZADO DEL FORMULARIO MODAL --- */}
      {/* El formulario solo se mostrará si isFormOpen es true */}
      {isFormOpen && (
        <WorkOrderForm
          orderId={selectedOrderId}
          onClose={handleCloseForm}
          onSave={handleSave}
        />
      )}
    </>
  );
}

// Actualizamos la tabla para que pueda llamar a la función de editar
const WorkOrderTable = ({ orders, formatDate, onEdit, notesOpenFor, setNotesOpenFor }) => (
  <div className="overflow-x-auto">
    {orders.length === 0 ? (
      <p className="text-center text-gray-400 py-4">
        No hay órdenes de trabajo para mostrar.
      </p>
    ) : (
      <table className="min-w-full bg-white">
        <thead className="bg-gray-100">
          <tr>
            <th className="py-3 px-4 text-left">N° Orden</th>
            <th className="py-3 px-4 text-left">Cliente</th>
            <th className="py-3 px-4 text-left">Dispositivo</th>
            <th className="py-3 px-4 text-left">Fecha</th>
            <th className="py-3 px-4 text-left">Estado</th>
            <th className="py-3 px-4 text-center">Acciones</th>
          </tr>
        </thead>
        <tbody>
  {orders.map((order) => (
    // Agrupamos las dos filas (la normal y la expandida de notas) en un único Fragment
    <React.Fragment key={order.id}>
      <tr className="border-b hover:bg-gray-50">
        {/* N° Orden */}
        <td className="py-3 px-4 font-mono font-bold">
          {order.work_order_number}
        </td>

        {/* Cliente + contacto */}
        <td className="py-3 px-4">
          <div className="font-medium text-sm">{order.customer_name}</div>
          <div className="text-xs text-gray-500">{order.customer_phone}</div>
          {order.customer_email && (
            <div className="text-xs text-gray-500">{order.customer_email}</div>
          )}
          {order.customer_address && (
            <div className="text-xs text-gray-400">{order.customer_address}</div>
          )}
        </td>

        {/* Dispositivo */}
        <td className="py-3 px-4">{`${order.device_brand} ${order.device_model}`}</td>

        {/* Fecha */}
        <td className="py-3 px-4">{formatDate(order.created_at)}</td>

        {/* Estado */}
        <td className="py-3 px-4">
          <span
            className={`px-2 py-1 text-xs font-semibold rounded-full ${
              order.status === "RECIBIDO"
                ? "bg-blue-200 text-blue-800"
                : order.status === "LISTO"
                ? "bg-green-200 text-green-800"
                : order.status === "ENTREGADO"
                ? "bg-gray-200 text-gray-800"
                : "bg-yellow-200 text-yellow-800"
            }`}
          >
            {order.status.replace("_", " ")}
          </span>
        </td>

        {/* Acciones */}
        <td className="py-3 px-4 text-center space-x-3">
          {/* Abrir/cerrar panel de notas para ESTA orden */}
          <button
            onClick={() =>
              setNotesOpenFor(notesOpenFor === order.id ? null : order.id)
            }
            className="text-purple-600 hover:underline"
          >
            {notesOpenFor === order.id ? "Ocultar notas" : "Notas"}
          </button>

          {/* Ver/Editar (tu flujo existente) */}
          <button
            onClick={() => onEdit(order.id)}
            className="text-blue-500 hover:underline"
          >
            Ver/Editar
          </button>
        </td>
      </tr>

      {/* Fila expandible de NOTAS (ocupa todo el ancho: colSpan debe igualar el # de columnas del thead) */}
      {notesOpenFor === order.id && (
        <tr className="bg-gray-50">
          <td colSpan={6} className="py-3 px-4">
            <WorkOrderNotes workOrderId={order.id} />
          </td>
        </tr>
      )}
    </React.Fragment>
  ))}
</tbody>

      </table>
    )}
  </div>
);

export default WorkOrderPage;
