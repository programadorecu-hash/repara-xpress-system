// 1. Importamos 'useMemo', que es nuestra "calculadora inteligente"
import React, { useState, useEffect, useContext, useMemo } from "react";
import api from "../services/api"; // El mensajero
import { AuthContext } from "../context/AuthContext"; // Para saber quién soy

// --- INICIO DE NUESTRO CÓDIGO ---
// Función para obtener la fecha de hoy en formato 'YYYY-MM-DD'
const getTodayString = () => {
  return new Date().toISOString().slice(0, 10);
};
// --- FIN DE NUESTRO CÓDIGO ---

// Esta es la nueva página (el "televisor")
function SalesHistoryPage() {
  const [sales, setSales] = useState([]); // El "historial"
  const [loading, setLoading] = useState(true); // Para el "Cargando..."
  const [error, setError] = useState("");
  const { user } = useContext(AuthContext); // Para permisos
  const [isPrintingId, setIsPrintingId] = useState(null);

  // --- INICIO: "Blocs de notas" para nuestro buscador ---
  const [startDate, setStartDate] = useState(getTodayString()); // Calendario Inicio (default HOY)
  const [endDate, setEndDate] = useState(getTodayString()); // Calendario Fin (default HOY)
  const [searchTerm, setSearchTerm] = useState(""); // Barra de búsqueda
  // --- FIN: "Blocs de notas" ---

  // --- INICIO DE NUESTROS CAMBIOS ---
  const [locations, setLocations] = useState([]); // Para la lista de sucursales
  const [selectedLocationId, setSelectedLocationId] = useState(""); // '' significa "Todas"

  // Verificamos si el usuario tiene permiso para ver el filtro
  const canSeeAllLocations =
    user?.role === "admin" || user?.role === "inventory_manager";
  // --- FIN DE NUESTROS CAMBIOS ---

  // --- INICIO: NUESTRA "CALCULADORA" ---
  // useMemo es un "calculador inteligente". Solo volverá a sumar
  // si la lista de 'sales' (ventas) cambia.
  const totalFilteredSales = useMemo(() => {
    // .reduce() es como usar una calculadora para sumar una lista de números
    // Empezamos en 0 (el '0' al final)
    // y por cada 'sale' (venta), sumamos su 'total_amount'
    return sales.reduce((total, sale) => total + sale.total_amount, 0);
  }, [sales]); // <-- Le decimos que solo recalcule si 'sales' cambia
  // --- FIN: NUESTRA "CALCULADORA" ---

  // --- INICIO: NUESTRO "CLASIFICADOR DE MONEDAS" (Calculadora de Desglose) ---
  const paymentMethodSummary = useMemo(() => {
    // 1. Creamos un "organizador" (un objeto) vacío
    const summary = {};

    // 2. Revisamos cada venta en la lista filtrada
    for (const sale of sales) {
      // 3. Obtenemos el método (Ej: "EFECTIVO") y el monto (Ej: 50)
      const method = sale.payment_method; // (Viene del backend)
      const amount = sale.total_amount;

      // 4. Si aún no tenemos un "montón" para este método, lo creamos
      if (!summary[method]) {
        summary[method] = 0;
      }

      // 5. Sumamos el monto al "montón" correcto
      summary[method] += amount;
    }

    // 6. Devolvemos el organizador con los montones sumados
    return summary; // (Quedará algo como: { "EFECTIVO": 50, "TRANSFERENCIA": 100 })
  }, [sales]); // <-- Le decimos que solo recalcule si 'sales' cambia
  // --- FIN: NUESTRO "CLASIFICADOR DE MONEDAS" ---

  // Esto se ejecuta cuando abres la página
  useEffect(() => {
    // Al cargar la página, busca automáticamente las ventas de "hoy"
    fetchSales();

    // --- INICIO DE NUESTROS CAMBIOS ---
    // 5. Si el usuario puede ver todas las sucursales, las cargamos
    if (canSeeAllLocations) {
      const fetchLocations = async () => {
        try {
          // Usamos el endpoint /locations/ que ya solo devuelve sucursales principales
          const response = await api.get("/locations/");
          setLocations(response.data);
        } catch (err) {
          console.error(
            "No se pudieron cargar las sucursales para el filtro",
            err
          );
        }
      };
      fetchLocations();
    }
    // --- FIN DE NUESTROS CAMBIOS ---
  }, [canSeeAllLocations]); // <--- ACTUALIZA LA DEPENDENCIA AQUÍ

  // Función para pedirle el historial al "servicio de cable" (el backend)
  const fetchSales = async () => {
    setLoading(true);
    setError(""); // Limpiamos errores viejos

    // --- INICIO: Preparamos los filtros para la "manguera" ---
    const params = {
      skip: 0,
      limit: 100, // Por ahora cargamos 100
    };

    // Solo añadimos los filtros si tienen un valor
    if (startDate) {
      params.start_date = startDate;
    }
    if (endDate) {
      params.end_date = endDate;
    }
    if (searchTerm) {
      params.search = searchTerm;
    }

    // --- INICIO DE NUESTROS CAMBIOS ---
    // 8. Añadimos el location_id a los parámetros SOLO si está seleccionado
    if (selectedLocationId) {
      params.location_id = selectedLocationId;
    }
    // --- FIN DE NUESTROS CAMBIOS ---

    // --- FIN: Preparamos los filtros ---

    try {
      // 1. Usamos la "manguera" /sales/ y le pasamos los filtros
      const response = await api.get("/sales/", { params: params });
      setSales(response.data); // 2. Guardamos los datos
    } catch (err) {
      setError("No se pudo cargar el historial de ventas.");
    } finally {
      setLoading(false);
    }
  };

  // --- INICIO: Función para el botón "Buscar" ---
  // Se llama cuando el usuario presiona "Buscar" en el formulario
  const handleSearchSubmit = (e) => {
    e.preventDefault(); // Evita que la página se recargue
    fetchSales(); // Llama a la función de búsqueda con los filtros actuales
  };
  // --- FIN: Función para el botón "Buscar" ---

  // Función simple para formatear la fecha
  const formatDate = (dateString) => {
    // Ajustamos la fecha para que se vea más limpia
    return new Date(dateString).toLocaleString("es-EC", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // --- INICIO: NUESTRO "AYUDANTE" PARA FORMAtear NOMBRES ---
  // Convierte "METODO_PAGO" en "Metodo pago"
  const formatPaymentMethod = (method) => {
    if (!method) return "Otro";

    // 1. Reemplaza guiones bajos (_) por espacios (ej: "TARJETA_CREDITO" -> "TARJETA CREDITO")
    let spacedMethod = method.replace("_", " ");

    // 2. Pone la primera letra en Mayúscula y el resto en minúscula
    //    (ej: "TARJETA CREDITO" -> "Tarjeta credito")
    let formatted =
      spacedMethod.charAt(0).toUpperCase() +
      spacedMethod.slice(1).toLowerCase();

    return formatted;
  };
  // --- FIN: NUESTRO "AYUDANTE" ---

  // Esta es la nueva función (CORREGIDA) para programar el botón "Ver Recibo"
  const handleViewReceipt = async (saleId) => {
    // ... (esta función no cambia, la dejamos como estaba)
    setIsPrintingId(saleId);
    setError("");
    try {
      const response = await api.get(`/sales/${saleId}/receipt`, {
        responseType: "blob",
      });
      const pdfBlob = new Blob([response.data], { type: "application/pdf" });
      const fileURL = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = fileURL;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(fileURL), 1000);
    } catch (err) {
      console.error("Error al generar PDF:", err);
      setError("No se pudo generar el recibo PDF. (Revisa la consola)");
    } finally {
      setIsPrintingId(null);
    }
  };

  // (El resto es la "carcasa" del televisor)
  return (
    <div className="bg-white p-6 rounded-xl shadow-md border space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">
            Historial de Ventas
          </h1>
          <p className="text-sm text-gray-500">
            Revisa todas las ventas completadas.
          </p>
        </div>
      </div>

      {/* --- INICIO DE NUESTROS CAMBIOS (Botones de Filtro) --- */}
      {/* 11. Solo mostramos estos botones si es admin o gerente */}
      {canSeeAllLocations && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-100 rounded-lg border">
          <span className="text-sm font-semibold mr-2 text-gray-800">
            Filtrar por Sucursal:
          </span>

          {/* Botón "Todas" */}
          <button
            onClick={() => setSelectedLocationId("")} // Vacío = Todas
            className={`py-1 px-3 rounded-full text-sm font-medium transition-all ${
              selectedLocationId === ""
                ? "bg-accent text-white shadow"
                : "bg-white text-gray-700 border hover:bg-gray-50"
            }`}
          >
            Todas
          </button>

          {/* Botones para cada sucursal */}
          {locations.map((loc) => (
            <button
              key={loc.id}
              onClick={() => setSelectedLocationId(loc.id)}
              className={`py-1 px-3 rounded-full text-sm font-medium transition-all ${
                selectedLocationId === loc.id
                  ? "bg-accent text-white shadow"
                  : "bg-white text-gray-700 border hover:bg-gray-50"
              }`}
            >
              {loc.name}
            </button>
          ))}
        </div>
      )}
      {/* --- FIN DE NUESTROS CAMBIOS --- */}

      {/* --- INICIO: NUESTRO "BUSCADOR INTELIGENTE" (Formulario) --- */}
      <form
        onSubmit={handleSearchSubmit}
        className="p-4 bg-gray-50 rounded-lg border flex flex-wrap items-end gap-4"
      >
        {/* Filtro Fecha Inicio */}
        <div>
          <label
            htmlFor="start_date"
            className="block text-sm font-medium text-gray-700"
          >
            Fecha Inicio
          </label>
          <input
            type="date"
            id="start_date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 p-2 border rounded-md w-full"
          />
        </div>

        {/* Filtro Fecha Fin */}
        <div>
          <label
            htmlFor="end_date"
            className="block text-sm font-medium text-gray-700"
          >
            Fecha Fin
          </label>
          <input
            type="date"
            id="end_date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 p-2 border rounded-md w-full"
          />
        </div>

        {/* Filtro Búsqueda por Texto */}
        <div className="flex-grow">
          <label
            htmlFor="search_term"
            className="block text-sm font-medium text-gray-700"
          >
            Buscar (Cliente / Cédula)
          </label>
          <input
            type="text"
            id="search_term"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Nombre o Cédula"
            className="mt-1 p-2 border rounded-md w-full"
          />
        </div>

        {/* Botón de Búsqueda */}
        <button
          type="submit"
          disabled={loading} // Desactivado mientras carga
          className="py-2 px-6 bg-accent text-white font-bold rounded-lg hover:bg-teal-600 disabled:bg-gray-400"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </form>
      {/* --- FIN: NUESTRO "BUSCADOR INTELIGENTE" --- */}

      {/* --- INICIO: CAJA DE RESUMEN (LA PANTALLA DE LA CALCULADORA) --- */}
      {/* 1. CAMBIAMOS A 3 COLUMNAS para que quepa la nueva caja */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Caja para el Total de Ventas */}
        <div className="bg-gray-100 p-4 rounded-lg border">
          <h3 className="text-sm font-semibold text-gray-600 uppercase">
            TOTAL DE VENTAS (FILTRADO)
          </h3>
          {/* Mostramos el total que calculamos, con 2 decimales */}
          <p className="text-3xl font-bold text-secondary">
            ${totalFilteredSales.toFixed(2)}
          </p>
        </div>

        {/* Caja para el Número de Ventas */}
        <div className="bg-gray-100 p-4 rounded-lg border">
          <h3 className="text-sm font-semibold text-gray-600 uppercase">
            N° DE VENTAS (FILTRADO)
          </h3>
          {/* Mostramos cuántas ventas hay en la lista */}
          <p className="text-3xl font-bold text-secondary">{sales.length}</p>
        </div>

        {/* --- INICIO: NUESTRA NUEVA CAJA DE DESGLOSE --- */}
        <div className="bg-gray-100 p-4 rounded-lg border">
          <h3 className="text-sm font-semibold text-gray-600 uppercase">
            DESGLOSE POR MÉTODO
          </h3>

          {/* Object.keys(objeto) nos da una lista de las "claves" (Ej: ["EFECTIVO", "TRANSFERENCIA"])
            Si la lista está vacía (length === 0), mostramos un guion.
          */}
          {Object.keys(paymentMethodSummary).length === 0 ? (
            <p className="text-xl font-bold text-gray-400">---</p>
          ) : (
            // Si hay datos, los recorremos y mostramos uno por uno
            <div className="space-y-1 mt-2">
              {Object.entries(paymentMethodSummary).map(([method, total]) => (
                <div
                  key={method}
                  className="flex justify-between items-baseline text-sm"
                >
                  {/* Usamos nuestro "ayudante" para limpiar el nombre */}
                  <span className="font-semibold text-gray-700">
                    {formatPaymentMethod(method)}:
                  </span>
                  <span className="font-bold text-secondary">
                    ${total.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* --- FIN: NUESTRA NUEVA CAJA DE DESGLOSE --- */}
      </div>
      {/* --- FIN: CAJA DE RESUMEN --- */}

      {error && (
        <div className="p-3 rounded-lg bg-red-100 text-red-700">{error}</div>
      )}

      {/* --- INICIO: La "Pantalla" (La tabla de datos) --- */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white text-secondary">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-3 px-4 text-left">ID Venta</th>
              <th className="py-3 px-4 text-left">Fecha</th>
              <th className="py-3 px-4 text-left">Cliente</th>
              <th className="py-3 px-4 text-left">Vendedor</th>
              <th className="py-3 px-4 text-right">Total</th>
              <th className="py-3 px-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="py-6 px-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            ) : sales.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-6 px-4 text-center text-gray-500">
                  No se encontraron ventas para los filtros seleccionados.
                </td>
              </tr>
            ) : (
              // Si hay ventas, las mostramos una por una
              sales.map((sale) => (
                <tr key={sale.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono font-bold">#{sale.id}</td>
                  <td className="py-3 px-4 text-sm">
                    {formatDate(sale.created_at)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-sm">
                      {sale.customer_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {sale.customer_ci}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm">{sale.user.email}</td>
                  <td className="py-3 px-4 text-right font-bold text-base">
                    ${sale.total_amount.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {/* Este es el botón "control remoto" */}
                    <button
                      onClick={() => handleViewReceipt(sale.id)}
                      disabled={isPrintingId === sale.id}
                      className="text-accent hover:underline disabled:text-gray-400 disabled:no-underline"
                    >
                      {isPrintingId === sale.id ? "Generando..." : "Ver Recibo"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* --- FIN: La "Pantalla" --- */}
    </div>
  );
}

export default SalesHistoryPage;
