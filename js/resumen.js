// @ts-check

// Cuentas para la pantalla Hoy y el formulario. Funciones puras: reciben registros y devuelven
// datos; la pantalla sólo los dibuja.

/**
 * Los registros entre dos fechas (las dos incluidas), ordenados por fecha y, dentro del día, por
 * cómo se anotaron. Deja afuera los anulados: desde el 14/11/2026 borrar saca el registro, y los
 * anulados que hayan quedado de antes siguen guardados, pero no se muestran ni se copian.
 *
 * @param {import('./tipos.js').Registro[]} registros
 * @param {string} desde "aaaa-mm-dd"
 * @param {string} hasta "aaaa-mm-dd"
 * @returns {import('./tipos.js').Registro[]}
 */
export function registrosDelPeriodo(registros, desde, hasta) {
  return registros
    .filter((r) => !r.anulado && r.fecha >= desde && r.fecha <= hasta)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creado.localeCompare(b.creado));
}

/**
 * Los registros de un día, del más nuevo al más viejo (como se ven en la lista).
 *
 * @param {import('./tipos.js').Registro[]} registros
 * @param {string} dia "aaaa-mm-dd"
 * @returns {import('./tipos.js').Registro[]}
 */
export function registrosDelDia(registros, dia) {
  return registrosDelPeriodo(registros, dia, dia).reverse();
}

/**
 * Ingresos y egresos por moneda. Cuenta sólo los registros de plata (no las sesiones de
 * deporte) y no cuenta los anulados. No convierte dólares a pesos: eso lo hace el resumen del
 * historial con el tipo de cambio del mes.
 *
 * @param {import('./tipos.js').Registro[]} registros
 * @returns {{ARS: {ingresos: number, egresos: number}, USD: {ingresos: number, egresos: number}}}
 */
export function totales(registros) {
  const resultado = { ARS: { ingresos: 0, egresos: 0 }, USD: { ingresos: 0, egresos: 0 } };
  for (const { clase, anulado, datos } of registros) {
    if (clase !== 'finanza' || anulado) continue;
    const moneda = datos.moneda === 'USD' ? resultado.USD : resultado.ARS;
    if (datos.tipo === 'ingreso') moneda.ingresos += datos.monto ?? 0;
    else moneda.egresos += datos.monto ?? 0;
  }
  // Sumar decimales en binario deja restos (0.1 + 0.2 = 0.30000000000000004): se redondea a centavos.
  for (const moneda of [resultado.ARS, resultado.USD]) {
    moneda.ingresos = Math.round(moneda.ingresos * 100) / 100;
    moneda.egresos = Math.round(moneda.egresos * 100) / 100;
  }
  return resultado;
}

/**
 * El medio del último registro de plata anotado (sin contar anulados), para dejarlo elegido en
 * el formulario. Vacío si todavía no hay registros de plata.
 *
 * @param {import('./tipos.js').Registro[]} registros
 * @returns {string}
 */
export function ultimoMedio(registros) {
  let ultimo = null;
  for (const registro of registros) {
    if (registro.clase !== 'finanza' || registro.anulado) continue;
    if (!ultimo || registro.creado > ultimo.creado) ultimo = registro;
  }
  return ultimo ? ultimo.datos.medio : '';
}
