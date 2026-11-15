// @ts-check

import { momentoLocal } from './fechas.js';

// El respaldo es un archivo JSON con todos los registros, los guardados y la tabla de alimentos.
// Protege contra lo que localStorage no protege: que se borren los datos del navegador, que se
// pierda o se cambie el celular.
//
// Versión 2 (14/11/2026): suma los guardados y la tabla de alimentos. Un respaldo de la versión 1
// (sólo registros) se sigue pudiendo importar.
//
// Casi todo acá es puro (recibe datos, devuelve datos) y tiene pruebas. Lo único que necesita
// el navegador es descargarRespaldo, que hace la descarga.

const APP = 'registrador';
const VERSION = 2;

/**
 * @typedef {object} Extras lo que va en el respaldo además de los registros
 * @property {import('./tipos.js').Guardado[]} [guardados]
 * @property {import('./tipos.js').Alimento[]} [alimentos]
 */

/**
 * El contenido del archivo de respaldo.
 *
 * @param {import('./tipos.js').Registro[]} registros
 * @param {string} momento cuándo se hace, como lo da momentoLocal()
 * @param {Extras} [extras]
 * @returns {string} el JSON, con sangría para que se pueda leer si se abre el archivo
 */
export function armarRespaldo(registros, momento, { guardados = [], alimentos = [] } = {}) {
  return JSON.stringify({ app: APP, version: VERSION, fecha: momento, registros, guardados, alimentos }, null, 2);
}

/**
 * @param {string} momento como lo da momentoLocal()
 * @returns {string} por ejemplo "registrador-respaldo-2026-11-01.json"
 */
export function nombreDelRespaldo(momento) {
  return `registrador-respaldo-${momento.slice(0, 10)}.json`;
}

/**
 * Lee el texto de un archivo de respaldo y devuelve lo que trae. Si no es un respaldo del
 * registrador, o le falta algo, lanza un error y no se importa nada. Un respaldo de la versión 1
 * trae sólo registros: los guardados vienen vacíos y los alimentos, null (no trae tabla).
 *
 * @param {string} texto
 * @returns {{registros: import('./tipos.js').Registro[], guardados: import('./tipos.js').Guardado[], alimentos: import('./tipos.js').Alimento[] | null}}
 */
export function leerRespaldo(texto) {
  let respaldo;
  try {
    respaldo = JSON.parse(texto);
  } catch {
    respaldo = null;
  }
  if (!respaldo || respaldo.app !== APP || !Array.isArray(respaldo.registros)) {
    throw new Error('Ese archivo no es un respaldo del registrador. No se importó nada.');
  }
  if (respaldo.version > VERSION) {
    throw new Error(
      'El respaldo es de una versión más nueva de la app. Actualizá la app y volvé a probar.',
    );
  }
  // Lo mínimo para poder unirlo sin romper nada: id, fecha de edición y datos.
  const incompleto = respaldo.registros.some(
    (/** @type {any} */ r) =>
      typeof r?.id !== 'string' ||
      typeof r.actualizado !== 'string' ||
      typeof r.datos !== 'object' ||
      r.datos === null,
  );
  if (incompleto) {
    throw new Error('El respaldo tiene registros incompletos. No se importó nada.');
  }

  const guardados = respaldo.guardados ?? [];
  const alimentos = respaldo.alimentos ?? null;
  const guardadosMal =
    !Array.isArray(guardados) ||
    guardados.some(
      (/** @type {any} */ g) =>
        typeof g?.id !== 'string' || typeof g.nombre !== 'string' || typeof g.clase !== 'string' || typeof g.datos !== 'object',
    );
  const alimentosMal =
    alimentos !== null &&
    (!Array.isArray(alimentos) || alimentos.some((/** @type {any} */ a) => typeof a?.alimento !== 'string'));
  if (guardadosMal || alimentosMal) {
    throw new Error('El respaldo tiene guardados o alimentos incompletos. No se importó nada.');
  }
  return { registros: respaldo.registros, guardados, alimentos };
}

/**
 * Une los guardados actuales con los de un respaldo, por id: agrega los que faltan y deja los
 * que ya están como están. No cambia las listas que recibe.
 *
 * @param {import('./tipos.js').Guardado[]} actuales
 * @param {import('./tipos.js').Guardado[]} delRespaldo
 * @returns {{guardados: import('./tipos.js').Guardado[], agregados: number}}
 */
