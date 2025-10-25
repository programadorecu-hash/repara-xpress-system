// frontend/src/components/Header.jsx

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
    // CAMBIO: He ajustado el color a uno más acorde a tu paleta.
    <header className="bg-secondary shadow-md">
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          
          <div className="text-white font-bold text-xl">
            {activeShift ? `Repara Xpress - ${activeShift.location.name}` : "Repara Xpress"}
          </div>
          
          <div className="flex items-center space-x-6">
            
            {/* --- ENLACES DE NAVEGACIÓN --- */}
            <Link to="/" className="text-white font-semibold hover:text-gray-300">INICIO</Link>
            <Link to="/pos" className="text-white font-semibold hover:text-gray-300">VENDER</Link>
            <Link to="/ordenes" className="text-white font-semibold hover:text-gray-300">ORDENES</Link>
            <Link to="/inventario" className="text-white font-semibold hover:text-gray-300">BODEGA</Link>
            

            
            {user?.role === 'admin' && (
              <Link to="/auditoria" className="text-white font-semibold hover:text-gray-300">
                AUDITAR INVENTARIO
              </Link>
            )}
            
            {token && user && (
              <div className="flex items-center space-x-4">
                <span className="text-gray-300">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="bg-highlight hover:bg-yellow-500 text-secondary font-bold py-2 px-4 rounded-lg transition duration-300"
                >
                  FIN DEL TURNO
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