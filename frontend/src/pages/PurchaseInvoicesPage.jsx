import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { 
    HiShoppingCart, HiPlus, HiTrash, HiSearch, HiUserAdd, HiCube 
} from 'react-icons/hi';
import ModalForm from '../components/ModalForm'; // Reutilizamos tu modal genérico

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const PurchaseInvoicesPage = () => {
    const { token, user } = useContext(AuthContext);
    
    // --- ESTADOS DE DATOS ---
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]); // Para el buscador
    
    // --- ESTADOS DEL FORMULARIO PRINCIPAL ---
    const [invoiceNumber, setInvoiceNumber] = useState('');
    // ARREGLO FECHA: Usar hora local, no UTC
    const [invoiceDate, setInvoiceDate] = useState(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [pin, setPin] = useState('');
    
    // --- ESTADOS DEL CARRITO DE COMPRA ---
    const [cart, setCart] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(''); // ID del producto seleccionado
    const [productSearchTerm, setProductSearchTerm] = useState(''); // Texto del buscador
    const [quantity, setQuantity] = useState(1);
    const [cost, setCost] = useState('');

    // --- ESTADOS DE MODALES RÁPIDOS ---
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    
    // Formulario Producto Rápido
    const [newProdName, setNewProdName] = useState('');
    const [newProdSku, setNewProdSku] = useState('');
    const [newProdPrice, setNewProdPrice] = useState('');
    const [newProdCat, setNewProdCat] = useState('');
    const [categories, setCategories] = useState([]); // Para el select de categoría

    // Formulario Proveedor Rápido
    const [newSuppName, setNewSuppName] = useState('');
    const [newSuppPhone, setNewSuppPhone] = useState('');
    // CAMPOS NUEVOS
    const [newSuppAddress, setNewSuppAddress] = useState('');
    const [newSuppEmail, setNewSuppEmail] = useState('');
    const [newSuppContact, setNewSuppContact] = useState('');

    // --- ESTADO DESTINO DE MERCADERÍA ---
    const [locations, setLocations] = useState([]);
    const [targetLocation, setTargetLocation] = useState('');

    // --- CARGA INICIAL ---
    useEffect(() => {
        fetchSuppliers();
        fetchProducts();
        fetchCategories();
        fetchLocations(); // <--- Cargar sucursales
    }, [token]);

    const fetchLocations = async () => {
        try {
            const res = await axios.get(`${API_URL}/locations/`, { headers: { Authorization: `Bearer ${token}` } });
            setLocations(res.data);
            
            // Opcional: Si el usuario tiene turno activo, pre-seleccionar esa sucursal
            // (Esto mejora la UX para que no tenga que seleccionar siempre)
            try {
                const profile = await axios.get(`${API_URL}/users/me/profile`, { headers: { Authorization: `Bearer ${token}` } });
                if (profile.data.active_shift?.location_id) {
                    setTargetLocation(profile.data.active_shift.location_id);
                }
            } catch (e) {}

        } catch (error) { console.error("Error cargando sucursales", error); }
    };

    // --- EFECTO DE BÚSQUEDA ---
    useEffect(() => {
        // Filtrar productos cuando cambia el texto de búsqueda
        if (productSearchTerm === '') {
            setFilteredProducts(products.slice(0, 50)); // Mostrar los primeros 50 por defecto
        } else {
            const lowerTerm = productSearchTerm.toLowerCase();
            const filtered = products.filter(p => 
                p.name.toLowerCase().includes(lowerTerm) || 
                p.sku.toLowerCase().includes(lowerTerm)
            );
            setFilteredProducts(filtered.slice(0, 50)); // Limitar resultados para rendimiento
        }
    }, [productSearchTerm, products]);

    const fetchSuppliers = async () => {
        try {
            const res = await axios.get(`${API_URL}/suppliers/`, { headers: { Authorization: `Bearer ${token}` } });
            setSuppliers(res.data);
        } catch (error) { console.error(error); }
    };

    const fetchProducts = async () => {
        try {
            // Traemos productos sin paginación estricta para el buscador local (o limitamos a 1000)
            const res = await axios.get(`${API_URL}/products/?limit=2000`, { headers: { Authorization: `Bearer ${token}` } });
            setProducts(res.data);
            setFilteredProducts(res.data.slice(0, 50));
        } catch (error) { console.error(error); }
    };

    const fetchCategories = async () => {
        try {
            const res = await axios.get(`${API_URL}/categories/`, { headers: { Authorization: `Bearer ${token}` } });
            setCategories(res.data);
        } catch (error) { console.error(error); }
    };

    // --- MANEJO DEL CARRITO ---
    const handleAddItem = (e) => {
        e.preventDefault();
        if (!selectedProduct || quantity <= 0 || cost <= 0) {
            toast.warning("Selecciona producto, cantidad y costo válido.");
            return;
        }
        
        const productObj = products.find(p => p.id === parseInt(selectedProduct));
        if (!productObj) return;

        const newItem = {
            product_id: parseInt(selectedProduct),
            product_name: productObj.name,
            quantity: parseInt(quantity),
            cost_per_unit: parseFloat(cost),
            total: parseInt(quantity) * parseFloat(cost)
        };

        setCart([...cart, newItem]);
        // Resetear campos de item, pero mantener el cursor en el buscador si es posible
        setProductSearchTerm('');
        setSelectedProduct('');
        setQuantity(1);
        setCost('');
    };

    const handleRemoveItem = (index) => {
        const newCart = [...cart];
        newCart.splice(index, 1);
        setCart(newCart);
    };

    // --- CREACIÓN RÁPIDA: PROVEEDOR (MEJORADA) ---
    const handleQuickSupplier = async () => {
        if (!newSuppName) return toast.warning("Nombre requerido");
        try {
            const res = await axios.post(`${API_URL}/suppliers/`, {
                name: newSuppName.toUpperCase(),
                phone: newSuppPhone || null,
                email: newSuppEmail || null, 
                contact_person: newSuppContact || null,
                // Si tu backend soporta dirección en proveedor, añádela aquí.
                // Si no, la omitimos para evitar error 422.
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            setSuppliers([...suppliers, res.data]);
            setSelectedSupplier(res.data.id); // Seleccionar automáticamente
            setIsSupplierModalOpen(false);
            setNewSuppName(''); setNewSuppPhone('');
            toast.success("Proveedor creado y seleccionado");
        } catch (error) {
            toast.error("Error al crear proveedor");
        }
    };

    // --- CREACIÓN RÁPIDA: PRODUCTO ---
    const handleQuickProduct = async () => {
        if (!newProdName || !newProdSku || !newProdPrice) return toast.warning("Faltan datos");
        try {
            const payload = {
                name: newProdName.toUpperCase(),
                sku: newProdSku.toUpperCase(),
                description: "Creado desde Compras",
                price_1: parseFloat(newProdPrice),
                price_2: parseFloat(newProdPrice),
                price_3: parseFloat(newProdPrice),
                category_id: newProdCat ? parseInt(newProdCat) : null,
                average_cost: 0 // Se actualizará con esta compra
            };
            
            const res = await axios.post(`${API_URL}/products/`, payload, { headers: { Authorization: `Bearer ${token}` } });
            
            const newProd = res.data;
            setProducts([...products, newProd]);
            setProductSearchTerm(newProd.name); // Para que aparezca en el filtro
            setSelectedProduct(newProd.id); // Seleccionar automáticamente
            setIsProductModalOpen(false);
            
            // Limpiar
            setNewProdName(''); setNewProdSku(''); setNewProdPrice(''); setNewProdCat('');
            toast.success("Producto creado. ¡Ahora ponle costo y cantidad!");
        } catch (error) {
            toast.error(error.response?.data?.detail || "Error al crear producto");
        }
    };

    // --- GUARDAR FACTURA COMPLETA ---
    const handleSubmitInvoice = async (e) => {
        e.preventDefault();
        if (cart.length === 0) return toast.warning("El carrito está vacío");
        if (!selectedSupplier) return toast.warning("Selecciona un proveedor");
        if (!pin) return toast.warning("Ingresa tu PIN");
        
        // 1. Necesitamos el ID de la ubicación actual para la compra
        // Asumimos que viene del token/contexto. Si no está en 'activeShift', usamos un default o error.
        // Pero el backend recibe 'location_id' como query param en tu código actual de main.py
        
        // CORRECCIÓN 422: Validar tipos estrictamente
        try {
            // El endpoint en main.py es: POST /purchase-invoices/?location_id=...
            // Necesitamos el location_id. Lo sacamos del turno activo.
            const userProfile = await axios.get(`${API_URL}/users/me/profile`, { headers: { Authorization: `Bearer ${token}` } });
            const activeLocId = userProfile.data.active_shift?.location_id;

            if (!activeLocId) {
                return toast.error("Debes tener un turno activo para registrar compras (para saber a qué bodega va).");
            }

            if (!targetLocation) {
                return toast.warning("Por favor, selecciona la Sucursal de Destino (Bodega).");
            }

            const payload = {
                invoice_number: invoiceNumber || "S/N",
                invoice_date: invoiceDate,
                supplier_id: parseInt(selectedSupplier, 10),
                target_location_id: parseInt(targetLocation, 10), // <--- ENVIAMOS EL DESTINO ELEGIDO
                items: cart.map(item => ({
                    product_id: parseInt(item.product_id, 10),
                    quantity: parseInt(item.quantity, 10),
                    cost_per_unit: parseFloat(item.cost_per_unit)
                })),
                pin: pin
            };

            // Enviamos la petición. 
            // Nota: Ya no dependemos tanto del 'params: location_id' para la lógica, 
            // pero lo dejamos por compatibilidad si el backend lo requiere para validar sesión.
            // Lo importante es que 'payload' lleva 'target_location_id'.
            await axios.post(`${API_URL}/purchase-invoices/`, payload, {
                headers: { Authorization: `Bearer ${token}` },
                params: { location_id: activeLocId } 
            });
            toast.success("Factura de compra registrada correctamente");

            // 1. Obtener la ubicación del turno activo (para saber a qué bodega va)
            // Usamos una llamada síncrona al perfil si no tenemos el dato en el contexto inmediato
            // O mejor, intentamos obtenerlo del usuario actual
            let targetLocationId = null;
            try {
                const profileRes = await axios.get(`${API_URL}/users/me/profile`, { 
                    headers: { Authorization: `Bearer ${token}` } 
                });
                targetLocationId = profileRes.data.active_shift?.location_id;
            } catch (e) {
                console.error("Error obteniendo turno", e);
            }

            if (!targetLocationId) {
                return toast.error("Debes iniciar turno en una sucursal para registrar compras.");
            }

            await axios.post(`${API_URL}/purchase-invoices/`, payload, {
                headers: { Authorization: `Bearer ${token}` },
                params: { location_id: targetLocationId } // <--- ESTO FALTABA
            });

            toast.success("Factura de compra registrada correctamente");
            // Reset total
            setCart([]);
            setInvoiceNumber('');
            setPin('');
            setProductSearchTerm('');
            setSelectedProduct('');
        } catch (error) {
            toast.error(error.response?.data?.detail || "Error al registrar compra");
        }
    };

    const grandTotal = cart.reduce((acc, item) => acc + item.total, 0);

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
                <HiShoppingCart className="mr-3 text-indigo-600" />
                Ingreso de Mercadería (Compras)
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* --- COLUMNA IZQUIERDA: DATOS DE FACTURA --- */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
                        <h2 className="font-bold text-lg text-gray-700 mb-4 border-b pb-2">Datos de Factura</h2>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">N° Factura Física</label>
                                <input 
                                    type="text" 
                                    value={invoiceNumber} 
                                    onChange={e => setInvoiceNumber(e.target.value.toUpperCase())}
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                                    placeholder="001-001-123456789"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Proveedor</label>
                                <div className="flex gap-2">
                                    <select 
                                        value={selectedSupplier}
                                        onChange={e => setSelectedSupplier(e.target.value)}
                                        className="w-full border p-2 rounded bg-white"
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        {suppliers.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                    <button 
                                        onClick={() => setIsSupplierModalOpen(true)}
                                        className="bg-green-100 text-green-700 p-2 rounded hover:bg-green-200 transition"
                                        title="Crear Nuevo Proveedor"
                                    >
                                        <HiUserAdd size={20} />
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Fecha Emisión</label>
                                <input 
                                    type="date" 
                                    value={invoiceDate} 
                                    onChange={e => setInvoiceDate(e.target.value)}
                                    className="w-full border p-2 rounded"
                                />
                            </div>

                            {/* SELECTOR DE DESTINO */}
                            <div className="col-span-1 md:col-span-2 bg-blue-50 p-3 rounded-lg border border-blue-200">
                                <label className="block text-sm font-bold text-blue-800 mb-1">
                                    📍 Destino de Mercadería (Bodega)
                                </label>
                                <select 
                                    value={targetLocation} 
                                    onChange={e => setTargetLocation(e.target.value)}
                                    className="w-full border border-blue-300 p-2 rounded bg-white text-gray-800 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">-- Seleccionar Sucursal --</option>
                                    {locations.map(loc => (
                                        <option key={loc.id} value={loc.id}>
                                            Bodega de {loc.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-blue-600 mt-1">
                                    El sistema ingresará el stock automáticamente a la bodega de la sucursal seleccionada.
                                </p>
                            </div>
                            {/* ------------------- */}
                        </div>
                    </div>

                    {/* --- AGREGAR PRODUCTOS --- */}
                    <div className="bg-indigo-50 p-6 rounded-xl shadow-md border border-indigo-100">
                        <h2 className="font-bold text-lg text-indigo-800 mb-4 border-b border-indigo-200 pb-2">Agregar Producto</h2>
                        
                        <form onSubmit={handleAddItem} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-indigo-600 mb-1">BUSCAR PRODUCTO</label>
                                <div className="relative">
                                    <div className="flex gap-2 mb-1">
                                        <input 
                                            type="text"
                                            value={productSearchTerm}
                                            onChange={e => {
                                                setProductSearchTerm(e.target.value);
                                                setSelectedProduct(''); // Resetear selección al buscar
                                            }}
                                            className="w-full p-2 pl-8 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Escribe nombre o SKU..."
                                        />
                                        <HiSearch className="absolute left-2.5 top-3 text-gray-400" />
                                        
                                        <button 
                                            type="button"
                                            onClick={() => setIsProductModalOpen(true)}
                                            className="bg-blue-100 text-blue-700 p-2 rounded hover:bg-blue-200 transition flex-shrink-0"
                                            title="Crear Nuevo Producto"
                                        >
                                            <HiPlus size={20} />
                                        </button>
                                    </div>
                                    
                                    {/* Selector Filtrado */}
                                    <select 
                                        value={selectedProduct}
                                        onChange={e => {
                                            setSelectedProduct(e.target.value);
                                            // Auto-rellenar nombre en buscador para UX
                                            const p = products.find(prod => prod.id === parseInt(e.target.value));
                                            if(p) setProductSearchTerm(p.name);
                                        }}
                                        className="w-full border p-2 rounded bg-white text-sm"
                                        size="5" // Mostrar como lista desplegada
                                    >
                                        {filteredProducts.length === 0 ? (
                                            <option disabled>No hay coincidencias</option>
                                        ) : (
                                            filteredProducts.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} (SKU: {p.sku})
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-indigo-600">CANTIDAD</label>
                                    <input 
                                        type="number" min="1" 
                                        value={quantity} 
                                        onChange={e => setQuantity(e.target.value)}
                                        className="w-full border p-2 rounded text-center font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-indigo-600">COSTO UNIT. ($)</label>
                                    <input 
                                        type="number" step="0.01" min="0.01"
                                        value={cost} 
                                        onChange={e => setCost(e.target.value)}
                                        className="w-full border p-2 rounded text-center font-bold text-green-700"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-2 rounded hover:bg-indigo-700 transition">
                                Agregar a la Lista
                            </button>
                        </form>
                    </div>
                </div>

                {/* --- COLUMNA DERECHA: RESUMEN Y GUARDAR --- */}
                <div className="lg:col-span-2 flex flex-col h-full">
                    <div className="bg-white rounded-xl shadow-md border border-gray-200 flex-grow flex flex-col overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="font-bold text-gray-700">Detalle de Compra</h2>
                            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">
                                {cart.length} Items
                            </span>
                        </div>

                        <div className="flex-grow overflow-auto p-0">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-100 text-gray-600 text-xs uppercase sticky top-0">
                                    <tr>
                                        <th className="p-3">Producto</th>
                                        <th className="p-3 text-center">Cant.</th>
                                        <th className="p-3 text-right">Costo Unit.</th>
                                        <th className="p-3 text-right">Subtotal</th>
                                        <th className="p-3 text-center">X</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {cart.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="p-8 text-center text-gray-400">
                                                Agrega productos desde el panel izquierdo
                                            </td>
                                        </tr>
                                    ) : (
                                        cart.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="p-3 font-medium text-gray-800">{item.product_name}</td>
                                                <td className="p-3 text-center">{item.quantity}</td>
                                                <td className="p-3 text-right">${item.cost_per_unit.toFixed(2)}</td>
                                                <td className="p-3 text-right font-bold text-gray-800">${item.total.toFixed(2)}</td>
                                                <td className="p-3 text-center">
                                                    <button onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600">
                                                        <HiTrash size={18}/>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-6 bg-gray-50 border-t border-gray-200">
                            <div className="flex justify-between items-end mb-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Confirma con tu PIN</label>
                                    <input 
                                        type="password" 
                                        value={pin}
                                        onChange={e => setPin(e.target.value)}
                                        className="border p-2 rounded w-32 text-center tracking-widest"
                                        placeholder="****"
                                    />
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-500 uppercase">Total Factura</p>
                                    <p className="text-4xl font-bold text-gray-800">${grandTotal.toFixed(2)}</p>
                                </div>
                            </div>
                            
                            <button 
                                onClick={handleSubmitInvoice}
                                className="w-full bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-green-700 transition transform hover:-translate-y-1"
                            >
                                REGISTRAR INGRESO A BODEGA
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- MODAL CREAR PRODUCTO --- */}
            <ModalForm
                isOpen={isProductModalOpen}
                onClose={() => setIsProductModalOpen(false)}
                title="Crear Nuevo Producto Rápido"
                submitLabel="Crear Producto"
                onSubmit={handleQuickProduct}
            >
                <div className="space-y-3">
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-500">NOMBRE</label>
                            <input type="text" value={newProdName} onChange={e => setNewProdName(e.target.value.toUpperCase())} className="w-full border p-2 rounded" />
                        </div>
                        <div className="w-1/3">
                            <label className="block text-xs font-bold text-gray-500">SKU / CÓDIGO</label>
                            <input type="text" value={newProdSku} onChange={e => setNewProdSku(e.target.value.toUpperCase())} className="w-full border p-2 rounded" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-500">PRECIO VENTA P3 ($)</label>
                            <input type="number" step="0.01" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} className="w-full border p-2 rounded" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-500">CATEGORÍA</label>
                            <select value={newProdCat} onChange={e => setNewProdCat(e.target.value)} className="w-full border p-2 rounded bg-white">
                                <option value="">Sin Categoría</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">* El costo se definirá al agregarlo a la factura.</p>
                </div>
            </ModalForm>

            {/* --- MODAL CREAR PROVEEDOR (COMPLETO) --- */}
            <ModalForm
                isOpen={isSupplierModalOpen}
                onClose={() => setIsSupplierModalOpen(false)}
                title="Nuevo Proveedor"
                submitLabel="Guardar Proveedor"
                onSubmit={handleQuickSupplier}
            >
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-500">NOMBRE EMPRESA / PERSONA *</label>
                        <input type="text" value={newSuppName} onChange={e => setNewSuppName(e.target.value.toUpperCase())} className="w-full border p-2 rounded" required />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-500">TELÉFONO</label>
                            <input type="text" value={newSuppPhone} onChange={e => setNewSuppPhone(e.target.value)} className="w-full border p-2 rounded" />
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-gray-500">CONTACTO (VENDEDOR)</label>
                             <input type="text" value={newSuppContact} onChange={e => setNewSuppContact(e.target.value)} className="w-full border p-2 rounded" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500">EMAIL</label>
                        <input type="email" value={newSuppEmail} onChange={e => setNewSuppEmail(e.target.value)} className="w-full border p-2 rounded" />
                    </div>
                </div>
            </ModalForm>
        </div>
    );
};

export default PurchaseInvoicesPage;