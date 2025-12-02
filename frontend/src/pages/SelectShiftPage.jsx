import React, { useState, useEffect, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
// Importamos el componente del "Guardia de Seguridad"
import MandatoryNotificationModal from "../components/MandatoryNotificationModal";

function SelectShiftPage() {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { startShift } = useContext(AuthContext);

  // Al cargar la página, obtenemos la lista de sucursales desde el backend
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await api.get("/locations/");
        // Filtramos para mostrar solo las sucursales principales, no las bodegas
        const mainLocations = response.data.filter(
          (loc) => loc.parent_id === null
        );
        setLocations(mainLocations);
        if (mainLocations.length > 0) {
          setSelectedLocation(mainLocations[0].id); // Seleccionamos la primera por defecto
        }
      } catch (err) {
        setError("No se pudieron cargar las sucursales.");
      }
    };
    fetchLocations();
  }, []);

  // Estado para guardar las reglas que traiga el guardia
  const [notificationRules, setNotificationRules] = useState([]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      // 1. Intentamos iniciar el turno
      const response = await api.post("/shifts/clock-in", {
        location_id: selectedLocation,
      });

      // 2. Actualizamos el "gafete" en el navegador
      startShift(response.data);

      // 3. --- EL CAMBIO: Preguntamos si hay notificaciones obligatorias ---
      const rulesResponse = await api.get("/notifications/check", {
        params: { event_type: "CLOCK_IN" },
      });

      const rules = rulesResponse.data;

      if (rules && rules.length > 0) {
        // 4a. Si hay reglas, las guardamos. Esto hará que aparezca el Modal automáticamente.
        setNotificationRules(rules);
        // NO navegamos todavía. El usuario está "detenido" en la puerta.
      } else {
        // 4b. Si no hay reglas, pasamos directo.
        navigate("/");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Error al iniciar el turno.");
    }
  };

  // Esta función se ejecuta cuando el usuario por fin da click en "ENTENDIDO" en el modal
  const handleNotificationClose = () => {
    navigate("/"); // Ahora sí, déjalo pasar.
  };
  return (
    <div className="flex items-center justify-center min-h-screen bg-primary">
      <div className="p-8 bg-white rounded-lg shadow-lg w-full max-w-sm border">
        <h2 className="text-2xl font-bold text-center text-secondary mb-6">
          Iniciar Turno
        </h2>
        <form onSubmit={handleSubmit}>
          {error && (
            <p className="bg-red-200 text-red-800 p-3 rounded-lg mb-4">
              {error}
            </p>
          )}
          <div className="mb-6">
            <label className="block text-gray-500 mb-2" htmlFor="location">
              Selecciona tu Sucursal
            </label>
            <select
              id="location"
              className="w-full p-3 bg-gray-100 rounded-lg text-secondary border border-gray-300 focus:outline-none focus:border-detail"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              disabled={locations.length === 0} // Desactivamos si no hay opciones
            >
              {/* --- INICIO DE NUESTRO CÓDIGO (Mensaje si no hay sucursales) --- */}
              {locations.length === 0 ? (
                <option value="">No hay sucursales creadas</option>
              ) : (
                locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))
              )}
              {/* --- FIN DE NUESTRO CÓDIGO --- */}
            </select>
          </div>

          {/* --- INICIO DE NUESTRO CÓDIGO (Atajo para crear sucursales) --- */}
          {locations.length === 0 && (
            <div className="mb-4 text-center text-sm">
              <p className="text-gray-600">
                Parece que no hay ninguna sucursal.
              </p>
              {/* Llevamos al admin a la nueva página que creamos */}
              <Link
                to="/sucursales"
                className="font-semibold text-accent hover:underline"
              >
                Haz clic aquí para crear tu primera sucursal
              </Link>
            </div>
          )}
          {/* --- FIN DE NUESTRO CÓDIGO --- */}

          <button
            type="submit"
            className="w-full bg-accent hover:bg-teal-500 text-white font-bold py-3 rounded-lg transition duration-300"
          >
            Confirmar e Ingresar
          </button>
        </form>
      </div>

      {/* --- Aquí está el Guardia (El Modal) --- */}
      {/* Solo se muestra si 'notificationRules' tiene datos */}
      <MandatoryNotificationModal
        rules={notificationRules}
        onClose={handleNotificationClose}
      />
    </div>
  );
}

export default SelectShiftPage;
