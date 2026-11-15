// @ts-check

import { normalizar } from './textos.js';

// Cuentas de los guardados (§15, pasos 3 y 4). Funciones puras: el almacén los guarda; acá se
// eligen y se ordenan para el menú.

/**
 * Los guardados de una clase, ordenados por nombre, para el menú "Guardados".
 *
 * @param {import('./tipos.js').Guardado[]} guardados
 * @param {string} clase "ejercicio" o "comida"
 * @returns {import('./tipos.js').Guardado[]}
 */
export function guardadosDe(guardados, clase) {
  return guardados.filter((g) => g.clase === clase).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/**
 * El guardado de una clase con ese nombre (sin importar mayúsculas ni tildes), o null. Lo usa
 * app.js para preguntar antes de reemplazar uno.
 *
 * @param {import('./tipos.js').Guardado[]} guardados
 * @param {string} clase
 * @param {string} nombre
 * @returns {import('./tipos.js').Guardado | null}
 */
export function buscarGuardado(guardados, clase, nombre) {
  return guardados.find((g) => g.clase === clase && normalizar(g.nombre) === normalizar(nombre)) ?? null;
}
