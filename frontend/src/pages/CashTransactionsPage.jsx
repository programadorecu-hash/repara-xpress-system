import React, {
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import ModalForm from "../components/ModalForm.jsx";
import { AuthContext } from "../context/AuthContext.jsx";
import api from "../services/api";
import { createCashTransaction, fetchCashTransactions } from "../services/cash";

const emptyForm = {
  amount: "",
  description: "",
  pin: "",
};

function CashTransactionsPage() {
  const { user, activeShift } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();

  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(
    searchParams.get("accountId") || ""
  );
  const [transactions, setTransactions] = useState([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- INICIO DE NUESTRO CÓDIGO (Cierre de Caja) ---
  // "Pantalla digital" para el saldo actual
  const [accountBalance, setAccountBalance] = useState(null);
  // Estado de carga para la "pantalla digital"
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  // --- FIN DE NUESTRO CÓDIGO ---

  // --- HISTORIAL DE CIERRES ---
  const [showClosuresModal, setShowClosuresModal] = useState(false);
  const [pastClosures, setPastClosures] = useState([]);
  // ---------------------------

  const canManageCash = user?.role === "admin";
  const location = activeShift?.location;

  const formattedAccounts = useMemo(
    () =>
      accounts.map((account) => ({
        value: String(account.id),
        label: account.name,
      })),
    [accounts]
  );

  useEffect(() => {
    if (!location?.id || !canManageCash) {
      setAccounts([]);
      return;
    }

    const loadAccounts = async () => {
      try {
        setIsLoadingAccounts(true);
        setError("");
        const response = await api.get(
          `/locations/${location.id}/cash-accounts/`
        );
        setAccounts(response.data);
      } catch (err) {
        setError("No se pudieron cargar las cuentas de caja.");
      } finally {
        setIsLoadingAccounts(false);
      }
    };

    loadAccounts();
  }, [location?.id, canManageCash]);

  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedAccountId("");
      return;
    }

    const fromQuery = searchParams.get("accountId");
    if (
      fromQuery &&
      accounts.some((account) => String(account.id) === fromQuery)
    ) {
      setSelectedAccountId(fromQuery);
      return;
    }

    if (
      !selectedAccountId ||
      !accounts.some((account) => String(account.id) === selectedAccountId)
    ) {
      setSelectedAccountId(String(accounts[0].id));
    }
  }, [accounts, searchParams]);

  // --- INICIO DE NUESTRO CÓDIGO (Cierre de Caja) ---

  // Función para cargar el SALDO (la "pantalla digital")
  const loadBalance = useCallback(async () => {
    if (!selectedAccountId) {
      setAccountBalance(null);
      return;
    }
    try {
      setIsLoadingBalance(true);
      // Llamamos a la nueva URL que creamos en main.py
      const response = await api.get(
        `/cash-accounts/${selectedAccountId}/balance`
      );
      setAccountBalance(response.data);
    } catch (err) {
      setError("No se pudo cargar el saldo de la cuenta.");
    } finally {
      setIsLoadingBalance(false);
    }
  }, [selectedAccountId]); // Depende de la cuenta seleccionada

  // Función para cargar la LISTA de movimientos
  const loadTransactions = useCallback(async () => {
    if (!selectedAccountId) {
      setTransactions([]);
      return;
    }
    try {
      setIsLoadingTransactions(true);
      setError("");
      const data = await fetchCashTransactions(selectedAccountId);
      setTransactions(data);
    } catch (err) {
      setError("No se pudieron cargar los movimientos de caja.");
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [selectedAccountId]); // Depende de la cuenta seleccionada

  // Este useEffect se dispara cuando la cuenta seleccionada cambia
  useEffect(() => {
    loadTransactions(); // Carga la lista
    loadBalance(); // Carga el saldo
  }, [selectedAccountId, loadTransactions, loadBalance]); // Añadimos las funciones
  // --- FIN DE NUESTRO CÓDIGO ---

  const handleAccountChange = (event) => {
    const { value } = event.target;
    setSelectedAccountId(value);
    setSuccessMessage("");
    setError("");
    if (value) {
      setSearchParams({ accountId: value });
    } else {
      setSearchParams({});
    }
  };

  const handleOpenModal = () => {
    setFormState(emptyForm);
    setSuccessMessage("");
    setError("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // --- FUNCIONES HISTORIAL CIERRES ---
  const handleOpenClosuresHistory = async () => {
    if (!selectedAccountId) return;
    try {
      const res = await api.get(`/cash-accounts/${selectedAccountId}/closures`);
      setPastClosures(res.data);
      setShowClosuresModal(true);
    } catch (e) {
      alert("No se pudo cargar el historial de cierres.");
    }
  };

  const handleReprintClosure = async (closureId) => {
    try {
      // Pedimos el reporte pasando el ID del cierre
      const response = await api.get(
        `/cash-accounts/${selectedAccountId}/closure-report?closure_id=${closureId}`,
        { responseType: "blob" }
      );
      const fileURL = window.URL.createObjectURL(response.data);
      window.open(fileURL, "_blank");
    } catch (e) {
      alert("Error al generar el PDF.");
    }
  };
  // -----------------------------------

  // --- INICIO DE NUESTRO CÓDIGO (El "Botón Rojo") ---
  const handleOpenCloseoutModal = () => {
    // Si no hay saldo, o el saldo es 0, no hacemos nada
    if (!accountBalance || accountBalance.current_balance === 0) {
      alert("No hay saldo para cerrar en esta caja.");
      return;
    }

    // Pre-llenamos el formulario con los datos del cierre
    setFormState({
      // Ponemos el saldo en NEGATIVO
      amount: (accountBalance.current_balance * -1).toFixed(2),
      description: "CIERRE DE CAJA", // Descripción por defecto
      pin: "",
    });

    setSuccessMessage("");
    setError("");
    setIsModalOpen(true); // Abrimos el mismo modal
  };
  // --- FIN DE NUESTRO CÓDIGO ---

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    // Si es descripción, mayúsculas. Si es PIN o monto, normal.
    const val = name === "description" ? value.toUpperCase() : value;

    setFormState((prev) => ({
      ...prev,
      [name]: val,
    }));
  };

  const handleCreateTransaction = async () => {
    if (!selectedAccountId) {
      setError(
        "Selecciona una cuenta de caja antes de registrar un movimiento."
      );
      return;
    }

    const parsedAmount = parseFloat(formState.amount);
    if (Number.isNaN(parsedAmount) || parsedAmount === 0) {
      setError("Ingresa un monto válido (puede ser positivo o negativo).");
      return;
    }

    if (!formState.description.trim()) {
      setError("La descripción es obligatoria.");
      return;
    }

    if (!formState.pin.trim()) {
      setError("Ingresa tu PIN de seguridad.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      await createCashTransaction({
        amount: parsedAmount,
        description: formState.description.trim(),
        account_id: Number(selectedAccountId),
        pin: formState.pin,
      });
      setIsModalOpen(false);
      setFormState(emptyForm);
      setSuccessMessage("Movimiento registrado correctamente.");

      // --- INICIO DE NUESTRO CÓDIGO (Cierre de Caja) ---
      // Recargamos AMBAS cosas: la lista y el saldo
      await Promise.all([loadTransactions(), loadBalance()]);
      // --- FIN DE NUESTRO CÓDIGO ---
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || "No se pudo registrar el movimiento.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    {
      key: "timestamp",
      label: "Fecha",
      render: (row) => new Date(row.timestamp).toLocaleString(),
    },
    {
      key: "description",
      label: "Descripción",
    },
    {
      key: "amount",
      label: "Monto",
      render: (row) => (
        <span
          className={
            row.amount < 0
              ? "text-red-600 font-semibold"
              : "text-green-600 font-semibold"
          }
        >
          {new Intl.NumberFormat("es-EC", {
            style: "currency",
            currency: "USD",
          }).format(row.amount)}
        </span>
      ),
    },
    {
      key: "user",
      label: "Registrado por",
      render: (row) => row.user?.email || "—",
    },
  ];

  if (!canManageCash) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-md border">
        <h1 className="text-2xl font-bold text-secondary mb-2">
          Movimientos de caja
        </h1>
        <p className="text-gray-500">
          Solo los administradores pueden gestionar la caja.
        </p>
      </div>
    );
  }

  if (!activeShift) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-md border">
        <h1 className="text-2xl font-bold text-secondary mb-2">
          Movimientos de caja
        </h1>
        <p className="text-gray-500">
          Necesitas iniciar un turno para registrar movimientos.
        </p>
        <Link
          to="/iniciar-turno"
          className="mt-4 inline-block text-accent font-semibold"
        >
          Ir a iniciar turno
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary">
            Movimientos de caja
          </h1>
          <p className="text-sm text-gray-500">
            Registra ingresos o egresos y revisa el historial de la cuenta
            seleccionada.
          </p>
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700">
              Cuenta de caja
            </label>
            <select
              value={selectedAccountId}
              onChange={handleAccountChange}
              className="mt-1 w-full md:w-64 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={isLoadingAccounts}
            >
              <option value="" disabled>
                {isLoadingAccounts
                  ? "Cargando cuentas..."
                  : "Selecciona una cuenta"}
              </option>
              {formattedAccounts.map((account) => (
                <option key={account.value} value={account.value}>
                  {account.label}
                </option>
              ))}
            </select>
          </div>

          {/* --- INICIO DE NUESTRO CÓDIGO (Pantalla Digital y Botón de Cierre) --- */}

          {/* Esta es la "Pantalla Digital" que muestra el saldo */}
          <div className="text-right">
            <label className="block text-sm font-semibold text-gray-700">
              Saldo Actual
            </label>
            {isLoadingBalance ? (
              <p className="text-lg font-bold text-gray-400">Calculando...</p>
            ) : (
              <p
                className={`text-2xl font-bold ${
                  accountBalance?.current_balance < 0
                    ? "text-red-600"
                    : "text-secondary"
                }`}
              >
                {/* Formateamos el número como dinero */}
                {new Intl.NumberFormat("es-EC", {
                  style: "currency",
                  currency: "USD",
                }).format(accountBalance?.current_balance || 0)}
              </p>
            )}
          </div>

          {/* Botón para Ingreso/Gasto manual (el que ya tenías) */}
          <button
            onClick={handleOpenModal}
            className="bg-secondary text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-70"
            disabled={!selectedAccountId}
            title="Registrar un ingreso o gasto manual"
          >
            + Movimiento Manual
          </button>

          {/* Botón Historial (NUEVO) */}
          <button
            onClick={handleOpenClosuresHistory}
            className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-700 disabled:opacity-50"
            disabled={!selectedAccountId}
            title="Ver cierres anteriores"
          >
            📜 Historial
          </button>

          {/* Este es el "Botón Rojo" para Cierre de Caja */}
          <button
            onClick={handleOpenCloseoutModal}
            className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50"
            // Se deshabilita si no hay cuenta, si el saldo es 0, o si se está cargando
            disabled={
              !selectedAccountId ||
              isLoadingBalance ||
              !accountBalance ||
              accountBalance.current_balance === 0
            }
            title="Cerrar la caja (retirar todo el saldo)"
          >
            Cierre de Caja
          </button>
          {/* --- FIN DE NUESTRO CÓDIGO --- */}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-100 text-red-700">{error}</div>
      )}
      {successMessage && (
        <div className="p-3 rounded-lg bg-green-100 text-green-700">
          {successMessage}
        </div>
      )}

      {isLoadingTransactions ? (
        <p className="text-gray-500">Cargando movimientos...</p>
      ) : (
        <DataTable
          columns={columns}
          data={transactions}
          emptyMessage={
            selectedAccountId
              ? "Aún no hay movimientos registrados para esta cuenta."
              : "Selecciona una cuenta de caja para ver el historial."
          }
        />
      )}

      <ModalForm
        title="Registrar movimiento"
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleCreateTransaction}
        submitLabel="Registrar"
        isSubmitting={isSubmitting}
        footer={
          <span className="text-sm">Usa montos negativos para egresos.</span>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700">
              Monto *
            </label>
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
            <label className="block text-sm font-semibold text-gray-700">
              Descripción *
            </label>
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
            <label className="block text-sm font-semibold text-gray-700">
              PIN de seguridad *
            </label>
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
      {/* MODAL HISTORIAL DE CIERRES (PEGAR AQUÍ) */}
      {showClosuresModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Historial de Cierres</h3>
              <button
                onClick={() => setShowClosuresModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y">
              {pastClosures.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No hay cierres registrados.
                </p>
              ) : (
                pastClosures.map((closure) => (
                  <div
                    key={closure.id}
                    className="py-3 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-bold text-gray-800">
                        {new Date(closure.timestamp).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500">
                        {closure.user?.email}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600 mb-1">
                        ${Math.abs(closure.amount).toFixed(2)}
                      </p>
                      <button
                        onClick={() => handleReprintClosure(closure.id)}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                      >
                        🖨️ Reimprimir
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {/* ------------------------------------------- */}
    </div>
  );
}

export default CashTransactionsPage;
