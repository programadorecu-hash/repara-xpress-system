// frontend/src/components/WorkOrderNotes.jsx
// Panel de "Notas internas" para una orden específica.
// Uso: <WorkOrderNotes workOrderId={order.id} />
// Requiere: usuario con rol interno y turno activo (el backend lo valida).

import { useEffect, useState } from "react";
import { getWorkOrderNotes, addWorkOrderNote } from "../services/api";

export default function WorkOrderNotes({ workOrderId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadNotes() {
    try {
      setLoading(true);
      setError("");
      const data = await getWorkOrderNotes(workOrderId, { limit: 50 });
      setNotes(data);
    } catch (err) {
      setError(
        "No se pudieron cargar las notas. Verifica permisos y turno activo."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAddNote(e) {
    e.preventDefault();
    if (!message.trim()) return;
    try {
      setSending(true);
      setError("");
      await addWorkOrderNote(workOrderId, message.trim());
      setMessage("");
      await loadNotes(); // refrescar lista
    } catch (err) {
      setError("No se pudo guardar la nota. Verifica permisos o turno activo.");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId]);

  return (
    <div className="mt-3 border rounded p-3 bg-white">
      <h4 className="font-semibold mb-2">Notas internas</h4>

      {/* Formulario crear nota */}
      <form onSubmit={handleAddNote} className="mb-3">
        <textarea
          className="w-full border rounded p-2 resize-vertical"
          rows={3}
          placeholder="Escribe un comentario para esta orden..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            type="submit"
            disabled={sending || !message.trim()}
            className="px-3 py-1 rounded bg-brand hover:bg-brand-deep text-white disabled:opacity-50"
          >
            {sending ? "Guardando..." : "Agregar nota"}
          </button>
          <button
            type="button"
            onClick={loadNotes}
            disabled={loading}
            className="px-3 py-1 rounded border"
          >
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </form>

      {/* Mensaje de error */}
      {error ? <div className="text-red-600 mb-2">{error}</div> : null}

      {/* Lista de notas */}
      {loading ? (
        <div>Cargando notas...</div>
      ) : notes.length === 0 ? (
        <div className="text-gray-600">Sin notas aún.</div>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="border rounded p-2">
              <div className="text-sm text-gray-500">
                {/* Encabezado: autor (email), local y fecha */}
                <span className="font-medium">
                  {n?.user?.email || "Usuario"}
                </span>
                {" · "}
                <span>{n?.location?.name || "Local"}</span>
                {" · "}
                <span>{new Date(n.created_at).toLocaleString()}</span>
              </div>
              <div className="mt-1">{n.message}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/*
Resumen:
- Muestra y crea notas internas por orden.
- Usa los endpoints del backend (/work-orders/{id}/notes) protegidos por roles internos.
- Si no hay turno activo, el backend devuelve error y aquí lo mostramos.
*/
