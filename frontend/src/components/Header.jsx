// frontend/src/components/Header.jsx

import React, { useContext } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
// (Eliminamos getCompanySettings, useEffect y useState porque los datos ahora vienen del padre)

// Importamos los íconos
import {
  HiOutlineHome,
  HiOutlineShoppingCart,
  HiOutlineClock,
  HiOutlineCog,
  HiOutlineArchive,
  HiOutlineTruck,
  HiOutlineShoppingBag,
  HiOutlineExclamationCircle,
  HiOutlineDocumentReport,
  HiOutlineInbox,
  HiOutlineCash,
  HiOutlineOfficeBuilding,
  HiOutlineUsers,
  HiOutlineLogout,
  HiOutlineMenu,
  HiOutlineX,
  HiOutlineIdentification,
  HiOutlineBell,
  HiOutlineUserGroup,
  HiOutlineCurrencyDollar,
  HiOutlineChartPie, // <--- ÍCONO AGREGADO
} from "react-icons/hi";

// Componente de Enlace con Ícono
function NavItem({ to, icon, label, isExpanded }) {
  // 1. Quitamos 'space-x-3' para manejar el margen manualmente y evitar "saltos"
  // 2. Mantenemos 'whitespace-nowrap' para que el texto sea rígido
  const baseStyle =
    "flex items-center py-2 px-3 rounded-lg text-surface/80 hover:bg-surface/10 transition-all duration-300 group overflow-hidden whitespace-nowrap";
  
  const activeStyle = "bg-surface/20 text-surface font-semibold";

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `${baseStyle} ${isActive ? activeStyle : ""} ${
          !isExpanded ? "justify-center" : "justify-start"
        }`
      }
      title={!isExpanded ? label : undefined}
    >
      {/* ICONO: 'flex-shrink-0' es VITAL para que no se aplaste al cerrar el menú */}
      <div className="text-xl min-w-[24px] flex-shrink-0 flex justify-center">{icon}</div>
      
      {/* TEXTO: Animación suave sincronizada con el menú (duration-500) */}
      <div 
        className={`
          overflow-hidden whitespace-nowrap
          transition-all duration-500 ease-in-out
          ${isExpanded 
            ? "max-w-[200px] opacity-100 ml-3"  // ml-3 da el espacio cuando está abierto
            : "max-w-0 opacity-0 ml-0"          // ml-0 quita el espacio cuando está cerrado
          }
        `}
      >
        {label}
      </div>
    </NavLink>
  );
}

