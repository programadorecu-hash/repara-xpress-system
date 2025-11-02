import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../components/DataTable.jsx';
import ModalForm from '../components/ModalForm.jsx';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext.jsx';

const emptyAccount = {
  name: '',
  account_type: 'CAJA_CHICA',
};

// --- INICIO DE NUESTRO CÓDIGO ---
// Añadimos CAJA_VENTAS como una opción seleccionable
const ACCOUNT_TYPE_OPTIONS = [
  { value: 'CAJA_VENTAS', label: 'Caja de Ventas (Principal)' },
  { value: 'CAJA_CHICA', label: 'Caja chica (Gastos)' },
  { value: 'BANCO', label: 'Cuenta bancaria' },
  { value: 'OTRO', label: 'Otro (Ej: Recargas, Sueltos)' },
];
// --- FIN DE NUESTRO CÓDIGO ---

function CashAccountsPage() {
  const { user, activeShift } = useContext(AuthContext);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState(emptyAccount);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManageCash = user?.role === 'admin';
  const location = activeShift?.location;

  const fetchAccounts = async () => {
    if (!location) {
      setAccounts([]);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/locations/${location.id}/cash-accounts/`);
      setAccounts(response.data);
    } catch (err) {
      setError('No se pudieron cargar las cuentas de caja.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [location?.id]);

  const handleOpenModal = () => {
    setFormState(emptyAccount);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!location) {
      setError('Necesitas un turno activo para crear cuentas de caja.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await api.post('/cash-accounts/', {
        ...formState,
        location_id: location.id,
      });
      handleCloseModal();
      fetchAccounts();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || 'No se pudo crear la cuenta de caja.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Nombre' },
    {
      key: 'account_type',
      label: 'Tipo',
      render: (row) => ACCOUNT_TYPE_OPTIONS.find((option) => option.value === row.account_type)?.label || row.account_type,
    },
    {
      key: 'location',
      label: 'Sucursal',
      render: (row) => row.location?.name || '—',
    },
  ];

  if (!canManageCash) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-md border">
        <h1 className="text-2xl font-bold text-secondary mb-2">Cuentas y egresos de caja</h1>
        <p className="text-gray-500">Solo los administradores pueden gestionar la caja.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Cuentas y egresos de caja</h1>
          <p className="text-sm text-gray-500">Controla las cuentas de efectivo asociadas a la sucursal activa.</p>
        </div>
        <button
          onClick={handleOpenModal}
          className="bg-accent text-white font-semibold py-2 px-4 rounded-lg"
        >
          + Nueva cuenta
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-100 text-red-700">{error}</div>}

      {loading ? (
        <p className="text-gray-500">Cargando cuentas...</p>
      ) : (
        <DataTable
          columns={columns}
          data={accounts}
          actions={(row) => (
            <Link
              to={`/caja/transacciones?accountId=${row.id}`}
              className="text-accent font-semibold hover:underline"
            >
              Ver movimientos
            </Link>
          )}
          emptyMessage={location ? 'No hay cuentas registradas para esta sucursal.' : 'Inicia un turno para ver las cuentas.'}
        />
      )}

      <ModalForm
        title="Nueva cuenta de caja"
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
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
            <label className="block text-sm font-semibold text-gray-700">Tipo de cuenta *</label>
            <select
              name="account_type"
              value={formState.account_type}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {ACCOUNT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Sucursal</label>
            <input
              type="text"
              value={location?.name || 'Sin turno activo'}
              disabled
              className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2"
            />
          </div>
        </div>
      </ModalForm>
    </div>
  );
}

export default CashAccountsPage;
