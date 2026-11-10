'use client';

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className={`bg-white w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b sticky top-0 bg-white">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

export function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

const COLORES = {
  pendiente: 'bg-amber-100 text-amber-800', aceptada: 'bg-green-100 text-green-800',
  rechazada: 'bg-gray-200 text-gray-600', pagada: 'bg-green-100 text-green-800',
  anulada: 'bg-red-100 text-red-700', recibido: 'bg-blue-100 text-blue-800',
  en_revision: 'bg-amber-100 text-amber-800', enviado_proveedor: 'bg-purple-100 text-purple-800',
  reparado: 'bg-teal-100 text-teal-800', reemplazado: 'bg-teal-100 text-teal-800',
  reembolsado: 'bg-gray-200 text-gray-700', rechazado: 'bg-red-100 text-red-700',
  entregado: 'bg-green-100 text-green-800',
};

export function Badge({ estado, children }) {
  return <span className={`badge ${COLORES[estado] || 'bg-gray-100 text-gray-700'}`}>{children || estado?.replace('_', ' ')}</span>;
}

export function Table({ head, children, empty }) {
  return (
    <div className="card p-0 overflow-x-auto">
      <table className="w-full">
        <thead className="bg-brand-soft"><tr>{head.map((h, i) => <th key={i} className="th">{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
      {empty && <p className="text-center text-sm text-gray-400 py-8">{empty}</p>}
    </div>
  );
}
