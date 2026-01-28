// frontend/src/pages/RegisterPage.jsx

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import apiClient from "../services/api";
import { toast } from "react-toastify";

// --- ICONOS SVG (Estilo unificado con Login) ---
const Icons = {
  Briefcase: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  Mail: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  Lock: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  Keypad: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4h-4v-4H8m13-9v2m-3-2v2m-3-2v2m-3-2v2m-3-2v2m-3-2v2m-3-2v2m-3-2v2m-3-2v2" />
    </svg>
  ),
  Eye: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  EyeOff: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  )
};

function RegisterPage() {
  const [formData, setFormData] = useState({
    company_name: "",
    admin_email: "",
    admin_password: "",
    admin_pin: "",
    confirm_password: "",
    terms_accepted: false
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (formData.admin_password !== formData.confirm_password) return toast.error("Las contraseñas no coinciden.");
    if (formData.admin_password.length < 6) return toast.error("La contraseña debe tener al menos 6 caracteres.");
    if (formData.admin_pin.length < 4) return toast.error("El PIN debe tener al menos 4 dígitos.");
    if (!formData.terms_accepted) return toast.warn("Debes aceptar los Términos y Condiciones.");

    setLoading(true);
    try {
      await apiClient.post("/register", {
        company_name: formData.company_name,
        admin_email: formData.admin_email,
        admin_password: formData.admin_password,
        admin_pin: formData.admin_pin
      });
      toast.info("Registro correcto. Revisa tu correo.");
      setIsVerifying(true);
    } catch (error) {
      console.error(error);
      const errorMsg = error.response?.data?.detail || "Error al registrar la empresa.";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post("/verify-account", {
        email: formData.admin_email,
        code: verificationCode
      });
      toast.success("¡Cuenta verificada! Bienvenido.");
      navigate("/login"); 
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Código incorrecto.";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-primary px-4 font-roboto py-8">
      
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-gray-100 overflow-hidden">
        
        {/* Header Limpio */}
        <div className="bg-white pt-8 pb-2 text-center">
            <h2 className="text-3xl font-extrabold text-secondary tracking-tight">
             {isVerifying ? "Verificación" : "Crear Cuenta"}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
                {isVerifying ? "Revisa tu correo electrónico" : "¿Sabes cuanto dinero pierdes por no llevar inventario?"}
            </p>
        </div>

        <div className="p-8">
          
          {!isVerifying ? (
            // --- PASO 1: FORMULARIO DE REGISTRO ---
            <form className="space-y-4" onSubmit={handleRegister}>
              
              {/* Nombre de la Empresa */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre del Taller</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icons.Briefcase />
                  </div>
                  <input
                    name="company_name"
                    type="text"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl text-secondary border border-gray-200 focus:outline-none focus:border-accent focus:bg-white transition-colors"
                    placeholder="Ej. Taller Express"
                    value={formData.company_name}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Correo Electrónico */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Correo (Admin)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icons.Mail />
                  </div>
                  <input
                    name="admin_email"
                    type="email"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl text-secondary border border-gray-200 focus:outline-none focus:border-accent focus:bg-white transition-colors"
                    placeholder="tucorreo@ejemplo.com"
                    value={formData.admin_email}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Contraseña */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Contraseña</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icons.Lock />
                  </div>
                  <input
                    name="admin_password"
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full pl-10 pr-10 py-3 bg-gray-100 rounded-xl text-secondary border border-gray-200 focus:outline-none focus:border-accent focus:bg-white transition-colors"
                    placeholder="••••••••"
                    value={formData.admin_password}
                    onChange={handleChange}
                  />
                  <div 
                    className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                  </div>
                </div>
              </div>

              {/* Confirmar Contraseña */}
              <div>
                 <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icons.Lock />
                  </div>
                  <input
                    name="confirm_password"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    className={`w-full pl-10 pr-10 py-3 bg-gray-100 rounded-xl text-secondary border border-gray-200 focus:outline-none focus:border-accent focus:bg-white transition-colors ${
                        formData.confirm_password && formData.admin_password !== formData.confirm_password 
                        ? "border-red-300 focus:border-red-500" 
                        : ""
                    }`}
                    placeholder="Confirmar contraseña"
                    value={formData.confirm_password}
                    onChange={handleChange}
                  />
                   <div 
                    className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                  </div>
                </div>
              </div>

              {/* PIN */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">PIN Seguridad (4-6 dígitos)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icons.Keypad />
                  </div>
                  <input
                    name="admin_pin"
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    className="w-full pl-10 pr-10 py-3 bg-gray-100 rounded-xl text-secondary border border-gray-200 focus:outline-none focus:border-accent focus:bg-white transition-colors tracking-widest font-mono"
                    placeholder="****"
                    value={formData.admin_pin}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (!val || /^\d+$/.test(val)) handleChange(e);
                    }}
                  />
                  <div 
                    className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                    onClick={() => setShowPin(!showPin)}
                  >
                    {showPin ? <Icons.EyeOff /> : <Icons.Eye />}
                  </div>
                </div>
              </div>

              {/* Checkbox Términos */}
              <div className="flex items-start py-2">
                <input
                    id="terms"
                    name="terms_accepted"
                    type="checkbox"
                    required
                    checked={formData.terms_accepted}
                    onChange={handleChange}
                    className="mt-1 h-4 w-4 text-accent border-gray-300 rounded focus:ring-accent"
                  />
                <div className="ml-3 text-sm">
                  <label htmlFor="terms" className="font-medium text-gray-600">
                    Acepto los{" "}
                    <button
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className="text-accent hover:text-blue-600 font-bold hover:underline"
                    >
                      Términos y Condiciones
                    </button>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent hover:bg-blue-600 text-white font-bold py-3.5 rounded-xl transition duration-300 shadow-lg transform active:scale-95 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? "Creando..." : "Registrar mi Taller"}
              </button>

            </form>
          ) : (
            // --- PASO 2: VERIFICACIÓN ---
            <form className="space-y-6" onSubmit={handleVerify}>
              <div>
                <label className="block text-center text-sm font-medium text-gray-700 mb-4">
                  Ingresa el código enviado a: <br/>
                  <span className="text-accent font-bold">{formData.admin_email}</span>
                </label>
                
                <input
                    name="verificationCode"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    className="block w-full text-center py-4 text-3xl font-mono tracking-[0.5em] border-2 border-accent rounded-xl focus:outline-none bg-gray-50 text-secondary"
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-xl transition duration-300 shadow-lg transform active:scale-95"
              >
                {loading ? "Verificando..." : "Activar Cuenta"}
              </button>
              
              <div className="text-center">
                 <button type="button" onClick={() => setIsVerifying(false)} className="text-sm text-gray-500 underline">Corregir correo</button>
              </div>
            </form>
          )}

          {/* Footer */}
          {!isVerifying && (
            <div className="mt-8 text-center border-t border-gray-100 pt-6">
               <p className="text-sm text-gray-500">
                ¿Ya tienes cuenta?{" "}
                <Link to="/login" className="font-bold text-accent hover:text-blue-600">
                  Inicia Sesión
                </Link>
              </p>
            </div>
          )}

        </div>
      </div>

      {/* --- MODAL LEGAL (Blindaje IEPI/SRI/LOPDP) --- */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col overflow-hidden animate-fade-in-up">
            
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-bold text-secondary">Legal</h3>
                <button onClick={() => setShowTermsModal(false)} className="text-gray-400 hover:text-red-500">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto text-sm text-gray-600 space-y-4 leading-relaxed text-justify h-96">
                <p className="font-bold text-secondary text-lg mb-2">Términos y Condiciones de Uso del Servicio</p>
                
                <p>
                    El presente contrato describe los términos y condiciones aplicables al uso del software <strong>ReparaSoft®</strong> ofrecido por el PROVEEDOR dentro del territorio de la República del Ecuador. Al hacer clic en "Aceptar", usted (el "USUARIO") acepta vincularse jurídicamente bajo las siguientes cláusulas:
                </p>

                <div className="space-y-1">
                    <h4 className="font-bold text-secondary text-xs uppercase">1. Licencia de Uso (SaaS)</h4>
                    <p className="text-xs">
                        Se otorga una licencia limitada, no exclusiva, intransferible y revocable para acceder y utilizar el software exclusivamente para la gestión de su negocio. El USUARIO reconoce que el software es una herramienta de gestión y no garantiza resultados económicos específicos.
                    </p>
                </div>

                <div className="space-y-1">
                    <h4 className="font-bold text-secondary text-xs uppercase">2. Limitación de Responsabilidad (Cláusula de Indemnidad)</h4>
                    <p className="text-xs">
                        El servicio se presta "TAL CUAL" (As-Is). En la máxima medida permitida por la ley ecuatoriana, ReparaSoft® <strong>NO será responsable</strong> por daños directos, indirectos, incidentales, especiales o consecuentes, incluyendo pero no limitado a: lucro cesante, pérdida de datos, interrupción del negocio, fallas en la conexión a internet, cortes de energía eléctrica o caídas de los servidores del SRI que impidan la facturación.
                    </p>
                </div>

                <div className="space-y-1">
                    <h4 className="font-bold text-secondary text-xs uppercase">3. Protección de Datos (LOPDP)</h4>
                    <p className="text-xs">
                        Conforme a la Ley Orgánica de Protección de Datos Personales, ReparaSoft® actúa en calidad de "ENCARGADO DEL TRATAMIENTO". El USUARIO mantiene la calidad de "RESPONSABLE DEL TRATAMIENTO" de los datos de sus clientes finales y garantiza haber obtenido el consentimiento lícito para ingresarlos al sistema. ReparaSoft® aplicará medidas de seguridad técnicas para proteger dicha información.
                    </p>
                </div>

                <div className="space-y-1">
                    <h4 className="font-bold text-secondary text-xs uppercase">4. Facturación Electrónica y SRI</h4>
                    <p className="text-xs">
                        El USUARIO es el único responsable de la veracidad de la información tributaria ingresada. ReparaSoft® actúa como mero conducto tecnológico hacia el SRI. De conformidad con la normativa tributaria, los comprobantes electrónicos generados se conservarán digitalmente por el plazo mínimo legal de 7 años.
                    </p>
                </div>

                <div className="space-y-1">
                    <h4 className="font-bold text-secondary text-xs uppercase">5. Propiedad Intelectual (SENADI)</h4>
                    <p className="text-xs">
                        Todo el código fuente, bases de datos, diseños, logotipos y funcionalidades de ReparaSoft® son propiedad exclusiva de sus desarrolladores y están protegidos por el Servicio Nacional de Derechos Intelectuales (SENADI / IEPI). Queda estrictamente prohibida la ingeniería inversa, copia, distribución o reventa del software.
                    </p>
                </div>

                <div className="space-y-1">
                    <h4 className="font-bold text-secondary text-xs uppercase">6. Jurisdicción</h4>
                    <p className="text-xs">
                        Para cualquier controversia derivada de este contrato, las partes se someten a la jurisdicción de los jueces civiles de la ciudad de Quito y al procedimiento que corresponda según la ley.
                    </p>
                </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button
                    onClick={() => { setFormData({...formData, terms_accepted: true}); setShowTermsModal(false); }}
                    className="bg-accent text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-600 transition-colors shadow-sm"
                >
                    Aceptar y Cerrar
                </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default RegisterPage;