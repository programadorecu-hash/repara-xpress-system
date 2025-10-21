import { Outlet } from 'react-router-dom';
import Header from './Header.jsx';

function AppLayout() {
  return (
    // CAMBIO: Fondo claro 'primary', texto oscuro por defecto
    <div className="bg-primary text-gray-800 min-h-screen">
      <Header /> {/* Mantenemos el Header oscuro para un buen contraste */}
      <main className="container mx-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;