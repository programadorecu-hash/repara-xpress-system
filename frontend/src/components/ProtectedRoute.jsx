import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';

function ProtectedRoute({ children }) {
  const { token } = useContext(AuthContext);

  if (!token) {
    // Si no hay token, redirige al usuario a la página de login
    return <Navigate to="/login" replace />;
  }

  // Si hay un token, muestra la página que estamos protegiendo
  return children;
}

export default ProtectedRoute;