// frontend/src/pages/PasswordRecoveryPage.jsx

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import apiClient from "../services/api";
import { toast } from "react-toastify";

function PasswordRecoveryPage() {
  const [step, setStep] = useState(1); // 1 = Pedir Email, 2 = Poner Código y Nueva Clave
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Paso 1: Solicitar el Código
  const handleRequestCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post("/password-recovery/request", { email });
      toast.info("Si el correo existe, se ha enviado un código de verificación.");
      setStep(2); // Avanzamos al siguiente paso visualmente
    } catch (error) {
      console.error(error);
      toast.error("Error al solicitar el código.");
    } finally {
      setLoading(false);
    }
  };

  // Paso 2: Confirmar Código y Cambiar Clave
  const handleConfirmReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post("/password-recovery/confirm", {
        email,
        recovery_code: code,
        new_password: newPassword,
      });
      toast.success("¡Contraseña actualizada! Inicia sesión ahora.");
      navigate("/login");
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.detail || "Código incorrecto o expirado.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md border border-gray-200">
        
        <h2 className="text-2xl font-bold text-center text-secondary mb-2">
          Recuperar Contraseña
        </h2>

        {step === 1 ? (
          // --- FORMULARIO PASO 1: EMAIL ---
          <form onSubmit={handleRequestCode} className="space-y-6">
            <p className="text-gray-500 text-center text-sm mb-4">
              Ingresa tu correo electrónico asociado a la cuenta. Te enviaremos un código temporal.
            </p>
            <div>
              <label className="block text-gray-700 font-bold mb-1">Correo Electrónico</label>
              <input
                type="email"
                className="w-full p-3 border rounded-lg focus:outline-none focus:border-accent"
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition duration-300"
            >
              {loading ? "Enviando..." : "Enviar Código"}
            </button>
          </form>
        ) : (
          // --- FORMULARIO PASO 2: CÓDIGO Y NUEVA CLAVE ---
          <form onSubmit={handleConfirmReset} className="space-y-6">
            <p className="text-green-600 text-center text-sm mb-4 font-semibold bg-green-50 p-2 rounded">
              ¡Código enviado! Revisa tu correo (o la consola del servidor).
            </p>
            <div>
              <label className="block text-gray-700 font-bold mb-1">Código de Verificación</label>
              <input
                type="text"
                className="w-full p-3 border rounded-lg focus:outline-none focus:border-accent text-center tracking-widest text-lg"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-bold mb-1">Nueva Contraseña</label>
              <input
                type="password"
                className="w-full p-3 border rounded-lg focus:outline-none focus:border-accent"
                placeholder="Mínimo 8 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-teal-600 text-white font-bold py-3 rounded-lg transition duration-300"
            >
              {loading ? "Actualizando..." : "Cambiar Contraseña"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center pt-4 border-t">
          <Link to="/login" className="text-gray-500 hover:text-gray-800 text-sm font-medium">
            ← Volver al inicio de sesión
          </Link>
        </div>

      </div>
    </div>
  );
}

export default PasswordRecoveryPage;