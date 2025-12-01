// frontend/src/pages/LocationsPage.jsx
// Esta es la nueva página del "Arquitecto" para crear Sucursales

import React, { useState, useEffect } from 'react';
import api from '../services/api';
import DataTable from '../components/DataTable.jsx';
import ModalForm from '../components/ModalForm.jsx';

// El "plano" vacío para una nueva sucursal
const emptyForm = {
  name: '',
  description: '',
  address: '',
};

function LocationsPage() {
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Estados para el formulario modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null); // Para saber si estamos creando o editando

  // Cargar la lista de sucursales cuando la página se abre
  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setIsLoading(true);
      setError('');
      // Llamamos al "camarero" para que nos traiga la lista de sucursales
      // (Gracias al cambio en crud.py, esto solo traerá las "Oficinas Principales")
      const response = await api.get('/locations/');
      setLocations(response.data);
    } catch (err) {
      setError('No se pudieron cargar las sucursales.');
    } finally {
      setIsLoading(false);
    }
  };

  // Abrir el formulario (modal)
  const handleOpenModal = (location = null) => {
    if (location) {
      // Si estamos editando, llenamos el formulario con los datos
      setFormState({
        name: location.name,
        description: location.description || '',
        address: location.address || '',
      });
      setEditingId(location.id);
    } else {
      // Si estamos creando, usamos el formulario vacío
      setFormState(emptyForm);
      setEditingId(null);
    }
    setError(''); // Limpiamos errores viejos
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // Actualizar el estado del formulario mientras el admin escribe
  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({
      ...prev,
      [name]: value.toUpperCase(),
    }));
  };

  // Enviar el formulario al backend
  const handleSubmit = async () => {
    if (!formState.name) {
      setError('El nombre de la sucursal es obligatorio.');
      return;
    }
    
    setIsSubmitting(true);
    setError('');

    try {
      if (editingId) {
        // Si teníamos un ID, actualizamos (PUT)
        await api.put(`/locations/${editingId}`, formState);
      } else {
        // Si no, creamos (POST)
        // Aquí es donde el backend hará la "Magia 2x1"
        await api.post('/locations/', formState);
      }
      fetchLocations(); // Recargamos la lista
      handleCloseModal(); // Cerramos el formulario
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar la sucursal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Definir las columnas para la tabla de sucursales
  const columns = [
    { key: 'name', label: 'Nombre Sucursal' },
    { key: 'address', label: 'Dirección' },
    { key: 'description', label: 'Descripción' },
  ];

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Administrar Sucursales</h1>
          <p className="text-sm text-gray-500">
            Crea o edita las oficinas de tu negocio.
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-accent text-white font-semibold py-2 px-4 rounded-lg"
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

      {/* Este es el formulario que aparece/desaparece */}
      <ModalForm
        title={editingId ? 'Editar Sucursal' : 'Crear Nueva Sucursal'}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        footer="Al crear una sucursal, se creará automáticamente una bodega asociada."
      >
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Nombre *</label>
            <input
              type="text"
              name="name"
              value={formState.name}
              onChange={handleFormChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Ej: Sucursal Matriz - Nueva Aurora"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Dirección</label>
            <input
              type="text"
              name="address"
              value={formState.address}
              onChange={handleFormChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Ej: Gral. Julio Andrade, Quito 170701"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Descripción</label>
            <textarea
              name="description"
              rows={2}
              value={formState.description}
              onChange={handleFormChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Ej: Sucursal principal en el sur de Quito"
            />
          </div>
        </div>
      </ModalForm>
    </div>
  );
}

export default LocationsPage;