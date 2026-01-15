// frontend/src/pages/RegisterPage.jsx

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import apiClient from "../services/api";
import { toast } from "react-toastify";

function RegisterPage() {
  // Estados para guardar lo que escribe el usuario
  const [formData, setFormData] = useState({
    company_name: "",
    admin_email: "",
    admin_password: "",
    admin_pin: "",
    confirm_password: ""
  });
  
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Función para actualizar los datos mientras escribe
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Función al enviar el formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 1. Validaciones básicas
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
      // 2. Enviamos los datos al Backend (a la "Oficina de Bienvenida")
      await apiClient.post("/register", {
        company_name: formData.company_name,
        admin_email: formData.admin_email,
        admin_password: formData.admin_password,
        admin_pin: formData.admin_pin
      });

      // 3. Éxito
      toast.success("¡Registro exitoso! Ahora puedes iniciar sesión.");
      navigate("/login"); // Lo mandamos a la puerta de entrada

    } catch (error) {
      console.error(error);
      // Si el backend responde con error (ej: "Email duplicado")
      const errorMsg = error.response?.data?.detail || "Error al registrar la empresa.";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-lg border border-gray-200">
        
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-secondary">Registrar Nueva Empresa</h2>
          <p className="text-gray-500 mt-2">Crea tu taller y comienza a organizar tus reparaciones.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Nombre de la Empresa */}
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

          {/* Email del Dueño */}
          <div>
            <label className="block text-gray-700 font-bold mb-1">Usuario o Correo (Admin)</label>
            <input
              type="text" 
              name="admin_email"
              placeholder="tu@email.com o demo"
              className="w-full p-3 border rounded-lg focus:outline-none focus:border-accent"
              value={formData.admin_email}
              onChange={handleChange}
              required
            />
          </div>

          {/* Contraseña y Confirmación */}
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

          {/* PIN de Seguridad */}
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

          {/* Botón de Registro */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg text-white font-bold text-lg transition duration-300 ${
              loading ? "bg-gray-400 cursor-not-allowed" : "bg-accent hover:bg-teal-600 shadow-md"
            }`}
          >
            {loading ? "Creando Empresa..." : "Registrar Empresa"}
          </button>

        </form>

        {/* Link para volver al Login */}
        <div className="mt-6 text-center border-t pt-4">
          <p className="text-gray-600">
            ¿Ya tienes una cuenta?{" "}
            <Link to="/login" className="text-accent font-bold hover:underline">
              Iniciar Sesión
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}

export default RegisterPage;