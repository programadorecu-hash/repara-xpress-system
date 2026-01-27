// frontend/src/pages/RegisterPage.jsx

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import apiClient from "../services/api";
import { toast } from "react-toastify";

// --- ICONOS SVG ---
const Icons = {
  Store: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  User: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
       <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Mail: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  Lock: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  Keypad: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4h-4v-4H8m13-9v2m-3-2v2m-3-2v2m-3-2v2m-3-2v2m-3-2v2m-3-2v2m-3-2v2m-3-2v2" />
    </svg>
  ),
  Eye: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  EyeOff: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ),
  Briefcase: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  Check: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
};

function RegisterPage() {
  // Datos del Paso 1 (Registro)
  const [formData, setFormData] = useState({
    company_name: "",
    admin_email: "",
    admin_password: "",
    admin_pin: "",
    confirm_password: "",
    terms_accepted: false // NUEVO: Estado para el checkbox
  });

  // Visibilidad de contraseñas y modal
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false); // NUEVO: Controlar modal

  // Datos del Paso 2 (Verificación)
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Manejar cambios en el formulario
  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  // PASO 1: Enviar datos de registro
  const handleRegister = async (e) => {
    e.preventDefault();
    
    // Validaciones
    if (formData.admin_password !== formData.confirm_password) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    if (formData.admin_password.length < 6) {
        toast.error("La contraseña debe tener al menos 6 caracteres.");
        return;
    }
    if (formData.admin_pin.length < 4) {
        toast.error("El PIN debe tener al menos 4 dígitos.");
        return;
    }
    // NUEVO: Validación de términos
    if (!formData.terms_accepted) {
        toast.warn("Debes aceptar los Términos y Condiciones para continuar.");
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
      navigate("/login"); 

    } catch (error) {
      console.error(error);
      const errorMsg = error.response?.data?.detail || "Código incorrecto.";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center py-6 sm:px-6 lg:px-8 relative">
      
      {/* Encabezado Mobile-Friendly */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <h2 className="mt-2 text-3xl font-extrabold text-brand">
            {isVerifying ? "Verificación" : "Crea tu Taller"}
        </h2>
        <p className="mt-2 text-sm text-gray-600 max-w-xs mx-auto">
            {isVerifying 
              ? "Hemos enviado un código de 6 dígitos a tu correo." 
              : "Gestiona reparaciones, ventas e inventario con ReparaSoft®."}
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-gray-100 sm:px-10">
          
          {!isVerifying ? (
            // --- PASO 1: FORMULARIO DE REGISTRO ---
            <form className="space-y-5" onSubmit={handleRegister}>
              
              {/* Nombre de la Empresa */}
              <div>
                <label className="block text-sm font-medium text-brand-soft mb-1">Nombre del Negocio</label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Icons.Briefcase />
                  </div>
                  <input
                    name="company_name"
                    type="text"
                    required
                    className="focus:ring-accent focus:border-accent block w-full pl-10 py-3 sm:text-sm border-gray-300 rounded-lg bg-gray-50"
                    placeholder="Ej. Taller Express"
                    value={formData.company_name}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Correo Electrónico */}
              <div>
                <label className="block text-sm font-medium text-brand-soft mb-1">Correo Administrador</label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Icons.Mail />
                  </div>
                  <input
                    name="admin_email"
                    type="email"
                    required
                    className="focus:ring-accent focus:border-accent block w-full pl-10 py-3 sm:text-sm border-gray-300 rounded-lg bg-gray-50"
                    placeholder="admin@tuempresa.com"
                    value={formData.admin_email}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Contraseña */}
              <div>
                <label className="block text-sm font-medium text-brand-soft mb-1">Contraseña</label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Icons.Lock />
                  </div>
                  <input
                    name="admin_password"
                    type={showPassword ? "text" : "password"}
                    required
                    className="focus:ring-accent focus:border-accent block w-full pl-10 pr-10 py-3 sm:text-sm border-gray-300 rounded-lg bg-gray-50"
                    placeholder="••••••••"
                    value={formData.admin_password}
                    onChange={handleChange}
                  />
                  <div 
                    className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-gray-400 hover:text-accent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                  </div>
                </div>
              </div>

              {/* Confirmar Contraseña */}
              <div>
                <label className="block text-sm font-medium text-brand-soft mb-1">Confirmar Contraseña</label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Icons.Lock />
                  </div>
                  <input
                    name="confirm_password"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    className={`focus:ring-accent focus:border-accent block w-full pl-10 pr-10 py-3 sm:text-sm border rounded-lg bg-gray-50 ${
                        formData.confirm_password && formData.admin_password !== formData.confirm_password 
                        ? "border-red-300 focus:border-red-500 focus:ring-red-500" 
                        : "border-gray-300"
                    }`}
                    placeholder="••••••••"
                    value={formData.confirm_password}
                    onChange={handleChange}
                  />
                   <div 
                    className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-gray-400 hover:text-accent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                  </div>
                </div>
              </div>

              {/* PIN de Seguridad */}
              <div>
                <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-brand-soft">PIN de Seguridad (4-6 dígitos)</label>
                </div>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Icons.Keypad />
                  </div>
                  <input
                    name="admin_pin"
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    className="focus:ring-accent focus:border-accent block w-full pl-10 pr-10 py-3 sm:text-sm border-gray-300 rounded-lg bg-gray-50 tracking-widest text-lg"
                    placeholder="****"
                    value={formData.admin_pin}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (!val || /^\d+$/.test(val)) {
                            handleChange(e);
                        }
                    }}
                  />
                  <div 
                    className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-gray-400 hover:text-accent"
                    onClick={() => setShowPin(!showPin)}
                  >
                    {showPin ? <Icons.EyeOff /> : <Icons.Eye />}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                    Úsalo para autorizar descuentos y acciones sensibles.
                </p>
              </div>

              {/* CHECKBOX TÉRMINOS Y CONDICIONES (NUEVO) */}
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="terms"
                    name="terms_accepted"
                    type="checkbox"
                    required
                    checked={formData.terms_accepted}
                    onChange={handleChange}
                    className="focus:ring-accent h-5 w-5 text-accent border-gray-300 rounded cursor-pointer"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="terms" className="font-medium text-gray-700">
                    Acepto los{" "}
                    <button
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className="text-accent hover:text-teal-600 underline font-bold focus:outline-none"
                    >
                      Términos y Condiciones
                    </button>
                    {" "}de ReparaSoft®
                  </label>
                  <p className="text-gray-500 text-xs">Es necesario aceptar para continuar.</p>
                </div>
              </div>

              {/* Botón de Acción */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white transition-all duration-200 ${
                    loading 
                    ? "bg-gray-400 cursor-not-allowed" 
                    : "bg-brand hover:bg-brand-deep hover:shadow-lg transform active:scale-95"
                  }`}
                >
                  {loading ? "Procesando..." : "Crear mi Taller"}
                </button>
              </div>

            </form>
          ) : (
            // --- PASO 2: VERIFICACIÓN ---
            <form className="space-y-6" onSubmit={handleVerify}>
              <div>
                <label className="block text-center text-sm font-medium text-gray-700 mb-4">
                  Ingresa el código que enviamos a <br/>
                  <span className="text-brand font-bold">{formData.admin_email}</span>
                </label>
                
                <div className="mt-1">
                  <input
                    name="verificationCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    className="block w-full text-center py-4 text-3xl font-mono tracking-[0.5em] border-2 border-accent rounded-xl focus:ring-accent focus:border-accent bg-gray-50"
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                  />
                </div>
                <p className="text-xs text-center text-gray-400 mt-2">
                    (Revisa la consola del backend si estás probando localmente)
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white transition-all duration-200 ${
                  loading 
                  ? "bg-gray-400 cursor-not-allowed" 
                  : "bg-action-green hover:bg-teal-700 hover:shadow-lg"
                }`}
              >
                {loading ? "Verificando..." : "Activar Cuenta"}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsVerifying(false)}
                  className="text-sm font-medium text-brand-soft hover:text-brand"
                >
                  ← Corregir correo
                </button>
              </div>
            </form>
          )}

          {/* Footer del Card */}
          {!isVerifying && (
            <div className="mt-8 border-t border-gray-200 pt-6">
               <p className="text-center text-sm text-gray-600">
                ¿Ya tienes una cuenta?{" "}
                <Link to="/login" className="font-bold text-accent hover:text-blue-500 transition-colors">
                  Iniciar Sesión
                </Link>
              </p>
            </div>
          )}

        </div>
      </div>

      {/* --- MODAL DE TÉRMINOS Y CONDICIONES (NUEVO) --- */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col overflow-hidden animate-fade-in-up">
            
            {/* Header del Modal */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-bold text-brand">Términos y Condiciones</h3>
                <button 
                    onClick={() => setShowTermsModal(false)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            
            {/* Contenido Legal (Scrollable) - ADAPTADO ECUADOR LOPDP & IEPI */}
            <div className="p-6 overflow-y-auto text-sm text-gray-600 space-y-4 leading-relaxed text-justify">
                <p className="font-bold text-gray-800 text-lg">Términos de Uso y Política de Privacidad</p>
                
                <p>
                    Bienvenido a <strong>ReparaSoft®</strong>. Al registrarse y utilizar nuestro sistema SaaS (Software as a Service), usted ("el Suscriptor") acepta los siguientes términos legales, redactados en cumplimiento con la normativa de la República del Ecuador.
                </p>

                <div className="space-y-2">
                    <h4 className="font-bold text-brand-deep">1. Protección de Datos (LOPDP)</h4>
                    <p>
                        En cumplimiento con la <strong>Ley Orgánica de Protección de Datos Personales (LOPDP)</strong> de Ecuador, le informamos que sus datos y los de sus clientes serán tratados con estricta confidencialidad. 
                        ReparaSoft® actúa como "Encargado del Tratamiento" de los datos que usted ingrese. Usted mantiene la calidad de "Responsable del Tratamiento" frente a sus propios clientes finales.
                    </p>
                </div>

                <div className="space-y-2">
                    <h4 className="font-bold text-brand-deep">2. Finalidad y Consentimiento</h4>
                    <p>
                        Los datos recopilados (RUC, correos, teléfonos) se utilizarán exclusivamente para:
                        a) La gestión operativa de su taller o negocio.
                        b) La emisión de comprobantes electrónicos autorizados por el <strong>SRI</strong>.
                        c) El envío de notificaciones técnicas y de seguridad.
                        No vendemos ni compartimos sus datos con terceros con fines publicitarios sin su consentimiento expreso.
                    </p>
                </div>

                <div className="space-y-2">
                    <h4 className="font-bold text-brand-deep">3. Retención de Datos (Normativa SRI)</h4>
                    <p>
                        Aunque usted tiene derecho a la eliminación de sus datos (Derecho al Olvido), cierta información transaccional (facturas, retenciones) deberá ser conservada por el periodo mínimo de 7 años exigido por el <strong>Servicio de Rentas Internas (SRI)</strong> para fines tributarios. Pasado este tiempo, o si no existe obligación legal, los datos podrán ser eliminados a su solicitud.
                    </p>
                </div>

                <div className="space-y-2">
                    <h4 className="font-bold text-brand-deep">4. Exención de Responsabilidad Técnica</h4>
                    <p>
                        ReparaSoft® implementa medidas de seguridad de alto nivel (encriptación, backups). Sin embargo, no nos hacemos responsables por pérdidas de datos causadas por:
                        a) Mal uso de sus credenciales (compartir su contraseña o PIN).
                        b) Fallas generalizadas de proveedores de internet o electricidad en Ecuador.
                        c) Ataques cibernéticos de fuerza mayor que superen los estándares razonables de seguridad.
                    </p>
                </div>

                 <div className="space-y-2">
                    <h4 className="font-bold text-brand-deep">5. Propiedad Intelectual (Registro SENADI/IEPI)</h4>
                    <p>
                        El software ReparaSoft®, su código fuente, interfaces gráficas, estructura de bases de datos y logotipos están protegidos por derechos de propiedad intelectual debidamente registrados ante el <strong>Servicio Nacional de Derechos Intelectuales (SENADI)</strong>, anteriormente conocido como <strong>IEPI</strong>, en la República del Ecuador. Queda estrictamente prohibida su copia, ingeniería inversa, distribución no autorizada o modificación. La suscripción otorga únicamente una licencia de uso temporal, no exclusiva e intransferible.
                    </p>
                </div>
            </div>

            {/* Footer del Modal */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button
                    onClick={() => {
                        setFormData({...formData, terms_accepted: true});
                        setShowTermsModal(false);
                    }}
                    className="bg-brand text-white px-6 py-2.5 rounded-xl font-bold hover:bg-brand-deep transition-colors shadow-sm"
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