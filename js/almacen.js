// @ts-check

import { momentoLocal } from './fechas.js';
import { filaEsperada } from './exportar.js';

// Lo único que toca localStorage.
//
// localStorage guarda sólo texto, con una clave. Toda la lista de registros se guarda como un
// solo texto JSON bajo esta clave. Lleva prefijo porque todos los repos publicados en
// brunenjere.github.io comparten el mismo localStorage.
export const CLAVE = 'registrador:v1:registros';

// Todas las operaciones siguen el mismo patrón: leer la lista entera, cambiarla y guardarla
// entera. Con unos cientos de registros por mes es instantáneo, y es el patrón más simple de
// entender: lo guardado siempre es una lista completa y coherente.
//
// Cuando algo sale mal, estas funciones LANZAN un error con un mensaje en castellano (throw).
// No muestran nada: app.js atrapa el error y lo muestra en pantalla.

/**
 * Lo mínimo que tiene que tener el almacenamiento: leer y escribir texto por clave.
 * localStorage lo cumple; las pruebas usan uno falso, en memoria.
 *
 * @typedef {Pick<Storage, 'getItem' | 'setItem'>} Almacenamiento
 */

/**
 * Crea el almacén sobre un almacenamiento. La app usa localStorage; las pruebas, uno falso.
 *
 * @param {Almacenamiento} [storage]
 */
