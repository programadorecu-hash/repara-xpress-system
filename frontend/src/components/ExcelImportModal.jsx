import React, { useState, useRef } from "react";
import { FaFileExcel, FaUpload, FaCheck, FaTimes, FaSpinner, FaExclamationTriangle } from "react-icons/fa";
import api from "../services/api";

function ExcelImportModal({ onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1: Subir, 2: Vista Previa, 3: Resultado
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  // Paso 1: Descargar Plantilla
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

  // Paso 2: Subir y Analizar
  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await api.post("/products/import/excel", formData);
      setPreviewData(response.data.preview);
      setStats(response.data.stats);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al analizar el archivo.");
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  // Paso 3: Confirmar Carga
  const handleConfirmImport = async () => {
    setLoading(true);
    try {
      // Preparamos la lista final.
      // Por defecto, mandamos todo lo que no sea error.
      // Si el usuario quisiera filtrar (checkboxes), aquí lo haríamos.
      const itemsToProcess = previewData.map(row => ({
        ...row.data,
        action_to_take: row.status === "EXISTE" ? "UPDATE" : "CREATE"
      }));

      const response = await api.post("/products/import/confirm", { items: itemsToProcess });
      alert(response.data.message);
      onSuccess(); // Recargar la tabla de productos
      onClose(); // Cerrar modal
    } catch (err) {
      setError("Error al guardar los datos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        
        {/* Encabezado */}
        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FaFileExcel className="text-green-600" /> Importación Masiva de Productos
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Contenido Principal */}
        <div className="p-6 flex-1 overflow-y-auto">
          {error && (
            <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg flex items-center gap-2">
              <FaExclamationTriangle /> {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-8 py-4">
              
              {/* --- ZONA DE GUÍA DE FORMATO (ESTILO PROFESIONAL) --- */}
              <div className="bg-gray-50 border border-gray-200 p-5 rounded-xl text-sm text-gray-600 shadow-sm">
                <h4 className="font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2">
                   📋 REGLAS PARA LA IMPORTACIÓN
                </h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                  <li className="flex gap-2 items-start">
                    <span className="text-blue-500 font-bold">·</span> 
                    <span>Mantener los encabezados de la plantilla.</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <span className="text-blue-500 font-bold">·</span> 
                    <span>No usar fórmulas ni insertar imágenes.</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <span className="text-blue-500 font-bold">·</span> 
                    <span>Usar <strong>punto (.)</strong> para decimales (Ej: 10.50).</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <span className="text-blue-500 font-bold">·</span> 
                    <span>Campos Clave: Tipo, Marca y Modelo.</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <span className="text-blue-500 font-bold">·</span> 
                    <span>Evitar símbolos especiales (@, #, *).</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <span className="text-blue-500 font-bold">·</span> 
                    <span>Condición: Nuevo, Usado, Genérico, Original.</span>
                  </li>
                </ul>
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">1. Descarga la Plantilla Oficial</h3>
                <p className="text-gray-500">Contiene ejemplos reales para guiarte.</p>
                <button 
                  onClick={handleDownloadTemplate}
                  className="px-6 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 font-semibold transition flex items-center gap-2 mx-auto"
                >
                  <FaFileExcel /> Descargar Plantilla con Ejemplos
                </button>
              </div>

              <div className="border-t pt-8 space-y-4 text-center">
                <h3 className="text-lg font-semibold">2. Sube tu Archivo Completo</h3>
                
                <div 
                  onClick={() => fileInputRef.current.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-10 cursor-pointer hover:border-green-500 hover:bg-green-50 transition flex flex-col items-center gap-4"
                >
                  <div className="bg-green-100 p-4 rounded-full text-green-600">
                    {loading ? <FaSpinner className="animate-spin text-2xl" /> : <FaUpload className="text-2xl" />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Haz clic para subir tu Excel</p>
                    <p className="text-sm text-gray-400">Solo archivos .xlsx</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".xlsx" 
                    onChange={handleFileUpload} 
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && previewData && (
            <div className="space-y-4">
              <div className="flex gap-4 mb-4">
                <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg flex-1 text-center border border-green-200">
                  <span className="block text-2xl font-bold">{stats.nuevos}</span>
                  <span className="text-sm font-medium">Nuevos Productos</span>
                </div>
                <div className="bg-orange-100 text-orange-800 px-4 py-2 rounded-lg flex-1 text-center border border-orange-200">
                  <span className="block text-2xl font-bold">{stats.existentes}</span>
                  <span className="text-sm font-medium">Actualizaciones</span>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 text-gray-600 sticky top-0">
                    <tr>
                      <th className="p-3">Estado</th>
                      <th className="p-3">SKU</th>
                      <th className="p-3">Nombre</th>
                      <th className="p-3 text-right">Precio PVP</th>
                      <th className="p-3 text-right">Stock Inicial</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {previewData.map((row, idx) => (
                      <tr key={idx} className={row.status === "EXISTE" ? "bg-orange-50" : "bg-white"}>
                        <td className="p-3">
                          {row.status === "NUEVO" ? (
                            <span className="bg-green-200 text-green-800 px-2 py-1 rounded text-xs font-bold">NUEVO</span>
                          ) : (
                            <span className="bg-orange-200 text-orange-800 px-2 py-1 rounded text-xs font-bold">ACTUALIZAR</span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-gray-600">{row.data.sku}</td>
                        <td className="p-3 font-medium">
                          {row.data.name}
                          {row.conflict && (
                            <div className="text-xs text-gray-500 mt-1">
                              Actual: {row.conflict.db_name}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          ${row.data.price_3}
                          {row.conflict && row.conflict.db_price !== row.data.price_3 && (
                            <div className="text-xs text-red-500 line-through">
                              ${row.conflict.db_price}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right">{row.data.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Pie de Página */}
        <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
          {step === 2 && (
            <button 
              onClick={() => { setStep(1); setFile(null); }}
              className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
            >
              Atrás
            </button>
          )}
          
          {step === 2 ? (
            <button 
              onClick={handleConfirmImport}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <FaSpinner className="animate-spin" /> : <FaCheck />} 
              Confirmar e Importar
            </button>
          ) : (
            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">
              Cancelar
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

export default ExcelImportModal;