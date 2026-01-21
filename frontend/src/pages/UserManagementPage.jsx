// frontend/src/pages/UserManagementPage.jsx
// Esta es la nueva página de "Oficina de RRHH" - AHORA CON INVITACIONES

import React, { useState, useEffect } from 'react';
import api from '../services/api';
import DataTable from '../components/DataTable.jsx';
import ModalForm from '../components/ModalForm.jsx';
import { toast } from 'react-toastify';

// Formulario de INVITACIÓN (Solo pedimos correo y rol)
const invitationForm = {
  email: '',
  role: 'warehouse_operator',
};

// Formulario vacío para editar (esto se mantiene igual)
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
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [inviteFormState, setInviteFormState] = useState(invitationForm);
  const [editFormState, setEditFormState] = useState(emptyEditForm);

  const [editingUser, setEditingUser] = useState(null); 
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // --- Lógica para INVITAR Usuario ---
  const handleOpenInviteModal = () => {
    setInviteFormState(invitationForm);
    setError('');
    setIsInviteModalOpen(true);
  };

  const handleInviteChange = (event) => {
    const { name, value } = event.target;
    setInviteFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleInviteSubmit = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      // Llamamos al endpoint de invitar
      await api.post('/invitations/send', inviteFormState);
      toast.success('Invitación enviada al correo.');
      setIsInviteModalOpen(false);
    } catch (err) {
      const msg = err.response?.data?.detail || 'No se pudo enviar la invitación.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Lógica para EDITAR Usuario (Se mantiene igual) ---
  const handleOpenEditModal = (user) => {
    setEditingUser(user); 
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
    let val = type === 'checkbox' ? checked : (name === 'role' ? value : value.toUpperCase());
    setEditFormState((prev) => ({ ...prev, [name]: val }));
  };

  const handleEditSubmit = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      await api.patch(`/users/${editingUser.id}`, editFormState);
      fetchUsers();
      setIsEditModalOpen(false);
      toast.success('Usuario actualizado.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al actualizar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (userId) => {
    const newPassword = prompt('Escribe la NUEVA contraseña temporal para este usuario:');
    if (newPassword && newPassword.length >= 8) {
      try {
        await api.post(`/users/${userId}/reset-password`, { new_password: newPassword });
        toast.success('Contraseña reseteada.');
      } catch (err) {
        toast.error('Error al resetear contraseña.');
      }
    }
  };

  const columns = [
    { key: 'email', label: 'Email' },
    { key: 'full_name', label: 'Nombre' },
    { key: 'role', label: 'Rol' },
    {
      key: 'is_active',
      label: 'Estado',
      render: (user) => (
        <span className={user.is_active ? 'text-green-600' : 'text-red-600'}>
          {user.is_active ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    { key: 'id_card', label: 'Cédula' },
  ];

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Gestión de Personal</h1>
          <p className="text-sm text-gray-500">Envía invitaciones para que tus empleados se unan.</p>
        </div>
        <button
          onClick={handleOpenInviteModal}
          className="bg-accent text-white font-semibold py-2 px-4 rounded-lg shadow hover:bg-teal-600"
        >
          ✉️ Invitar Empleado
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-100 text-red-700">{error}</div>}

      {isLoading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : (
        <DataTable
          columns={columns}
          data={users}
          emptyMessage="No hay usuarios en la empresa."
          actions={(user) => (
            <div className="flex flex-col items-start gap-1">
              <button
                onClick={() => handleOpenEditModal(user)}
                className="text-accent font-semibold hover:underline text-sm"
              >
                Editar Ficha
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

      {/* --- Modal para INVITAR --- */}
      <ModalForm
        title="Invitar Colaborador"
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSubmit={handleInviteSubmit}
        isSubmitting={isSubmitting}
        submitLabel="Enviar Invitación"
        footer="Se enviará un correo con un enlace para que el empleado configure su contraseña y PIN."
      >
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Correo Electrónico *</label>
            <input
              type="email"
              name="email"
              value={inviteFormState.email}
              onChange={handleInviteChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 lowercase"
              placeholder="ejemplo@correo.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Rol *</label>
            <select
              name="role"
              value={inviteFormState.role}
              onChange={handleInviteChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="warehouse_operator">Empleado (Vendedor/Técnico)</option>
              <option value="inventory_manager">Gerente (Inventario)</option>
              <option value="admin">Administrador (Socio)</option>
            </select>
          </div>
        </div>
      </ModalForm>

      {/* --- Modal para EDITAR (Igual que antes) --- */}
      <ModalForm
        title={`Editar: ${editingUser?.email}`}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        submitLabel="Guardar"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Nombre Completo</label>
            <input
              type="text"
              name="full_name"
              value={editFormState.full_name}
              onChange={handleEditFormChange}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Cédula</label>
            <input
              type="text"
              name="id_card"
              value={editFormState.id_card}
              onChange={handleEditFormChange}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700">Contacto Emergencia</label>
            <input
              type="text"
              name="emergency_contact"
              value={editFormState.emergency_contact}
              onChange={handleEditFormChange}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </div>
          <div className="flex items-center pt-4">
            <input
              type="checkbox"
              name="is_active"
              checked={editFormState.is_active}
              onChange={handleEditFormChange}
              className="h-4 w-4"
            />
            <label className="ml-2 text-sm font-semibold">Usuario Activo</label>
          </div>
        </div>
      </ModalForm>
    </div>
  );
}

export default UserManagementPage;