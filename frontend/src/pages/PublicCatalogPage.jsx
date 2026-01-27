import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  HiSearch, HiOutlineChatAlt2, HiStar, HiOutlineStar, HiX, 
  HiOfficeBuilding, HiUserCircle, HiZoomIn, HiPhotograph, 
  HiLightningBolt, HiCheckCircle 
} from "react-icons/hi";
import apiClient, { getCompanyPublicProfile, submitCompanyReview } from "../services/api";
import { useAuth } from "../context/AuthContext";

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
        className="relative h-64 bg-slate-50 flex items-center justify-center p-6 cursor-zoom-in overflow-hidden group-hover:bg-slate-100 transition-colors"
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
          {/* Categoría o Marca (Ficticio/Extraído del nombre) */}
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Repuesto</p>
          
          <h3 
            className="font-bold text-slate-800 text-lg leading-snug mb-3 line-clamp-2 group-hover:text-blue-600 transition-colors cursor-pointer"
            onClick={() => onOpenPreview(currentImage || placeholderImage, item.product_name)}
          >
            {item.product_name}
          </h3>
          
          {/* Vendedor Pill */}
          <div 
            onClick={(e) => { e.stopPropagation(); onOpenProfile(item.company_id); }}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-100 rounded-lg cursor-pointer transition-colors group/seller mb-4"
          >
            <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
              <HiOfficeBuilding className="w-3 h-3" />
            </div>
            <span className="text-xs font-semibold text-slate-600 group-hover/seller:text-blue-700 truncate max-w-[150px]">
              {item.company_name}
            </span>
          </div>
        </div>

        {/* Precio y CTA */}
        <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Precio Distribuidor</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-slate-400">$</span>
              <span className="text-3xl font-black text-slate-800 tracking-tight">{item.price.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onWhatsAppClick(item); }}
            className="bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-xl shadow-lg shadow-emerald-500/30 transition-transform active:scale-95 flex items-center justify-center"
            title="Contactar por WhatsApp"
          >
            <HiOutlineChatAlt2 className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}

// --- PÁGINA PRINCIPAL ---
function PublicCatalogPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Modales
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (searchTerm.length < 3) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const response = await apiClient.get("/public/search/parts", { params: { q: searchTerm } });
      setResults(response.data);
    } catch (error) {
      console.error("Error buscando:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSellClick = () => user ? navigate("/products") : navigate("/register");

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
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600 rounded-full blur-[100px] opacity-30"></div>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-600 rounded-full blur-[120px] opacity-20"></div>

        <div className="max-w-7xl mx-auto px-6 py-24 relative z-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-16">
            
            {/* Texto Principal */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-blue-900/50 border border-blue-500/30 rounded-full px-4 py-1.5 mb-6">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-blue-200 text-xs font-bold uppercase tracking-wider">Red de Técnicos Ecuador</span>
              </div>
              
              <h1 className="text-5xl lg:text-7xl font-extrabold text-white tracking-tight leading-tight mb-6">
                Busca. Encuentra. <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400">
                  Repara más Rápido.
                </span>
              </h1>
              
              <p className="text-slate-400 text-xl mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Accede al inventario en tiempo real de los mayores importadores y distribuidores del país. Compara precios y contacta directo.
              </p>

              {/* BUSCADOR FLOTANTE */}
              <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto lg:mx-0 group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl blur opacity-30 group-hover:opacity-70 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative flex items-center bg-white p-2 rounded-2xl shadow-2xl">
                  <HiSearch className="w-6 h-6 text-slate-400 ml-4" />
                  <input 
                    type="text" 
                    className="flex-1 bg-transparent px-4 py-4 text-lg text-slate-800 placeholder-slate-400 outline-none font-medium"
                    placeholder="Ej: Display Samsung A32, Pin Carga..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                  />
                  <button 
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg shadow-blue-600/30 transform hover:scale-105"
                  >
                    Buscar
                  </button>
                </div>
              </form>
            </div>

            {/* Tarjeta de Publicidad (El Gancho Visual) */}
            <div className="hidden lg:block w-96">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500">
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
            </div>

          </div>
        </div>
      </div>

      {/* --- RESULTADOS --- */}
      <div className="max-w-7xl mx-auto px-6 -mt-10 relative z-20">
        
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
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
                  onClick={() => navigate('/register')}
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

      {/* --- MODALES --- */}
      {selectedCompanyId && <CompanyProfileModal companyId={selectedCompanyId} onClose={() => setSelectedCompanyId(null)} />}
      {previewImage && <ImagePreviewModal imageUrl={previewImage.url} productName={previewImage.name} onClose={() => setPreviewImage(null)} />}
    
    </div>
  );
}

export default PublicCatalogPage;