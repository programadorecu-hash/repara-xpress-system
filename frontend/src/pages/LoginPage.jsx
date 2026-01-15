import React, { useState, useContext } from "react";
import apiClient from "../services/api";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const response = await apiClient.post(
        "/token", // ¡Sin localhost! Solo la ruta.
        formData
      );

      // Llamamos a nuestra nueva función de login y esperamos el perfil
      const userProfile = await login(response.data.access_token);

      // --- INICIO DE NUESTRO CÓDIGO (Lógica de Login Simplificada) ---
      // El "Guardia de PIN" (en AuthContext) se encarga de redirigir a /crear-pin si es necesario.
      // Nosotros solo nos preocupamos de si tiene turno activo o no.

      // --- LÓGICA DE REDIRECCIÓN CORREGIDA ---
      
      // 1. REGLA DE ORO: Si no tiene PIN, a crear PIN (¡Sea quien sea!)
      if (userProfile && !userProfile.hashed_pin) {
        navigate("/crear-pin");
        return; // ¡Importante! Detenemos aquí para que no siga ejecutando.
      }

      // 2. Si ya tiene PIN y tiene turno activo -> Al Dashboard
      if (userProfile && userProfile.active_shift) {
        navigate("/");
      } 
      // 3. Si tiene PIN pero NO tiene turno -> A Iniciar Turno
      else {
        navigate("/iniciar-turno");
      }
      // --- FIN ---
    } catch (err) {
      setError("Email o contraseña incorrectos.");
    }
  };

  return (
    // El JSX del formulario se mantiene igual que antes
    <div className="flex items-center justify-center min-h-screen bg-primary px-4"> 
      {/* Agregado 'px-4' arriba para que en celulares la caja no toque los bordes */}
      <div className="p-8 bg-white rounded-lg shadow-lg w-full max-w-md border">
        <h2 className="text-3xl font-bold text-center text-secondary mb-6">
          Iniciar Sesión
        </h2>
        <form onSubmit={handleSubmit}>
          {error && (
            <p className="bg-red-200 text-red-800 p-3 rounded-lg mb-4">
              {error}
            </p>
          )}
          <div className="mb-4">
            <label className="block text-gray-500 mb-2" htmlFor="email">
              Usuario o Correo
            </label>
            {/* CAMBIO: type="text" permite ingresar usuarios como 'ANDY202' sin que el navegador pida arroba (@) */}
            <input
              type="text"
              id="email"
              className="w-full p-3 bg-gray-100 rounded-lg text-secondary border border-gray-300 focus:outline-none focus:border-detail uppercase" // Agregamos 'uppercase' visual
              value={email}
              onChange={(e) => setEmail(e.target.value)} // El backend buscará este texto en la columna email
              required
              placeholder="Ej: pepito@gmail.com o ANDY202"
            />
          </div>
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-gray-500" htmlFor="password">
                Contraseña
              </label>
              <button
                type="button"
                onClick={() => navigate("/recuperar-clave")}
                className="text-sm text-blue-600 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <input
              type="password"
              id="password"
              className="w-full p-3 bg-gray-100 rounded-lg text-secondary border border-gray-300 focus:outline-none focus:border-detail"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-accent hover:bg-teal-500 text-white font-bold py-3 rounded-lg transition duration-300"
          >
            Ingresar
          </button>
        </form>

        {/* --- SECCIÓN NUEVA: Enlace al Registro --- */}
        <div className="mt-6 text-center border-t border-gray-200 pt-4">
          <p className="text-gray-600 mb-2">¿Quieres usar este sistema en tu negocio?</p>
          <button
            onClick={() => navigate("/register")}
            className="text-accent font-bold hover:underline hover:text-teal-700 transition-colors"
          >
            Registrar mi Empresa Gratis
          </button>
        </div>
        {/* ----------------------------------------- */}

      </div>
    </div>
  );
}

export default LoginPage;
