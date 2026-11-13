// Datos del negocio — cámbialos aquí y se actualizan en cotizaciones, recibos y garantías
export const NEGOCIO = {
  nombre: 'TECNO INFO GT',
  responsable: 'Ing. Pedro Madrid',
  telefono: '+502 5316 0294',
  web: 'tecnoinfo.info',
  regimen: 'Pequeño Contribuyente',
  // Límite anual de facturación del régimen (Q). Verifícalo con la SAT si cambia.
  limiteAnual: 150000,
};

export const CONDICIONES = {
  COT: 'Precios en quetzales, incluyen IVA 5% (Pequeño Contribuyente). Cotización válida hasta la fecha indicada o mientras haya existencia. Pago en efectivo o transferencia; con tarjeta (hasta 10 cuotas) aplica recargo.',
  VTA: 'Garantía contra defectos de fábrica según el plazo indicado en cada producto, contada desde la fecha de este recibo. No cubre golpes, humedad, variaciones de voltaje, manipulación por terceros ni software. Presentar este recibo para cualquier reclamo. Devoluciones dentro de 7 días con empaque y accesorios completos.',
};

// Texto que el cliente acepta al firmar en cada momento
export const FIRMA = {
  aceptacion: { titulo: 'Recibido y aceptado (cliente)', leyenda: 'Recibí esta cotización y acepto sus precios y condiciones.' },
  entrega: { titulo: 'Recibí conforme (cliente)', leyenda: 'Recibí conforme los productos y servicios detallados, en buen estado, y acepto las condiciones de garantía.' },
  recepcion: { titulo: 'Entrega el equipo (cliente)', leyenda: 'Entrego el equipo descrito para revisión y acepto las condiciones de recepción.' },
  retiro: { titulo: 'Retira / recibe (cliente)', leyenda: 'Retiro el equipo o recibo el reembolso indicado, a mi entera satisfacción.' },
};

// Firma de TECNO INFO (emisor) según el documento
export const FIRMA_EMISOR = {
  COT: 'Emite',
  VTA: 'Entrega',
  CASO: 'Recibe el equipo',
  leyenda: 'Firmo este documento en nombre de TECNO INFO GT.',
};

export const METODOS_PAGO = [
  ['efectivo', 'Efectivo'], ['transferencia', 'Transferencia'], ['deposito', 'Depósito'],
  ['tarjeta', 'Tarjeta (POS)'], ['otro', 'Otro'],
];

export const ESTADOS_CASO = [
  ['recibido', 'Recibido'], ['en_revision', 'En revisión'], ['enviado_proveedor', 'Enviado a proveedor'],
  ['reparado', 'Reparado'], ['reemplazado', 'Reemplazado'], ['reembolsado', 'Reembolsado'],
  ['rechazado', 'Rechazado'], ['entregado', 'Entregado al cliente'],
];
