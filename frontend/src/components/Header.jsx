// frontend/src/components/Header.jsx

import React, { useContext } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";

// Importamos los íconos
import { 
  HiOutlineHome, HiOutlineShoppingCart, HiOutlineClock, 
  HiOutlineCog, HiOutlineArchive, HiOutlineTruck, 
  HiOutlineShoppingBag, HiOutlineExclamationCircle, 
  HiOutlineDocumentReport, HiOutlineInbox, HiOutlineCash, 
  HiOutlineOfficeBuilding, HiOutlineUsers, HiOutlineLogout, 
  HiOutlineMenu, HiOutlineX, HiOutlineIdentification,
  HiOutlineBell, HiOutlineUserGroup
} from "react-icons/hi";

// Componente de Enlace con Ícono
function NavItem({ to, icon, label, isExpanded }) {
  const baseStyle = "flex items-center space-x-3 py-2 px-3 rounded-lg text-surface/80 hover:bg-surface/10 transition-colors";
  const activeStyle = "bg-surface/20 text-surface font-semibold";

  return (
    <NavLink
      to={to}
      className={({ isActive }) => 
        `${baseStyle} ${isActive ? activeStyle : ''} ${!isExpanded ? 'justify-center' : ''}`
      }
      title={!isExpanded ? label : undefined}
    >
      <div className="text-xl">
        {icon}
      </div>
      {isExpanded && <span>{label}</span>}
    </NavLink>
  );
}

// El Header/Menú Principal
function Header({ isMenuOpen, onToggle }) {
  const { token, user, activeShift, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const canManageInventory = user?.role === "admin" || user?.role === "inventory_manager";
  const canManageCash = user?.role === "admin";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <>
      {/* Fondo oscuro para celular cuando el menú está abierto (Overlay) */}
      {isMenuOpen && (
        <div 
          onClick={onToggle}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Menú Lateral */}
      <aside className={`fixed left-0 top-0 z-50 h-dvh 
                        flex flex-col p-4 
                        bg-brand/90 md:bg-brand/50 text-surface 
                        backdrop-blur-md border-r border-white/10 shadow-2xl
                        transition-transform duration-300 
                        ${/* Lógica Responsiva: Si está cerrado, en móvil se esconde a la izquierda, en PC se queda quieto */ ''}
                        ${isMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                        
                        ${/* Ancho: Si está abierto es ancho completo (o 64). Si cerrado en PC es chico (20) */ ''}
                        ${isMenuOpen ? 'w-64' : 'w-64 md:w-20'}
                        `}>
        
        {/* Sección Superior: Logo */}
        <div className={`flex ${isMenuOpen ? 'justify-between' : 'justify-center'} items-center px-2 flex-shrink-0`}>
          {isMenuOpen && (
            <div className="text-white font-bold text-xl">
              Repara Xpress
            </div>
          )}
          
          <button 
            onClick={onToggle} 
            className="text-surface/80 hover:text-surface p-2 rounded-lg hover:bg-surface/10"
          >
            {isMenuOpen ? <HiOutlineX className="w-6 h-6" /> : <HiOutlineMenu className="w-6 h-6" />}
          </button>
        </div>
        
        {/* Nombre de la Sucursal */}
        {isMenuOpen && activeShift && (
          <div className="text-sm text-surface/80 font-semibold px-2 mt-2 flex-shrink-0">
            Sucursal: {activeShift.location.name}
          </div>
        )}

        {/* Sección Media: Navegación (con Scroll activado y estilizado por CSS global) */}
        <nav className="flex flex-col space-y-1 mt-8 flex-1 overflow-y-auto min-h-0">
          <NavItem to="/" label="Inicio" icon={<HiOutlineHome />} isExpanded={isMenuOpen} />
          <NavItem to="/pos" label="Vender" icon={<HiOutlineShoppingCart />} isExpanded={isMenuOpen} />
          <NavItem to="/historial-ventas" label="Historial Ventas" icon={<HiOutlineClock />} isExpanded={isMenuOpen} />
          <NavItem to="/ordenes" label="Ordenes" icon={<HiOutlineCog />} isExpanded={isMenuOpen} />
          <NavItem to="/clientes" label="Clientes" icon={<HiOutlineUserGroup />} isExpanded={isMenuOpen} />
          <NavItem to="/inventario" label="Bodega" icon={<HiOutlineArchive />} isExpanded={isMenuOpen} />
          
          {canManageInventory && (
            <NavItem to="/proveedores" label="Proveedores" icon={<HiOutlineTruck />} isExpanded={isMenuOpen} />
          )}
          {canManageInventory && (
            <NavItem to="/compras" label="Compras" icon={<HiOutlineShoppingBag />} isExpanded={isMenuOpen} />
          )}
          {user?.role === "admin" && (
            <NavItem to="/personal" label="Control Personal" icon={<HiOutlineIdentification />} isExpanded={isMenuOpen} />
          )}
          {canManageInventory && (
            <NavItem to="/ventas-perdidas" label="Ventas Perdidas" icon={<HiOutlineExclamationCircle />} isExpanded={isMenuOpen} />
          )}
          {user?.role === "admin" && (
            <NavItem to="/auditoria" label="Auditar Inventario" icon={<HiOutlineDocumentReport />} isExpanded={isMenuOpen} />
          )}
          {canManageCash && (
            <NavItem to="/caja" label="Caja" icon={<HiOutlineInbox />} isExpanded={isMenuOpen} />
          )}
          {canManageCash && (
            <NavItem to="/caja/transacciones" label="Movimientos de Caja" icon={<HiOutlineCash />} isExpanded={isMenuOpen} />
          )}
          {user?.role === "admin" && (
            <NavItem to="/sucursales" label="Sucursales" icon={<HiOutlineOfficeBuilding />} isExpanded={isMenuOpen} />
          )}
          {user?.role === "admin" && (
            <NavItem to="/usuarios" label="Usuarios" icon={<HiOutlineUsers />} isExpanded={isMenuOpen} />
          )}
          {(user?.role === "admin" || user?.role === "inventory_manager") && (
            <NavItem 
              to="/configuracion/notificaciones" 
              label="Config. Alertas" 
              icon={<HiOutlineBell />} 
              isExpanded={isMenuOpen} 
            />
          )}
        </nav>

        {/* Sección Inferior: Botón Salir */}
        <div className="mt-auto pt-4 border-t border-white/10 flex-shrink-0">
          {token && user && (
            <div className="flex flex-col space-y-3">
              {isMenuOpen && (
                <span className="text-sm text-surface/80 px-3 truncate" title={user.email}>
                  {user.email}
                </span>
              )}
              
              <button
                onClick={handleLogout}
                className={`w-full flex items-center space-x-3 py-2 px-3 rounded-lg text-surface/80 hover:bg-red-500/50 hover:text-white font-bold transition-colors ${!isMenuOpen ? 'justify-center' : ''}`}
              >
                <HiOutlineLogout className="w-6 h-6" />
                {isMenuOpen && <span>FIN DEL TURNO</span>}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export default Header;