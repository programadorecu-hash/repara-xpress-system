import axios from 'axios';

// Creamos una instancia de Axios con la URL base de nuestro backend
const apiClient = axios.create({
  baseURL: 'http://localhost:8000',
});

// ¡La Magia! Un "interceptor" que se ejecuta ANTES de cada petición.
apiClient.interceptors.request.use(
  (config) => {
    // Obtenemos el token guardado en localStorage
    const token = localStorage.getItem('accessToken');
    if (token) {
      // Si existe el token, lo añadimos a la cabecera de la petición
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;


// ===== API: Notas internas de órdenes =====
// Usamos la misma instancia apiClient (con baseURL y token en el interceptor).

export async function getWorkOrderNotes(workOrderId, { skip = 0, limit = 50 } = {}) {
  // Lista de notas (más recientes primero, según backend)
  const { data } = await apiClient.get(`/work-orders/${workOrderId}/notes`, {
    params: { skip, limit }
  });
  return data; // Array de notas [{ id, created_at, message, user:{...}, location:{...} }, ...]
}

export async function addWorkOrderNote(workOrderId, message) {
  // Crea una nota nueva para la orden. Requiere turno activo (backend valida).
  const { data } = await apiClient.post(`/work-orders/${workOrderId}/notes`, { message });
  return data; // Nota creada con user y location cargados
}
// ===== FIN API: Notas =====
