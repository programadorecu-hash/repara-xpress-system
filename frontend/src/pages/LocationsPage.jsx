// frontend/src/pages/LocationsPage.jsx
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import DataTable from '../components/DataTable.jsx';
import ModalForm from '../components/ModalForm.jsx';

// El "plano" actualizado para una nueva sucursal
const emptyForm = {
  name: '',
  description: '',
  address: '',
  phone: '', 
  email: '', 
  daily_goal: 0, // <--- NUEVO
};

function LocationsPage() {
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Estados para el formulario modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await api.get('/locations/');
      setLocations(response.data);
    } catch (err) {
      setError('No se pudieron cargar las sucursales.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (location = null) => {
    if (location) {
      setFormState({
        name: location.name,
        description: location.description || '',
        address: location.address || '',
        phone: location.phone || '', 
        email: location.email || '', 
        daily_goal: location.daily_goal || 0, // <--- Cargar meta
      });
      setEditingId(location.id);
    } else {
      setFormState(emptyForm);
      setEditingId(null);
    }
    setError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    // Truco: Para el email no queremos mayúsculas forzadas
    const finalValue = name === 'email' ? value : value.toUpperCase();
    
    setFormState((prev) => ({
      ...prev,
      [name]: finalValue,
    }));
  };

  const handleSubmit = async () => {
    if (!formState.name) {
      setError('El nombre de la sucursal es obligatorio.');
      return;
    }
    
    setIsSubmitting(true);
    setError('');

    try {
      if (editingId) {
        await api.put(`/locations/${editingId}`, formState);
      } else {
        await api.post('/locations/', formState);
      }
      fetchLocations();
      handleCloseModal();
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar la sucursal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Columnas actualizadas para mostrar contacto
  const columns = [
    { key: 'name', label: 'Nombre Sucursal' },
    { key: 'address', label: 'Dirección' },
    { key: 'phone', label: 'Teléfono' }, // Nueva columna
    { key: 'description', label: 'Descripción' },
  ];

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Administrar Sucursales</h1>
          <p className="text-sm text-gray-500">
            Define la información de contacto para cada local.
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-accent text-white font-semibold py-2 px-4 rounded-lg hover:bg-teal-600 transition"
        >
          + Nueva Sucursal
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-100 text-red-700">{error}</div>}

      {isLoading ? (
        <p className="text-gray-500">Cargando sucursales...</p>
      ) : (
        <DataTable
          columns={columns}
          data={locations}
          emptyMessage="Aún no has creado ninguna sucursal."
          actions={(location) => (
            <button
              onClick={() => handleOpenModal(location)}
              className="text-accent font-semibold hover:underline"
            >
              Editar
            </button>
          )}
        />
      )}

      <ModalForm
        title={editingId ? 'Editar Sucursal' : 'Crear Nueva Sucursal'}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        footer="La información de contacto (dirección, teléfono) aparecerá en los recibos emitidos desde esta sucursal."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700">Nombre *</label>
            <input
              type="text"
              name="name"
              value={formState.name}
              onChange={handleFormChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Ej: SUCURSAL NORTE"
              required
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700">Dirección</label>
            <input
              type="text"
              name="address"
              value={formState.address}
              onChange={handleFormChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Ej: Av. Amazonas y Naciones Unidas"
            />
            <p className="text-xs text-gray-500 mt-1">Si se deja vacío, se usará la dirección de la Matriz.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700">Teléfono</label>
            <input
              type="text"
              name="phone"
              value={formState.phone}
              onChange={handleFormChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Ej: 0991234567"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700">Email</label>
            <input
              type="email"
              name="email"
              value={formState.email}
              onChange={handleFormChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="sucursal@ejemplo.com"
            />
          </div>

          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
            <label className="block text-sm font-bold text-green-800">Meta Diaria de Ventas ($)</label>
            <input
              type="number"
              step="0.01"
              name="daily_goal"
              value={formState.daily_goal}
              onChange={handleFormChange}
              className="mt-1 w-full rounded-lg border border-green-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 font-bold text-green-900"
              placeholder="0.00"
            />
            <p className="text-xs text-green-700 mt-1">Define el objetivo diario para medir el rendimiento en el Dashboard.</p>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700">Descripción</label>
            <textarea
              name="description"
              rows={2}
              value={formState.description}
              onChange={handleFormChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Notas internas sobre esta ubicación"
            />
          </div>
        </div>
      </ModalForm>
    </div>
  );
}

export default LocationsPage;