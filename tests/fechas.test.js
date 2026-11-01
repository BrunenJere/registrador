import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hoyLocal, momentoLocal, esFechaValida, mesDe } from '../js/fechas.js';

// Las pruebas corren con la zona horaria de Argentina, sea cual sea la de la computadora.
process.env.TZ = 'America/Argentina/Buenos_Aires';

test('hoyLocal da el día local, aunque en UTC ya sea mañana', () => {
  const ahora = new Date(2026, 10, 1, 23, 30); // 01/11/2026 23:30 en Argentina (el mes cuenta desde 0)
  assert.equal(hoyLocal(ahora), '2026-11-01');
  // El error que se evita: en UTC ya son las 02:30 del 02/11.
  assert.equal(ahora.toISOString().slice(0, 10), '2026-11-02');
});

test('hoyLocal completa mes y día con dos dígitos', () => {
  assert.equal(hoyLocal(new Date(2026, 0, 5, 10, 0)), '2026-01-05');
});

test('momentoLocal da la hora local con la zona de Argentina', () => {
  const ahora = new Date(2026, 10, 1, 21, 40, 5);
  assert.equal(momentoLocal(ahora), '2026-11-01T21:40:05-03:00');
});

test('esFechaValida acepta días que existen', () => {
  assert.equal(esFechaValida('2026-11-01'), true);
  assert.equal(esFechaValida('2026-02-28'), true);
  assert.equal(esFechaValida('2028-02-29'), true); // 2028 es bisiesto
});

test('esFechaValida rechaza días que no existen', () => {
  assert.equal(esFechaValida('2026-02-30'), false);
  assert.equal(esFechaValida('2026-02-29'), false); // 2026 no es bisiesto
  assert.equal(esFechaValida('2026-04-31'), false);
  assert.equal(esFechaValida('2026-13-01'), false);
  assert.equal(esFechaValida('2026-00-10'), false);
});

test('esFechaValida rechaza otros formatos', () => {
  assert.equal(esFechaValida('01/11/2026'), false);
  assert.equal(esFechaValida('2026-1-5'), false);
  assert.equal(esFechaValida(''), false);
});

test('mesDe da el año y el mes', () => {
  assert.equal(mesDe('2026-11-01'), '2026-11');
});
