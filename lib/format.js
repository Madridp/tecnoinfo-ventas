const TZ = 'America/Guatemala';

export const q = (n) =>
  'Q' + Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fecha = (d) =>
  d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('es-GT', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

export const fechaHora = (d) =>
  d ? new Date(d).toLocaleString('es-GT', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

export const sumarDias = (d, dias) => {
  const x = new Date(d);
  x.setDate(x.getDate() + Number(dias || 0));
  return x;
};

export const textoGarantia = (dias) => {
  dias = Number(dias || 0);
  if (!dias) return 'Sin garantía';
  if (dias % 365 === 0) return `${dias / 365} año${dias > 365 ? 's' : ''}`;
  if (dias % 30 === 0) return `${dias / 30} mes${dias > 30 ? 'es' : ''}`;
  return `${dias} días`;
};

export const errMsg = (e) => (e?.message || String(e)).replace(/^.*?ERROR:\s*/, '');
