import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DataTable from '../components/DataTable.jsx';
import ModalForm from '../components/ModalForm.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import api from '../services/api';
import { createCashTransaction, fetchCashTransactions } from '../services/cash';

const emptyForm = {
  amount: '',
  description: '',
  pin: '',
};

function CashTransactionsPage() {
  const { user, activeShift } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();

  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(searchParams.get('accountId') || '');
  const [transactions, setTransactions] = useState([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManageCash = user?.role === 'admin';
  const location = activeShift?.location;

  const formattedAccounts = useMemo(
    () => accounts.map((account) => ({
      value: String(account.id),
      label: account.name,
    })),
    [accounts],
  );

  useEffect(() => {
    if (!location?.id || !canManageCash) {
      setAccounts([]);
      return;
    }

    const loadAccounts = async () => {
      try {
        setIsLoadingAccounts(true);
        setError('');
        const response = await api.get(`/locations/${location.id}/cash-accounts/`);
        setAccounts(response.data);
      } catch (err) {
        setError('No se pudieron cargar las cuentas de caja.');
      } finally {
        setIsLoadingAccounts(false);
      }
    };

    loadAccounts();
  }, [location?.id, canManageCash]);

  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedAccountId('');
      return;
    }

    const fromQuery = searchParams.get('accountId');
    if (fromQuery && accounts.some((account) => String(account.id) === fromQuery)) {
      setSelectedAccountId(fromQuery);
      return;
    }

    if (!selectedAccountId || !accounts.some((account) => String(account.id) === selectedAccountId)) {
      setSelectedAccountId(String(accounts[0].id));
    }
  }, [accounts, searchParams]);

  useEffect(() => {
    const loadTransactions = async () => {
      if (!selectedAccountId) {
        setTransactions([]);
        return;
      }

      try {
        setIsLoadingTransactions(true);
        setError('');
        const data = await fetchCashTransactions(selectedAccountId);
        setTransactions(data);
      } catch (err) {
        setError('No se pudieron cargar los movimientos de caja.');
      } finally {
        setIsLoadingTransactions(false);
      }
    };

    loadTransactions();
  }, [selectedAccountId]);

  const handleAccountChange = (event) => {
    const { value } = event.target;
    setSelectedAccountId(value);
    setSuccessMessage('');
    setError('');
    if (value) {
      setSearchParams({ accountId: value });
    } else {
      setSearchParams({});
    }
  };

  const handleOpenModal = () => {
    setFormState(emptyForm);
    setSuccessMessage('');
    setError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateTransaction = async () => {
    if (!selectedAccountId) {
      setError('Selecciona una cuenta de caja antes de registrar un movimiento.');
      return;
    }

    const parsedAmount = parseFloat(formState.amount);
    if (Number.isNaN(parsedAmount) || parsedAmount === 0) {
      setError('Ingresa un monto válido (puede ser positivo o negativo).');
      return;
    }

    if (!formState.description.trim()) {
      setError('La descripción es obligatoria.');
      return;
    }

    if (!formState.pin.trim()) {
      setError('Ingresa tu PIN de seguridad.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await createCashTransaction({
        amount: parsedAmount,
        description: formState.description.trim(),
        account_id: Number(selectedAccountId),
        pin: formState.pin,
      });
      setIsModalOpen(false);
      setFormState(emptyForm);
      setSuccessMessage('Movimiento registrado correctamente.');
      const updatedTransactions = await fetchCashTransactions(selectedAccountId);
      setTransactions(updatedTransactions);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || 'No se pudo registrar el movimiento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    {
      key: 'timestamp',
      label: 'Fecha',
      render: (row) => new Date(row.timestamp).toLocaleString(),
    },
    {
      key: 'description',
      label: 'Descripción',
    },
    {
      key: 'amount',
      label: 'Monto',
      render: (row) => (
        <span className={row.amount < 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
          {new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(row.amount)}
        </span>
      ),
    },
    {
      key: 'user',
      label: 'Registrado por',
      render: (row) => row.user?.email || '—',
    },
  ];

  if (!canManageCash) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-md border">
        <h1 className="text-2xl font-bold text-secondary mb-2">Movimientos de caja</h1>
        <p className="text-gray-500">Solo los administradores pueden gestionar la caja.</p>
      </div>
    );
  }

  if (!activeShift) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-md border">
        <h1 className="text-2xl font-bold text-secondary mb-2">Movimientos de caja</h1>
        <p className="text-gray-500">Necesitas iniciar un turno para registrar movimientos.</p>
        <Link to="/iniciar-turno" className="mt-4 inline-block text-accent font-semibold">
          Ir a iniciar turno
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Movimientos de caja</h1>
          <p className="text-sm text-gray-500">
            Registra ingresos o egresos y revisa el historial de la cuenta seleccionada.
          </p>
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Cuenta de caja</label>
            <select
              value={selectedAccountId}
              onChange={handleAccountChange}
              className="mt-1 w-full md:w-64 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={isLoadingAccounts}
            >
              <option value="" disabled>
                {isLoadingAccounts ? 'Cargando cuentas...' : 'Selecciona una cuenta'}
              </option>
              {formattedAccounts.map((account) => (
                <option key={account.value} value={account.value}>
                  {account.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleOpenModal}
            className="bg-accent text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-70"
            disabled={!selectedAccountId}
          >
            + Registrar movimiento
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-100 text-red-700">{error}</div>}
      {successMessage && <div className="p-3 rounded-lg bg-green-100 text-green-700">{successMessage}</div>}

      {isLoadingTransactions ? (
        <p className="text-gray-500">Cargando movimientos...</p>
      ) : (
        <DataTable
          columns={columns}
          data={transactions}
          emptyMessage={selectedAccountId ? 'Aún no hay movimientos registrados para esta cuenta.' : 'Selecciona una cuenta de caja para ver el historial.'}
        />
      )}

      <ModalForm
        title="Registrar movimiento"
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleCreateTransaction}
        submitLabel="Registrar"
        isSubmitting={isSubmitting}
        footer={<span className="text-sm">Usa montos negativos para egresos.</span>}
      >
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Monto *</label>
            <input
              type="number"
              step="0.01"
              name="amount"
              value={formState.amount}
              onChange={handleFormChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Descripción *</label>
            <textarea
              name="description"
              rows={3}
              value={formState.description}
              onChange={handleFormChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">PIN de seguridad *</label>
            <input
              type="password"
              name="pin"
              value={formState.pin}
              onChange={handleFormChange}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>
        </div>
      </ModalForm>
    </div>
  );
}

export default CashTransactionsPage;
