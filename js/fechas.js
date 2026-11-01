// @ts-check

// Fechas siempre con la hora LOCAL del celular.
//
// El error clásico que se evita acá: new Date().toISOString() devuelve la fecha y la hora en
// UTC (la hora de Greenwich). Argentina está 3 horas atrás (UTC−3), así que todo lo anotado
// después de las 21:00 quedaría con la fecha del día siguiente. Por eso las fechas se arman a
// mano con getFullYear, getMonth y getDate, que devuelven los valores locales.

/**
 * Completa con un cero a la izquierda: 5 → "05", 12 → "12".
 *
 * @param {number} n
 * @returns {string}
 */
function dosDigitos(n) {
  return String(n).padStart(2, '0');
}

/**
 * La fecha local de hoy (o de `ahora`), en el formato del historial.
 *
 * @param {Date} [ahora] el momento a convertir; si no se pasa, el momento actual
 * @returns {string} por ejemplo "2026-11-01"
 */
export function hoyLocal(ahora = new Date()) {
  const anio = ahora.getFullYear();
  const mes = dosDigitos(ahora.getMonth() + 1); // getMonth cuenta desde 0: enero es 0
  const dia = dosDigitos(ahora.getDate());
  return `${anio}-${mes}-${dia}`;
}

/**
 * El momento local con su zona horaria, para los campos `creado` y `actualizado`.
 *
 * @param {Date} [ahora] el momento a convertir; si no se pasa, el momento actual
 * @returns {string} por ejemplo "2026-11-01T21:40:05-03:00"
 */
export function momentoLocal(ahora = new Date()) {
  const hora = dosDigitos(ahora.getHours());
  const minutos = dosDigitos(ahora.getMinutes());
  const segundos = dosDigitos(ahora.getSeconds());

  // getTimezoneOffset devuelve cuántos minutos hay que SUMARLE a la hora local para llegar a
  // UTC. En Argentina da 180 (3 horas), por eso el signo se invierte: 180 → "-03:00".
  const diferencia = ahora.getTimezoneOffset();
  const signo = diferencia > 0 ? '-' : '+';
  const horasZona = dosDigitos(Math.floor(Math.abs(diferencia) / 60));
  const minutosZona = dosDigitos(Math.abs(diferencia) % 60);

  return `${hoyLocal(ahora)}T${hora}:${minutos}:${segundos}${signo}${horasZona}:${minutosZona}`;
}

/**
 * Verdadero si el texto tiene la forma aaaa-mm-dd y ese día existe en el calendario.
 *
 * @param {string} texto por ejemplo "2026-11-01"
 * @returns {boolean}
 */
export function esFechaValida(texto) {
  // 1. La forma: 4 dígitos, guion, 2 dígitos, guion, 2 dígitos.
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto));
  if (!partes) {
    return false;
  }
  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);

  // 2. Que el día exista. JavaScript no rechaza fechas imposibles: las "corre". El 30 de
  //    febrero lo convierte en el 2 de marzo. Entonces se arma la fecha y se revisa que siga
  //    siendo el mismo año, mes y día. Se usa UTC para que ningún cambio de horario de verano
  //    mueva el día.
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

/**
 * El mes de una fecha, para saber a qué archivo del historial va
 * (`Ingresos y egresos aaaa-mm`). Supone una fecha válida.
 *
 * @param {string} fecha por ejemplo "2026-11-01"
 * @returns {string} por ejemplo "2026-11"
 */
export function mesDe(fecha) {
  return fecha.slice(0, 7);
}
