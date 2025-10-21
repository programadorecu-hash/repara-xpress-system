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

  const login = (newToken) => {
    localStorage.setItem('accessToken', newToken);
    setToken(newToken); // Esto disparará el useEffect de arriba para cargar el perfil
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