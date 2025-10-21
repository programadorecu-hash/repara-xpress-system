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