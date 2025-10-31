// frontend/src/components/Header.jsx

import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";

function Header() {
  const { token, user, activeShift, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const canManageInventory =
    user?.role === "admin" || user?.role === "inventory_manager";
  const canManageCash = user?.role === "admin";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    // CAMBIO: He ajustado el color a uno más acorde a tu paleta.
    <header className="bg-brand text-surface shadow-md">
      {/* bg-brand = #295BF2 (fondo azul del header)
      text-surface = #F2F2F2 (texto claro) */}
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-white font-bold text-xl">
            {activeShift
              ? `Repara Xpress - ${activeShift.location.name}`
              : "Repara Xpress"}
          </div>

          <div className="flex items-center space-x-6">
            {/* --- ENLACES DE NAVEGACIÓN --- */}
            <Link
              to="/"
              className="text-surface font-semibold hover:text-brand-mist"
            >
              INICIO
            </Link>
            <Link
            to="/pos"
            className="text-surface font-semibold hover:text-brand-mist"
          >
            VENDER
          </Link>

          {/* --- INICIO DE NUESTRO CÓDIGO --- */}
          {/* Este es el nuevo botón para el historial de ventas */}
          <Link
            to="/historial-ventas"
            className="text-surface font-semibold hover:text-brand-mist"
          >
            HISTORIAL VENTAS
          </Link>
          {/* --- FIN DE NUESTRO CÓDIGO --- */}

          <Link
            to="/ordenes"
              className="text-surface font-semibold hover:text-brand-mist"
            >
              ORDENES
            </Link>
            <Link
              to="/inventario"
              className="text-surface font-semibold hover:text-brand-mist"
            >
              BODEGA
            </Link>

            {canManageInventory && (
              <Link
                to="/proveedores"
                className="text-surface font-semibold hover:text-brand-mist"
              >
                PROVEEDORES
              </Link>
            )}

            {canManageInventory && (
              <Link
                to="/compras"
                className="text-surface font-semibold hover:text-brand-mist"
              >
                COMPRAS
              </Link>
            )}

            {canManageInventory && (
              <Link
                to="/ventas-perdidas"
                className="text-surface font-semibold hover:text-brand-mist"
              >
                VENTAS PERDIDAS
              </Link>
            )}

            {user?.role === "admin" && (
              <Link
                to="/auditoria"
                className="text-surface font-semibold hover:text-brand-mist"
              >
                AUDITAR INVENTARIO
              </Link>
            )}

            {canManageCash && (
              <Link
                to="/caja"
                className="text-surface font-semibold hover:text-brand-mist"
              >
                CAJA
              </Link>
            )}
            {canManageCash && (
              <Link
                to="/caja/transacciones"
                className="text-surface font-semibold hover:text-brand-mist"
              >
                MOVIMIENTOS DE CAJA
              </Link>
            )}

            {token && user && (
              <div className="flex items-center space-x-4">
                <span className="text-surface/80">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="bg-surface text-brand hover:bg-brand-mist font-bold py-2 px-4 rounded-lg transition duration-300"
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
