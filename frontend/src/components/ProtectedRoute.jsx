import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';

function ProtectedRoute({ children, requiredRoles }) {
  const { token, user } = useContext(AuthContext);

  if (!token) {
    // Si no hay token, redirige al usuario a la página de login
    return <Navigate to="/login" replace />;
  }

  if (Array.isArray(requiredRoles) && requiredRoles.length > 0) {
    if (!user || !requiredRoles.includes(user.role)) {
      return <Navigate to="/" replace />;
    }
  }

  // Si hay un token, muestra la página que estamos protegiendo
  return children;
}

export default ProtectedRoute;