import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';

function Header() {
  const { token, user, activeShift, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-sky-700 shadow-md">
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          
          {/* Lado Izquierdo: Título */}
          <div className="text-white font-bold text-xl">
            {activeShift ? `Repara Xpress - ${activeShift.location.name}` : "Repara Xpress - Quito"}
          </div>
          
          {/* Lado Derecho: Enlaces y Sesión de Usuario */}
          <div className="flex items-center space-x-6">
            
            {/* --- AQUÍ ESTÁ EL NUEVO ENLACE --- */}
            {/* Se muestra solo si el rol del usuario es 'admin' */}
            {user?.role === 'admin' && (
              <Link to="/auditoria" className="text-white font-semibold hover:text-sky-200 transition duration-300">
                Auditoría
              </Link>
            )}
            
            {/* Información del usuario y botón de logout */}
            {token && user && (
              <div className="flex items-center space-x-4">
                <span className="text-sky-200">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
                >
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>

        </div>
      </nav>
    </header>
  );
}

export default Header;