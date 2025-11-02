import React, { createContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('accessToken'));
  const [user, setUser] = useState(null);
  const [activeShift, setActiveShift] = useState(null);

  useEffect(() => {
    // Si detectamos un token al cargar la app, buscamos el perfil del usuario
    if (token) {
      api.get('/users/me/profile')
        .then(response => {
          setUser(response.data);
          setActiveShift(response.data.active_shift);
        })
        .catch(() => {
          // Si el token es inválido, limpiamos todo
          logout();
        });
    }
  }, [token]);

  // --- INICIO DE NUESTRO CÓDIGO (Guardia de PIN) ---
  const navigate = useNavigate(); // Para poder redirigir

  const login = async (newToken) => {
  localStorage.setItem('accessToken', newToken);
  setToken(newToken);

  // Inmediatamente después de guardar el token, buscamos el perfil completo
  try {
    const response = await api.get('/users/me/profile');
    const userProfile = response.data; // Guardamos el perfil

    setUser(userProfile);
    setActiveShift(userProfile.active_shift);

    // --- ¡AQUÍ ESTÁ LA LÓGICA DEL GUARDIA! ---
    // 1. Revisamos el "gafete" (perfil) del usuario
    // 2. Si el usuario NO tiene un PIN configurado (hashed_pin es null o vacío)
    // 3. Y NO es el admin (el admin puede que no necesite PIN para todo)
    if (!userProfile.hashed_pin && userProfile.role !== 'admin') {
      // 4. Lo forzamos a ir al "escritorio de crear PIN"
      navigate('/crear-pin');
    }
    // --- FIN DE LA LÓGICA DEL GUARDIA ---

    return userProfile; // Devolvemos el perfil para que la página de login lo use
  } catch (error) {
    // --- FIN DE NUESTRO CÓDIGO ---
      console.error("Error al cargar el perfil del usuario", error);
      logout(); // Si falla, limpiamos todo por seguridad
      return null;
    }
  };

  const logout = async () => {
    if (activeShift) {
      try {
        // Intentamos cerrar el turno antes de desloguear
        await api.post('/shifts/clock-out');
      } catch (error) {
        console.error("No se pudo cerrar el turno, puede que ya estuviera cerrado.", error);
      }
    }
    localStorage.removeItem('accessToken');
    setToken(null);
    setUser(null);
    setActiveShift(null);
  };

  const startShift = (shift) => {
    setActiveShift(shift);
  };

  const authValue = { token, user, activeShift, login, logout, startShift, setUser };

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}