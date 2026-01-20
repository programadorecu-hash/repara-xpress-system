import axios from 'axios';

// Creamos una instancia de Axios
const apiClient = axios.create({
  // Ya no necesitamos lógica compleja ni "OR". 
  // Vite reemplazará esta variable con "/api" directamente gracias al config.
  baseURL: import.meta.env.VITE_API_URL,
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

    // --- ¡ESTA ES LA NUEVA LÓGICA INTELIGENTE! ---
    // Si los datos que estamos enviando son un "paquete" (FormData)...
    if (config.data instanceof FormData) {
      // ...le decimos al mensajero que BORRE la etiqueta de "Content-Type" (si es que la tiene).
      // Esto fuerza al navegador a poner la etiqueta correcta por sí solo,
      // incluyendo el código secreto ("boundary") que el servidor necesita.
      delete config.headers['Content-Type'];
    }
    // --- FIN DE LA LÓGICA ---

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


// ===== API: Entregar Sin Reparar =====
export async function deliverWorkOrderUnrepaired(workOrderId, { diagnostic_fee, reason, pin }) {
  // Llama a la ventanilla especial que creamos en el backend
  const { data } = await apiClient.post(`/work-orders/${workOrderId}/deliver-unrepaired`, {
    diagnostic_fee,
    reason,
    pin
  });
  return data;
}
// ===== FIN API =====


// Borrar foto de orden
export async function deleteWorkOrderImage(imageId) {
  const { data } = await apiClient.delete(`/work-order-images/${imageId}`);
  return data;
}

// ===== API: Configuración de Empresa =====
export async function getCompanySettings() {
  const { data } = await apiClient.get('/company/settings');
  return data;
}

export async function updateCompanySettings(settings) {
  const { data } = await apiClient.put('/company/settings', settings);
  return data;
}

// Subir logo de empresa (similar a subir foto de producto)
export async function uploadCompanyLogo(file) {
  const formData = new FormData();
  formData.append('file', file);
  // No necesitamos poner headers manuales, el interceptor lo hace
  const { data } = await apiClient.post('/company/logo', formData);
  return data;
}

// ===== API: Funciones Básicas Faltantes (Productos y Ubicaciones) =====
export async function getLocations() {
  const { data } = await apiClient.get('/locations/');
  return data;
}

export async function getProducts({ skip = 0, limit = 100, search, location_id } = {}) {
  const { data } = await apiClient.get('/products/', {
    params: { skip, limit, search, location_id }
  });
  return data;
}
// ======================================================================

// ===== API: Transferencias (Envíos entre Sucursales) =====

export async function getTransfers({ status, skip = 0, limit = 50 } = {}) {
  // Obtiene la lista de envíos. El backend ya filtra por usuario/sucursal.
  const { data } = await apiClient.get('/transfers/', {
    params: { status, skip, limit }
  });
  return data;
}

export async function getTransfer(id) {
  // Obtiene el detalle de un envío específico
  const { data } = await apiClient.get(`/transfers/${id}`);
  return data;
}

export async function createTransfer({ destination_location_id, note, items, pin }) {
  // Crea un nuevo envío
  const { data } = await apiClient.post('/transfers/', {
    destination_location_id,
    note,
    items, // Array de { product_id, quantity }
    pin
  });
  return data;
}

export async function receiveTransfer(id, { status, pin, note }) {
  // Acepta o Rechaza un envío
  // status debe ser "ACEPTADO" o "RECHAZADO"
  const { data } = await apiClient.post(`/transfers/${id}/receive`, {
    status,
    pin,
    note
  });
  return data;
}
// ===== FIN API =====