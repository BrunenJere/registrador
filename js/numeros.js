// @ts-check

// Forma válida de un monto escrito a la argentina: el punto separa miles y la coma separa
// decimales. Se lee de izquierda a derecha:
//
//   ^                      principio del texto
//   (                      la parte entera puede ser...
//     \d{1,3}(\.\d{3})+    ...de 1 a 3 dígitos seguidos de grupos de "punto + 3 dígitos"
//                          (3.500 · 12.000 · 1.234.567)
//     |                    ...o
//     \d+                  ...dígitos sin puntos (3500)
//   )
//   (,\d{1,2})?            y, opcional, una coma con 1 o 2 decimales (,5 · ,50)
//   $                      fin del texto
//
// Lo que no encaja se rechaza en vez de adivinar: "3.5" (¿3,5 o 3500?), "1,234" (tres
// decimales), "-5", "abc".
const FORMATO_MONTO = /^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/;

/**
 * Convierte lo que se escribe en el campo de monto a un número.
 *
 * @param {string} texto lo que escribió el usuario, por ejemplo "$ 3.500,50"
 * @returns {number | null} el monto (3500.5), o null si no es un monto válido mayor que 0
 */
export function leerMonto(texto) {
  // 1. Sacar los espacios (también los que no se ven, como el espacio duro) y el signo $.
  const limpio = String(texto).replace(/[\s$]/g, '');

  // 2. Revisar que tenga la forma de un monto argentino.
  if (!FORMATO_MONTO.test(limpio)) {
    return null;
  }

  // 3. Pasarlo a la forma que entiende JavaScript: sin puntos de miles y con punto decimal.
  const monto = Number(limpio.replaceAll('.', '').replace(',', '.'));

  // 4. Tiene que ser mayor que 0 ("0" y "0,00" tienen forma válida, pero no son un monto).
  if (!(monto > 0)) {
    return null;
  }

  return monto;
}

/**
 * Convierte un número entero escrito (minutos, series, repeticiones) a número.
 * Los límites (por ejemplo, minutos entre 1 y 600) los revisa la validación, que da un mensaje
 * más claro.
 *
 * @param {string} texto por ejemplo "32"
 * @returns {number | null} el entero, o null si el texto no son sólo dígitos
 */
export function leerEntero(texto) {
  const limpio = String(texto).trim();
  if (!/^\d+$/.test(limpio)) {
    return null;
  }
  return Number(limpio);
}