export function crearAlmacen(storage = globalThis.localStorage) {
  /**
   * Todos los registros guardados.
   *
   * @returns {import('./tipos.js').Registro[]}
   */
  function leerTodos() {
    const texto = storage.getItem(CLAVE);
    if (texto === null) {
      return []; // la primera vez todavía no hay nada guardado
    }

    let registros;
    try {
      registros = JSON.parse(texto);
    } catch {
      registros = null;
    }
    if (!Array.isArray(registros)) {
      // No se pisa nada: los datos quedan como están para poder recuperarlos.
      throw new Error(
        'Los datos guardados están dañados y no se pueden leer. No se cambió nada: ' +
          'importá el último respaldo o avisale a Claude antes de seguir anotando.',
      );
    }
    return registros;
  }

  /**
   * Guarda la lista entera.
   *
   * @param {import('./tipos.js').Registro[]} registros
   */
  function guardarTodos(registros) {
    try {
      storage.setItem(CLAVE, JSON.stringify(registros));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        throw new Error(
          'No queda espacio para guardar. No se guardó el último cambio: descargá un respaldo y avisale a Claude.',
        );
      }
      throw error; // cualquier otro problema se informa tal cual
    }
  }

  /**
   * Arma un registro nuevo a partir de lo cargado en el formulario y lo guarda.
   * Los datos tienen que venir ya validados (lo hace app.js con validarFinanza).
   *
   * @param {{fecha: string, datos: import('./tipos.js').DatosFinanza}} entrada
   * @param {string} [momento] cuándo se anota; por defecto, ahora
   * @returns {import('./tipos.js').Registro} el registro guardado
   */
  function agregar(entrada, momento = momentoLocal()) {
    const registros = leerTodos();
    /** @type {import('./tipos.js').Registro} */
    const registro = {
      id: crypto.randomUUID(),
      version: 1,
      clase: 'finanza',
      fecha: entrada.fecha,
      creado: momento,
      actualizado: momento,
      texto: '',
      datos: { ...entrada.datos },
      exportado: null,
      exportado_como: null,
      anulado: false,
    };
    registros.push(registro);
    guardarTodos(registros);
    return registro;
  }

  /**
   * Cambia la fecha y los datos de un registro guardado.
   * Los datos nuevos tienen que venir ya validados (lo hace app.js con validarFinanza).
   *
   * Si el registro ya se había exportado, no se toca `exportado_como`: como la fila nueva ya no
   * coincide con la cargada en la bóveda, pendientes() lo muestra como corregido.
   *
   * @param {string} id
   * @param {{fecha: string, datos: import('./tipos.js').DatosFinanza}} cambios
   * @param {string} [momento] cuándo se edita; por defecto, ahora
   * @returns {import('./tipos.js').Registro} el registro editado
   */
  function editar(id, cambios, momento = momentoLocal()) {
    const registros = leerTodos();
    const registro = buscar(registros, id);
    if (registro.anulado) {
      throw new Error('Ese registro está anulado: no se puede editar.');
    }
    registro.fecha = cambios.fecha;
    registro.datos = { ...cambios.datos };
    registro.actualizado = momento;
    guardarTodos(registros);
    return registro;
  }

  /**
   * Borra un registro. Si nunca se exportó, desaparece. Si ya se exportó, queda anulado para
   * que la próxima exportación avise (principio 6).
   *
   * @param {string} id
   * @param {string} [momento] cuándo se borra; por defecto, ahora
   */
  function borrar(id, momento = momentoLocal()) {
    const registros = leerTodos();
    const registro = buscar(registros, id);
    if (registro.exportado === null) {
      guardarTodos(registros.filter((r) => r.id !== id));
    } else {
      registro.anulado = true;
      registro.actualizado = momento;
      guardarTodos(registros);
    }
  }

  /**
   * Marca registros como exportados: la fila que queda cargada en la bóveda es la esperada
   * (null si estaba anulado, así un anulado se avisa una sola vez). No cambia `actualizado`,
   * porque exportar no es editar.
   *
   * @param {string[]} ids
   * @param {string} [momento] cuándo se exporta; por defecto, ahora
   * @returns {CopiaDeExportacion[]} cómo estaban antes, para poder deshacer
   */
  function marcarExportados(ids, momento = momentoLocal()) {
    const registros = leerTodos();
    /** @type {CopiaDeExportacion[]} */
    const copiaAnterior = [];
    for (const registro of registros) {
      if (!ids.includes(registro.id)) continue;
      copiaAnterior.push({
        id: registro.id,
        exportado: registro.exportado,
        exportado_como: registro.exportado_como,
      });
      registro.exportado = momento;
      registro.exportado_como = filaEsperada(registro);
    }
    guardarTodos(registros);
    return copiaAnterior;
  }

  /**
   * Vuelve los registros a como estaban antes de marcarExportados.
   *
   * @param {CopiaDeExportacion[]} copiaAnterior lo que devolvió marcarExportados
   */
  function deshacerExportacion(copiaAnterior) {
    const registros = leerTodos();
    for (const copia of copiaAnterior) {
      const registro = registros.find((r) => r.id === copia.id);
      if (!registro) continue; // si mientras tanto se borró, no hay nada que deshacer
      registro.exportado = copia.exportado;
      registro.exportado_como = copia.exportado_como;
    }
    guardarTodos(registros);
  }

  return { leerTodos, guardarTodos, agregar, editar, borrar, marcarExportados, deshacerExportacion };
}

/**
 * @typedef {object} CopiaDeExportacion
 * @property {string} id
 * @property {string | null} exportado
 * @property {string | null} exportado_como
 */

/**
 * Busca un registro por id; si no está, lanza un error.
 *
 * @param {import('./tipos.js').Registro[]} registros
 * @param {string} id
 */
function buscar(registros, id) {
  const registro = registros.find((r) => r.id === id);
  if (!registro) {
    throw new Error('No se encontró ese registro. Puede que ya se haya borrado.');
  }
  return registro;
}

/**
 * Le pide al navegador que no borre los datos si el celular se queda sin espacio.
 * El navegador puede decir que no; en ese caso, el respaldo semanal es la protección.
 *
 * @returns {Promise<boolean>} true si el navegador aceptó
 */
export async function pedirPersistencia() {
  if (!globalThis.navigator?.storage?.persist) {
    return false; // este navegador no lo permite
  }
  return navigator.storage.persist();
}
