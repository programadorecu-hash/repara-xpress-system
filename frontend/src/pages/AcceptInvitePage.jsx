// frontend/src/pages/AcceptInvitePage.jsx

import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import apiClient from "../services/api";
import { toast } from "react-toastify";

function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Obtenemos el "ticket" de la URL (ej: ?token=abc-123...)
  const tokenFromUrl = searchParams.get("token");

  const [formData, setFormData] = useState({
    full_name: "",
    id_card: "",
    password: "",
    confirm_password: "",
    pin: "",
    emergency_contact: ""
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tokenFromUrl) {
      toast.error("Enlace inválido. No hay ticket de invitación.");
    }
  }, [tokenFromUrl]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!tokenFromUrl) {
      toast.error("No se encontró el token de invitación.");
      return;
    }

    if (formData.password !== formData.confirm_password) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    if (formData.pin.length < 4) {
      toast.error("El PIN debe tener al menos 4 dígitos.");
      return;
    }

    setLoading(true);

    try {
      // Enviamos el paquete completo al backend
      await apiClient.post("/invitations/accept", {
        token: tokenFromUrl,
        full_name: formData.full_name.toUpperCase(),
        id_card: formData.id_card,
        password: formData.password,
        pin: formData.pin,
        emergency_contact: formData.emergency_contact?.toUpperCase()
      });

      toast.success("¡Bienvenido al equipo! Ya puedes iniciar sesión.");
      navigate("/login");

    } catch (error) {
      console.error(error);
      const errorMsg = error.response?.data?.detail || "Error al procesar la invitación.";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!tokenFromUrl) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <h2 className="text-2xl font-bold text-red-600">Enlace Inválido</h2>
        <p className="mt-2 text-gray-600">Parece que este enlace está roto o incompleto.</p>
        <Link to="/login" className="mt-4 text-accent hover:underline">Ir al Inicio</Link>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4 py-8">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-lg border border-gray-200">
        
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-secondary">Bienvenido al Equipo</h2>
          <p className="text-gray-500 mt-2">Completa tu perfil para activar tu cuenta.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Datos Personales */}
          <div>
            <label className="block text-gray-700 font-bold mb-1">Nombre Completo</label>
            <input
              type="text"
              name="full_name"
              placeholder="Ej: JUAN PÉREZ"
              className="w-full p-3 border rounded-lg uppercase"
              value={formData.full_name}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">Cédula / ID</label>
            <input
              type="text"
              name="id_card"
              placeholder="171..."
              className="w-full p-3 border rounded-lg"
              value={formData.id_card}
              onChange={handleChange}
              required
            />
          </div>

          {/* Seguridad */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-bold mb-1">Crea tu Contraseña</label>
              <input
                type="password"
                name="password"
                className="w-full p-3 border rounded-lg"
                placeholder="Mínimo 8 caracteres"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-bold mb-1">Confirma Contraseña</label>
              <input
                type="password"
                name="confirm_password"
                className="w-full p-3 border rounded-lg"
                value={formData.confirm_password}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">Crea tu PIN (Seguridad)</label>
            <p className="text-xs text-gray-500 mb-1">Este código lo usarás para firmar operaciones rápidas.</p>
            <input
              type="password"
              name="pin"
              maxLength={6}
              placeholder="****"
              className="w-full p-3 border rounded-lg text-center tracking-widest text-lg"
              value={formData.pin}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">Contacto de Emergencia</label>
            <input
              type="text"
              name="emergency_contact"
              placeholder="Nombre y Teléfono"
              className="w-full p-3 border rounded-lg uppercase"
              value={formData.emergency_contact}
              onChange={handleChange}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg text-white font-bold text-lg transition duration-300 ${
              loading ? "bg-gray-400 cursor-not-allowed" : "bg-accent hover:bg-teal-600 shadow-md"
            }`}
          >
            {loading ? "Registrando..." : "Crear mi Cuenta"}
          </button>

        </form>
      </div>
    </div>
  );
}

export default AcceptInvitePage;