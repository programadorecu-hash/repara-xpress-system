// frontend/src/pages/LoginPage.jsx

import React, { useState, useContext } from "react";
import apiClient from "../services/api";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import { useSearchParams } from "react-router-dom"; 

// --- ICONOS SVG (Estilo unificado) ---
const Icons = {
  User: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
       <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Lock: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  Search: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
};

// Función auxiliar para obtener la fecha actual formateada
const getCurrentDateText = () => {
  const date = new Date();
  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
};

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useContext(AuthContext);

  // --- LÓGICA AUTO-DEMO ---
  React.useEffect(() => {
    if (searchParams.get("demo") === "true") {
      setEmail("demo");
      setPassword("demo");
    }
  }, [searchParams]);

  const fillDemoCredentials = () => {
    setEmail("demo");
    setPassword("demo");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const response = await apiClient.post("/token", formData);
      const userProfile = await login(response.data.access_token);

      // --- LÓGICA DE REDIRECCIÓN ---
      if (userProfile && !userProfile.hashed_pin) {
        navigate("/crear-pin");
        return;
      }
      if (userProfile && userProfile.active_shift) {
        navigate("/");
      } else {
        navigate("/iniciar-turno");
      }
    } catch (err) {
      setError("Email o contraseña incorrectos.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-primary px-4 font-roboto py-8"> 
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-gray-100 overflow-hidden">
        
        {/* Header Limpio */}
        <div className="bg-white pt-8 pb-2 text-center">
            <h2 className="text-3xl font-extrabold text-secondary tracking-tight">
             ReparaSoft<span className="text-accent text-lg align-top">®</span>
            </h2>
            <p className="text-gray-500 text-sm mt-1 leading-relaxed">
                No pierdas plata! <br />
                ¿Sabes cuánto vendes? ¿Qué tienes?
            </p>
        </div>

        <div className="p-8">
            <h3 className="text-xl font-bold text-center text-secondary mb-6">
            Iniciar Sesión
            </h3>

            <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 rounded text-sm mb-4">
                <p>{error}</p>
                </div>
            )}
            
            {/* Input Usuario */}
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icons.User />
                </div>
                <input
                    type="text"
                    id="email"
                    className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl text-secondary border border-gray-200 focus:outline-none focus:border-accent focus:bg-white transition-colors"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="Usuario o Correo"
                />
            </div>

            {/* Input Password */}
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icons.Lock />
                </div>
                <input
                    type="password"
                    id="password"
                    className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl text-secondary border border-gray-200 focus:outline-none focus:border-accent focus:bg-white transition-colors"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Contraseña"
                />
            </div>
            
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={() => navigate("/recuperar-clave")}
                    className="text-xs font-semibold text-gray-500 hover:text-accent"
                >
                    ¿Olvidaste tu contraseña?
                </button>
            </div>

            <button
                type="submit"
                className="w-full bg-accent hover:bg-blue-600 text-white font-bold py-3.5 rounded-xl transition duration-300 shadow-lg transform active:scale-95"
            >
                Ingresar
            </button>

            {/* Botón Demo */}
            <button
                type="button"
                onClick={fillDemoCredentials}
                className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-3 rounded-xl transition duration-300 border border-indigo-200 text-sm flex justify-center items-center gap-2"
            >
                <span>🧪</span> Probar Demo (Acceso Rápido)
            </button>
            </form>

            {/* --- SECCIÓN PÚBLICA --- */}
            <div className="mt-8 pt-6 border-t border-gray-100">
            
            {/* Botón Gancho PRINCIPAL */}
            <button
                onClick={() => navigate("/catalogo-repuestos")}
                className="w-full relative overflow-hidden bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-blue-900 font-extrabold py-4 px-6 rounded-2xl shadow-xl transform hover:scale-[1.02] transition-all duration-300 group mb-6"
            >
                <div className="absolute top-0 left-0 w-full h-full bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                <div className="flex items-center justify-center space-x-3">
                    <Icons.Search />
                    <span className="uppercase tracking-wide text-sm sm:text-base">Lista de Precios {getCurrentDateText()}</span>
                </div>
            </button>

            <div className="text-center">
                <p className="text-xs text-gray-400 mb-2">¿Nuevo por aquí?</p>
                <button
                onClick={() => navigate("/register")}
                className="text-accent font-bold hover:underline hover:text-blue-700 transition-colors text-sm"
                >
                Crear Cuenta de Taller Gratis
                </button>
            </div>
            
            </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;