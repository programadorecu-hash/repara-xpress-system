// frontend/src/pages/PublicCatalogPage.jsx

import React, { useState } from "react";
import { HiSearch, HiOutlineChatAlt2 } from "react-icons/hi";
import apiClient from "../services/api";

function PublicCatalogPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (searchTerm.length < 3) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const response = await apiClient.get("/public/search/parts", {
        params: { q: searchTerm }
      });
      setResults(response.data);
    } catch (error) {
      console.error("Error buscando:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppClick = (product) => {
    if (!product.company_phone) return alert("El proveedor no tiene WhatsApp configurado.");
    
    // Limpieza básica del número
    let phone = product.company_phone.replace(/\s+/g, '').replace(/-/g, '');
    // Si empieza con 0, asumimos Ecuador (+593) si no tiene +
    if (phone.startsWith("0")) phone = "+593" + phone.substring(1);
    
    const message = `Hola *${product.company_name}*, vi en la Lista de Precios que tienen el repuesto:
*${product.product_name}* a $${product.price}.
¿Disponen de stock para entrega inmediata?`;

    const url = `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-secondary">
      
      {/* --- HERO SECTION (Buscador) --- */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 py-16 px-4 shadow-xl">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            Encuentra tu Repuesto <span className="text-yellow-400">al Mejor Precio</span>
          </h1>
          <p className="text-blue-100 text-lg md:text-xl max-w-2xl mx-auto">
            Compara precios entre los mayores importadores de Ecuador. Stock real actualizado al instante.
          </p>
          
          <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto mt-8">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <HiSearch className="h-6 w-6 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-12 pr-4 py-4 rounded-full border-none shadow-lg text-lg focus:ring-4 focus:ring-blue-500/50 outline-none transition-all"
                placeholder="Ej: Pantalla A20, Pin de Carga, Batería..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
              <button 
                type="submit"
                className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-800 text-white font-bold px-6 rounded-full transition-colors"
              >
                Buscar
              </button>
            </div>
          </form>
          <p className="text-blue-200 text-sm">
            Busca por modelo, marca o tipo de repuesto.
          </p>
        </div>
      </div>

      {/* --- RESULTADOS --- */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        
        {loading && (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {!loading && hasSearched && results.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-xl">No encontramos resultados para "{searchTerm}".</p>
            <p className="mt-2">Intenta con palabras más cortas (ej: "A32" en lugar de "Samsung Galaxy A32").</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map((item, index) => (
            <div 
              key={index} 
              className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow overflow-hidden flex flex-col"
            >
              {/* Encabezado de la Tarjeta */}
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2 py-1 text-xs font-bold rounded uppercase ${
                    item.stock_status === 'Disponible' ? 'bg-green-100 text-green-700' :
                    item.stock_status === 'Pocas Unidades' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {item.stock_status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(item.last_updated).toLocaleDateString()}
                  </span>
                </div>
                
                <h3 className="text-lg font-bold text-gray-800 mb-1 leading-tight">
                  {item.product_name}
                </h3>
                
                <div className="mt-3 flex items-baseline">
                  <span className="text-3xl font-extrabold text-blue-900">
                    ${item.price.toFixed(2)}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">inc. IVA</span>
                </div>

                <div className="mt-4 border-t pt-3">
                  <p className="text-sm font-semibold text-gray-600">Vendido por:</p>
                  <p className="text-base font-bold text-gray-800">{item.company_name}</p>
                  {item.company_address && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      📍 {item.company_address}
                    </p>
                  )}
                </div>
              </div>

              {/* Botón de Acción */}
              <div className="bg-gray-50 p-4 border-t border-gray-100">
                <button
                  onClick={() => handleWhatsAppClick(item)}
                  className="w-full flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  <HiOutlineChatAlt2 className="w-5 h-5" />
                  <span>Comprar por WhatsApp</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* --- BANNER PUBLICITARIO: SISTEMA DEMO --- */}
        <div className="mt-16 bg-blue-50 border border-blue-100 rounded-2xl p-8 md:p-12 text-center shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-yellow-300 rounded-full opacity-20 blur-3xl"></div>
          <div className="relative z-10">
            <h2 className="text-3xl font-bold text-blue-900 mb-4">¿Tienes un Servicio Técnico?</h2>
            <p className="text-lg text-blue-700 mb-8 max-w-2xl mx-auto">
              Prueba el sistema de gestión más completo del Ecuador. 
              Controla reparaciones, inventario y caja en un solo lugar.
            </p>
            <a 
              href="/login?demo=true" 
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold py-4 px-10 rounded-full shadow-lg transform hover:-translate-y-1 transition-all"
            >
              🚀 Probar DEMO Gratis (Sin Registro)
            </a>
            <p className="text-sm text-blue-500 mt-4">
              Ingreso inmediato • Datos de prueba precargados
            </p>
          </div>
        </div>
        {/* ----------------------------------------- */}

      </div>

      {/* --- FOOTER --- */}
      <footer className="bg-white border-t py-8 mt-10 text-center text-gray-500 text-sm">
        <p>© 2026 Repara Xpress - La Red de Técnicos del Ecuador</p>
        <div className="mt-2 space-x-4">
            <a href="/login" className="hover:text-blue-600">Acceso Técnicos</a>
            <a href="/register" className="hover:text-blue-600">Registrar mi Taller</a>
        </div>
      </footer>
    </div>
  );
}

export default PublicCatalogPage;