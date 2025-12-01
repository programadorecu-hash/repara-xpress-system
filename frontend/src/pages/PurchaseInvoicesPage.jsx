import React, { useContext, useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import ModalForm from '../components/ModalForm.jsx';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext.jsx';

const emptyInvoice = {
  invoice_number: '',
  invoice_date: new Date().toISOString().slice(0, 10),
  supplier_id: '',
  pin: '',
};

const emptyItem = {
  product_id: '',
  quantity: 1,
  cost_per_unit: 0,
};

function PurchaseInvoicesPage() {
  const { user, activeShift } = useContext(AuthContext);
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState(emptyInvoice);
  const [items, setItems] = useState([emptyItem]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listError, setListError] = useState('');

  const canManagePurchases = user?.role === 'admin' || user?.role === 'inventory_manager';
  const locationId = activeShift?.location?.id;

  const fetchDependencies = async () => {
    try {
      setLoading(true);
      setError('');
      const [supplierResponse, productResponse] = await Promise.all([
        api.get('/suppliers/'),
        api.get('/products/'),
      ]);
      setSuppliers(supplierResponse.data);
      setProducts(productResponse.data);
    } catch (err) {
      setError('No se pudo preparar el formulario de compras.');
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      const response = await api.get('/purchase-invoices/');
      setInvoices(response.data);
      setListError('');
    } catch (err) {
      setListError('No se pudieron cargar las facturas de compra.');
      setInvoices([]);
    }
  };

  useEffect(() => {
    fetchDependencies();
    fetchInvoices();
  }, []);

  const handleOpenModal = () => {
    setFormState({
      ...emptyInvoice,
      invoice_date: new Date().toISOString().slice(0, 10),
    });
    setItems([emptyItem]);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleInvoiceChange = (event) => {
    const { name, value } = event.target;
    // Número de factura en mayúsculas, el resto (PIN/IDs) igual
    const val = name === 'invoice_number' ? value.toUpperCase() : value;
    
    setFormState((prev) => ({
      ...prev,
      [name]: val,
    }));
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, emptyItem]);
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const totalCost = useMemo(() => {
    return items.reduce((acc, item) => {
      const quantity = Number(item.quantity) || 0;
      const cost = Number(item.cost_per_unit) || 0;
      return acc + quantity * cost;
    }, 0);
  }, [items]);

  const handleSubmit = async () => {
    if (!locationId) {
      setError('Necesitas iniciar un turno para registrar compras.');
      return;
    }

    const validItems = items.filter((item) => item.product_id && Number(item.quantity) > 0);
    if (validItems.length === 0) {
      setError('Agrega al menos un producto válido a la factura.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const payload = {
        invoice_number: formState.invoice_number,
        invoice_date: formState.invoice_date,
        supplier_id: Number(formState.supplier_id),
        pin: formState.pin,
        items: validItems.map((item) => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
          cost_per_unit: Number(item.cost_per_unit),
        })),
      };

      const response = await api.post(`/purchase-invoices/?location_id=${locationId}`, payload);
      setInvoices((prev) => [response.data, ...prev]);
      handleCloseModal();
      setFormState(emptyInvoice);
      setItems([emptyItem]);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || 'No se pudo registrar la factura.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    { key: 'invoice_number', label: 'Número' },
    {
      key: 'invoice_date',
      label: 'Fecha',
      render: (row) => new Date(row.invoice_date).toLocaleDateString(),
    },
    {
      key: 'supplier',
      label: 'Proveedor',
      render: (row) => row.supplier?.name || '—',
    },
    {
      key: 'total_cost',
      label: 'Total',
      render: (row) => `$${Number(row.total_cost || 0).toFixed(2)}`,
      headerClassName: 'text-right',
      cellClassName: 'text-right font-semibold',
    },
    {
      key: 'items_count',
      label: 'Artículos',
      render: (row) => row.items?.length || 0,
      headerClassName: 'text-center',
      cellClassName: 'text-center',
    },
  ];

  if (!canManagePurchases) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-md border">
        <h1 className="text-2xl font-bold text-secondary mb-2">Facturas de compra</h1>
        <p className="text-gray-500">No tienes permisos para gestionar compras.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Facturas de compra</h1>
          <p className="text-sm text-gray-500">Registra compras y actualiza automáticamente el inventario.</p>
        </div>
        <button
          onClick={handleOpenModal}
          className="bg-accent text-white font-semibold py-2 px-4 rounded-lg"
        >
          + Registrar compra
        </button>
      </div>

      {(error || listError) && (
        <div className="space-y-2">
          {error && <div className="p-3 rounded-lg bg-red-100 text-red-700">{error}</div>}
          {listError && <div className="p-3 rounded-lg bg-yellow-100 text-yellow-700">{listError}</div>}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Preparando formulario...</p>
      ) : (
        <DataTable columns={columns} data={invoices} emptyMessage="No hay compras registradas." />
      )}

      <ModalForm
        title="Registrar compra"
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        submitLabel="Guardar compra"
        isSubmitting={isSubmitting}
        footer={(
          <div className="flex w-full items-center justify-between gap-4">
            <span>Total estimado:</span>
            <span className="font-semibold text-secondary text-lg">${totalCost.toFixed(2)}</span>
          </div>
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Número de factura *</label>
            <input
              type="text"
              name="invoice_number"
              value={formState.invoice_number}
              onChange={handleInvoiceChange}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Fecha *</label>
            <input
              type="date"
              name="invoice_date"
              value={formState.invoice_date}
              onChange={handleInvoiceChange}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Proveedor *</label>
            <select
              name="supplier_id"
              value={formState.supplier_id}
              onChange={handleInvoiceChange}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Selecciona un proveedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">PIN de autorización *</label>
            <input
              type="password"
              name="pin"
              value={formState.pin}
              onChange={handleInvoiceChange}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-secondary">Productos</h3>
            <button
              type="button"
              onClick={handleAddItem}
              className="text-accent font-semibold"
            >
              + Agregar producto
            </button>
          </div>

          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-gray-50 p-4 rounded-lg">
              <div className="md:col-span-5">
                <label className="block text-sm font-semibold text-gray-700">Producto *</label>
                <select
                  value={item.product_id}
                  onChange={(event) => handleItemChange(index, 'product_id', event.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">Selecciona un producto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-semibold text-gray-700">Cantidad *</label>
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(event) => handleItemChange(index, 'quantity', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-semibold text-gray-700">Costo unitario *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.cost_per_unit}
                  onChange={(event) => handleItemChange(index, 'cost_per_unit', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div className="md:col-span-1 flex items-end">
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="text-red-500 hover:underline"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </ModalForm>
    </div>
  );
}

export default PurchaseInvoicesPage;
