import React, { createContext, useState, useEffect } from 'react';
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

  const login = async (newToken) => {
    localStorage.setItem('accessToken', newToken);
    setToken(newToken);
    
    // Inmediatamente después de guardar el token, buscamos el perfil completo
    try {
      const response = await api.get('/users/me/profile');
      setUser(response.data);
      setActiveShift(response.data.active_shift);
      return response.data; // Devolvemos el perfil para que la página de login lo use
    } catch (error) {
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

  const authValue = { token, user, activeShift, login, logout, startShift };

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}