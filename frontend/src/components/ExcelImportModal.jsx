import React, { useState, useRef, useEffect } from "react";
// 1. Íconos de FontAwesome (Fa...)
import { FaFileExcel, FaSpinner } from "react-icons/fa";
// 2. Íconos de Heroicons (Hi...) - Estilo TransfersPage
import { 
  HiOutlineCloudUpload, 
  HiOutlineOfficeBuilding, 
  HiX, 
  HiExclamationCircle, 
  HiOutlineDownload, 
  HiBan, 
  HiArrowRight, 
  HiCheck 
} from "react-icons/hi";

import api from "../services/api";

function ExcelImportModal({ onClose, onSuccess }) {
  const [step, setStep] = useState(1); 
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [bodegas, setBodegas] = useState([]);
  const [selectedBodega, setSelectedBodega] = useState("");

  const fileInputRef = useRef(null);

  useEffect(() => {
    api.get("/api/bodegas/")
      .then(res => {
        setBodegas(res.data);
        if (res.data.length > 0) {
           setSelectedBodega(res.data[0].id);
        }
      })
      .catch(err => console.error("Error cargando bodegas", err));
  }, []);

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get("/products/template/excel", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "Plantilla_Carga_Productos.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError("Error descargando la plantilla.");
    }
  };

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedBodega) {
        alert("⚠️ Por favor selecciona una BODEGA DE DESTINO antes de subir el archivo.");
        e.target.value = null; 
        return;
    }

    setFile(selectedFile);
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("target_location_id", selectedBodega);

    try {
      const response = await api.post("/products/import/excel", formData);
      
      const enrichedData = response.data.preview.map(row => ({
        ...row,
        action_to_take: row.status === "EXISTE" ? "UPDATE" : "CREATE",
        stock_action: "ADD" 
      }));

      setPreviewData(enrichedData);
      setStats(response.data.stats);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al analizar el archivo.");
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRowActionChange = (index, field, value) => {
    const newData = [...previewData];
    newData[index][field] = value;
    setPreviewData(newData);
  };

  const handleConfirmImport = async () => {
    if (!selectedBodega) {
        alert("Por favor selecciona una bodega de destino.");
        return;
    }

    setLoading(true);
    try {
      const itemsToProcess = previewData
        .filter(row => row.status !== "ERROR") 
        .map(row => ({
          ...row.data,
          action_to_take: row.action_to_take,
          stock_action: row.stock_action
        }));

      const payload = {
          items: itemsToProcess,
          target_location_id: parseInt(selectedBodega)
      };

      const response = await api.post("/products/import/confirm", payload);
      alert(response.data.message);
      onSuccess(); 
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar los datos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden transform transition-all scale-100">
        
        {/* HEADER ELEGANTE */}
        <div className="p-6 border-b border-gray-100 bg-white flex justify-between items-center">
          <div className="flex flex-col">
            <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
               <div className="p-2 bg-green-50 rounded-lg text-green-600">
                  <HiOutlineCloudUpload className="w-6 h-6" />
               </div>
               Importación de Inventario
            </h2>
            <p className="text-sm text-gray-500 mt-1 ml-12">Carga masiva de productos desde Excel.</p>
          </div>
          
          <div className="flex items-center gap-4">
              {bodegas.length > 0 && (
                  <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
                      <HiOutlineOfficeBuilding className="text-gray-400"/>
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Destino:</span>
                      <select 
                          value={selectedBodega} 
                          onChange={(e) => setSelectedBodega(e.target.value)}
                          className="text-sm font-bold text-gray-700 outline-none bg-transparent cursor-pointer hover:text-indigo-600 transition-colors"
                      >
                          {bodegas.map(b => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                      </select>
                  </div>
              )}

              <button onClick={onClose} className="p-2 bg-white text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition border border-gray-200 shadow-sm">
                <HiX className="text-xl" />
              </button>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="p-6 flex-1 overflow-y-auto bg-gray-50/50">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-lg flex items-center gap-3 shadow-sm">
              <HiExclamationCircle className="text-xl flex-shrink-0" /> 
              <span className="font-medium">{error}</span>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-8 max-w-4xl mx-auto py-4">
               {/* GUÍA DE FORMATO */}
               <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h4 className="text-gray-800 font-bold mb-4 text-sm uppercase tracking-wide flex items-center gap-2 border-b border-gray-100 pb-3">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  Reglas de Importación
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm text-gray-600">
                  <div className="flex items-start gap-3">
                    <span className="text-indigo-500 font-bold">•</span>
                    <span>No alteres los encabezados de la plantilla.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-indigo-500 font-bold">•</span>
                    <span>Usa <strong>punto (.)</strong> para decimales (Ej: 10.50).</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-indigo-500 font-bold">•</span>
                    <span>Sin símbolos raros (@, #, *) en nombres.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-indigo-500 font-bold">•</span>
                    <span>Condición: Nuevo, Usado, Genérico, Original.</span>
                  </div>
                  <div className="flex items-start gap-3 md:col-span-2 bg-indigo-50 p-2 rounded-lg text-indigo-700 font-medium">
                    <span className="text-indigo-500 font-bold">•</span>
                    <span>Campos Obligatorios: <strong>TIPO, MARCA y MODELO</strong>.</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Tarjeta 1: Descargar */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center text-center hover:border-indigo-200 transition-colors">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-full mb-3">
                          <HiOutlineDownload className="text-2xl"/>
                      </div>
                      <h3 className="font-bold text-gray-800 mb-1">1. Obtener Plantilla</h3>
                      <p className="text-xs text-gray-500 mb-4">Descarga el archivo base con ejemplos.</p>
                      <button 
                        onClick={handleDownloadTemplate}
                        className="w-full py-2.5 bg-white text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 font-bold transition flex items-center justify-center gap-2"
                      >
                        <FaFileExcel /> Descargar Excel
                      </button>
                  </div>

                  {/* Tarjeta 2: Subir */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center text-center hover:border-green-200 transition-colors">
                      <div className="p-3 bg-green-50 text-green-600 rounded-full mb-3">
                          {loading ? <FaSpinner className="animate-spin text-2xl" /> : <HiOutlineCloudUpload className="text-2xl"/>}
                      </div>
                      <h3 className="font-bold text-gray-800 mb-1">2. Cargar Archivo</h3>
                      <p className="text-xs text-gray-500 mb-4">Sube tu Excel completado aquí.</p>
                      <button 
                        onClick={() => fileInputRef.current.click()}
                        className="w-full py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 font-bold shadow-lg shadow-green-200 transition transform active:scale-95 flex items-center justify-center gap-2"
                        disabled={loading}
                      >
                        Seleccionar Archivo
                      </button>
                      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx" onChange={handleFileUpload} />
                  </div>
              </div>
            </div>
          )}

          {step === 2 && previewData && (
            <div className="space-y-6">
              {/* RESUMEN DE DATOS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 text-green-800 px-5 py-3 rounded-xl border border-green-100 flex flex-col items-center">
                  <span className="text-2xl font-extrabold">{stats.nuevos}</span> 
                  <span className="text-xs font-bold uppercase tracking-wider">Nuevos</span>
                </div>
                <div className="bg-orange-50 text-orange-800 px-5 py-3 rounded-xl border border-orange-100 flex flex-col items-center">
                  <span className="text-2xl font-extrabold">{stats.existentes}</span> 
                  <span className="text-xs font-bold uppercase tracking-wider">Conflictos</span>
                </div>
                {stats.errores > 0 && (
                    <div className="bg-red-50 text-red-800 px-5 py-3 rounded-xl border border-red-100 flex flex-col items-center">
                    <span className="text-2xl font-extrabold">{stats.errores}</span> 
                    <span className="text-xs font-bold uppercase tracking-wider">Errores</span>
                    </div>
                )}
              </div>

              {/* TABLA DE DECISIÓN */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm h-[55vh] flex flex-col">
                <div className="overflow-y-auto custom-scrollbar flex-1">
                    <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 border-b border-gray-100 sticky top-0 z-10">
                        <tr>
                        <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider w-48">Acción</th>
                        <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Producto (Excel)</th>
                        <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-center">Precios (P1/PVP)</th>
                        <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-center">Decisión de Stock</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {previewData.map((row, idx) => (
                        <tr key={idx} className={`hover:bg-indigo-50/30 transition-colors ${row.status === "ERROR" ? "bg-red-50/50" : ""}`}>
                            
                            {/* 1. SELECTOR DE ACCIÓN PRINCIPAL */}
                            <td className="px-6 py-4 align-top">
                            {row.status === "ERROR" ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold border border-red-200">
                                    <HiBan/> ERROR
                                </span>
                            ) : (
                                <select 
                                    value={row.action_to_take}
                                    onChange={(e) => handleRowActionChange(idx, "action_to_take", e.target.value)}
                                    className={`w-full p-2 rounded-lg border text-xs font-bold cursor-pointer outline-none focus:ring-2 focus:ring-offset-1 transition-all ${
                                        row.action_to_take === "CREATE" ? "bg-green-100 text-green-800 border-green-200 focus:ring-green-400" :
                                        row.action_to_take === "UPDATE" ? "bg-orange-100 text-orange-800 border-orange-200 focus:ring-orange-400" :
                                        "bg-gray-100 text-gray-500 border-gray-200 focus:ring-gray-400"
                                    }`}
                                >
                                    {row.status === "NUEVO" ? (
                                        <>
                                            <option value="CREATE">✨ CREAR</option>
                                            <option value="SKIP">🚫 OMITIR</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="UPDATE">🔄 ACTUALIZAR</option>
                                            <option value="SKIP">🚫 NO TOCAR</option>
                                        </>
                                    )}
                                </select>
                            )}
                            </td>

                            {/* 2. DETALLES DEL PRODUCTO */}
                            <td className="px-6 py-4 align-top">
                            {row.status === "ERROR" ? (
                                <div className="text-red-600 text-sm font-medium flex items-center gap-2">
                                    <HiExclamationCircle className="text-lg flex-shrink-0"/> {row.error_msg}
                                </div>
                            ) : (
                                <div>
                                    <div className="font-bold text-gray-800 text-sm">{row.data.name}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono border border-gray-200">
                                            {row.data.sku}
                                        </span>
                                        {row.conflict && (
                                            <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded border border-orange-100">
                                                Sistema: {row.conflict.db_name}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                            </td>

                            {/* 3. PRECIOS (COMPARATIVA) */}
                            <td className="px-6 py-4 align-top text-center">
                            {row.status !== "ERROR" && (
                                <div className="flex flex-col items-center">
                                    <span className="font-black text-gray-800 text-sm">${row.data.price_1.toFixed(2)}</span>
                                    {row.conflict && row.conflict.db_price !== row.data.price_1 && (
                                        <div className="flex items-center gap-1 text-xs mt-1 bg-yellow-50 px-2 py-0.5 rounded-full border border-yellow-100">
                                            <span className="text-gray-400 line-through decoration-red-400">${row.conflict.db_price.toFixed(2)}</span>
                                            <HiArrowRight className="text-gray-400 text-[10px]"/>
                                        </div>
                                    )}
                                </div>
                            )}
                            </td>

                            {/* 4. DECISIÓN DE STOCK (LA MAGIA) */}
                            <td className="px-6 py-4 align-top w-72">
                            {row.status !== "ERROR" && (
                                <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                                    <div className="flex justify-between text-xs mb-2 text-gray-500 font-medium px-1">
                                        <span>Excel: <strong className="text-gray-800">{row.data.quantity}</strong></span>
                                        {row.conflict ? (
                                            <span>Sistema: <strong className="text-gray-800">{row.conflict.db_stock}</strong></span>
                                        ) : (
                                            <span className="text-green-600">Nuevo</span>
                                        )}
                                    </div>
                                    
                                    {row.status === "EXISTE" && row.action_to_take === "UPDATE" ? (
                                            <select
                                                value={row.stock_action}
                                                onChange={(e) => handleRowActionChange(idx, "stock_action", e.target.value)}
                                                className="w-full p-2 text-xs border border-gray-300 rounded-lg cursor-pointer outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                                            >
                                                <option value="ADD">➕ Sumar (Total: {row.conflict.db_stock + row.data.quantity})</option>
                                                <option value="REPLACE">✏️ Reemplazar (Total: {row.data.quantity})</option>
                                                <option value="KEEP_SYSTEM">🚫 Ignorar Excel (Mantener {row.conflict.db_stock})</option>
                                            </select>
                                    ) : (
                                        <div className="text-xs text-green-700 font-bold text-center bg-green-100/50 p-2 rounded-lg border border-green-200">
                                            Entrada Inicial: {row.data.quantity}
                                        </div>
                                    )}
                                </div>
                            )}
                            </td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pie de Página */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          {step === 2 && (
            <button 
              onClick={() => { setStep(1); setFile(null); setPreviewData([]); }}
              className="px-6 py-3 text-gray-600 hover:text-gray-800 hover:bg-white border border-transparent hover:border-gray-200 rounded-xl font-bold transition shadow-sm"
            >
              Atrás
            </button>
          )}
          
          {step === 2 ? (
            <button 
              onClick={handleConfirmImport}
              disabled={loading}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white rounded-xl font-bold shadow-lg shadow-green-200 transition transform active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <FaSpinner className="animate-spin h-5 w-5" /> : <HiCheck className="text-xl"/>} 
              Procesar Cambios
            </button>
          ) : (
            <button onClick={onClose} className="px-6 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl font-bold transition">
              Cancelar
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

export default ExcelImportModal;