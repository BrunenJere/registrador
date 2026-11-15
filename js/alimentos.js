// @ts-check

import { normalizar } from './textos.js';

// La tabla de alimentos (§15, paso 5): un CSV que arma el usuario en Google Sheets o Excel, con
// las kcal y los macros de cada alimento POR PORCIÓN. Funciones puras: leer el CSV, buscar un
// alimento y multiplicar por las porciones.

const COLUMNAS = /** @type {const} */ (['alimento', 'porcion', 'kcal', 'proteinas', 'carbohidratos', 'grasas']);

/**
 * Parte una línea de CSV en campos, respetando las comillas: en `"pan, lactal";2` la coma de
 * adentro de las comillas no separa. Dos comillas seguidas adentro ("") son una comilla.
 *
 * @param {string} linea
 * @param {string} separador "," o ";"
 * @returns {string[]}
 */
export function partirLinea(linea, separador) {
  const campos = [];
  let actual = '';
  let entreComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (entreComillas) {
      if (c === '"' && linea[i + 1] === '"') {
        actual += '"'; // "" adentro de comillas es una comilla
        i++;
      } else if (c === '"') {
        entreComillas = false;
      } else {
        actual += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === separador) {
      campos.push(actual);
      actual = '';
    } else {
      actual += c;
    }
  }
  campos.push(actual);
  return campos.map((campo) => campo.trim());
}

/**
 * Un número de la tabla: acepta coma o punto decimal ("12,5" o "12.5"), sin separador de miles.
 * Devuelve null si no es un número de 0 en adelante.
 *
 * @param {string} texto
 * @returns {number | null}
 */
export function leerDecimal(texto) {
  const limpio = texto.trim();
  if (!/^\d+([.,]\d+)?$/.test(limpio)) return null;
  return Number(limpio.replace(',', '.'));
}

/**
 * Lee el CSV de la tabla de alimentos.
 * - La primera línea son los títulos: alimento, porcion, kcal, proteinas, carbohidratos, grasas,
 *   en cualquier orden y con o sin tildes.
 * - El separador es ";" si la línea de títulos tiene alguno (así exporta el Excel en castellano);
 *   si no, ",".
 * - Si alguna fila tiene un error, se devuelven todos los errores y ningún alimento: la tabla se
 *   carga entera o no se carga.
 *
 * @param {string} texto
 * @returns {{alimentos: import('./tipos.js').Alimento[], errores: string[]}}
 */
export function leerTablaCSV(texto) {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== ''); // ﻿: la marca que pone Excel al principio
  if (lineas.length === 0) return { alimentos: [], errores: ['El archivo está vacío.'] };

  const separador = lineas[0].includes(';') ? ';' : ',';
  const titulos = partirLinea(lineas[0], separador).map(normalizar);
  const faltan = COLUMNAS.filter((c) => !titulos.includes(c));
  if (faltan.length > 0) {
    return { alimentos: [], errores: [`Faltan columnas en la primera fila: ${faltan.join(', ')}.`] };
  }
  const posicion = Object.fromEntries(COLUMNAS.map((c) => [c, titulos.indexOf(c)]));

  /** @type {import('./tipos.js').Alimento[]} */
  const alimentos = [];
  const errores = [];
  const vistos = new Set();
  lineas.slice(1).forEach((linea, i) => {
    const fila = i + 2; // como la numera la hoja de cálculo: la 1 son los títulos
    const campos = partirLinea(linea, separador);
    const nombre = campos[posicion.alimento] ?? '';
    if (nombre === '') {
      errores.push(`Fila ${fila}: falta el nombre del alimento.`);
      return;
    }
    if (vistos.has(normalizar(nombre))) {
      errores.push(`Fila ${fila}: «${nombre}» está repetido.`);
      return;
    }
    vistos.add(normalizar(nombre));

    /** @type {Record<string, number>} */
    const valores = {};
    for (const columna of ['kcal', 'proteinas', 'carbohidratos', 'grasas']) {
      const valor = leerDecimal(campos[posicion[columna]] ?? '');
      if (valor === null) {
        errores.push(`Fila ${fila}: «${columna}» de ${nombre} no es un número (usá 12,5 o 12.5, sin puntos de miles).`);
        return;
      }
      valores[columna] = valor;
    }
    alimentos.push({
      alimento: nombre,
      porcion: campos[posicion.porcion] || '1 porción',
      kcal: valores.kcal,
      proteinas: valores.proteinas,
      carbohidratos: valores.carbohidratos,
      grasas: valores.grasas,
    });
  });

  if (lineas.length === 1) errores.push('La tabla no tiene alimentos: sólo la fila de títulos.');
  return errores.length > 0 ? { alimentos: [], errores } : { alimentos, errores: [] };
}

/**
 * El alimento de la tabla con ese nombre (sin importar mayúsculas ni tildes), o null.
 *
 * @param {import('./tipos.js').Alimento[]} tabla
 * @param {string} nombre
 * @returns {import('./tipos.js').Alimento | null}
 */
export function buscarAlimento(tabla, nombre) {
  const clave = normalizar(nombre);
  return tabla.find((a) => normalizar(a.alimento) === clave) ?? null;
}

/**
 * Las kcal y los macros de un alimento para cierta cantidad de porciones, a un decimal.
 *
 * @param {import('./tipos.js').Alimento} alimento
 * @param {number} porciones
 * @returns {{kcal: number, proteinas: number, carbohidratos: number, grasas: number}}
 */
export function valoresPorPorciones(alimento, porciones) {
  /** @param {number} n */
  const unDecimal = (n) => Math.round(n * porciones * 10) / 10;
  return {
    kcal: unDecimal(alimento.kcal),
    proteinas: unDecimal(alimento.proteinas),
    carbohidratos: unDecimal(alimento.carbohidratos),
    grasas: unDecimal(alimento.grasas),
  };
}
