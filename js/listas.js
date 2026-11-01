// @ts-check

// Valores permitidos de una finanza. Son los mismos que usa el historial de la bóveda
// (columnas fecha,tipo,categoria,detalle,monto,moneda,medio,proyecto): si allá cambia una
// categoría, se cambia acá. La validación y los botones del formulario leen de este archivo,
// así que nunca pueden usar listas distintas.
//
// Object.freeze impide que otra parte del código modifique una lista por error.

export const TIPOS = Object.freeze(['egreso', 'ingreso']);

export const CATEGORIAS_INGRESO = Object.freeze([
  'sueldo',
  'clientes',
  'becas',
  'familia',
  'otros',
]);

export const CATEGORIAS_EGRESO = Object.freeze([
  'comida',
  'casa',
  'thiago',
  'cuotas y deudas',
  'personal',
  'salud',
  'trabajo',
  'otros',
]);

export const MEDIOS = Object.freeze([
  'efectivo',
  'débito',
  'crédito',
  'transferencia',
  'mercado pago',
]);

export const MONEDAS = Object.freeze(['ARS', 'USD']);

// Actividades de una sesión de deporte. "otro" es todo lo que no es correr ni fuerza
// (caminar, bici, la limpieza del fondo).
export const ACTIVIDADES = Object.freeze(['correr', 'fuerza', 'otro']);
