// @ts-check

import { TIPOS, CATEGORIAS_INGRESO, CATEGORIAS_EGRESO, MEDIOS, MONEDAS, ACTIVIDADES } from './listas.js';
import { hoyLocal, esFechaValida } from './fechas.js';

// Un ID de proyecto de la bóveda: una letra mayúscula y dos dígitos (P05, C01, S03).
const FORMATO_PROYECTO = /^[A-Z]\d{2}$/;

/**
 * Revisa un ingreso o egreso antes de guardarlo. No cambia nada: sólo informa.
 *
 * @param {Pick<import('./tipos.js').Registro, 'fecha' | 'datos'>} registro
 *   alcanza con la fecha y los datos (así sirve también para un registro que todavía no se guardó)
 * @param {string} [hoy] la fecha de hoy; si no se pasa, la del celular (las pruebas pasan una fija)
 * @returns {import('./tipos.js').ErrorDeValidacion[]} vacía si se puede guardar
 */
export function validarFinanza(registro, hoy = hoyLocal()) {
  /** @type {import('./tipos.js').ErrorDeValidacion[]} */
  const errores = [];
  const { fecha, datos } = registro;

  // Fecha: que exista y que no sea futura (se anota el día que se mueve la plata).
  // Las fechas aaaa-mm-dd se pueden comparar como texto: "2026-11-02" > "2026-11-01".
  if (!esFechaValida(fecha)) {
    errores.push({ campo: 'fecha', mensaje: 'La fecha no es válida.' });
  } else if (fecha > hoy) {
    errores.push({
      campo: 'fecha',
      mensaje: 'La fecha no puede ser futura: se anota el día que se mueve la plata.',
    });
  }

  // Tipo y categoría. La categoría se revisa sólo si el tipo es válido, porque de él depende
  // qué lista corresponde (no hay "sueldo" en un egreso).
  if (!TIPOS.includes(datos.tipo)) {
    errores.push({ campo: 'tipo', mensaje: 'El tipo tiene que ser ingreso o egreso.' });
  } else {
    const categorias = datos.tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;
    if (!datos.categoria) {
      errores.push({ campo: 'categoria', mensaje: 'Elegí una categoría.' });
    } else if (!categorias.includes(datos.categoria)) {
      errores.push({
        campo: 'categoria',
        mensaje: `«${datos.categoria}» no es una categoría de ${datos.tipo}.`,
      });
    }
  }

  // Detalle: que no esté vacío (trim saca los espacios de los bordes, así "   " cuenta como vacío).
  if (typeof datos.detalle !== 'string' || datos.detalle.trim() === '') {
    errores.push({ campo: 'detalle', mensaje: 'Escribí un detalle.' });
  }

  // Monto.
  if (typeof datos.monto !== 'number' || !Number.isFinite(datos.monto)) {
    // Llega null cuando leerMonto no pudo leer lo que se escribió.
    errores.push({
      campo: 'monto',
      mensaje: 'El monto no es válido. Usá punto para los miles y coma para los decimales (3.500 o 3,5).',
    });
  } else if (datos.monto <= 0) {
    errores.push({ campo: 'monto', mensaje: 'El monto tiene que ser mayor que 0.' });
  } else if (!tieneHastaDosDecimales(datos.monto)) {
    errores.push({ campo: 'monto', mensaje: 'El monto puede tener 2 decimales como mucho.' });
  }

  // Moneda y medio: que estén en su lista.
  if (!MONEDAS.includes(datos.moneda)) {
    errores.push({ campo: 'moneda', mensaje: 'La moneda tiene que ser ARS o USD.' });
  }
  if (!datos.medio) {
    errores.push({ campo: 'medio', mensaje: 'Elegí un medio de pago.' });
  } else if (!MEDIOS.includes(datos.medio)) {
    errores.push({ campo: 'medio', mensaje: `«${datos.medio}» no es un medio de pago válido.` });
  }

  // Proyecto: opcional; si está, con forma de ID.
  if (datos.proyecto && !FORMATO_PROYECTO.test(datos.proyecto)) {
    errores.push({
      campo: 'proyecto',
      mensaje: 'El proyecto tiene que ser un ID como P05, o quedar vacío.',
    });
  }

  return errores;
}

/**
 * Verdadero si el número tiene 2 decimales como mucho.
 *
 * La cuenta obvia (monto * 100 da un entero) falla con algunos números por cómo la
 * computadora guarda los decimales: 0.29 * 100 da 28.999999999999996. Por eso se mira si
 * monto * 100 está "lo bastante cerca" de un entero, con una tolerancia mínima.
 *
 * @param {number} monto
 * @returns {boolean}
 */
function tieneHastaDosDecimales(monto) {
  const porCien = monto * 100;
  return Math.abs(porCien - Math.round(porCien)) < 1e-6;
}

