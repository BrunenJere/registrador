// @ts-check

// Sólo documentación: la forma de los datos que usa la app (§5 de la especificación).
// No tiene código que se ejecute. VS Code lee estas definiciones y avisa si alguna función
// usa un campo que no existe o le pasa un dato del tipo equivocado. Los demás archivos las
// usan con import('./tipos.js').Registro.

/**
 * Los campos de un ingreso o egreso: las columnas del historial de la bóveda.
 *
 * @typedef {object} DatosFinanza
 * @property {string} tipo        "ingreso" o "egreso"
 * @property {string} categoria   una de listas.js, según el tipo
 * @property {string} detalle     texto corto
 * @property {number | null} monto  mayor que 0, hasta 2 decimales (null si no se pudo leer)
 * @property {string} moneda      "ARS" o "USD"
 * @property {string} medio       uno de listas.js
 * @property {string} proyecto    vacío o un ID como "P05"
 */

/**
 * Un registro guardado. Lo que cambia según la clase está en `datos`.
 *
 * @typedef {object} Registro
 * @property {string} id
 * @property {number} version
 * @property {string} clase        "finanza" (en la fase 1, la única)
 * @property {string} fecha        día al que corresponde, "aaaa-mm-dd"
 * @property {string} creado       momento local con zona, "aaaa-mm-ddThh:mm:ss-03:00"
 * @property {string} actualizado  ídem, última edición
 * @property {string} texto        la frase original (vacía en la fase 1)
 * @property {DatosFinanza} datos
 * @property {string | null} exportado       momento en que se copió para Claude
 * @property {string | null} exportado_como  la fila CSV tal como se exportó
 * @property {boolean} anulado
 */

/**
 * Un error de validación, con el campo al que corresponde para mostrarlo al lado.
 *
 * @typedef {object} ErrorDeValidacion
 * @property {string} campo    "fecha", "tipo", "categoria", "detalle", "monto", "moneda", "medio" o "proyecto"
 * @property {string} mensaje  en castellano, para mostrar tal cual
 */

export {};
