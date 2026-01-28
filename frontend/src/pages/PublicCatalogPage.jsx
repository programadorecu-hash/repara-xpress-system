import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  HiSearch, HiOutlineChatAlt2, HiStar, HiOutlineStar, HiX, 
  HiOfficeBuilding, HiUserCircle, HiZoomIn, HiPhotograph, 
  HiLightningBolt, HiCheckCircle, HiArrowDown, HiArrowLeft 
} from "react-icons/hi";
import apiClient, { getCompanyPublicProfile, submitCompanyReview } from "../services/api";
import { useAuth } from "../context/AuthContext";
import ProductForm from "../components/ProductForm"; // Importamos el formulario

// --- COMPONENTE 1: VISOR DE IMAGEN (ZOOM MODAL) - ESTILO DARKROOM ---
function ImagePreviewModal({ imageUrl, productName, onClose }) {
  if (!imageUrl) return null;
  const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${import.meta.env.VITE_API_URL}${imageUrl}`;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/95 backdrop-blur-md flex items-center justify-center z-[70] p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div className="relative max-w-6xl w-full h-full flex flex-col items-center justify-center">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full p-3 backdrop-blur-sm"
        >
          <HiX className="w-8 h-8" />
        </button>

        <img 
          src={fullUrl} 
          alt={productName} 
          className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl ring-1 ring-white/10"
          onClick={(e) => e.stopPropagation()}
        />
        
        <div className="mt-6 px-6 py-3 bg-black/40 rounded-full backdrop-blur-md border border-white/10">
          <p className="text-white font-medium text-lg tracking-wide">{productName}</p>
        </div>
      </div>
    </div>
  );
}

// --- COMPONENTE 2: MODAL DE PERFIL (ESTILO DASHBOARD) ---
function CompanyProfileModal({ companyId, onClose }) {
  const { user } = useAuth();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    async function loadData() {
      try {
        const data = await getCompanyPublicProfile(companyId);
        setCompany(data);
      } catch (error) {
        console.error("Error cargando perfil:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [companyId]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return alert("Por favor escribe un comentario.");
    setSubmitting(true);
    try {
      await submitCompanyReview(companyId, { rating, comment });
      const data = await getCompanyPublicProfile(companyId);
      setCompany(data);
      setComment("");
      alert("¡Gracias por tu opinión!");
    } catch (error) {
      alert(error.response?.data?.detail || "Error al enviar reseña.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!company && !loading) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative border border-slate-200">
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">Perfil del Distribuidor</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-full transition-colors">
            <HiX className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div></div>
        ) : (
          <div className="p-6 md:p-8">
            {/* Header Perfil */}
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-5 rounded-2xl shadow-lg shadow-blue-500/20">
                <HiOfficeBuilding className="w-12 h-12 text-white" />
              </div>
              <div className="text-center md:text-left flex-1">
                <h2 className="text-3xl font-bold text-slate-900">{company.name}</h2>
                <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => {
                      const avg = company.reviews.length > 0 ? (company.reviews.reduce((acc, r) => acc + r.rating, 0) / company.reviews.length) : 0;
                      return i < Math.round(avg) ? <HiStar key={i} className="w-5 h-5" /> : <HiOutlineStar key={i} className="w-5 h-5 text-slate-300" />;
                    })}
                  </div>
                  <span className="text-slate-500 font-medium">
                    {company.reviews.length > 0 ? (company.reviews.reduce((acc, r) => acc + r.rating, 0) / company.reviews.length).toFixed(1) : "N/A"}
                  </span>
                  <span className="text-slate-400 text-sm">({company.reviews.length} reseñas)</span>
                </div>
                {company.settings?.address && (
                  <p className="text-slate-500 mt-3 flex items-center justify-center md:justify-start gap-1">
                    📍 <span className="font-medium">{company.settings.address}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Lista de Reseñas */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <HiUserCircle className="w-5 h-5 text-blue-500" />
                Lo que dicen los técnicos
              </h3>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {company.reviews.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <p className="text-slate-400">Aún no hay opiniones. ¡Sé el primero en calificar!</p>
                  </div>
                ) : (
                  company.reviews.map((rev) => (
                    <div key={rev.id} className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-slate-700 text-sm">{rev.user_name}</span>
                        <div className="flex text-yellow-400 text-xs">
                          {[...Array(5)].map((_, i) => (i < rev.rating ? <HiStar key={i} /> : <HiOutlineStar key={i} className="text-slate-200" />))}
                        </div>
                      </div>
                      <p className="text-slate-600 text-sm italic">"{rev.comment}"</p>
                      <p className="text-xs text-slate-400 mt-2 text-right">{new Date(rev.created_at).toLocaleDateString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Formulario */}
            {user ? (
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <h4 className="font-bold text-slate-800 mb-4">Calificar a este proveedor</h4>
                <form onSubmit={handleSubmitReview}>
                  <div className="flex gap-2 mb-4 justify-center md:justify-start">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button type="button" key={star} onClick={() => setRating(star)} className="transform transition hover:scale-110 focus:outline-none">
                        {star <= rating ? <HiStar className="w-8 h-8 text-yellow-400 drop-shadow-sm" /> : <HiOutlineStar className="w-8 h-8 text-slate-300" />}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm transition-shadow shadow-sm"
                    rows="3"
                    placeholder="¿Cómo fue la calidad del repuesto y la atención?"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required
                  ></textarea>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl w-full transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Publicando..." : "Publicar Opinión"}
                  </button>
                </form>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center">
                <p className="text-blue-800 font-medium mb-3">¿Eres cliente de este distribuidor?</p>
                <a href="/login" className="inline-block bg-white text-blue-600 border border-blue-200 px-6 py-2 rounded-full font-bold hover:bg-blue-50 transition-colors">
                  Inicia Sesión para Opinar
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- COMPONENTE TARJETA DE PRODUCTO (ESTILO PREMIUM) ---
function ProductCard({ item, onOpenPreview, onOpenProfile, onWhatsAppClick }) {
  const [currentImage, setCurrentImage] = useState(item.images.length > 0 ? item.images[0] : null);
  const placeholderImage = "https://cdn-icons-png.flaticon.com/512/6866/6866547.png";
  const getFullUrl = (url) => url ? (url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL}${url}`) : placeholderImage;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-blue-200 transition-all duration-300 group flex flex-col overflow-hidden relative">
      
      {/* Badge Flotante "Verificado" (Estético) */}
      <div className="absolute top-0 right-0 z-20 p-3">
        {item.stock_status === 'Disponible' && (
          <span className="flex items-center gap-1 bg-white/90 backdrop-blur text-emerald-600 text-[10px] font-bold px-2 py-1 rounded-full shadow-sm border border-emerald-100">
            <HiCheckCircle /> STOCK OK
          </span>
        )}
      </div>

      {/* --- Visor Imagen --- */}
      <div 
        // CAMBIO: Altura h-52 en celular, h-64 en PC para ver más contenido sin tanto scroll
        className="relative h-52 sm:h-64 bg-slate-50 flex items-center justify-center p-6 cursor-zoom-in overflow-hidden group-hover:bg-slate-100 transition-colors"
        onClick={() => onOpenPreview(currentImage || placeholderImage, item.product_name)}
      >
        {currentImage ? (
          <img 
            src={getFullUrl(currentImage)} 
            alt={item.product_name}
            className="h-full w-full object-contain drop-shadow-md transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex flex-col items-center text-slate-300">
            <HiPhotograph className="w-16 h-16 opacity-50" />
            <span className="text-xs mt-2 font-medium">Sin imagen</span>
          </div>
        )}
        
        {/* Overlay Lupa */}
        {currentImage && (
          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="bg-white text-slate-700 p-3 rounded-full shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-300">
              <HiZoomIn className="w-6 h-6" />
            </div>
          </div>
        )}
      </div>

      {/* --- Miniaturas (Estilo Dock) --- */}
      {item.images.length > 1 && (
        <div className="px-4 py-2 bg-white border-b border-slate-100 flex justify-center gap-2">
          {item.images.slice(0, 3).map((img, idx) => (
            <div 
              key={idx}
              onMouseEnter={() => setCurrentImage(img)}
              onClick={(e) => { e.stopPropagation(); onOpenPreview(img, item.product_name); }}
              className={`w-10 h-10 rounded-lg border cursor-pointer overflow-hidden transition-all ${
                currentImage === img 
                  ? 'border-blue-500 ring-2 ring-blue-100 scale-110 z-10' 
                  : 'border-slate-200 opacity-60 hover:opacity-100 hover:border-slate-400'
              }`}
            >
              <img src={getFullUrl(img)} className="w-full h-full object-cover" alt="" />
            </div>
          ))}
        </div>
      )}

      {/* --- Información --- */}
      <div className="p-5 flex-1 flex flex-col bg-white">
        <div className="flex-1">
          {/* Categoría o Marca */}
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">Repuesto</p>
          
          <h3 
            className="font-bold text-slate-900 text-lg leading-tight mb-3 line-clamp-2 group-hover:text-blue-600 transition-colors cursor-pointer"
            onClick={() => onOpenPreview(currentImage || placeholderImage, item.product_name)}
          >
            {item.product_name}
          </h3>
          
          {/* Vendedor y Reseñas (DISEÑO SUPER VISIBLE) */}
          <div 
            onClick={(e) => { e.stopPropagation(); onOpenProfile(item.company_id); }}
            // CAMBIO: Fondo suave (bg-slate-50), borde y padding para destacar el bloque del vendedor
            className="flex flex-col mb-5 cursor-pointer group/seller bg-slate-50 p-3 rounded-xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50/30 transition-all shadow-sm"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="bg-white p-1.5 rounded-full shadow-sm text-blue-500">
                 <HiOfficeBuilding className="w-4 h-4" />
              </div>
              {/* CAMBIO: Texto más grande (text-base) y negrita extra (font-black) */}
              <span className="font-black text-slate-800 text-base group-hover/seller:text-blue-700 transition-colors truncate tracking-tight">
                {item.company_name}
              </span>
            </div>
            
            {/* Visualización de Confianza (Estrellas Grandes) */}
            <div className="flex items-center justify-between pl-1">
               <div className="flex text-yellow-400 filter drop-shadow-sm">
                 {/* CAMBIO: Estrellas más grandes (w-5 h-5) */}
                 {[1, 2, 3, 4, 5].map((star) => (
                   <HiStar key={star} className="w-5 h-5" />
                 ))}
               </div>
               <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-md uppercase tracking-wider group-hover/seller:bg-blue-600 group-hover/seller:text-white transition-colors">
                 Ver Reseñas
               </span>
            </div>
          </div>
        </div>

        {/* Precio y CTA (NUEVO BOTÓN WHASTAPP EXPLÍCITO) */}
        <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-3">
          <div className="flex items-baseline gap-1">
             <span className="text-xs font-bold text-slate-400 uppercase mr-1">Precio:</span>
             <span className="text-lg font-bold text-slate-400">$</span>
             <span className="text-3xl font-black text-slate-800 tracking-tight">{item.price.toFixed(2)}</span>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onWhatsAppClick(item); }}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-transform active:scale-95 flex items-center justify-center gap-2 group/btn"
            title="Contactar por WhatsApp"
          >
            <HiOutlineChatAlt2 className="w-5 h-5 group-hover/btn:animate-bounce" />
            <span className="font-bold tracking-wide text-sm">WHATSAPP</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// --- PÁGINA PRINCIPAL ---
