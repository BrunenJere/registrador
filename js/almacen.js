// @ts-check

import { momentoLocal } from './fechas.js';
import { normalizar } from './textos.js';

// Lo único que toca localStorage.
//
// localStorage guarda sólo texto, con una clave. Toda la lista de registros se guarda como un
// solo texto JSON bajo esta clave. Lleva prefijo porque todos los repos publicados en
// brunenjere.github.io comparten el mismo localStorage.
export const CLAVE = 'registrador:v1:registros';

// Cuándo se descargó el último respaldo, para recordar hacerlo una vez por semana.
export const CLAVE_ULTIMO_RESPALDO = 'registrador:v1:ultimo-respaldo';

// Los guardados (sesiones de deporte y comidas con nombre, para completar el formulario) y la
// tabla de alimentos cargada desde un CSV. Van aparte de los registros: no son algo que pasó.
export const CLAVE_GUARDADOS = 'registrador:v1:guardados';
export const CLAVE_ALIMENTOS = 'registrador:v1:alimentos';

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
   * Lee una lista guardada como JSON. Si no hay nada, devuelve []. Si el texto está roto, lanza
   * un error y no pisa nada: los datos quedan como están para poder recuperarlos.
   *
   * @param {string} clave
   * @returns {any[]}
   */
  function leerLista(clave) {
    const texto = storage.getItem(clave);
    if (texto === null) {
      return []; // la primera vez todavía no hay nada guardado
    }

    let lista;
    try {
      lista = JSON.parse(texto);
    } catch {
      lista = null;
    }
    if (!Array.isArray(lista)) {
      throw new Error(
        'Los datos guardados están dañados y no se pueden leer. No se cambió nada: ' +
          'importá el último respaldo o avisale a Claude antes de seguir anotando.',
      );
    }
    return lista;
  }

  /**
   * Guarda una lista entera como JSON. Si no hay espacio, avisa en vez de fallar en silencio.
   *
   * @param {string} clave
   * @param {any[]} lista
   */
  function guardarLista(clave, lista) {
    try {
      storage.setItem(clave, JSON.stringify(lista));
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
   * Todos los registros guardados.
   *
   * @returns {import('./tipos.js').Registro[]}
   */
  function leerTodos() {
    return leerLista(CLAVE);
  }

  /**
   * Guarda la lista entera de registros.
   *
   * @param {import('./tipos.js').Registro[]} registros
   */
  function guardarTodos(registros) {
    guardarLista(CLAVE, registros);
  }

  /**
   * Arma un registro nuevo a partir de lo cargado en el formulario y lo guarda.
   * Los datos tienen que venir ya validados (lo hace app.js con validarFinanza o
   * validarEjercicio, según la clase).
   *
   * @param {{clase: string, fecha: string, datos: object}} entrada
   * @param {string} [momento] cuándo se anota; por defecto, ahora
   * @returns {import('./tipos.js').Registro} el registro guardado
   */
  function agregar(entrada, momento = momentoLocal()) {
    const registros = leerTodos();
    /** @type {import('./tipos.js').Registro} */
    const registro = {
      id: crypto.randomUUID(),
      version: 1,
      clase: entrada.clase,
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
   * Cambia la fecha y los datos de un registro guardado. La clase no cambia.
   * Los datos nuevos tienen que venir ya validados (lo hace app.js).
   *
   * Si el registro ya se había exportado, no se toca `exportado_como`: como la fila nueva ya no
   * coincide con la cargada en la bóveda, pendientes() lo muestra como corregido.
   *
   * @param {string} id
   * @param {{fecha: string, datos: object}} cambios
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
   * Borra un registro: lo saca de la lista. Desde el 14/11/2026 no queda "anulado": al copiar la
   * semana, Claude ve que falta y lo pregunta.
   *
   * @param {string} id
   */
  function borrar(id) {
    const registros = leerTodos();
    buscar(registros, id); // para avisar si no existe
    guardarTodos(registros.filter((r) => r.id !== id));
  }

  /**
   * Cuándo se descargó el último respaldo, o null si nunca.
   *
   * @returns {string | null}
   */
  function leerUltimoRespaldo() {
    return storage.getItem(CLAVE_ULTIMO_RESPALDO);
  }

  /**
   * Anota que se descargó un respaldo.
   *
   * @param {string} [momento] por defecto, ahora
   */
  function guardarUltimoRespaldo(momento = momentoLocal()) {
    storage.setItem(CLAVE_ULTIMO_RESPALDO, momento);
  }

  // ---------- Guardados ----------

  /**
   * Todos los guardados (de deporte y de comidas).
   *
   * @returns {import('./tipos.js').Guardado[]}
   */
  function leerGuardados() {
    return leerLista(CLAVE_GUARDADOS);
  }

  /**
   * Guarda la lista entera de guardados (la usa el respaldo).
   *
   * @param {import('./tipos.js').Guardado[]} guardados
   */
  function guardarGuardados(guardados) {
    guardarLista(CLAVE_GUARDADOS, guardados);
  }

  /**
   * Agrega un guardado. Si ya hay uno de la misma clase con el mismo nombre (sin importar
   * mayúsculas ni tildes), lo reemplaza: app.js pregunta antes.
   *
   * @param {{clase: string, nombre: string, datos: object}} entrada
   * @returns {import('./tipos.js').Guardado}
   */
  function agregarGuardado(entrada) {
    const guardados = leerGuardados();
    const nombre = entrada.nombre.trim();
    const existente = guardados.find((g) => g.clase === entrada.clase && normalizar(g.nombre) === normalizar(nombre));
    if (existente) {
      existente.nombre = nombre;
      existente.datos = structuredClone(entrada.datos);
      guardarGuardados(guardados);
      return existente;
    }
    /** @type {import('./tipos.js').Guardado} */
    const guardado = { id: crypto.randomUUID(), clase: entrada.clase, nombre, datos: structuredClone(entrada.datos) };
    guardados.push(guardado);
    guardarGuardados(guardados);
    return guardado;
  }

  /**
   * Borra un guardado. Los registros que se anotaron a partir de él no cambian.
   *
   * @param {string} id
   */
  function borrarGuardado(id) {
    guardarGuardados(leerGuardados().filter((g) => g.id !== id));
  }

  // ---------- Tabla de alimentos ----------

  /**
   * La tabla de alimentos cargada desde el CSV ([] si no hay).
   *
   * @returns {import('./tipos.js').Alimento[]}
   */
  function leerAlimentos() {
    return leerLista(CLAVE_ALIMENTOS);
  }

  /**
   * Reemplaza la tabla de alimentos entera ([] la borra).
   *
   * @param {import('./tipos.js').Alimento[]} alimentos
   */
  function guardarAlimentos(alimentos) {
    guardarLista(CLAVE_ALIMENTOS, alimentos);
  }

  return {
    leerTodos,
    guardarTodos,
    agregar,
    editar,
    borrar,
    leerUltimoRespaldo,
    guardarUltimoRespaldo,
    leerGuardados,
    guardarGuardados,
    agregarGuardado,
    borrarGuardado,
    leerAlimentos,
    guardarAlimentos,
  };
}

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