/**
 * Revisa una sesión de deporte antes de guardarla (§13 de la especificación). No cambia nada:
 * sólo informa. Los errores de un ejercicio de fuerza llevan el campo "ejercicio-N" (N desde 0)
 * para mostrarlos al lado de ese ejercicio.
 *
 * @param {Pick<import('./tipos.js').Registro, 'fecha' | 'datos'>} registro
 * @param {string} [hoy] la fecha de hoy; si no se pasa, la del celular (las pruebas pasan una fija)
 * @returns {import('./tipos.js').ErrorDeValidacion[]} vacía si se puede guardar
 */
export function validarEjercicio(registro, hoy = hoyLocal()) {
  /** @type {import('./tipos.js').ErrorDeValidacion[]} */
  const errores = [];
  /** @type {{fecha: string, datos: import('./tipos.js').DatosEjercicio}} */
  const { fecha, datos } = registro;

  // Fecha: que exista y que no sea futura.
  if (!esFechaValida(fecha)) {
    errores.push({ campo: 'fecha', mensaje: 'La fecha no es válida.' });
  } else if (fecha > hoy) {
    errores.push({ campo: 'fecha', mensaje: 'La fecha no puede ser futura.' });
  }

  // Actividad. Lo que sigue depende de ella, así que si no es válida no se revisa más.
  if (!ACTIVIDADES.includes(datos.actividad)) {
    errores.push({ campo: 'actividad', mensaje: 'Elegí correr, fuerza u otro.' });
    return errores;
  }

  // Minutos: obligatorios en todas las actividades (alimentan el indicador de las 168 h).
  if (!Number.isInteger(datos.minutos)) {
    errores.push({ campo: 'minutos', mensaje: 'Escribí los minutos, en número entero.' });
  } else if (/** @type {number} */ (datos.minutos) < 1 || /** @type {number} */ (datos.minutos) > 600) {
    errores.push({ campo: 'minutos', mensaje: 'Los minutos tienen que ser entre 1 y 600.' });
  }

  // Km: obligatorios al correr, opcionales en "otro" y no van en fuerza.
  if (datos.actividad === 'correr' && datos.km === null) {
    errores.push({ campo: 'km', mensaje: 'Escribí los km (por ejemplo, 3,2).' });
  } else if (datos.actividad === 'fuerza' && datos.km !== null) {
    errores.push({ campo: 'km', mensaje: 'La fuerza no lleva km.' });
  } else if (datos.km !== null) {
    const km = datos.km;
    if (typeof km !== 'number' || !(km > 0) || km > 100 || !tieneHastaDosDecimales(km)) {
      errores.push({ campo: 'km', mensaje: 'Los km tienen que ser más de 0 y hasta 100, con 2 decimales como mucho.' });
    }
  }

  // Detalle: obligatorio en "otro" (qué fue).
  if (datos.actividad === 'otro' && (typeof datos.detalle !== 'string' || datos.detalle.trim() === '')) {
    errores.push({ campo: 'detalle', mensaje: 'Escribí qué fue (por ejemplo, caminar).' });
  }

  // Ejercicios: sólo en fuerza, y cada uno completo.
  if (datos.actividad !== 'fuerza' && datos.ejercicios.length > 0) {
    errores.push({ campo: 'actividad', mensaje: 'Sólo la fuerza lleva ejercicios.' });
  }
  if (datos.actividad === 'fuerza') {
    datos.ejercicios.forEach((e, i) => {
      const problema = problemaDeEjercicio(e);
      if (problema) errores.push({ campo: `ejercicio-${i}`, mensaje: `Ejercicio ${i + 1}: ${problema}` });
    });
  }

  // Nota: opcional, corta.
  if (datos.nota && datos.nota.length > 200) {
    errores.push({ campo: 'nota', mensaje: 'La nota puede tener 200 caracteres como mucho.' });
  }

  return errores;
}

/**
 * El primer problema de un ejercicio de fuerza, o null si está completo.
 *
 * @param {import('./tipos.js').Ejercicio} e
 * @returns {string | null}
 */
function problemaDeEjercicio(e) {
  if (typeof e.nombre !== 'string' || e.nombre.trim() === '') return 'escribí el nombre.';
  /** @param {number | null} n */
  const enteroValido = (n) => Number.isInteger(n) && /** @type {number} */ (n) >= 1 && /** @type {number} */ (n) <= 100;
  if (!enteroValido(e.series)) return 'las series tienen que ser un entero entre 1 y 100.';
  if (!enteroValido(e.repeticiones)) return 'las repeticiones tienen que ser un entero entre 1 y 100.';
  if (e.kg !== null && (typeof e.kg !== 'number' || !(e.kg > 0) || e.kg > 500 || !tieneHastaDosDecimales(e.kg))) {
    return 'los kg tienen que ser más de 0 y hasta 500, con 2 decimales como mucho (vacío es peso corporal).';
  }
  return null;
}
