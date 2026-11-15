import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumenDeTiempo, tiempoPorTema, temasDeTiempo, horas } from '../js/tiempo.js';
import { normalizar } from '../js/textos.js';

/** Un registro de tiempo; cada prueba cambia lo que necesita. */
function tiempo(que, minutos, { anulado = false, fecha = '2026-11-14' } = {}) {
  return { id: que + minutos, clase: 'tiempo', fecha, creado: `${fecha}T10:00:00-03:00`, anulado, datos: { minutos, que } };
}

test('normalizar: minúsculas, sin tildes, sin espacios de más, con ñ', () => {
  assert.equal(normalizar('  GCI '), 'gci');
  assert.equal(normalizar('Gcí'), 'gci');
  assert.equal(normalizar('Pañalera'), 'pañalera');
  assert.equal(normalizar('estudio   de  inglés'), 'estudio de ingles');
});

test('resumenDeTiempo: una línea', () => {
  assert.equal(resumenDeTiempo({ minutos: 90, que: 'GCI' }), '90 min · GCI');
});

test('tiempoPorTema: suma por tema, junta mayúsculas y tildes, de mayor a menor', () => {
  const lista = [
    tiempo('GCI', 90),
    tiempo('pañalera', 240),
    tiempo('gci ', 30),
    tiempo('Gcí', 60),
    tiempo('inglés', 45, { anulado: true }), // anulado: no cuenta
    { id: 'p', clase: 'finanza', fecha: '2026-11-14', anulado: false, datos: { monto: 100 } }, // otra clase
  ];
  assert.deepEqual(tiempoPorTema(lista), [
    { que: 'pañalera', minutos: 240 },
    { que: 'GCI', minutos: 180 },
  ]);
});

test('temasDeTiempo: sin repetir y en orden alfabético', () => {
  assert.deepEqual(temasDeTiempo([tiempo('pañalera', 240), tiempo('GCI', 90), tiempo('gci', 30)]), ['GCI', 'pañalera']);
});

test('horas: minutos a horas con coma', () => {
  assert.equal(horas(90), '1,5 h');
  assert.equal(horas(240), '4 h');
  assert.equal(horas(50), '0,8 h');
});
