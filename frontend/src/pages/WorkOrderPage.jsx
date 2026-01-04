import React, { useState, useEffect, useContext } from "react";
import api, { getCompanySettings } from "../services/api"; // Importar getCompanySettings
import { AuthContext } from "../context/AuthContext";
import { HiOutlineChatAlt2 } from "react-icons/hi"; // Icono WhatsApp
// --- 1. IMPORTAMOS NUESTRO NUEVO FORMULARIO ---
import WorkOrderForm from "../components/WorkOrderForm.jsx";

import WorkOrderNotes from "../components/WorkOrderNotes.jsx"; // Panel de notas internas

// --- Diccionario de Estados Bonitos ---
const STATUS_LABELS = {
  RECIBIDO: "Recibido",
  EN_REVISION: "En Revisión",
  REPARANDO: "Reparando",
  LISTO: "Listo",
  ENTREGADO: "Entregado",
  SIN_REPARACION: "Sin Reparación"
};

function WorkOrderPage() {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user } = useContext(AuthContext);

  // --- 2. NUEVOS ESTADOS PARA MANEJAR EL FORMULARIO ---
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [notesOpenFor, setNotesOpenFor] = useState(null);
  
  // Estado para WhatsApp
  const [companyInfo, setCompanyInfo] = useState(null);

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
    // Cargar config empresa
    getCompanySettings().then(setCompanyInfo).catch(console.error);
  }, []);

  const formatDate = (dateString) => {
    const options = { year: "numeric", month: "short", day: "numeric" };
    return new Date(dateString).toLocaleDateString("es-EC", options);
  };

  const groupOrdersByLocation = (orders) => {
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
    if (savedOrder && !selectedOrderId) {
      setSelectedOrderId(savedOrder.id);
    }
    fetchWorkOrders();
  };

  // --- 4. FUNCIÓN PARA EL CAMBIO RÁPIDO DE ESTADO ---
  const handleStatusChange = async (orderId, newStatus) => {
    try {
      // Llamada directa a la API para actualizar solo el estado
      await api.patch(`/work-orders/${orderId}`, { status: newStatus });
      // Recargamos la lista silenciosamente para reflejar cambios
      fetchWorkOrders();
    } catch (error) {
      alert("Error al cambiar estado: " + (error.response?.data?.detail || error.message));
    }
  };

  if (loading && workOrders.length === 0)
    return (
      <p className="text-center text-gray-500 animate-pulse mt-10">
        Cargando órdenes de trabajo...
      </p>
    );
  if (error) return <p className="text-center text-red-500 mt-10">{error}</p>;

  return (
    <>
      <div className="bg-white p-6 rounded-xl shadow-md border text-secondary">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Gestión de Órdenes de Trabajo</h1>
          {/* El botón ahora abre el formulario de creación */}
          <button
            onClick={handleOpenCreateForm}
            className="bg-brand text-white font-bold py-2 px-4 rounded-lg shadow hover:bg-indigo-900 transition-colors"
          >
            + Nueva Orden
          </button>
        </div>

        {isManager ? (
          <div className="space-y-8">
            {groupedOrders &&
              Object.keys(groupedOrders).map((locationName) => (
                <div key={locationName}>
                  <h2 className="text-xl font-semibold mb-3 border-b pb-2 text-gray-700">
                    {locationName}
                  </h2>
                  <WorkOrderTable
                    orders={groupedOrders[locationName]}
                    formatDate={formatDate}
                    onEdit={handleOpenEditForm}
                    notesOpenFor={notesOpenFor}
                    setNotesOpenFor={setNotesOpenFor}
                    onStatusChange={handleStatusChange}
                    companyInfo={companyInfo} // <--- NUEVO
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
            onStatusChange={handleStatusChange} // Pasamos la función nueva
            companyInfo={companyInfo} //
          />
        )}
      </div>

      {/* --- RENDERIZADO DEL FORMULARIO MODAL --- */}
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

// Actualizamos la tabla para incluir el selector de estado
const WorkOrderTable = ({
  orders,
  formatDate,
  onEdit,
  notesOpenFor,
  setNotesOpenFor,
  onStatusChange,
  companyInfo // <--- Recibimos
}) => {
  // Función interna para WhatsApp (Lógica Anti-Spam y Universal)
  const handleWhatsApp = (order) => {
    if (!order.customer_phone) return alert("Sin teléfono");
    
    let phone = order.customer_phone.trim().replace(/\s+/g, '');
    const countryCode = companyInfo?.whatsapp_country_code || "+593";
    
    if (phone.startsWith("0")) phone = countryCode + phone.substring(1);
    else if (!phone.startsWith("+")) phone = countryCode + phone;

    // 1. Mensaje Base (Información del Estado)
    const statusText = STATUS_LABELS[order.status] || order.status;
    const baseMsg = companyInfo?.whatsapp_default_message || "Hola, actualizamos el estado de su equipo.";
    
    let message = `${baseMsg}
Orden: #${order.work_order_number}
Equipo: ${order.device_brand} ${order.device_model}
Estado Actual: *${statusText}*`;

    // 2. LÓGICA ANTI-SPAM: Solo adjuntar el enlace si el estado es 'RECIBIDO'
    if (order.status === 'RECIBIDO') {
        let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        if (API_URL.startsWith('/')) {
          API_URL = window.location.origin + API_URL;
        }
        // Usamos el ID público (que el backend ya habrá reparado si faltaba)
        const pId = order.public_id || 'consultar-taller';
        const publicLink = `${API_URL}/public/view/work-order/${pId}`;

        message += `

Para su respaldo, puede descargar su orden aquí:
${publicLink}`;
    }

    message += `

Gracias por su confianza.`;

    // 3. ENLACE UNIVERSAL (wa.me)
    // Esto funciona mejor en Windows porque permite al navegador preguntar
    // "¿Abrir WhatsApp Desktop?" en lugar de forzar la versión Web o fallar.
    const whatsappUrl = `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
  };

  return (
  <div className="overflow-x-auto">
    {orders.length === 0 ? (
      <p className="text-center text-gray-400 py-4">
        No hay órdenes de trabajo para mostrar.
      </p>
    ) : (
      <table className="min-w-full bg-white text-sm">
        <thead className="bg-gray-100 text-gray-600 font-medium">
          <tr>
            <th className="py-3 px-4 text-left">N°</th>
            <th className="py-3 px-4 text-left">Cliente</th>
            <th className="py-3 px-4 text-left">Equipo</th>
            <th className="py-3 px-4 text-left">Fecha</th>
            <th className="py-3 px-4 text-left">Estado</th>
            <th className="py-3 px-4 text-center">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {orders.map((order) => (
            // Agrupamos las dos filas (la normal y la expandida de notas) en un único Fragment
            <React.Fragment key={order.id}>
              <tr className="hover:bg-gray-50 transition-colors">
                {/* N° Orden */}
                <td className="py-3 px-4 font-mono font-bold text-accent">
                  {order.work_order_number}
                </td>

                {/* Cliente + contacto */}
                <td className="py-3 px-4">
                  <div className="font-bold text-gray-800">
                    {order.customer_name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {order.customer_phone}
                  </div>
                </td>

                {/* Dispositivo */}
                <td className="py-3 px-4 text-gray-700">{`${order.device_brand} ${order.device_model}`}</td>

                {/* Fecha */}
                <td className="py-3 px-4 text-gray-500">{formatDate(order.created_at)}</td>

                {/* --- CAMBIO: Selector de Estado Rápido --- */}
                <td className="py-3 px-4">
                   <select
                      value={order.status}
                      onClick={(e) => e.stopPropagation()} // Para que no active otros clicks si los hubiera
                      onChange={(e) => onStatusChange(order.id, e.target.value)}
                      className={`
                        text-xs font-bold py-1 px-2 rounded-full cursor-pointer border-0 ring-1 ring-inset focus:ring-2 focus:ring-inset focus:ring-accent outline-none
                        ${order.status === 'LISTO' ? 'bg-green-100 text-green-700 ring-green-600/20' : ''}
                        ${order.status === 'RECIBIDO' ? 'bg-blue-100 text-blue-700 ring-blue-700/10' : ''}
                        ${order.status === 'REPARANDO' ? 'bg-yellow-100 text-yellow-800 ring-yellow-600/20' : ''}
                        ${order.status === 'EN_REVISION' ? 'bg-purple-100 text-purple-700 ring-purple-600/20' : ''}
                        ${order.status === 'SIN_REPARACION' ? 'bg-red-50 text-red-700 ring-red-600/10' : ''}
                        ${order.status === 'ENTREGADO' ? 'bg-gray-100 text-gray-600 ring-gray-500/10' : ''}
                      `}
                    >
                      {Object.keys(STATUS_LABELS).map((key) => (
                        <option key={key} value={key}>
                          {STATUS_LABELS[key]}
                        </option>
                      ))}
                    </select>
                </td>
                {/* ------------------------------------------ */}

                {/* Acciones */}
                <td className="py-3 px-4 text-center space-x-3">
                  {/* Botón Nuevo: Gasto Asociado */}
                  <button
                    onClick={() => {
                        // Aquí abriremos un modal de gastos especial.
                        // Por ahora, para no complicar más la respuesta, usamos un alert
                        // Pero el backend YA ESTÁ LISTO para recibir 'work_order_id' en el gasto.
                        alert("Funcionalidad pendiente de UI: Gasto en Orden #" + order.work_order_number);
                    }}
                    className="text-orange-500 hover:underline text-xs font-medium"
                  >
                    +Gasto
                  </button>

                  {/* Abrir/cerrar panel de notas para ESTA orden */}
                  <button
                    onClick={() =>
                      setNotesOpenFor(
                        notesOpenFor === order.id ? null : order.id
                      )
                    }
                    className="text-brand-deep hover:underline text-brand text-xs font-medium"
                  >
                    {notesOpenFor === order.id ? "Ocultar" : "Notas"}
                  </button>

                  {/* Botón WhatsApp */}
                  <button
                    onClick={() => handleWhatsApp(order)}
                    className="text-green-600 hover:text-green-800"
                    title="Notificar por WhatsApp"
                  >
                    <HiOutlineChatAlt2 className="w-5 h-5" />
                  </button>

                  {/* Ver/Editar (tu flujo existente) */}
                  <button
                    onClick={() => onEdit(order.id)}
                    className="text-blue-500 hover:underline text-brand-deep text-xs font-medium"
                  >
                    Ver/Editar
                  </button>
                </td>
              </tr>

              {/* Fila expandible de NOTAS (ocupa todo el ancho: colSpan debe igualar el # de columnas del thead) */}
              {notesOpenFor === order.id && (
                <tr className="bg-gray-50 border-b border-gray-200">
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
};

export default WorkOrderPage;