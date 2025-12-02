import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { HiOutlineTrash } from 'react-icons/hi';

function NotificationRulesPage() {
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState({
    name: '',
    message: '',
    delay_seconds: 5,
    condition: 'ALWAYS', // Default
    event_type: 'CLOCK_IN' // Por ahora solo soportamos este
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Forzamos mayúsculas en nombre y mensaje
      const payload = {
        ...form,
        name: form.name.toUpperCase(),
        message: form.message.toUpperCase()
      };
      await api.post('/notifications/rules', payload);
      setForm({ ...form, name: '', message: '' }); // Reset parcial
      fetchRules();
      alert("Regla creada");
    } catch (err) { alert("Error al crear"); }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-secondary mb-6">Configurar Notificaciones Obligatorias</h1>
      
      {/* Formulario */}
      <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <div className="md:col-span-2">
          <label className="block text-sm font-bold text-gray-700">Mensaje para el Empleado</label>
          <textarea 
            className="w-full border p-2 rounded uppercase" 
            rows="2"
            value={form.message}
            onChange={e => setForm({...form, message: e.target.value.toUpperCase()})}
            placeholder="EJ: RECUERDA CUADRAR LA CAJA ANTES DE EMPEZAR"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700">Frecuencia</label>
          <select 
            className="w-full border p-2 rounded"
            value={form.condition}
            onChange={e => setForm({...form, condition: e.target.value})}
          >
            <option value="ALWAYS">Siempre (Cada vez que inicie sesión)</option>
            <option value="FIRST_SHIFT">Solo la primera vez del día</option>
          </select>
        </div>
        <div className="flex items-end">
          <button className="bg-accent text-white font-bold py-2 px-4 rounded hover:bg-teal-600 w-full">
            Crear Regla
          </button>
        </div>
      </form>

      {/* Lista */}
      <h3 className="font-bold text-lg mb-4">Reglas Activas</h3>
      <div className="space-y-2">
        {rules.map(rule => (
          <div key={rule.id} className="flex justify-between items-center border p-3 rounded hover:bg-gray-50">
            <div>
              <p className="font-bold text-secondary">{rule.name}</p>
              <p className="text-sm text-gray-600">{rule.message}</p>
              <div className="text-xs text-gray-500 mt-1 flex gap-2">
                <span className="bg-blue-100 text-blue-800 px-2 rounded">Tiempo: {rule.delay_seconds}s</span>
                <span className="bg-purple-100 text-purple-800 px-2 rounded">
                  {rule.condition === 'ALWAYS' ? 'SIEMPRE' : '1RA VEZ DÍA'}
                </span>
              </div>
            </div>
            <button onClick={() => handleDelete(rule.id)} className="text-red-500 hover:bg-red-50 p-2 rounded">
              <HiOutlineTrash className="w-5 h-5" />
            </button>
          </div>
        ))}
        {rules.length === 0 && <p className="text-gray-500 text-center">No hay reglas configuradas.</p>}
      </div>
    </div>
  );
}

export default NotificationRulesPage;