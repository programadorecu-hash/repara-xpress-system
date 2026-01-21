// frontend/src/pages/RegisterPage.jsx

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import apiClient from "../services/api";
import { toast } from "react-toastify";

function RegisterPage() {
  // Datos del Paso 1 (Registro)
  const [formData, setFormData] = useState({
    company_name: "",
    admin_email: "",
    admin_password: "",
    admin_pin: "",
    confirm_password: ""
  });

  // Datos del Paso 2 (Verificación)
  const [isVerifying, setIsVerifying] = useState(false); // ¿Estamos en modo verificación?
  const [verificationCode, setVerificationCode] = useState("");

  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Manejar cambios en el formulario inicial
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // PASO 1: Enviar datos de registro
  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (formData.admin_password !== formData.confirm_password) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    if (formData.admin_pin.length < 4) {
        toast.error("El PIN debe tener al menos 4 dígitos.");
        return;
    }

    setLoading(true);

    try {
      await apiClient.post("/register", {
        company_name: formData.company_name,
        admin_email: formData.admin_email,
        admin_password: formData.admin_password,
        admin_pin: formData.admin_pin
      });

      // Si sale bien, no navegamos. Cambiamos al "Paso 2"
      toast.info("Registro correcto. Revisa tu correo para el código.");
      setIsVerifying(true);

    } catch (error) {
      console.error(error);
      const errorMsg = error.response?.data?.detail || "Error al registrar la empresa.";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // PASO 2: Verificar código
  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiClient.post("/verify-account", {
        email: formData.admin_email,
        code: verificationCode
      });

      toast.success("¡Cuenta verificada! Bienvenido.");
      navigate("/login"); // Ahora sí vamos al login

    } catch (error) {
      console.error(error);
      const errorMsg = error.response?.data?.detail || "Código incorrecto.";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-lg border border-gray-200">
        
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-secondary">
            {isVerifying ? "Verifica tu Cuenta" : "Registrar Nueva Empresa"}
          </h2>
          <p className="text-gray-500 mt-2">
            {isVerifying 
              ? `Ingresa el código enviado a ${formData.admin_email}` 
              : "Crea tu taller y comienza a organizar tus reparaciones."}
          </p>
        </div>

        {/* Mostramos Formulario 1 o Formulario 2 según el estado */}
        {!isVerifying ? (
          // --- FORMULARIO DE REGISTRO (PASO 1) ---
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-gray-700 font-bold mb-1">Nombre del Taller / Empresa</label>
              <input
                type="text"
                name="company_name"
                placeholder="Ej: Fix It Quito"
                className="w-full p-3 border rounded-lg focus:outline-none focus:border-accent"
                value={formData.company_name}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">Usuario o Correo (Admin)</label>
              <input
                type="text" 
                name="admin_email"
                placeholder="tu@email.com"
                className="w-full p-3 border rounded-lg focus:outline-none focus:border-accent"
                value={formData.admin_email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Contraseña</label>
                <input
                  type="password"
                  name="admin_password"
                  className="w-full p-3 border rounded-lg focus:outline-none focus:border-accent"
                  value={formData.admin_password}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-bold mb-1">Confirmar Contraseña</label>
                <input
                  type="password"
                  name="confirm_password"
                  className="w-full p-3 border rounded-lg focus:outline-none focus:border-accent"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">PIN de Seguridad (4-6 dígitos)</label>
              <p className="text-xs text-gray-500 mb-1">Usado para autorizar descuentos y borrar ítems.</p>
              <input
                type="password"
                name="admin_pin"
                maxLength={6}
                placeholder="****"
                className="w-full p-3 border rounded-lg focus:outline-none focus:border-accent text-center tracking-widest text-lg"
                value={formData.admin_pin}
                onChange={handleChange}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg text-white font-bold text-lg transition duration-300 ${
                loading ? "bg-gray-400 cursor-not-allowed" : "bg-accent hover:bg-teal-600 shadow-md"
              }`}
            >
              {loading ? "Procesando..." : "Siguiente: Verificar Correo"}
            </button>
          </form>
        ) : (
          // --- FORMULARIO DE VERIFICACIÓN (PASO 2) ---
          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <label className="block text-gray-700 font-bold mb-2 text-center">Código de Verificación (6 dígitos)</label>
              <input
                type="text"
                name="verificationCode"
                maxLength={6}
                placeholder="123456"
                className="w-full p-4 border-2 border-accent rounded-lg focus:outline-none text-center text-3xl tracking-[0.5em] font-mono"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                required
                autoFocus
              />
              <p className="text-sm text-gray-500 text-center mt-2">
                (Revisa la consola del backend para ver el código simulado)
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg text-white font-bold text-lg transition duration-300 ${
                loading ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700 shadow-md"
              }`}
            >
              {loading ? "Verificando..." : "Activar Cuenta"}
            </button>
            
            <button
              type="button"
              onClick={() => setIsVerifying(false)}
              className="w-full text-center text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Volver a corregir datos
            </button>
          </form>
        )}

        {/* Link para volver al Login (solo visible si no estamos verificando para no distraer) */}
        {!isVerifying && (
          <div className="mt-6 text-center border-t pt-4">
            <p className="text-gray-600">
              ¿Ya tienes una cuenta?{" "}
              <Link to="/login" className="text-accent font-bold hover:underline">
                Iniciar Sesión
              </Link>
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

export default RegisterPage;