import React, { useState, useEffect, useRef } from "react";

const PatternLockModal = ({ isOpen, onClose, onSave, initialPattern = "" }) => {
  const [path, setPath] = useState([]);
  const svgRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Coordenadas de los 9 puntos (en un lienzo de 300x300)
  const points = [
    { id: 1, x: 50, y: 50 }, { id: 2, x: 150, y: 50 }, { id: 3, x: 250, y: 50 },
    { id: 4, x: 50, y: 150 }, { id: 5, x: 150, y: 150 }, { id: 6, x: 250, y: 150 },
    { id: 7, x: 50, y: 250 }, { id: 8, x: 150, y: 250 }, { id: 9, x: 250, y: 250 },
  ];

  // Cargar patrón inicial si existe (ej: "1-2-3-5")
  useEffect(() => {
    if (isOpen && initialPattern) {
      const loadedPath = initialPattern.split("-").map(Number).filter(n => n >= 1 && n <= 9);
      setPath(loadedPath);
    } else if (isOpen) {
      setPath([]);
    }
  }, [isOpen, initialPattern]);

  const getPointAt = (x, y) => {
    // Detectar si el dedo/mouse está cerca de un punto
    return points.find(p => Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2) < 30);
  };

  const handleStart = (e) => {
    e.preventDefault(); // Evitar scroll en celular
    setIsDrawing(true);
    setPath([]); // Reiniciar al tocar
    handleMove(e);
  };

  const handleMove = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    // Obtener coordenadas relativas al SVG
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Escalar coordenadas (importante para pantallas responsive)
    const scaleX = 300 / rect.width;
    const scaleY = 300 / rect.height;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const point = getPointAt(x, y);
    if (point && !path.includes(point.id)) {
      setPath(prev => [...prev, point.id]);
    }
  };

  const handleEnd = () => {
    setIsDrawing(false);
  };

  const handleSave = () => {
    // Guardamos como texto separado por guiones: "1-2-5-9"
    const patternString = path.join("-");
    onSave(patternString);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-[80] flex items-center justify-center p-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm flex flex-col items-center">
        <h3 className="text-xl font-bold text-gray-700 mb-4">Dibujar Patrón</h3>
        
        <div 
          className="relative bg-gray-100 rounded-lg border-4 border-gray-200 mb-6 touch-none" 
          style={{ width: "300px", height: "300px" }}
        >
          <svg 
            ref={svgRef}
            viewBox="0 0 300 300" 
            className="w-full h-full cursor-crosshair"
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          >
            {/* Líneas conectoras */}
            <polyline 
              points={path.map(id => {
                const p = points.find(pt => pt.id === id);
                return `${p.x},${p.y}`;
              }).join(" ")}
              fill="none"
              stroke="#22c55e" // Color verde (Action Green)
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-80"
            />

            {/* Puntos (Círculos con Números) */}
            {points.map(p => {
              // Calculamos el orden: ¿Es el punto 1, el 2, el 3...?
              const index = path.indexOf(p.id);
              const isSelected = index !== -1;

              return (
                <g key={p.id}>
                  {/* El Círculo */}
                  <circle 
                    cx={p.x} 
                    cy={p.y} 
                    r="16" 
                    className={isSelected ? "fill-green-600" : "fill-gray-400"}
                    stroke="white"
                    strokeWidth="2"
                  />
                  {/* El Número (Solo si está seleccionado) */}
                  {isSelected && (
                    <text 
                      x={p.x} 
                      y={p.y + 5} 
                      textAnchor="middle" 
                      fill="white" 
                      fontSize="14" 
                      fontWeight="bold"
                      pointerEvents="none"
                    >
                      {index + 1}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex gap-4 w-full">
          <button 
            type="button" 
            onClick={onClose} 
            className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
          >
            Cancelar
          </button>
          <button 
            type="button" 
            onClick={handleSave} 
            className="flex-1 py-2 bg-accent text-white rounded-lg font-bold hover:bg-teal-600 shadow"
          >
            Guardar Patrón
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatternLockModal;