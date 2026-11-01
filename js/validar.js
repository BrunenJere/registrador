// @ts-check

import { TIPOS, CATEGORIAS_INGRESO, CATEGORIAS_EGRESO, MEDIOS, MONEDAS } from './listas.js';
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
