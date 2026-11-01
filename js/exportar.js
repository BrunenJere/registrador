// @ts-check

// Arma lo que se le pasa a Claude en el cierre del día. Son funciones puras: reciben
// registros y devuelven texto o listas; no tocan la pantalla ni el almacenamiento.
//
// La idea central es el campo `exportado_como`: guarda la fila que HOY está cargada en la
// bóveda para ese registro (null si no hay ninguna). Comparándola con la fila que debería
// estar, se sabe qué falta pasar:
//
//   debería estar   está en la bóveda   →  qué es
//   una fila        nada (null)         →  nuevo
//   una fila        otra fila           →  corregido
//   nada (anulado)  una fila            →  anulado
//   lo mismo        lo mismo            →  nada pendiente

const ENCABEZADO_CSV = 'fecha,tipo,categoria,detalle,monto,moneda,medio,proyecto';

/**
 * La fila del historial de un registro, en el orden de las columnas.
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
 * La fila que debería estar en la bóveda: ninguna si el registro está anulado.
 *
 * @param {import('./tipos.js').Registro} registro
 * @returns {string | null}
 */
export function filaEsperada(registro) {
  return registro.anulado ? null : aFilaCSV(registro);
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
 * El texto que se copia para Claude.
 *
 * @param {ReturnType<typeof pendientes>} pend lo que devuelve pendientes()
 * @param {string} momento cuándo se exporta, como lo da momentoLocal()
 * @returns {string}
 */
export function textoParaClaude(pend, momento) {
  const { nuevos, corregidos, anulados } = pend;
  const lineas = [
    `REGISTRADOR · exportado el ${fechaHoraLegible(momento)}`,
    `Nuevos: ${nuevos.length} · Corregidos: ${corregidos.length} · Anulados: ${anulados.length}`,
  ];

  if (nuevos.length > 0) {
    lineas.push('', '## Filas nuevas para el historial', ENCABEZADO_CSV);
    for (const registro of nuevos) lineas.push(aFilaCSV(registro));
  }

  if (corregidos.length > 0) {
    lineas.push('', '## Correcciones de filas ya cargadas');
    for (const registro of corregidos) {
      lineas.push(`antes: ${registro.exportado_como}`, `ahora: ${aFilaCSV(registro)}`);
    }
  }

  if (anulados.length > 0) {
    lineas.push('', '## Filas anuladas (sacarlas del historial)');
    for (const registro of anulados) lineas.push(`${registro.exportado_como}`);
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
