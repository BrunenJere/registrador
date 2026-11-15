// @ts-check

import { normalizar } from './textos.js';

// Cuentas de comidas (§15, paso 4). Funciones puras. Una comida tiene un momento (desayuno,
// almuerzo…) y una lista de items: cada uno con su alimento, cuántas porciones y, si se conocen,
// las kcal y los macros (ya multiplicados por las porciones).

const NUMERO = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

/**
 * @typedef {object} ItemDeComida
 * @property {string} alimento
 * @property {number | null} porciones
 * @property {number | null} kcal
 * @property {number | null} proteinas
 * @property {number | null} carbohidratos
 * @property {number | null} grasas
 */

/**
 * @typedef {object} Totales
 * @property {number} kcal
 * @property {number} proteinas
 * @property {number} carbohidratos
 * @property {number} grasas
 * @property {number} sinValores cuántos items no tienen kcal (no se pueden sumar)
 */

/**
 * Suma las kcal y los macros que se conocen. Los items sin kcal se cuentan aparte, para no
 * mostrar un total que parezca completo cuando no lo es.
 *
 * @param {ItemDeComida[]} items
 * @returns {Totales}
 */
export function totalesDeComida(items) {
  const t = { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0, sinValores: 0 };
  for (const item of items) {
    if (item.kcal === null || item.kcal === undefined) t.sinValores++;
    t.kcal += item.kcal ?? 0;
    t.proteinas += item.proteinas ?? 0;
    t.carbohidratos += item.carbohidratos ?? 0;
    t.grasas += item.grasas ?? 0;
  }
  // A un decimal: sumar decimales en binario deja restos (0.1 + 0.2 = 0.30000000000000004).
  for (const clave of /** @type {const} */ (['kcal', 'proteinas', 'carbohidratos', 'grasas'])) {
    t[clave] = Math.round(t[clave] * 10) / 10;
  }
  return t;
}

/**
 * Los totales de varias comidas (por ejemplo, las de un día). Sin anulados ni otras clases.
 *
 * @param {import('./tipos.js').Registro[]} registros
 * @returns {Totales}
 */
export function totalesDeComidas(registros) {
  const items = registros.filter((r) => r.clase === 'comida' && !r.anulado).flatMap((r) => r.datos.items);
  return totalesDeComida(items);
}

/**
 * La comida en una línea: "almuerzo · milanesa x1, ensalada x0,5 · 850 kcal". Las kcal van sólo
 * si se conoce alguna; si a algún item le faltan, se aclara.
 *
 * @param {{momento: string, items: ItemDeComida[], detalle?: string}} datos
 * @returns {string}
 */
export function resumenDeComida(datos) {
  const partes = [datos.momento, datos.items.map((i) => `${i.alimento} x${NUMERO.format(i.porciones ?? 0)}`).join(', ')];
  const t = totalesDeComida(datos.items);
  if (t.sinValores < datos.items.length) {
    partes.push(`${NUMERO.format(t.kcal)} kcal${t.sinValores > 0 ? ` (${t.sinValores} sin datos)` : ''}`);
  }
  if (datos.detalle) partes.push(datos.detalle);
  return partes.join(' · ');
}

/**
 * Los alimentos anotados alguna vez, sin repetir y en orden alfabético, para sugerirlos.
 *
 * @param {import('./tipos.js').Registro[]} registros
 * @returns {string[]}
 */
export function alimentosAnotados(registros) {
  /** @type {Map<string, string>} */
  const porClave = new Map();
  for (const r of registros) {
    if (r.clase !== 'comida' || r.anulado) continue;
    for (const item of r.datos.items) {
      const clave = normalizar(item.alimento);
      if (!porClave.has(clave)) porClave.set(clave, item.alimento.trim());
    }
  }
  return [...porClave.values()].sort((a, b) => a.localeCompare(b, 'es'));
}