// El Header/Menú Principal
function Header({ isMenuOpen, onToggle, companyInfo, apiUrl }) {
  const { token, user, activeShift, logout } = useContext(AuthContext); // <--- TOKEN AGREGADO
  const navigate = useNavigate();

  // Ya no cargamos datos aquí, usamos companyInfo que viene de AppLayout

  const canManageInventory =
    user?.role === "admin" || user?.role === "inventory_manager";
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
      <aside
        className={`fixed left-0 top-0 z-50 h-dvh 
                        flex flex-col p-4 
                        bg-brand/90 md:bg-brand/50 text-surface 
                        backdrop-blur-md border-r border-white/10 shadow-2xl
                        /* CAMBIO: 'duration-500' (más lento) y 'ease-in-out' (curva suave) */
                        transition-all duration-500 ease-in-out
                        ${
                          isMenuOpen
                            ? "translate-x-0 w-64"
                            : "-translate-x-full md:translate-x-0 md:w-20 w-64"
                        }
                        `}
      >
        {/* Sección Superior: Logo */}
        <div
          className={`flex ${
            isMenuOpen ? "justify-between" : "justify-center"
          } items-center px-2 flex-shrink-0 py-4`}
        >
          {/* Lógica de Visualización del Logo/Nombre */}
          {/* CAMBIO: Ahora es un Link que lleva al Inicio */}
          <NavLink 
            to="/" 
            className={`transition-all duration-500 ease-in-out flex flex-col items-center hover:opacity-90 ${isMenuOpen ? "opacity-100 max-w-[200px]" : "opacity-100 w-full justify-center"}`}
            title="Ir al Inicio"
          >
            
            {companyInfo?.logo_url ? (
              // CASO 1: TIENE LOGO
              <img 
                src={`${apiUrl}${companyInfo.logo_url}`} 
                alt={companyInfo.name} 
                // CORRECCIÓN: Forzamos rounded-full SIEMPRE, object-cover y borde
                className={`object-cover bg-white transition-all duration-500 rounded-full border-2 border-white/20 ${isMenuOpen ? "h-16 w-16 p-1" : "h-10 w-10 p-0.5"}`} 
              />
            ) : (
              // CASO 2: NO TIENE LOGO (Solo Inicial)
              <div className={`bg-accent rounded-full flex items-center justify-center text-white font-bold transition-all duration-500 border-2 border-white/20 ${isMenuOpen ? "h-14 w-14 text-2xl" : "h-10 w-10 text-xl"}`}>
                {companyInfo?.name?.charAt(0) || "R"}
              </div>
            )}

            {/* NOMBRE DE LA EMPRESA: Animación fluida sin saltos de línea */}
            <div 
              className={`
                overflow-hidden whitespace-nowrap text-center
                transition-all duration-500 ease-in-out
                ${isMenuOpen 
                  ? "max-h-[50px] opacity-100 mt-2" // Abierto: Altura, opacidad y margen
                  : "max-h-0 opacity-0 mt-0"        // Cerrado: Todo a cero (incluido el margen)
                }
              `}
            >
               <span className="text-white font-bold text-sm block">{companyInfo?.name || "Cargando..."}</span>
            </div>
          </NavLink>

          
        </div>

        {/* Nombre de la Sucursal */}
        {activeShift && (
          <div className={`text-sm text-surface/80 font-semibold px-2 mt-2 flex-shrink-0 transition-all duration-500 ease-in-out overflow-hidden whitespace-nowrap ${isMenuOpen ? "opacity-100 max-h-10" : "opacity-0 max-h-0"}`}>
            Sucursal: {activeShift.location.name}
          </div>
        )}
        {/* Sección Media: Navegación Organizada */}
        <nav className="flex flex-col space-y-1 mt-8 flex-1 overflow-y-auto min-h-0">
          
          {/* --- GRUPO: OPERATIVO --- */}
          {/* Siempre visible porque es lo más usado */}
          <NavItem to="/" label="Inicio" icon={<HiOutlineHome />} isExpanded={isMenuOpen} />
          <NavItem to="/pos" label="Vender" icon={<HiOutlineShoppingCart />} isExpanded={isMenuOpen} />
          <NavItem to="/ordenes" label="Ordenes" icon={<HiOutlineCog />} isExpanded={isMenuOpen} />
          <NavItem to="/inventario" label="Inventario" icon={<HiOutlineArchive />} isExpanded={isMenuOpen} />
          {user?.role === "admin" && (
            <NavItem to="/auditoria" label="Movimientos de Inventario" icon={<HiOutlineDocumentReport />} isExpanded={isMenuOpen} />
          )}

          <div className="my-2 border-t border-white/10" /> {/* Separador */}
          
          {/* --- GRUPO: GESTIÓN COMERCIAL --- */}
          {isMenuOpen && <div className="text-xs font-bold text-surface/50 uppercase px-3 mt-2 mb-1">Gestión</div>}
          
          <NavItem to="/historial-ventas" label="Historial de Ventas" icon={<HiOutlineClock />} isExpanded={isMenuOpen} />
          {canManageInventory && (
             <NavItem to="/ventas-perdidas" label="Ventas Perdidas" icon={<HiOutlineExclamationCircle />} isExpanded={isMenuOpen} />
          )}
          <NavItem to="/clientes" label="Clientes" icon={<HiOutlineUserGroup />} isExpanded={isMenuOpen} />
          {canManageInventory && (
             <NavItem to="/compras" label="Compras" icon={<HiOutlineShoppingBag />} isExpanded={isMenuOpen} />
          )}
          {canManageInventory && (
             <NavItem to="/proveedores" label="Proveedores" icon={<HiOutlineTruck />} isExpanded={isMenuOpen} />
          )}

          <div className="my-2 border-t border-white/10" /> {/* Separador */}

          {/* --- GRUPO: FINANZAS (Solo Admins/Gerentes) --- */}
          {(canManageInventory || canManageCash) && (
            <>
              {isMenuOpen && <div className="text-xs font-bold text-surface/50 uppercase px-3 mt-2 mb-1">Finanzas</div>}
              
              {canManageInventory && (
                <NavItem to="/gastos" label="Gastos y Costos" icon={<HiOutlineCurrencyDollar />} isExpanded={isMenuOpen} />
              )}
              {user?.role === "admin" && (
                <NavItem to="/reporte-financiero" label="Utilidad Neta" icon={<HiOutlineChartPie />} isExpanded={isMenuOpen} />
              )}
              {canManageCash && (
                <NavItem to="/caja" label="Cajas" icon={<HiOutlineInbox />} isExpanded={isMenuOpen} />
              )}
              {canManageCash && (
                <NavItem to="/caja/transacciones" label="Movimientos de Caja" icon={<HiOutlineCash />} isExpanded={isMenuOpen} />
              )}
            </>
          )}

          <div className="my-2 border-t border-white/10" /> {/* Separador */}

          {/* --- GRUPO: ADMINISTRACIÓN (Solo Admins) --- */}
          {(user?.role === "admin" || user?.role === "inventory_manager") && (
             <>
               {isMenuOpen && <div className="text-xs font-bold text-surface/50 uppercase px-3 mt-2 mb-1">Administración</div>}
               
               {user?.role === "admin" && (
                 <NavItem to="/configuracion/empresa" label="Datos Empresa" icon={<HiOutlineOfficeBuilding />} isExpanded={isMenuOpen} />
               )}
               {user?.role === "admin" && (
                 <NavItem to="/sucursales" label="Sucursales" icon={<HiOutlineOfficeBuilding />} isExpanded={isMenuOpen} />
               )}
               {user?.role === "admin" && (
                 <NavItem to="/usuarios" label="Gerencia y Empleados" icon={<HiOutlineUsers />} isExpanded={isMenuOpen} />
               )}
               {user?.role === "admin" && (
                 <NavItem to="/personal" label="Control de Personal" icon={<HiOutlineIdentification />} isExpanded={isMenuOpen} />
               )}
               <NavItem to="/configuracion/notificaciones" label="Alertas" icon={<HiOutlineBell />} isExpanded={isMenuOpen} />
             </>
          )}

        </nav>

        {/* Sección Inferior: Botón Salir */}
        <div className="mt-auto pt-4 border-t border-white/10 flex-shrink-0">
          {token && user && (
            <div className="flex flex-col space-y-3">
              {isMenuOpen && (
                <span
                  className="text-sm text-surface/80 px-3 truncate"
                  title={user.email}
                >
                  {user.email}
                </span>
              )}

              <button
                onClick={handleLogout}
                className={`w-full flex items-center py-2 px-3 rounded-lg text-surface/80 hover:bg-red-500/50 hover:text-white font-bold transition-colors ${
                  !isMenuOpen ? "justify-center" : "justify-start"
                }`}
                title={!isMenuOpen ? "Cerrar Sesión" : undefined}
              >
                {/* ICONO: Flex-shrink-0 para que no se aplaste */}
                <div className="text-xl min-w-[24px] flex-shrink-0 flex justify-center">
                  <HiOutlineLogout className="w-6 h-6" />
                </div>
                
                {/* TEXTO: Animación suave igual que los items del menú */}
                <div 
                  className={`
                    overflow-hidden whitespace-nowrap
                    transition-all duration-500 ease-in-out
                    ${isMenuOpen 
                      ? "max-w-[200px] opacity-100 ml-3" 
                      : "max-w-0 opacity-0 ml-0"
                    }
                  `}
                >
                  FIN DEL TURNO
                </div>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export default Header;
