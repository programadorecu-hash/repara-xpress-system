import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { HiOutlineTrash, HiOutlinePencil, HiOutlinePlus } from 'react-icons/hi';

function NotificationRulesPage() {
  const [rules, setRules] = useState([]);
  const [editingId, setEditingId] = useState(null); // ID si estamos editando
  
  // Estado del formulario
  const [form, setForm] = useState({
    name: '',
    message: '',
    delay_seconds: 5,
    condition: 'ALWAYS',
    event_type: 'CLOCK_IN',
    schedule_times_str: '' // Campo de texto para las horas (ej: "13:00, 20:00")
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
      // Convertimos la lista ["13:00", "14:00"] a texto "13:00, 14:00" para editar
      schedule_times_str: rule.schedule_times ? rule.schedule_times.join(', ') : ''
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ name: '', message: '', delay_seconds: 5, condition: 'ALWAYS', event_type: 'CLOCK_IN', schedule_times_str: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Procesar las horas: de texto "13:00, 14:00" a lista ["13:00", "14:00"]
      let schedule_times = null;
      if (form.event_type === 'SCHEDULED' && form.schedule_times_str) {
        schedule_times = form.schedule_times_str.split(',')
          .map(t => t.trim())
          .filter(t => t !== ''); // Limpiar espacios vacíos
      }

      const payload = {
        name: form.name.toUpperCase(),
        event_type: form.event_type,
        message: form.message.toUpperCase(),
        delay_seconds: form.delay_seconds,
        condition: form.condition,
        schedule_times: schedule_times
      };

      if (editingId) {
        await api.put(`/notifications/rules/${editingId}`, payload);
        alert("Regla actualizada");
      } else {
        await api.post('/notifications/rules', payload);
        alert("Regla creada");
      }

      handleCancelEdit(); // Resetear form
      fetchRules();
    } catch (err) { alert("Error al guardar"); }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-secondary mb-6">
        {editingId ? 'Editar Regla' : 'Configurar Notificaciones Obligatorias'}
      </h1>
      
      {/* Formulario */}
      <form onSubmit={handleSubmit} className={`p-4 rounded-lg mb-8 grid grid-cols-1 md:grid-cols-2 gap-4 border-2 ${editingId ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-transparent'}`}>
        <div>
          <label className="block text-sm font-bold text-gray-700">Tipo de Alerta</label>
          <select 
            className="w-full border p-2 rounded"
            value={form.event_type}
            onChange={e => setForm({...form, event_type: e.target.value})}
          >
            <option value="CLOCK_IN">Al Iniciar Turno (Entrada)</option>
            <option value="SCHEDULED">Programada (Por Hora)</option>
          </select>
        </div>

        {/* Campo condicional: Frecuencia (Solo para CLOCK_IN) */}
        {form.event_type === 'CLOCK_IN' && (
          <div>
            <label className="block text-sm font-bold text-gray-700">Frecuencia</label>
            <select 
              className="w-full border p-2 rounded"
              value={form.condition}
              onChange={e => setForm({...form, condition: e.target.value})}
            >
              <option value="ALWAYS">Siempre (Cada inicio de turno)</option>
              <option value="FIRST_SHIFT">Solo la primera vez del día</option>
            </select>
          </div>
        )}

        {/* Campo condicional: Horas (Solo para SCHEDULED) */}
        {form.event_type === 'SCHEDULED' && (
          <div className="md:col-span-1 bg-yellow-50 p-2 rounded border border-yellow-200">
            <label className="block text-sm font-bold text-gray-700">Horas (Formato 24h)</label>
            <input 
              className="w-full border p-2 rounded" 
              value={form.schedule_times_str}
              onChange={e => setForm({...form, schedule_times_str: e.target.value})}
              placeholder="Ej: 08:00, 13:30, 20:00"
            />
            <p className="text-xs text-gray-500 mt-1">Separa las horas con comas.</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-bold text-gray-700">Nombre de la Regla</label>
          <input 
            className="w-full border p-2 rounded uppercase" 
            value={form.name}
            onChange={e => setForm({...form, name: e.target.value.toUpperCase()})}
            placeholder="EJ: ALERTA CAJA"
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-bold text-gray-700">Mensaje para el Empleado</label>
          <textarea 
            className="w-full border p-2 rounded uppercase" 
            rows="2"
            value={form.message}
            onChange={e => setForm({...form, message: e.target.value.toUpperCase()})}
            placeholder="EJ: RECUERDA LIMPIAR EL LOCAL"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700">Segundos de Bloqueo</label>
          <input 
            type="number"
            className="w-full border p-2 rounded" 
            value={form.delay_seconds}
            onChange={e => setForm({...form, delay_seconds: parseInt(e.target.value)})}
            min="0"
            required
          />
        </div>

        <div className="flex items-end gap-2">
          {editingId && (
            <button type="button" onClick={handleCancelEdit} className="bg-gray-400 text-white font-bold py-2 px-4 rounded hover:bg-gray-500 w-1/2">
              Cancelar
            </button>
          )}
          <button className={`text-white font-bold py-2 px-4 rounded w-full ${editingId ? 'bg-blue-600 hover:bg-blue-700 w-1/2' : 'bg-accent hover:bg-teal-600'}`}>
            {editingId ? 'Actualizar Regla' : 'Crear Regla'}
          </button>
        </div>
      </form>

      {/* Lista */}
      <h3 className="font-bold text-lg mb-4">Reglas Activas</h3>
      <div className="space-y-2">
        {rules.map(rule => (
          <div key={rule.id} className="flex justify-between items-center border p-3 rounded hover:bg-gray-50">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-secondary">{rule.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded font-bold ${rule.event_type === 'SCHEDULED' ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'}`}>
                  {rule.event_type === 'SCHEDULED' ? '⏰ PROGRAMADA' : '🚪 ENTRADA'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{rule.message}</p>
              
              {/* Detalles extra */}
              <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">
                <span className="bg-blue-50 text-blue-600 px-1 rounded">Bloqueo: {rule.delay_seconds}s</span>
                {rule.event_type === 'CLOCK_IN' && (
                  <span className="bg-purple-50 text-purple-600 px-1 rounded">
                    {rule.condition === 'ALWAYS' ? 'Siempre' : '1ra vez del día'}
                  </span>
                )}
                {rule.event_type === 'SCHEDULED' && rule.schedule_times && (
                  <span className="bg-orange-50 text-orange-600 px-1 rounded font-mono">
                    Horas: {rule.schedule_times.join(', ')}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <button onClick={() => handleEdit(rule)} className="text-blue-500 hover:bg-blue-50 p-2 rounded" title="Editar">
                <HiOutlinePencil className="w-5 h-5" />
              </button>
              <button onClick={() => handleDelete(rule.id)} className="text-red-500 hover:bg-red-50 p-2 rounded" title="Eliminar">
                <HiOutlineTrash className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        {rules.length === 0 && <p className="text-gray-500 text-center">No hay reglas configuradas.</p>}
      </div>
    </div>
  );
}

export default NotificationRulesPage;