function PublicCatalogPage() {
  // CAMBIO: Traemos activeShift para saber si está trabajando
  const { user, activeShift } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Modales
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  // CAMBIO: Estado para mostrar el modal de creación rápida de producto
  const [showProductForm, setShowProductForm] = useState(false);
  // Estado para la flecha de "Scrollear"
  const [showScrollHint, setShowScrollHint] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (searchTerm.length < 3) return;
    setLoading(true);
    setHasSearched(true);
    // Ocultamos la flecha al iniciar nueva búsqueda para resetear
    setShowScrollHint(false); 
    try {
      const response = await apiClient.get("/public/search/parts", { params: { q: searchTerm } });
      setResults(response.data);
      // CAMBIO: Si hay resultados, mostramos la flecha y la quitamos en 5 seg
      if (response.data.length > 0) {
        setShowScrollHint(true);
        setTimeout(() => setShowScrollHint(false), 5000);
      }
    } catch (error) {
      console.error("Error buscando:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // CAMBIO: Lógica inteligente de redirección
  const handleSellClick = () => {
    if (activeShift) {
      // CORRECCIÓN: Si tiene turno activo, vamos al Home/Dashboard (Ruta raíz)
      navigate("/");
    } else if (user) {
      // Si es usuario pero no tiene turno, vamos a productos
      navigate("/products");
    } else {
      // Si es nuevo, registro
      navigate("/register");
    }
  };

  // CAMBIO: Función para guardar producto desde el modal público
  const handleSaveQuickProduct = async (productData) => {
    try {
      await apiClient.post("/products/", productData);
      alert("¡Producto publicado exitosamente!");
      setShowProductForm(false);
    } catch (error) {
      console.error(error);
      alert("Error al guardar el producto. Verifica los datos.");
    }
  };

  const handleWhatsAppClick = (product) => {
    if (!product.company_phone) return alert("El proveedor no tiene WhatsApp configurado.");
    let phone = product.company_phone.replace(/\s+/g, '').replace(/-/g, '');
    if (phone.startsWith("0")) phone = "+593" + phone.substring(1);
    const message = `Hola *${product.company_name}*, vi en la Lista Global de Precios:
*${product.product_name}* a $${product.price}.
¿Disponen de stock inmediato?`;
    window.open(`https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-600 pb-32">
      
      {/* --- HERO SECTION (Estilo Landing SaaS) --- */}
      <div className="bg-slate-900 relative overflow-hidden">
        
        {/* CAMBIO: Navbar Superior (Solo visible si NO está logueado) */}
        {!user && (
          // AJUSTE: p-4 en móvil (antes p-6), flex-row para asegurar línea, items-center
          <nav className="absolute top-0 right-0 z-50 p-4 sm:p-6 flex flex-row items-center gap-2 sm:gap-4 animate-fadeIn w-full justify-end pointer-events-none">
            {/* pointer-events-auto en los botones para que sean clickeables aunque el nav sea passthrough */}
            <button 
              onClick={() => navigate('/login')}
              // AJUSTE: Texto más pequeño en móvil (text-xs) y padding reducido
              className="pointer-events-auto text-white/90 hover:text-white font-bold text-xs sm:text-sm transition-colors uppercase tracking-wider px-2 py-2 sm:px-4"
            >
              Ingresar
            </button>
            <button 
              onClick={() => navigate('/register')}
              // AJUSTE: Botón compacto en móvil (py-2 px-4), texto minúsculo (text-[10px]), sin saltos de línea (whitespace-nowrap)
              className="pointer-events-auto bg-white text-blue-900 hover:bg-blue-50 font-black py-2 px-4 sm:py-2.5 sm:px-6 rounded-full shadow-xl hover:shadow-white/20 transition-all transform hover:-translate-y-0.5 active:scale-95 text-[10px] sm:text-xs sm:text-sm uppercase tracking-wide whitespace-nowrap"
            >
              Registrarme
            </button>
          </nav>
        )}

        {/* Background Effects */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600 rounded-full blur-[100px] opacity-30"></div>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-600 rounded-full blur-[120px] opacity-20"></div>

        {/* CAMBIO: Padding vertical reducido (py-12) y horizontal ajustado para ganar espacio */}
        {/* AJUSTE: Aumentamos mucho el padding superior (pt-32) SOLO en celular para bajar el texto y librar los botones */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-12 sm:py-24 relative z-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-16">
            
            {/* Texto Principal */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-blue-900/50 border border-blue-500/30 rounded-full px-4 py-1.5 mb-6">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-blue-200 text-xs font-bold uppercase tracking-wider">Red de Técnicos Ecuador</span>
              </div>
              
              {/* CAMBIO: Texto un poco más pequeño en celular (4xl) para evitar saltos de línea excesivos */}
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-white tracking-tight leading-tight mb-6">
                Busca. Encuentra. <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400">
                  Repara más Rápido.
                </span>
              </h1>
              
              {/* CAMBIO: Texto base (más pequeño) en móvil y padding lateral (px-4) para evitar desbordes */}
              <p className="text-slate-400 text-base sm:text-xl mb-8 sm:mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed px-4 sm:px-0">
                Accede al inventario en tiempo real de los mayores importadores y distribuidores del país.
              </p>

              {/* BUSCADOR FLOTANTE */}
              {/* CAMBIO: mx-10 para separar aún más de los bordes en celular */}
              <form onSubmit={handleSearch} className="relative max-w-2xl mx-10 sm:mx-auto lg:mx-0 group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl blur opacity-30 group-hover:opacity-70 transition duration-1000 group-hover:duration-200"></div>
                {/* CAMBIO: Padding del contenedor reducido (p-1) */}
                <div className="relative flex items-center bg-white p-1 sm:p-2 rounded-2xl shadow-2xl">
                  <HiSearch className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 ml-3 sm:ml-4" />
                  <input 
                    type="text" 
                    // CAMBIO: Input más compacto en celular
                    className="flex-1 bg-transparent px-3 py-3 sm:px-4 sm:py-4 text-base sm:text-lg text-slate-800 placeholder-slate-400 outline-none font-medium"
                    placeholder="Ej: Display Samsung A32..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                  />
                  <button 
                    type="submit"
                    // CAMBIO: Botón más compacto en celular
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 sm:py-4 sm:px-8 rounded-xl transition-all shadow-lg shadow-blue-600/30 transform hover:scale-105"
                  >
                    Buscar
                  </button>
                </div>
              </form>
            </div>

            {/* Tarjeta de Publicidad Inteligente (Se encoge al buscar) */}
            <div className={`w-full ${hasSearched ? 'max-w-xs' : 'max-w-sm lg:w-96'} mt-12 lg:mt-0 mx-auto lg:mx-0 transition-all duration-500`}>
              {!hasSearched ? (
                // --- MODO TARJETA GRANDE (ANTES DE BUSCAR) ---
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl transform lg:rotate-3 lg:hover:rotate-0 transition-transform duration-500">
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                    <HiLightningBolt className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">¿VENDES REPUESTOS?</h3>
                  <p className="text-slate-300 mb-6 leading-relaxed">
                    <strong>GANA DINERO</strong> vendidendo tus repuestos nuevos o de medio uso <strong>AQUÍ</strong>.
                  </p>
                  <div className="space-y-3">
                    <button 
                      onClick={handleSellClick}
                      className="w-full bg-white text-slate-900 font-bold py-3.5 rounded-xl hover:bg-slate-100 transition-colors shadow-xl flex items-center justify-center gap-2"
                    >
                      <HiOfficeBuilding className="w-5 h-5 text-blue-600" />
                      Únete como Proveedor
                    </button>
                    <a 
                      href="/register" 
                      className="block text-center text-slate-400 hover:text-white text-sm font-medium transition-colors"
                    >
                      Crear cuenta gratis →
                    </a>
                  </div>
                </div>
              ) : (
                // --- MODO BOTÓN COMPACTO (AL REALIZAR UNA BÚSQUEDA) ---
                <button 
                  onClick={handleSellClick}
                  className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold py-4 rounded-xl shadow-2xl hover:shadow-orange-500/50 transform hover:scale-105 transition-all flex items-center justify-center gap-3 border-2 border-white/20"
                >
                   <HiLightningBolt className="w-6 h-6 animate-pulse" />
                   VENDE TUS REPUESTOS
                </button>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* --- RESULTADOS --- */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-10 relative z-20">
        
        {loading && (
          <div className="bg-white rounded-3xl p-12 text-center shadow-xl border border-slate-100">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto"></div>
            <p className="mt-6 text-slate-500 font-medium text-lg">Conectando con bodegas...</p>
          </div>
        )}

        {!loading && hasSearched && results.length === 0 && (
          <div className="bg-white rounded-3xl p-12 text-center shadow-xl border border-slate-100">
            <div className="inline-block p-6 bg-slate-100 rounded-full mb-4">
              <HiSearch className="w-12 h-12 text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800">No encontramos "{searchTerm}"</h3>
            <p className="text-slate-500 mt-2 text-lg">Prueba con palabras clave más cortas (ej: "A32" en vez de "Samsung A32").</p>
          </div>
        )}

        {results.length > 0 && (
          // CAMBIO: Gap reducido en celular (gap-4) y padding horizontal menor
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-8">
            {results.map((item, index) => (
              <ProductCard 
                key={index}
                item={item}
                onOpenPreview={(url, name) => setPreviewImage({ url, name })}
                onOpenProfile={setSelectedCompanyId}
                onWhatsAppClick={handleWhatsAppClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* --- BANNER DE PUBLICIDAD INFERIOR (TU GIMNASIO DE MARKETING) --- */}
      {!loading && (
        <div className="max-w-5xl mx-auto mt-24 px-6 text-center">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-10 md:p-16 shadow-2xl relative overflow-hidden group">
            
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/20 transition-colors duration-700"></div>
            
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-6">
                Deja de perder dinero.
              </h2>
              <p className="text-blue-100 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
                Con <strong>REPARASOFT®</strong> sabes qué tienes, cuanto vendes, y si te estás <strong>AUTO-ROBANDO</strong> por no llevar control de tu mercadería y ventas.<br/><br/> También haces <strong>ORDENES DE TRABAJO, FACTURAS ELECTRÓNICAS SRI, MANEJO DE SUCURSALES</strong>
              </p>
              
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <button 
                  // CAMBIO: Usamos handleSellClick para redirección inteligente (Si tiene turno -> Home)
                  onClick={handleSellClick}
                  className="bg-white text-blue-700 font-bold py-4 px-10 rounded-xl hover:bg-blue-50 transition-all shadow-xl transform hover:-translate-y-1"
                >
                  Registrate Gratis
                </button>
                <button 
                  onClick={() => window.open('https://wa.me/+593984959401', '_blank')} // Tu número real aquí
                  className="bg-blue-800 text-white font-bold py-4 px-10 rounded-xl hover:bg-blue-900 transition-all border border-blue-500"
                >
                  Habla con alguién
                </button>
              </div>
            </div>
          </div>
          
          <p className="mt-8 text-slate-400 text-sm">
            © 2026 Repara Xpress Ecosystem. Potenciando a los técnicos del Ecuador.
          </p>
        </div>
      )}

      {/* --- BOTÓN FLOTANTE: REGRESAR AL SISTEMA (SOLO SI HAY TURNO) --- */}
      {activeShift && (
        <button
          onClick={() => navigate('/')} // CORRECCIÓN: Navegar a la raíz "/"
          // CAMBIO: Color Azul Vibrante + Sombra Brillante para que se vea MUCHO más
          className="fixed top-4 left-4 z-[60] bg-blue-600 text-white pl-3 pr-6 py-3 rounded-full shadow-lg shadow-blue-500/50 hover:bg-blue-700 transition-all flex items-center gap-2 font-black text-xs sm:text-sm border-2 border-white/20 hover:scale-105 active:scale-95 animate-fadeIn"
        >
          <div className="bg-white/20 p-1.5 rounded-full">
             <HiArrowLeft className="w-5 h-5" />
          </div>
          REGRESAR AL SISTEMA
        </button>
      )}

      {/* --- MODALES --- */}
      {selectedCompanyId && <CompanyProfileModal companyId={selectedCompanyId} onClose={() => setSelectedCompanyId(null)} />}
      {previewImage && <ImagePreviewModal imageUrl={previewImage.url} productName={previewImage.name} onClose={() => setPreviewImage(null)} />}
      
      {/* CAMBIO: Modal de Creación Rápida de Producto */}
      {showProductForm && (
        <ProductForm 
          onClose={() => setShowProductForm(false)} 
          onSave={handleSaveQuickProduct} 
        />
      )}
    
      {/* CAMBIO: Flecha discreta indicando scroll (Flotante) */}
      {showScrollHint && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 animate-bounce transition-opacity duration-1000">
          {/* CAMBIO: Color azul intenso, un poco más grande (px-5 py-2.5) y sombra azul brillante para que destaque */}
          <div className="bg-blue-600/95 backdrop-blur text-white px-5 py-2.5 rounded-full shadow-lg shadow-blue-500/50 border border-blue-400/50 flex items-center gap-2">
            <span className="text-sm font-bold tracking-wide">Ver resultados</span>
            <HiArrowDown className="w-5 h-5" />
          </div>
        </div>
      )}

    </div>
  );
}

export default PublicCatalogPage;