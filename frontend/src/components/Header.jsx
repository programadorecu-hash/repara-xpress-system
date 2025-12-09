// frontend/src/components/Header.jsx

import React, { useContext } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";

// --- INICIO DE NUESTRO CÓDIGO (Importar Íconos) ---
// Importamos todos los íconos que vamos a usar de la "caja de herramientas"
import { 
  HiOutlineHome, HiOutlineShoppingCart, HiOutlineClock, 
  HiOutlineCog, // <-- ¡AQUÍ ESTÁ LA HERRAMIENTA QUE FALTABA!
  HiOutlineArchive, HiOutlineTruck, HiOutlineShoppingBag, 
  HiOutlineExclamationCircle, HiOutlineDocumentReport, 
  HiOutlineInbox, HiOutlineCash, HiOutlineOfficeBuilding, 
  HiOutlineUsers, HiOutlineLogout, HiOutlineMenu, HiOutlineX,
  HiOutlineIdentification,
  HiOutlineBell,
  HiOutlineUserGroup, // <-- Ícono para Clientes
} from "react-icons/hi";
// --- FIN DE NUESTRO CÓDIGO ---


// --- INICIO DE NUESTRO CÓDIGO (Componente de Enlace con Ícono) ---
// Un nuevo "NavItem" que sabe si está expandido o no
function NavItem({ to, icon, label, isExpanded }) {
  const baseStyle = "flex items-center space-x-3 py-2 px-3 rounded-lg text-surface/80 hover:bg-surface/10 transition-colors";
  const activeStyle = "bg-surface/20 text-surface font-semibold"; // Estilo del botón "activo"

  return (
    <NavLink
      to={to}
      className={({ isActive }) => 
        // Si no está expandido, centramos el ícono
        `${baseStyle} ${isActive ? activeStyle : ''} ${!isExpanded ? 'justify-center' : ''}`
      }
      // Mostramos el nombre del ícono cuando está contraído
      title={!isExpanded ? label : undefined}
    >
      {/* El Ícono (siempre se muestra) */}
      <div className="text-xl">
        {icon}
      </div>
      {/* El Texto (solo se muestra si está expandido) */}
      {isExpanded && <span>{label}</span>}
    </NavLink>
  );
}
// --- FIN DE NUESTRO CÓDIGO ---


// --- INICIO DE NUESTRO CÓDIGO (El Header/Menú rediseñado) ---
// Ahora acepta las "props" (isMenuOpen, onToggle) que le pasa el AppLayout
function Header({ isMenuOpen, onToggle }) {
// --- FIN DE NUESTRO CÓDIGO ---

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
    // 1. El <aside> (panel lateral)
    // 2. Estilos Clave:
    //    - 'fixed', 'z-50', 'h-screen': Flota sobre todo.
    //    - 'transition-all duration-300': ¡La animación!
    //    - (Ancho condicional) {isMenuOpen ? 'w-64' : 'w-20'}
    // 3. ¡El Efecto Cristal!
    //    - 'bg-brand/50': Tu color 'brand' al 50% de transparencia.
    //    - 'backdrop-blur-md': ¡El difuminado!
    <aside className={`fixed left-0 top-0 z-50 h-screen 
                      flex flex-col p-4 
                      bg-brand/50 text-surface 
                      backdrop-blur-md border-r border-white/10 shadow-2xl
                      transition-all duration-300 ${isMenuOpen ? 'w-64' : 'w-20'}`}>
      
      {/* --- Sección Superior: Logo y Botón de Colapsar --- */}
      <div className={`flex ${isMenuOpen ? 'justify-between' : 'justify-center'} items-center px-2`}>
        {/* Mostramos el logo/nombre solo si está expandido */}
        {isMenuOpen && (
          <div className="text-white font-bold text-xl">
            Repara Xpress
          </div>
        )}
        
        {/* El botón de "hamburguesa" que llama a la función onToggle */}
        <button 
          onClick={onToggle} 
          className="text-surface/80 hover:text-surface p-2 rounded-lg hover:bg-surface/10"
        >
          {/* Muestra un ícono u otro dependiendo del estado */}
          {isMenuOpen ? <HiOutlineX className="w-6 h-6" /> : <HiOutlineMenu className="w-6 h-6" />}
        </button>
      </div>
      
      {/* La sucursal (se oculta si está contraído) */}
      {isMenuOpen && activeShift && (
        <div className="text-sm text-surface/80 font-semibold px-2 mt-2">
          Sucursal: {activeShift.location.name}
        </div>
      )}

      {/* --- Sección Media: Enlaces de Navegación --- */}
      <nav className="flex flex-col space-y-1 mt-8">
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
        {/* Botón visible para Admin y Gerentes */}
        {(user?.role === "admin" || user?.role === "inventory_manager") && (
          <NavItem 
            to="/configuracion/notificaciones" 
            label="Config. Alertas" 
            icon={<HiOutlineBell />} 
            isExpanded={isMenuOpen} 
          />
        )}
      </nav>

      {/* --- Sección Inferior: Usuario y Salir --- */}
      <div className="mt-auto pt-4 border-t border-white/10">
        {token && user && (
          <div className="flex flex-col space-y-3">
            {/* Mostramos el email solo si está expandido */}
            {isMenuOpen && (
              <span className="text-sm text-surface/80 px-3 truncate" title={user.email}>
                {user.email}
              </span>
            )}
            
            {/* El botón de Salir cambia para mostrar solo el ícono */}
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
  );
}

export default Header;