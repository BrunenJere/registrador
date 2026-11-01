// @ts-check

import { resumenDeSesion, lunesDe, resumenDeSemana, filaSemanalS03 } from './deporte.js';

// Arma lo que se le pasa a Claude en el cierre del día. Son funciones puras: reciben
// registros y devuelven texto o listas; no tocan la pantalla ni el almacenamiento.
//
// La idea central es el campo `exportado_como`: guarda la línea que HOY está cargada en la
// bóveda para ese registro (null si no hay ninguna). Comparándola con la línea que debería
// estar, se sabe qué falta pasar:
//
//   debería estar   está en la bóveda   →  qué es
//   una línea       nada (null)         →  nuevo
//   una línea       otra línea          →  corregido
//   nada (anulado)  una línea           →  anulado
//   lo mismo        lo mismo            →  nada pendiente
//
// La línea depende de la clase: una fila CSV del historial para la plata, y una línea de texto
// para cada sesión de deporte. Todo lo demás (pendientes, estados) es igual para las dos.

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
 * - deporte: "2026-11-02 · correr · 3,2 km · 32 min · 10:00 min/km".
 *
 * @param {import('./tipos.js').Registro} registro
 * @returns {string}
 */
export function lineaDeRegistro(registro) {
  if (registro.clase === 'ejercicio') {
    return `${registro.fecha} · ${resumenDeSesion(registro.datos)}`;
  }
  return aFilaCSV(registro);
}

/**
 * La línea que debería estar en la bóveda: ninguna si el registro está anulado.
 *
 * @param {import('./tipos.js').Registro} registro
 * @returns {string | null}
 */
export function filaEsperada(registro) {
  return registro.anulado ? null : lineaDeRegistro(registro);
}

/**
 * En qué estado está un registro respecto de la bóveda, para mostrarlo en la lista.
 *
 * @param {import('./tipos.js').Registro} registro
 * @returns {'nuevo' | 'exportado' | 'corregido' | 'anulado'}
 */
export function estadoDeExportacion(registro) {
  if (registro.anulado) return 'anulado';
  if (registro.exportado_como === null) return 'nuevo';
  return registro.exportado_como === lineaDeRegistro(registro) ? 'exportado' : 'corregido';
}

/**
 * Separa lo que falta pasar a la bóveda, ordenado por fecha y, dentro del día, por cómo se
 * anotó.
 *
 * @param {import('./tipos.js').Registro[]} registros
 * @returns {{nuevos: import('./tipos.js').Registro[], corregidos: import('./tipos.js').Registro[], anulados: import('./tipos.js').Registro[]}}
 */
export function pendientes(registros) {
  const ordenados = [...registros].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.creado.localeCompare(b.creado),
  );

  /** @type {ReturnType<typeof pendientes>} */
  const resultado = { nuevos: [], corregidos: [], anulados: [] };

  for (const registro of ordenados) {
    const esperada = filaEsperada(registro);
    const cargada = registro.exportado_como;

    if (esperada === cargada) continue; // la bóveda ya está al día con este registro
    if (cargada === null) resultado.nuevos.push(registro);
    else if (esperada === null) resultado.anulados.push(registro);
    else resultado.corregidos.push(registro);
  }

  return resultado;
}

/**
 * El texto que se copia para Claude: primero la plata, después el deporte y, si hubo cambios
 * de deporte, la fila de Métricas de S03 de cada semana tocada (calculada con TODOS los
 * registros de esa semana, no sólo con los pendientes).
 *
 * @param {ReturnType<typeof pendientes>} pend lo que devuelve pendientes()
 * @param {string} momento cuándo se exporta, como lo da momentoLocal()
 * @param {import('./tipos.js').Registro[]} [registros] todos los registros, para la fila semanal
 * @returns {string}
 */
export function textoParaClaude(pend, momento, registros = []) {
  const { nuevos, corregidos, anulados } = pend;
  const lineas = [
    `REGISTRADOR · exportado el ${fechaHoraLegible(momento)}`,
    `Nuevos: ${nuevos.length} · Corregidos: ${corregidos.length} · Anulados: ${anulados.length}`,
  ];

  /** @param {import('./tipos.js').Registro[]} lista */
  const deClase = (lista, clase) => lista.filter((r) => (r.clase ?? 'finanza') === clase);

  // ---- Plata ----
  const plata = { nuevos: deClase(nuevos, 'finanza'), corregidos: deClase(corregidos, 'finanza'), anulados: deClase(anulados, 'finanza') };

  if (plata.nuevos.length > 0) {
    lineas.push('', '## Filas nuevas para el historial', ENCABEZADO_CSV);
    for (const registro of plata.nuevos) lineas.push(aFilaCSV(registro));
  }
  if (plata.corregidos.length > 0) {
    lineas.push('', '## Correcciones de filas ya cargadas');
    for (const registro of plata.corregidos) {
      lineas.push(`antes: ${registro.exportado_como}`, `ahora: ${aFilaCSV(registro)}`);
    }
  }
  if (plata.anulados.length > 0) {
    lineas.push('', '## Filas anuladas (sacarlas del historial)');
    for (const registro of plata.anulados) lineas.push(`${registro.exportado_como}`);
  }

  // ---- Deporte ----
  const deporte = { nuevos: deClase(nuevos, 'ejercicio'), corregidos: deClase(corregidos, 'ejercicio'), anulados: deClase(anulados, 'ejercicio') };

  if (deporte.nuevos.length > 0) {
    lineas.push('', '## Deporte: sesiones nuevas');
    for (const registro of deporte.nuevos) lineas.push(lineaDeRegistro(registro));
  }
  if (deporte.corregidos.length > 0) {
    lineas.push('', '## Deporte: sesiones corregidas');
    for (const registro of deporte.corregidos) {
      lineas.push(`antes: ${registro.exportado_como}`, `ahora: ${lineaDeRegistro(registro)}`);
    }
  }
  if (deporte.anulados.length > 0) {
    lineas.push('', '## Deporte: sesiones anuladas');
    for (const registro of deporte.anulados) lineas.push(`${registro.exportado_como}`);
  }

  // La fila de cada semana donde hubo algún cambio de deporte, en orden.
  const tocadas = [...deporte.nuevos, ...deporte.corregidos, ...deporte.anulados];
  if (tocadas.length > 0) {
    const lunes = [...new Set(tocadas.map((r) => lunesDe(r.fecha)))].sort();
    lineas.push('', '## Métricas de S03 (reemplazar la fila de estas semanas)');
    for (const l of lunes) lineas.push(filaSemanalS03(resumenDeSemana(registros, l), l));
  }

  if (nuevos.length + corregidos.length + anulados.length === 0) {
    lineas.push('', 'No hay nada pendiente.');
  }

  return lineas.join('\n');
}

/**
 * "2026-11-01T22:10:05-03:00" → "01/11/2026 22:10", el formato de fechas de la bóveda.
 *
 * @param {string} momento
 * @returns {string}
 */
function fechaHoraLegible(momento) {
  const [anio, mes, dia] = momento.slice(0, 10).split('-');
  const horaMinutos = momento.slice(11, 16);
  return `${dia}/${mes}/${anio} ${horaMinutos}`;
}
