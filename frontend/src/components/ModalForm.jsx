import React from 'react';

function ModalForm({ title, isOpen, onClose, onSubmit, submitLabel = 'Guardar', children, footer, isSubmitting = false }) {
  if (!isOpen) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (onSubmit) {
      onSubmit();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-secondary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {children}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-4 border-t">
            {footer && (
              <div className="text-sm text-gray-600 md:flex-1">
                {footer}
              </div>
            )}
            <div className="flex justify-end gap-3 md:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-accent text-white font-semibold hover:bg-accent/90 disabled:opacity-70"
              >
                {isSubmitting ? 'Guardando...' : submitLabel}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ModalForm;