export function unirGuardados(actuales, delRespaldo) {
  const ids = new Set(actuales.map((g) => g.id));
  const nuevos = delRespaldo.filter((g) => !ids.has(g.id));
  return { guardados: [...actuales, ...nuevos], agregados: nuevos.length };
}

/**
 * Une los registros actuales con los de un respaldo, por id. Nunca duplica:
 * - si el registro no está, se agrega;
 * - si está, se queda la versión editada más recientemente (`actualizado`); si empatan, la actual.
 * No cambia las listas que recibe: devuelve una nueva.
 *
 * @param {import('./tipos.js').Registro[]} actuales
 * @param {import('./tipos.js').Registro[]} delRespaldo
 * @returns {{registros: import('./tipos.js').Registro[], agregados: number, actualizados: number, sin_cambios: number}}
 */
export function unirRegistros(actuales, delRespaldo) {
  // Un Map es una tabla clave → valor: acá, id → registro. Buscar por id es directo.
  const porId = new Map(actuales.map((r) => [r.id, r]));
  let agregados = 0;
  let actualizados = 0;
  let sin_cambios = 0;

  for (const registro of delRespaldo) {
    const actual = porId.get(registro.id);
    if (!actual) {
      porId.set(registro.id, registro);
      agregados++;
    } else if (Date.parse(registro.actualizado) > Date.parse(actual.actualizado)) {
      // Date.parse convierte el texto en milisegundos: compara momentos, no letras.
      porId.set(registro.id, registro);
      actualizados++;
    } else {
      sin_cambios++;
    }
  }

  return { registros: [...porId.values()], agregados, actualizados, sin_cambios };
}

/**
 * Lee un archivo de respaldo elegido por el usuario, lo une con lo guardado y guarda:
 * - los registros, con unirRegistros;
 * - los guardados, con unirGuardados;
 * - la tabla de alimentos, sólo si ahora no hay ninguna (la que está cargada es la más nueva).
 *
 * @param {Blob} archivo el archivo elegido (File es un tipo de Blob)
 * @param {ReturnType<typeof import('./almacen.js').crearAlmacen>} almacen
 * @returns {Promise<{agregados: number, actualizados: number, sin_cambios: number, guardados: number, tabla: boolean}>}
 */
export async function importarRespaldo(archivo, almacen) {
  const respaldo = leerRespaldo(await archivo.text());
  const { registros, agregados, actualizados, sin_cambios } = unirRegistros(almacen.leerTodos(), respaldo.registros);
  const unidos = unirGuardados(almacen.leerGuardados(), respaldo.guardados);
  const alimentos = respaldo.alimentos ?? [];
  const tabla = alimentos.length > 0 && almacen.leerAlimentos().length === 0;

  almacen.guardarTodos(registros);
  almacen.guardarGuardados(unidos.guardados);
  if (tabla) almacen.guardarAlimentos(alimentos);
  return { agregados, actualizados, sin_cambios, guardados: unidos.agregados, tabla };
}

/**
 * Verdadero si toca recordar el respaldo: nunca se hizo, o pasaron 7 días o más.
 *
 * @param {string | null} ultimo momento del último respaldo, o null
 * @param {string} hoy fecha de hoy, "aaaa-mm-dd"
 * @returns {boolean}
 */
export function tocaRespaldo(ultimo, hoy) {
  if (ultimo === null) {
    return true;
  }
  const MS_POR_DIA = 24 * 60 * 60 * 1000;
  const dias = (Date.parse(hoy) - Date.parse(ultimo.slice(0, 10))) / MS_POR_DIA;
  return dias >= 7;
}

/**
 * Descarga el archivo de respaldo en el celular. Sólo funciona en el navegador.
 *
 * Cómo: arma un Blob (un archivo en memoria) con el JSON, le pide al navegador una dirección
 * temporal para ese Blob, crea un enlace con el atributo `download` y lo "toca". Después libera
 * la dirección temporal.
 *
 * @param {import('./tipos.js').Registro[]} registros
 * @param {Extras} [extras] los guardados y la tabla de alimentos
 * @param {string} [momento] por defecto, ahora
 */
export function descargarRespaldo(registros, extras = {}, momento = momentoLocal()) {
  const blob = new Blob([armarRespaldo(registros, momento, extras)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreDelRespaldo(momento);
  enlace.click();
  // Se libera en el próximo ciclo, para no cortar la descarga que acaba de empezar.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
