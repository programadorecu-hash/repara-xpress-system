import React, { useEffect, useState, useContext } from 'react';
import DataTable from '../components/DataTable.jsx';
import ModalForm from '../components/ModalForm.jsx';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext.jsx';

const emptySupplier = {
  name: '',
  contact_person: '',
  email: '',
  phone: '',
};

function SuppliersPage() {
  const { user } = useContext(AuthContext);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState(emptySupplier);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManageSuppliers = user?.role === 'admin' || user?.role === 'inventory_manager';

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/suppliers/');
      setSuppliers(response.data);
    } catch (err) {
      setError('No se pudieron cargar los proveedores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const openModal = (supplier = null) => {
    if (supplier) {
      setFormState({
        name: supplier.name || '',
        contact_person: supplier.contact_person || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
      });
      setEditingSupplier(supplier);
    } else {
      setFormState(emptySupplier);
      setEditingSupplier(null);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    // Solo Nombre y Contacto van en mayúsculas
    const val = (name === 'name' || name === 'contact_person') 
      ? value.toUpperCase() 
      : value;

    setFormState((prev) => ({
      ...prev,
      [name]: val,
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier.id}`, formState);
      } else {
        await api.post('/suppliers/', formState);
      }
      closeModal();
      fetchSuppliers();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || 'No se pudo guardar el proveedor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Nombre' },
    { key: 'contact_person', label: 'Contacto' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Teléfono' },
  ];

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Proveedores</h1>
          <p className="text-sm text-gray-500">Administra los proveedores de tus compras.</p>
        </div>
        {canManageSuppliers && (
          <button
            onClick={() => openModal()}
            className="bg-accent text-white font-semibold py-2 px-4 rounded-lg"
          >
            + Nuevo proveedor
          </button>
        )}
      </div>

      {error && <div className="p-3 rounded-lg bg-red-100 text-red-700">{error}</div>}
      {loading ? (
        <p className="text-gray-500">Cargando proveedores...</p>
      ) : (
        <DataTable
          columns={columns}
          data={suppliers}
          actions={canManageSuppliers ? (supplier) => (
            <button
              type="button"
              onClick={() => openModal(supplier)}
              className="text-accent hover:underline"
            >
              Editar
            </button>
          ) : undefined}
        />
      )}

      <ModalForm
        title={editingSupplier ? 'Editar proveedor' : 'Nuevo proveedor'}
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Nombre *</label>
            <input
              type="text"
              name="name"
              value={formState.name}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Contacto</label>
            <input
              type="text"
              name="contact_person"
              value={formState.contact_person}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Email</label>
            <input
              type="email"
              name="email"
              value={formState.email}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Teléfono</label>
            <input
              type="tel"
              name="phone"
              value={formState.phone}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>
      </ModalForm>
    </div>
  );
}

export default SuppliersPage;
