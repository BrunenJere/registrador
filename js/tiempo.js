// @ts-check

import { normalizar } from './textos.js';

// Cuentas de tiempo (§15, paso 2). Funciones puras. Un registro de tiempo dice cuántos minutos
// y en qué fueron ("90 min · GCI"); sumados por tema dan las horas reales para el indicador de
// las 168 h.

/**
 * La sesión de tiempo en una línea: "90 min · GCI".
 *
 * @param {{minutos: number | null, que: string}} datos
 * @returns {string}
 */
export function resumenDeTiempo(datos) {
  return `${datos.minutos} min · ${datos.que}`;
}

/**
 * Los minutos sumados por tema, de mayor a menor. "GCI" y "gci" cuentan juntos (se comparan con
 * normalizar) y se muestran como se escribieron la primera vez. Sin anulados.
 *
 * @param {import('./tipos.js').Registro[]} registros
 * @returns {{que: string, minutos: number}[]}
 */
export function tiempoPorTema(registros) {
  /** @type {Map<string, {que: string, minutos: number}>} */
  const porTema = new Map();
  for (const r of registros) {
    if (r.clase !== 'tiempo' || r.anulado) continue;
    const clave = normalizar(r.datos.que);
    const tema = porTema.get(clave) ?? { que: r.datos.que.trim(), minutos: 0 };
    tema.minutos += r.datos.minutos ?? 0;
    porTema.set(clave, tema);
  }
  return [...porTema.values()].sort((a, b) => b.minutos - a.minutos || a.que.localeCompare(b.que, 'es'));
}

/**
 * Los temas ya escritos, sin repetir y en orden alfabético, para sugerirlos al escribir.
 *
 * @param {import('./tipos.js').Registro[]} registros
 * @returns {string[]}
 */
export function temasDeTiempo(registros) {
  return tiempoPorTema(registros)
    .map((t) => t.que)
    .sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * Minutos a horas con coma: 90 → "1,5 h".
 *
 * @param {number} minutos
 * @returns {string}
 */
export function horas(minutos) {
  return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(minutos / 60)} h`;
}
