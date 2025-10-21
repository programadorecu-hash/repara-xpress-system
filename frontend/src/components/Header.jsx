import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

function Header() {
  const { token, user, activeShift, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout(); // Llama a la nueva función de logout que también cierra el turno
    navigate('/login');
  };

  return (
    <header className="bg-sky-700 shadow-md">
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-white font-bold text-xl">
            {/* Si hay un turno activo, muestra el nombre de la sucursal */}
            {activeShift ? `Repara Xpress - ${activeShift.location.name}` : "Repara Xpress - Quito"}
          </div>
          <div>
            {token && user && (
              <div className="flex items-center space-x-4">
                {/* Muestra el email del usuario logueado */}
                <span className="text-sky-200">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg"
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