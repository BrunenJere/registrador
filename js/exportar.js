// @ts-check

import { resumenDeSesion, resumenDeSemana, filaSemanalS03 } from './deporte.js';
import { lunesDe, sumarDias } from './fechas.js';
import { registrosDelPeriodo } from './resumen.js';
import { horas, resumenDeTiempo, tiempoPorTema } from './tiempo.js';

// Arma el texto de "Copiar detalle": todo lo anotado en una semana o en un día, para pasárselo a
// Claude. Son funciones puras: reciben registros y devuelven texto; no tocan la pantalla ni el
// almacenamiento.
//
// Desde el 14/11/2026 se copia el período entero, sin marcar qué ya se había copiado (decisión
// del usuario): Claude lo compara con lo que está cargado en la bóveda.

const ENCABEZADO_CSV = 'fecha,tipo,categoria,detalle,monto,moneda,medio,proyecto';

/**
 * La fila del historial de un registro de plata, en el orden de las columnas.
 *
 * @param {import('./tipos.js').Registro} registro
 * @returns {string} por ejemplo "2026-11-01,egreso,comida,súper,3500,ARS,débito,"
 */
export function aFilaCSV(registro) {
  const { tipo, categoria, detalle, monto, moneda, medio, proyecto } = registro.datos;
  // String(3500.5) da "3500.5": sin separador de miles y con punto decimal, como pide el historial.
  return [registro.fecha, tipo, categoria, detalle, String(monto), moneda, medio, proyecto]
    .map(campoCSV)
    .join(',');
}

/**
 * Un campo de CSV. Si tiene una coma, comillas o un salto de línea, va entre comillas y las
 * comillas internas se duplican: pan, leche → "pan, leche" · dijo "hola" → "dijo ""hola""".
 * Si no, va tal cual.
 *
 * @param {string} valor
 * @returns {string}
 */
function campoCSV(valor) {
  if (/[",\r\n]/.test(valor)) {
    return `"${valor.replaceAll('"', '""')}"`;
  }
  return valor;
}

/**
 * La línea de un registro según su clase:
 * - plata: la fila CSV del historial;
 * - deporte: "2026-11-02 · correr · 3,2 km · 32 min · 10:00 min/km";
 * - tiempo: "2026-11-14 · 90 min · GCI".
 *
 * @param {import('./tipos.js').Registro} registro
 * @returns {string}
 */
export function lineaDeRegistro(registro) {
  if (registro.clase === 'ejercicio') return `${registro.fecha} · ${resumenDeSesion(registro.datos)}`;
  if (registro.clase === 'tiempo') return `${registro.fecha} · ${resumenDeTiempo(registro.datos)}`;
  return aFilaCSV(registro);
}

/**
 * El texto de "Copiar detalle" para un período: la plata como filas del historial, el deporte
 * en una línea por sesión y, si el período es una semana entera (de lunes a domingo) con
 * deporte, la fila de Métricas de S03. Las secciones vacías no aparecen.
 *
 * @param {import('./tipos.js').Registro[]} registros todos los guardados
 * @param {string} desde "aaaa-mm-dd"
 * @param {string} hasta "aaaa-mm-dd" (igual a desde para un día)
 * @param {string} momento cuándo se copia, como lo da momentoLocal()
 * @returns {string}
 */
export function textoDeDetalle(registros, desde, hasta, momento) {
  const delPeriodo = registrosDelPeriodo(registros, desde, hasta);
  const plata = delPeriodo.filter((r) => r.clase === 'finanza');
  const deporte = delPeriodo.filter((r) => r.clase === 'ejercicio');
  const esSemana = desde === lunesDe(desde) && hasta === sumarDias(desde, 6);

  const periodo =
    desde === hasta ? `día ${fechaLegible(desde)}` : `semana del ${fechaLegible(desde)} al ${fechaLegible(hasta)}`;
  const lineas = [`REGISTRADOR · ${periodo} · copiado el ${fechaHoraLegible(momento)}`];

  if (plata.length > 0) {
    lineas.push('', '## Plata (filas para el historial)', ENCABEZADO_CSV, ...plata.map(aFilaCSV));
  }
  if (deporte.length > 0) {
    lineas.push('', '## Deporte', ...deporte.map(lineaDeRegistro));
    if (esSemana) {
      lineas.push('', '## Métricas de S03', filaSemanalS03(resumenDeSemana(registros, desde), desde));
    }
  }
  const tiempo = delPeriodo.filter((r) => r.clase === 'tiempo');
  if (tiempo.length > 0) {
    lineas.push('', '## Tiempo', ...tiempo.map(lineaDeRegistro));
    if (esSemana) {
      lineas.push('', '## Horas por tema en la semana', ...tiempoPorTema(tiempo).map((t) => `- ${t.que}: ${horas(t.minutos)}`));
    }
  }
  if (delPeriodo.length === 0) {
    lineas.push('', 'No hay registros en este período.');
  }

  return lineas.join('\n');
}

/** "2026-11-09" → "09/11/2026", el formato de fechas de la bóveda. */
function fechaLegible(/** @type {string} */ fecha) {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

/**
 * "2026-11-01T22:10:05-03:00" → "01/11/2026 22:10".
 *
 * @param {string} momento
 * @returns {string}
 */
function fechaHoraLegible(momento) {
  return `${fechaLegible(momento.slice(0, 10))} ${momento.slice(11, 16)}`;
}
