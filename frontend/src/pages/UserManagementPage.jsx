// frontend/src/pages/UserManagementPage.jsx
// Esta es la nueva página de "Oficina de RRHH"

import React, { useState, useEffect } from 'react';
import api from '../services/api';
import DataTable from '../components/DataTable.jsx';
import ModalForm from '../components/ModalForm.jsx';

// Formulario vacío para un nuevo usuario
const emptyForm = {
  email: '',
  password: '',
  role: 'warehouse_operator', // Por defecto creamos "Empleados"
};

// Formulario vacío para editar
const emptyEditForm = {
  full_name: '',
  id_card: '',
  emergency_contact: '',
  role: '',
  is_active: true,
};

function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Estados para los formularios
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [createFormState, setCreateFormState] = useState(emptyForm);
  const [editFormState, setEditFormState] = useState(emptyEditForm);

  const [editingUser, setEditingUser] = useState(null); // Para guardar el usuario que editamos
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar la lista de usuarios al abrir la página
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await api.get('/users/');
      setUsers(response.data);
    } catch (err) {
      setError('No se pudieron cargar los usuarios.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Lógica para el Modal de CREAR Usuario ---
  const handleOpenCreateModal = () => {
    setCreateFormState(emptyForm);
    setError('');
    setIsCreateModalOpen(true);
  };

  const handleCreateFormChange = (event) => {
    const { name, value } = event.target;
    setCreateFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateSubmit = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      // 1. Llamamos a la URL de crear usuario
      await api.post('/users/', createFormState);
      fetchUsers(); // Recargamos la lista
      setIsCreateModalOpen(false); // Cerramos el formulario
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo crear el usuario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Lógica para el Modal de EDITAR Usuario ---
  const handleOpenEditModal = (user) => {
    setEditingUser(user); // Guardamos el usuario original
    // Llenamos el formulario de edición con sus datos
    setEditFormState({
      full_name: user.full_name || '',
      id_card: user.id_card || '',
      emergency_contact: user.emergency_contact || '',
      role: user.role,
      is_active: user.is_active,
    });
    setError('');
    setIsEditModalOpen(true);
  };

  const handleEditFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    
    let val;
    if (type === 'checkbox') {
      val = checked;
    } else if (name === 'role') {
      val = value; // El rol es un valor interno, no lo tocamos
    } else {
      // Nombre, Cédula, Contacto -> Mayúsculas
      val = value.toUpperCase();
    }

    setEditFormState((prev) => ({ ...prev, [name]: val }));
  };

  const handleEditSubmit = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      // 1. Llamamos a la URL de "actualización" (PATCH)
      await api.patch(`/users/${editingUser.id}`, editFormState);
      fetchUsers(); // Recargamos la lista
      setIsEditModalOpen(false); // Cerramos
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo actualizar el usuario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Lógica para Resetear Contraseña ---
  const handleResetPassword = async (userId) => {
    const newPassword = prompt('Escribe la NUEVA contraseña temporal para este usuario:');
    if (newPassword && newPassword.length >= 8) {
      try {
        await api.post(`/users/${userId}/reset-password`, { new_password: newPassword });
        alert('¡Contraseña reseteada con éxito!');
      } catch (err) {
        alert('Error: ' + (err.response?.data?.detail || 'No se pudo resetear la contraseña.'));
      }
    } else if (newPassword) {
      alert('Error: La contraseña debe tener al menos 8 caracteres.');
    }
  };

  // Definir las columnas para la tabla
  const columns = [
    { key: 'email', label: 'Email' },
    { key: 'full_name', label: 'Nombre Completo' },
    { key: 'role', label: 'Rol' },
    {
      key: 'is_active',
      label: 'Estado',
      render: (user) => (
        <span className={user.is_active ? 'text-green-600' : 'text-red-600'}>
          {user.is_active ? 'Activo' : 'Desactivado'}
        </span>
      ),
    },
    { key: 'id_card', label: 'Cédula' },
    { key: 'emergency_contact', label: 'Contacto Emergencia' },
  ];

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Gestión de Usuarios</h1>
          <p className="text-sm text-gray-500">Crea, edita y gestiona a tus empleados y gerentes.</p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="bg-accent text-white font-semibold py-2 px-4 rounded-lg"
        >
          + Nuevo Usuario
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-100 text-red-700">{error}</div>}

      {isLoading ? (
        <p className="text-gray-500">Cargando usuarios...</p>
      ) : (
        <DataTable
          columns={columns}
          data={users}
          emptyMessage="No hay usuarios creados."
          actions={(user) => (
            <div className="flex flex-col items-start gap-1">
              <button
                onClick={() => handleOpenEditModal(user)}
                className="text-accent font-semibold hover:underline text-sm"
              >
                Editar
              </button>
              <button
                onClick={() => handleResetPassword(user.id)}
                className="text-blue-600 font-semibold hover:underline text-sm"
              >
                Resetear Pass
              </button>
            </div>
          )}
        />
      )}

      {/* --- Modal para CREAR Usuario --- */}
      <ModalForm
        title="Crear Nuevo Usuario"
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        submitLabel="Crear Usuario"
        footer="El nuevo usuario será forzado a crear su propio PIN secreto en su primer inicio de sesión."
      >
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Email *</label>
            <input
              type="email"
              name="email"
              value={createFormState.email}
              onChange={handleCreateFormChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Contraseña Temporal *</label>
            <input
              type="text"
              name="password"
              value={createFormState.password}
              onChange={handleCreateFormChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Mínimo 8 caracteres"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Rol del Usuario *</label>
            <select
              name="role"
              value={createFormState.role}
              onChange={handleCreateFormChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="warehouse_operator">Empleado (Vendedor/Técnico)</option>
              <option value="inventory_manager">Gerente (Inventario)</option>
              <option value="admin">Administrador (Control Total)</option>
            </select>
          </div>
        </div>
      </ModalForm>

      {/* --- Modal para EDITAR Usuario --- */}
      <ModalForm
        title={`Editar Usuario: ${editingUser?.email}`}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        submitLabel="Guardar Cambios"
        footer="El PIN del usuario no se puede modificar desde aquí."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Nombre Completo</label>
            <input
              type="text"
              name="full_name"
              value={editFormState.full_name}
              onChange={handleEditFormChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Cédula</label>
            <input
              type="text"
              name="id_card"
              value={editFormState.id_card}
              onChange={handleEditFormChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700">Contacto de Emergencia</label>
            <input
              type="text"
              name="emergency_contact"
              value={editFormState.emergency_contact}
              onChange={handleEditFormChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Ej: Nombre (Teléfono)"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Rol del Usuario *</label>
            <select
              name="role"
              value={editFormState.role}
              onChange={handleEditFormChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="warehouse_operator">Empleado (Vendedor/Técnico)</option>
              <option value="inventory_manager">Gerente (Inventario)</option>
              <option value="admin">Administrador (Control Total)</option>
            </select>
          </div>
          <div className="flex items-center justify-start pt-4">
            <input
              type="checkbox"
              id="is_active"
              name="is_active"
              checked={editFormState.is_active}
              onChange={handleEditFormChange}
              className="h-4 w-4 text-accent rounded"
            />
            <label htmlFor="is_active" className="ml-2 block text-sm font-semibold text-gray-700">
              Usuario Activo (Puede iniciar sesión)
            </label>
          </div>
        </div>
      </ModalForm>
    </div>
  );
}

export default UserManagementPage;
