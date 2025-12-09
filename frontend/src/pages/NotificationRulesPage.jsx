import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { HiOutlineTrash, HiOutlinePencil, HiOutlinePlus, HiOutlineClock } from 'react-icons/hi';

function NotificationRulesPage() {
  const [rules, setRules] = useState([]);
  const [editingId, setEditingId] = useState(null); 
  
  const [form, setForm] = useState({
    name: '',
    message: '',
    delay_seconds: 5,
    condition: 'ALWAYS',
    event_type: 'CLOCK_IN',
    schedule_times: [] 
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const res = await api.get('/notifications/rules');
      setRules(res.data);
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if(!confirm("¿Borrar regla?")) return;
    await api.delete(`/notifications/rules/${id}`);
    fetchRules();
  };

  const handleEdit = (rule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      message: rule.message,
      delay_seconds: rule.delay_seconds,
      condition: rule.condition,
      event_type: rule.event_type,
      schedule_times: rule.schedule_times || [] 
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ name: '', message: '', delay_seconds: 5, condition: 'ALWAYS', event_type: 'CLOCK_IN', schedule_times: [] });
  };

  // --- Funciones para manejar la lista de horas ---
  const addTimeSlot = () => {
    // Agregamos "08:00" como base, pero ahora se verá que es editable
    setForm(prev => ({
      ...prev,
      schedule_times: [...prev.schedule_times, "08:00"] 
    }));
  };

  const removeTimeSlot = (index) => {
    setForm(prev => ({
      ...prev,
      schedule_times: prev.schedule_times.filter((_, i) => i !== index)
    }));
  };

  const updateTimeSlot = (index, value) => {
    const newTimes = [...form.schedule_times];
    newTimes[index] = value;
    setForm(prev => ({ ...prev, schedule_times: newTimes }));
  };
  // ------------------------------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let finalTimes = null;
      if (form.event_type === 'SCHEDULED') {
         finalTimes = form.schedule_times.filter(t => t !== "");
         if (finalTimes.length === 0) {
           alert("Debes agregar al menos una hora para la alerta programada.");
           return;
         }
      }

      const payload = {
        name: form.name.toUpperCase(),
        event_type: form.event_type,
        message: form.message.toUpperCase(),
        delay_seconds: form.delay_seconds,
        condition: form.condition,
        schedule_times: finalTimes
      };

      if (editingId) {
        await api.put(`/notifications/rules/${editingId}`, payload);
        alert("Regla actualizada");
      } else {
        await api.post('/notifications/rules', payload);
        alert("Regla creada");
      }

      handleCancelEdit(); 
      fetchRules();
    } catch (err) { alert("Error al guardar"); }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-secondary mb-6">
        {editingId ? 'Editar Regla' : 'Configurar Notificaciones Obligatorias'}
      </h1>
      
      <form onSubmit={handleSubmit} className={`p-6 rounded-lg mb-8 grid grid-cols-1 md:grid-cols-2 gap-6 border-2 ${editingId ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-transparent'}`}>
        
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Alerta</label>
          <select 
            className="w-full border p-2 rounded bg-white"
            value={form.event_type}
            onChange={e => setForm({...form, event_type: e.target.value})}
          >
            <option value="CLOCK_IN">Al Iniciar Turno (Entrada)</option>
            <option value="SCHEDULED">Programada (Reloj / Alarma)</option>
          </select>
        </div>

        {form.event_type === 'CLOCK_IN' && (
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Frecuencia</label>
            <select 
              className="w-full border p-2 rounded bg-white"
              value={form.condition}
              onChange={e => setForm({...form, condition: e.target.value})}
            >
              <option value="ALWAYS">Siempre (Cada inicio de turno)</option>
              <option value="FIRST_SHIFT">Solo la primera vez del día</option>
            </select>
          </div>
        )}

        {/* --- AQUÍ ESTÁ EL CAMBIO VISUAL --- */}
        {form.event_type === 'SCHEDULED' && (
          <div className="md:col-span-2 bg-white p-4 rounded border border-gray-200 shadow-sm">
            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center">
              <HiOutlineClock className="mr-2 h-5 w-5 text-accent" />
              Horarios de Activación
            </label>
            
            <div className="flex flex-wrap gap-4">
              {form.schedule_times.map((time, index) => (
                <div key={index} className="flex items-center gap-2">
                  
                  {/* INPUT MEJORADO: Ahora tiene fondo blanco y borde para parecer editable */}
                  <input 
                    type="time" 
                    value={time} 
                    onChange={(e) => updateTimeSlot(index, e.target.value)}
                    className="bg-white border border-gray-300 text-secondary text-lg font-bold rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer shadow-sm"
                    required
                  />

                  <button 
                    type="button"
                    onClick={() => removeTimeSlot(index)}
                    className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-full p-1"
                    title="Eliminar esta hora"
                  >
                    <HiOutlineTrash className="w-5 h-5" />
                  </button>
                </div>
              ))}

              <button 
                type="button"
                onClick={addTimeSlot}
                className="flex items-center px-4 py-2 bg-green-100 text-green-700 rounded-lg border border-green-200 hover:bg-green-200 transition font-semibold"
              >
                <HiOutlinePlus className="mr-1 w-5 h-5" /> Agregar Hora
              </button>
            </div>
            
            {form.schedule_times.length === 0 && (
               <p className="text-sm text-gray-500 mt-2 italic">* Agrega al menos una hora para que suene la alarma.</p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Nombre de la Regla</label>
          <input 
            className="w-full border p-2 rounded uppercase" 
            value={form.name}
            onChange={e => setForm({...form, name: e.target.value.toUpperCase()})}
            placeholder="EJ: ALERTA CAJA"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Segundos de Bloqueo</label>
          <input 
            type="number"
            className="w-full border p-2 rounded" 
            value={form.delay_seconds}
            onChange={e => setForm({...form, delay_seconds: parseInt(e.target.value)})}
            min="0"
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-bold text-gray-700 mb-2">Mensaje del Cartel</label>
          <textarea 
            className="w-full border p-2 rounded uppercase text-lg" 
            rows="2"
            value={form.message}
            onChange={e => setForm({...form, message: e.target.value.toUpperCase()})}
            placeholder="EJ: ES HORA DE LIMPIAR EL LOCAL Y ORDENAR LA VITRINA"
            required
          />
        </div>

        <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t">
          {editingId && (
            <button type="button" onClick={handleCancelEdit} className="px-6 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 font-semibold">
              Cancelar Edición
            </button>
          )}
          <button className={`px-8 py-2 rounded-lg text-white font-bold shadow-md transition ${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-accent hover:bg-teal-600'}`}>
            {editingId ? 'Guardar Cambios' : 'Crear Regla'}
          </button>
        </div>
      </form>

      <h3 className="font-bold text-lg mb-4 text-gray-800 border-b pb-2">Reglas Activas</h3>
      <div className="grid grid-cols-1 gap-3">
        {rules.map(rule => (
          <div key={rule.id} className="flex justify-between items-start bg-gray-50 border border-gray-200 p-4 rounded-lg hover:shadow-md transition">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="font-bold text-secondary text-lg">{rule.name}</span>
                <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-bold tracking-wide ${rule.event_type === 'SCHEDULED' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : 'bg-green-100 text-green-800 border border-green-200'}`}>
                  {rule.event_type === 'SCHEDULED' ? 'Programada' : 'Entrada'}
                </span>
              </div>
              <p className="text-gray-700 font-medium">{rule.message}</p>
              
              <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-2 items-center">
                <span className="bg-white border px-2 py-1 rounded">⏳ Bloqueo: {rule.delay_seconds}s</span>
                
                {rule.event_type === 'CLOCK_IN' && (
                  <span className="bg-white border px-2 py-1 rounded">
                    Frecuencia: {rule.condition === 'ALWAYS' ? 'Siempre' : '1ra vez del día'}
                  </span>
                )}
                
                {rule.event_type === 'SCHEDULED' && rule.schedule_times && (
                  <div className="flex gap-1 flex-wrap">
                    {rule.schedule_times.map((t, i) => (
                      <span key={i} className="bg-orange-100 text-orange-800 border border-orange-200 px-2 py-1 rounded font-mono font-bold">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-2 ml-4">
              <button onClick={() => handleEdit(rule)} className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded transition" title="Editar">
                <HiOutlinePencil className="w-5 h-5" />
              </button>
              <button onClick={() => handleDelete(rule.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition" title="Eliminar">
                <HiOutlineTrash className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        {rules.length === 0 && (
          <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg">
            No hay reglas configuradas aún.
          </div>
        )}
      </div>
    </div>
  );
}

export default NotificationRulesPage;