// frontend/src/pages/ProfilePage.jsx
import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';

function ProfilePage() {
  const { user } = useContext(AuthContext);

  // Estados para Contraseña
  const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });
  // Estados para PIN
  const [pinData, setPinData] = useState({ current: '', new: '' });
  
  const [loadingPass, setLoadingPass] = useState(false);
  const [loadingPin, setLoadingPin] = useState(false);

  // --- MANEJO DE CONTRASEÑA ---
  const handlePassChange = (e) => setPassData({...passData, [e.target.name]: e.target.value});

  const submitPassword = async (e) => {
    e.preventDefault();
    if (passData.new !== passData.confirm) return toast.error("Las contraseñas nuevas no coinciden.");
    if (passData.new.length < 8) return toast.error("La nueva contraseña debe tener al menos 8 caracteres.");

    setLoadingPass(true);
    try {
      await api.post('/users/me/change-password', {
        current_password: passData.current,
        new_password: passData.new
      });
      toast.success("Contraseña actualizada.");
      setPassData({ current: '', new: '', confirm: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al cambiar contraseña.");
    } finally {
      setLoadingPass(false);
    }
  };

  // --- MANEJO DE PIN ---
  const handlePinChange = (e) => setPinData({...pinData, [e.target.name]: e.target.value});

  const submitPin = async (e) => {
    e.preventDefault();
    if (pinData.new.length < 4) return toast.error("El PIN debe tener al menos 4 dígitos.");

    setLoadingPin(true);
    try {
      await api.post('/users/me/change-pin', {
        current_pin: pinData.current,
        new_pin: pinData.new
      });
      toast.success("PIN actualizado correctamente.");
      setPinData({ current: '', new: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al cambiar PIN.");
    } finally {
      setLoadingPin(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      
      {/* Encabezado */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <h1 className="text-2xl font-bold text-secondary">Mi Perfil</h1>
        <p className="text-gray-500">Gestiona tu información de seguridad personal.</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center text-white text-xl font-bold">
            {user?.email?.charAt(0).toUpperCase() || "U"}
          </div>
          <div>
            <p className="font-bold text-gray-800">{user?.full_name || "Usuario Sin Nombre"}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 uppercase font-semibold">
              {user?.role === 'warehouse_operator' ? 'Empleado' : user?.role}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* TARJETA 1: CAMBIAR CONTRASEÑA */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-lg font-bold text-secondary mb-4 flex items-center gap-2">
            🔐 Cambiar Contraseña
          </h2>
          <form onSubmit={submitPassword} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Contraseña Actual</label>
              <input 
                type="password" name="current" 
                value={passData.current} onChange={handlePassChange}
                className="w-full border rounded p-2 focus:border-accent outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Nueva Contraseña</label>
              <input 
                type="password" name="new" 
                value={passData.new} onChange={handlePassChange}
                className="w-full border rounded p-2 focus:border-accent outline-none"
                placeholder="Mínimo 8 caracteres"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Confirmar Nueva</label>
              <input 
                type="password" name="confirm" 
                value={passData.confirm} onChange={handlePassChange}
                className="w-full border rounded p-2 focus:border-accent outline-none"
                required
              />
            </div>
            <button 
              disabled={loadingPass}
              className="w-full bg-secondary text-white py-2 rounded hover:bg-gray-800 transition disabled:bg-gray-400"
            >
              {loadingPass ? "Guardando..." : "Actualizar Contraseña"}
            </button>
          </form>
        </div>

        {/* TARJETA 2: CAMBIAR PIN */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-lg font-bold text-secondary mb-4 flex items-center gap-2">
            🔢 Cambiar PIN de Seguridad
          </h2>
          <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 mb-4">
            El PIN se usa para firmar ventas rápidas y autorizar descuentos.
          </div>
          <form onSubmit={submitPin} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">PIN Actual</label>
              <input 
                type="password" name="current" maxLength={6}
                value={pinData.current} onChange={handlePinChange}
                className="w-full border rounded p-2 focus:border-accent outline-none tracking-widest text-center"
                placeholder="****"
              />
              <p className="text-xs text-gray-400 mt-1">Déjalo vacío si nunca has configurado un PIN.</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Nuevo PIN</label>
              <input 
                type="password" name="new" maxLength={6}
                value={pinData.new} onChange={handlePinChange}
                className="w-full border rounded p-2 focus:border-accent outline-none tracking-widest text-center"
                placeholder="****"
                required
              />
            </div>
            <button 
              disabled={loadingPin}
              className="w-full bg-accent text-white py-2 rounded hover:bg-teal-600 transition disabled:bg-gray-400"
            >
              {loadingPin ? "Guardando..." : "Actualizar PIN"}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

export default ProfilePage;