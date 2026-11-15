import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalesDeComida, totalesDeComidas, resumenDeComida, alimentosAnotados } from '../js/comidas.js';
import { validarComida } from '../js/validar.js';
import { textoDeDetalle } from '../js/exportar.js';

const HOY = '2026-11-14';
const MILANESA = { alimento: 'milanesa', porciones: 1, kcal: 600, proteinas: 35, carbohidratos: 30, grasas: 35 };
const ENSALADA = { alimento: 'ensalada', porciones: 0.5, kcal: 50.4, proteinas: 1.2, carbohidratos: 8.1, grasas: 0.2 };
const SIN_DATOS = { alimento: 'flan', porciones: 1, kcal: null, proteinas: null, carbohidratos: null, grasas: null };

/** Una comida guardada; cada prueba cambia lo que necesita. */
function comida(items, { momento = 'almuerzo', fecha = HOY, anulado = false, detalle = '' } = {}) {
  return { id: momento + fecha, clase: 'comida', fecha, creado: `${fecha}T13:00:00-03:00`, anulado, datos: { momento, items, detalle } };
}

test('totalesDeComida suma lo que se conoce y cuenta lo que falta', () => {
  assert.deepEqual(totalesDeComida([MILANESA, ENSALADA, SIN_DATOS]), {
    kcal: 650.4,
    proteinas: 36.2,
    carbohidratos: 38.1,
    grasas: 35.2,
    sinValores: 1,
  });
});

test('totalesDeComidas: las comidas de un día, sin anuladas ni otras clases', () => {
  const lista = [
    comida([MILANESA]),
    comida([ENSALADA], { momento: 'cena' }),
    comida([MILANESA], { momento: 'merienda', anulado: true }),
    { id: 'x', clase: 'tiempo', fecha: HOY, anulado: false, datos: { minutos: 30, que: 'GCI' } },
  ];
  assert.equal(totalesDeComidas(lista).kcal, 650.4);
});

test('resumenDeComida: una línea, con las kcal si se conoce alguna', () => {
  assert.equal(resumenDeComida(comida([MILANESA, ENSALADA]).datos), 'almuerzo · milanesa x1, ensalada x0,5 · 650,4 kcal');
  assert.equal(resumenDeComida(comida([MILANESA, SIN_DATOS]).datos), 'almuerzo · milanesa x1, flan x1 · 600 kcal (1 sin datos)');
  assert.equal(resumenDeComida(comida([SIN_DATOS]).datos), 'almuerzo · flan x1'); // sin datos: sin kcal
  assert.equal(resumenDeComida(comida([SIN_DATOS], { detalle: 'en lo de la nona' }).datos), 'almuerzo · flan x1 · en lo de la nona');
});

test('alimentosAnotados: sin repetir (sin importar mayúsculas) y en orden', () => {
  const lista = [comida([MILANESA, ENSALADA]), comida([{ ...MILANESA, alimento: 'Milanesa' }], { momento: 'cena' })];
  assert.deepEqual(alimentosAnotados(lista), ['ensalada', 'milanesa']);
});

function camposComida(datos, fecha = HOY) {
  return validarComida({ fecha, datos: { momento: 'almuerzo', items: [MILANESA], detalle: '', ...datos } }, HOY).map((e) => e.campo);
}

test('validarComida: completa, y con valores vacíos también', () => {
  assert.deepEqual(camposComida({}), []);
  assert.deepEqual(camposComida({ items: [SIN_DATOS] }), []);
});

test('validarComida: fecha, momento y al menos un alimento', () => {
  assert.deepEqual(camposComida({}, '2026-11-15'), ['fecha']);
  assert.deepEqual(camposComida({ momento: 'brunch' }), ['momento']);
  assert.deepEqual(camposComida({ items: [] }), ['items']);
});

test('validarComida: cada alimento con nombre, porciones y valores razonables', () => {
  assert.deepEqual(camposComida({ items: [MILANESA, { ...ENSALADA, alimento: ' ' }] }), ['item-1']);
  assert.deepEqual(camposComida({ items: [{ ...MILANESA, porciones: 0 }] }), ['item-0']);
  assert.deepEqual(camposComida({ items: [{ ...MILANESA, porciones: 21 }] }), ['item-0']);
  assert.deepEqual(camposComida({ items: [{ ...MILANESA, porciones: null }] }), ['item-0']);
  assert.deepEqual(camposComida({ items: [{ ...MILANESA, kcal: -1 }] }), ['item-0']);
  assert.deepEqual(camposComida({ items: [{ ...MILANESA, kcal: NaN }] }), ['item-0']); // algo escrito que no se pudo leer
  assert.deepEqual(camposComida({ items: [{ ...MILANESA, grasas: 501 }] }), ['item-0']);
});

test('textoDeDetalle: la sección de comidas', () => {
  const texto = textoDeDetalle([comida([MILANESA])], HOY, HOY, '2026-11-14T22:00:00-03:00');
  assert.ok(texto.includes('## Comidas\n2026-11-14 · almuerzo · milanesa x1 · 600 kcal'));
});
