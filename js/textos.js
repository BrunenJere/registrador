// @ts-check

/**
 * Un texto listo para comparar: sin espacios en los bordes, en minúsculas y sin tildes.
 * Así "GCI", "gci " y "Gcí" cuentan como lo mismo.
 *
 * Cómo saca las tildes: normalize('NFD') separa cada letra de su tilde ("á" pasa a "a" + "´"), y
 * la expresión regular borra esas marcas sueltas (el rango ̀-ͯ son las tildes y
 * diéresis). La ñ también se separa en "n" + "~": por eso se vuelve a armar antes.
 *
 * @param {string} texto
 * @returns {string}
 */
export function normalizar(texto) {
  return String(texto)
    .trim()
    .toLowerCase()
    .replaceAll('ñ', '\u0000') // se guarda la ñ…
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replaceAll('\u0000', 'ñ') // …y se devuelve
    .replace(/\s+/g, ' '); // varios espacios seguidos cuentan como uno
}
