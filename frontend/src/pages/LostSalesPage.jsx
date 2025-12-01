import React, { useContext, useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import ModalForm from '../components/ModalForm.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { createLostSaleLog, fetchLostSales } from '../services/lostSales.js';
import api from '../services/api';

const emptyForm = {
  product_name: '',
  reason: '',
  location_id: '',
};

function LostSalesPage() {
  const { user, activeShift } = useContext(AuthContext);

  const [lostSales, setLostSales] = useState([]);
  const [locations, setLocations] = useState([]);
  const [listError, setListError] = useState('');
  const [dependenciesError, setDependenciesError] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState(emptyForm);

  const canManageLostSales = user?.role === 'admin' || user?.role === 'inventory_manager';

  const defaultLocationId = useMemo(() => {
    if (activeShift?.location?.id) {
      return String(activeShift.location.id);
    }
    return '';
  }, [activeShift?.location?.id]);

  const locationOptions = useMemo(
    () =>
      locations.map((location) => ({
        value: String(location.id),
        label: location.name,
      })),
    [locations],
  );

  const locationNameById = useMemo(() => {
    return locations.reduce((accumulator, location) => {
      accumulator[location.id] = location.name;
      return accumulator;
    }, {});
  }, [locations]);

  useEffect(() => {
    if (!canManageLostSales) {
      setLostSales([]);
      return;
    }

    const loadLostSales = async () => {
      try {
        setIsLoading(true);
        const data = await fetchLostSales();
        setLostSales(data);
        setListError('');
      } catch (error) {
        setListError('No se pudieron cargar los registros de ventas perdidas.');
        setLostSales([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadLostSales();
  }, [canManageLostSales]);

  useEffect(() => {
    if (!canManageLostSales) {
      setLocations([]);
      return;
    }

    const loadLocations = async () => {
      try {
        setIsLoadingLocations(true);
        const response = await api.get('/locations/');
        setLocations(response.data);
        setDependenciesError('');
      } catch (error) {
        setDependenciesError('No se pudieron cargar las ubicaciones disponibles.');
        setLocations([]);
      } finally {
        setIsLoadingLocations(false);
      }
    };

    loadLocations();
  }, [canManageLostSales]);

  const handleOpenModal = () => {
    setFormState({
      ...emptyForm,
      location_id: defaultLocationId,
    });
    setFormError('');
    setSuccessMessage('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    // Si no es ID de ubicación, es texto libre -> Mayúsculas
    const val = name === 'location_id' ? value : value.toUpperCase();

    setFormState((previous) => ({
      ...previous,
      [name]: val,
    }));
  };

  const handleCreateLostSale = async () => {
    if (!formState.product_name.trim()) {
      setFormError('El nombre del producto es obligatorio.');
      return;
    }

    if (!formState.reason.trim()) {
      setFormError('Describe el motivo de la venta perdida.');
      return;
    }

    if (!formState.location_id) {
      setFormError('Selecciona una ubicación.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      const payload = {
        product_name: formState.product_name.trim(),
        reason: formState.reason.trim(),
        location_id: Number(formState.location_id),
      };

      const created = await createLostSaleLog(payload);
      setLostSales((previous) => [created, ...previous]);
      setSuccessMessage('Venta perdida registrada correctamente.');
      setIsModalOpen(false);
      setFormState(emptyForm);
    } catch (error) {
      const detail = error.response?.data?.detail;
      setFormError(detail || 'No se pudo registrar la venta perdida.');
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
      key: 'product_name',
      label: 'Producto',
    },
    {
      key: 'reason',
      label: 'Motivo',
      cellClassName: 'whitespace-pre-line',
    },
    {
      key: 'location',
      label: 'Ubicación',
      render: (row) => row.location?.name || locationNameById[row.location_id] || '—',
    },
    {
      key: 'user',
      label: 'Registrado por',
      render: (row) => row.user?.email || '—',
    },
  ];

  if (!canManageLostSales) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-md border">
        <h1 className="text-2xl font-bold text-secondary mb-2">Ventas perdidas</h1>
        <p className="text-gray-500">No tienes permisos para revisar ventas perdidas.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Ventas perdidas</h1>
          <p className="text-sm text-gray-500">
            Registra oportunidades de venta que no se concretaron para analizar causas y tendencias.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenModal}
          className="px-4 py-2 rounded-lg bg-accent text-white font-semibold hover:bg-accent/90 disabled:opacity-70"
          disabled={isLoadingLocations || !!dependenciesError}
        >
          Registrar venta perdida
        </button>
      </div>

      {dependenciesError && (
        <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-lg">
          {dependenciesError}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 text-green-700 border border-green-200 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      {listError && (
        <div className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-4 py-3 rounded-lg">
          {listError}
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-gray-500 py-10">Cargando ventas perdidas...</div>
      ) : (
        <DataTable columns={columns} data={lostSales} emptyMessage="No hay ventas perdidas registradas." />
      )}

      <ModalForm
        title="Registrar venta perdida"
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleCreateLostSale}
        submitLabel="Guardar"
        isSubmitting={isSubmitting}
        footer="Estos registros ayudan a planificar reposiciones y estrategias comerciales."
      >
        <div className="grid grid-cols-1 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-secondary">Producto *</span>
            <input
              type="text"
              name="product_name"
              value={formState.product_name}
              onChange={handleFormChange}
              className="border rounded-lg px-3 py-2"
              placeholder="Ej. Pantalla Samsung A20"
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-secondary">Motivo *</span>
            <textarea
              name="reason"
              value={formState.reason}
              onChange={handleFormChange}
              className="border rounded-lg px-3 py-2"
              rows={3}
              placeholder="Describe por qué se perdió la venta"
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-secondary">Ubicación *</span>
            <select
              name="location_id"
              value={formState.location_id}
              onChange={handleFormChange}
              className="border rounded-lg px-3 py-2"
              required
            >
              <option value="">Selecciona una ubicación</option>
              {locationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {formError && (
            <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-lg">
              {formError}
            </div>
          )}
        </div>
      </ModalForm>
    </div>
  );
}

export default LostSalesPage;

