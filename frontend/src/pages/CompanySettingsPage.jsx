import React, { useState, useEffect, useRef } from 'react';
import { getCompanySettings, updateCompanySettings, uploadCompanyLogo } from '../services/api';
import { HiOutlineOfficeBuilding, HiOutlineUpload, HiOutlineSave } from 'react-icons/hi';

function CompanySettingsPage() {
  const [settings, setSettings] = useState({
    name: '',
    ruc: '',
    email: '',
    phone: '',
    address: '',
    footer_message: '',
    logo_url: null,
    // --- NUEVO: Estado inicial para WhatsApp ---
    whatsapp_country_code: '+593',
    whatsapp_default_message: ''
    // ------------------------------------------
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  
  // Referencia para el input de archivo
  const fileInputRef = useRef(null);

  // URL base para mostrar imágenes (del .env)
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const data = await getCompanySettings();
      setSettings(data);
    } catch (error) {
      console.error("Error cargando configuración:", error);
      setMsg({ type: 'error', text: 'No se pudo cargar la información de la empresa.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMsg({ type: '', text: '' });
    try {
      await updateCompanySettings(settings);
      setMsg({ type: 'success', text: '¡Información actualizada correctamente!' });
      // Recargar la página después de un breve momento para ver cambios globales (como en el header)
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error("Error guardando:", error);
      setMsg({ type: 'error', text: 'Error al guardar los cambios.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsSaving(true);
    try {
      const updatedSettings = await uploadCompanyLogo(file);
      setSettings(updatedSettings); // Actualizamos estado con la nueva URL
      setMsg({ type: 'success', text: 'Logo actualizado.' });
       // Recargar para ver cambios
       setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Error subiendo logo:", error);
      setMsg({ type: 'error', text: 'No se pudo subir el logo.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center">Cargando datos de empresa...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-secondary mb-6 flex items-center gap-2">
        <HiOutlineOfficeBuilding className="w-8 h-8 text-brand" />
        Datos de la Empresa
      </h1>

      {msg.text && (
        <div className={`p-4 rounded-lg mb-6 ${msg.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
          {msg.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Columna Izquierda: Logo */}
          <div className="flex flex-col items-center">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Logo de la Empresa</label>
            <div className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden relative mb-4">
              {settings.logo_url ? (
                <img 
                  src={`${API_URL}${settings.logo_url}`} 
                  alt="Logo Empresa" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-gray-400 text-sm p-4 text-center">Sin Logo</span>
              )}
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleLogoUpload}
            />
            
            <button 
              type="button"
              onClick={() => fileInputRef.current.click()}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              disabled={isSaving}
            >
              <HiOutlineUpload className="w-4 h-4" />
              Cambiar Logo
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">Recomendado: PNG o JPG transparente.</p>
          </div>

          {/* Columna Derecha: Formulario */}
          <div className="md:col-span-2">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre de la Empresa</label>
                  <input
                    type="text"
                    name="name"
                    value={settings.name}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand focus:border-transparent"
                    placeholder="Ej: Taller Juanito"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Este nombre aparecerá en la barra superior y recibos.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">RUC / Identificación</label>
                  <input
                    type="text"
                    name="ruc"
                    value={settings.ruc}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded"
                    placeholder="Ej: 172429..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    name="phone"
                    value={settings.phone || ''}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email de Contacto</label>
                  <input
                    type="email"
                    name="email"
                    value={settings.email || ''}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Dirección Matriz</label>
                  <input
                    type="text"
                    name="address"
                    value={settings.address || ''}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Mensaje Pie de Página (Recibos)</label>
                  <input
                    type="text"
                    name="footer_message"
                    value={settings.footer_message || ''}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded"
                    placeholder="Ej: Gracias por su compra - No se aceptan devoluciones"
                  />
                </div>

                {/* --- NUEVA SECCIÓN: CONFIGURACIÓN WHATSAPP --- */}
                <div className="md:col-span-2 mt-4 pt-4 border-t border-gray-200">
                  <h3 className="text-md font-bold text-gray-800 mb-3">Configuración de WhatsApp</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Código de País por Defecto</label>
                      <input
                        type="text"
                        name="whatsapp_country_code"
                        value={settings.whatsapp_country_code || '+593'}
                        onChange={handleChange}
                        className="w-full p-2 border border-gray-300 rounded"
                        placeholder="Ej: +593"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Mensaje Predeterminado</label>
                      <input
                        type="text"
                        name="whatsapp_default_message"
                        value={settings.whatsapp_default_message || ''}
                        onChange={handleChange}
                        className="w-full p-2 border border-gray-300 rounded"
                        placeholder="Hola, adjunto su documento..."
                      />
                    </div>
                  </div>
                </div>
                {/* ------------------------------------------- */}

              </div>

              <div className="flex justify-end mt-6">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 font-bold shadow-lg transition-transform active:scale-95"
                >
                  <HiOutlineSave className="w-5 h-5" />
                  {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompanySettingsPage;