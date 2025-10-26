import React from 'react';

function DataTable({ columns, data, actions, emptyMessage = 'No hay registros disponibles.' }) {
  const hasData = Array.isArray(data) && data.length > 0;
  const hasActions = typeof actions === 'function';

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white text-secondary">
        <thead className="bg-gray-100">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key || column.label}
                className={`py-3 px-4 text-left ${column.headerClassName || ''}`}
              >
                {column.label}
              </th>
            ))}
            {hasActions && <th className="py-3 px-4 text-center">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {!hasData && (
            <tr>
              <td
                className="py-6 px-4 text-center text-gray-500"
                colSpan={columns.length + (hasActions ? 1 : 0)}
              >
                {emptyMessage}
              </td>
            </tr>
          )}
          {hasData && data.map((row) => {
            const rowKey = row.id ?? JSON.stringify(row);
            return (
              <tr key={rowKey} className="border-b last:border-b-0 hover:bg-gray-50">
                {columns.map((column) => (
                  <td
                    key={column.key || column.label}
                    className={`py-3 px-4 align-top ${column.cellClassName || ''}`}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
                {hasActions && (
                  <td className="py-3 px-4 text-center space-x-2">
                    {actions(row)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
