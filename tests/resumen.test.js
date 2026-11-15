import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registrosDelDia, registrosDelPeriodo, totales, ultimoMedio } from '../js/resumen.js';

/** Un registro mínimo para estas cuentas. */
function registro({ id = 'a', fecha = '2026-11-01', creado = '2026-11-01T10:00:00-03:00', anulado = false, ...datos } = {}) {
  return {
    id,
    clase: 'finanza',
    fecha,
    creado,
    anulado,
    exportado_como: null,
    datos: { tipo: 'egreso', categoria: 'comida', detalle: 'súper', monto: 100, moneda: 'ARS', medio: 'débito', proyecto: '', ...datos },
  };
}

test('registrosDelDia filtra por fecha y ordena del más nuevo al más viejo', () => {
  const lista = [
    registro({ id: 'temprano', creado: '2026-11-01T08:00:00-03:00' }),
    registro({ id: 'otro-dia', fecha: '2026-10-31' }),
    registro({ id: 'tarde', creado: '2026-11-01T20:00:00-03:00' }),
  ];
  assert.deepEqual(registrosDelDia(lista, '2026-11-01').map((r) => r.id), ['tarde', 'temprano']);
});

test('totales suma por moneda y tipo, sin contar anulados', () => {
  const lista = [
    registro({ monto: 3500 }),
    registro({ monto: 0.1 }),
    registro({ monto: 0.2 }),
    registro({ tipo: 'ingreso', categoria: 'sueldo', monto: 200000 }),
    registro({ moneda: 'USD', monto: 20 }),
    registro({ monto: 99999, anulado: true }),
  ];
  assert.deepEqual(totales(lista), {
    ARS: { ingresos: 200000, egresos: 3500.3 }, // 0.1 + 0.2 redondeado a centavos
    USD: { ingresos: 0, egresos: 20 },
  });
});

test('ultimoMedio da el medio del último anotado, sin contar anulados', () => {
  assert.equal(ultimoMedio([]), '');
  const lista = [
    registro({ medio: 'efectivo', creado: '2026-11-01T08:00:00-03:00' }),
    registro({ medio: 'mercado pago', creado: '2026-11-01T12:00:00-03:00' }),
    registro({ medio: 'crédito', creado: '2026-11-01T20:00:00-03:00', anulado: true }),
  ];
  assert.equal(ultimoMedio(lista), 'mercado pago');
});

test('totales y ultimoMedio ignoran las sesiones de deporte', () => {
  const corrida = {
    id: 'c',
    clase: 'ejercicio',
    fecha: '2026-11-01',
    creado: '2026-11-01T21:00:00-03:00',
    anulado: false,
    exportado_como: null,
    datos: { actividad: 'correr', minutos: 32, km: 3.2, detalle: '', ejercicios: [], nota: '' },
  };
  const lista = [registro({ monto: 3500, medio: 'efectivo' }), corrida];
  assert.deepEqual(totales(lista), { ARS: { ingresos: 0, egresos: 3500 }, USD: { ingresos: 0, egresos: 0 } });
  assert.equal(ultimoMedio(lista), 'efectivo'); // la corrida es más nueva, pero no tiene medio
});

test('registrosDelPeriodo: entre dos fechas, sin anulados, en orden', () => {
  const lista = [
    registro({ id: 'jueves', fecha: '2026-11-12' }),
    registro({ id: 'lunes-tarde', fecha: '2026-11-09', creado: '2026-11-09T20:00:00-03:00' }),
    registro({ id: 'lunes-temprano', fecha: '2026-11-09', creado: '2026-11-09T08:00:00-03:00' }),
    registro({ id: 'anulado', fecha: '2026-11-10', anulado: true }),
    registro({ id: 'antes', fecha: '2026-11-08' }),
    registro({ id: 'despues', fecha: '2026-11-16' }),
  ];
  assert.deepEqual(
    registrosDelPeriodo(lista, '2026-11-09', '2026-11-15').map((r) => r.id),
    ['lunes-temprano', 'lunes-tarde', 'jueves'],
  );
});

test('registrosDelDia deja afuera los anulados', () => {
  const lista = [registro({ id: 'ok' }), registro({ id: 'anulado', anulado: true })];
  assert.deepEqual(registrosDelDia(lista, '2026-11-01').map((r) => r.id), ['ok']);
});
