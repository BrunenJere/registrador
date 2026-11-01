import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registrosDelDia, totales, ultimoMedio } from '../js/resumen.js';
import { estadoDeExportacion, aFilaCSV } from '../js/exportar.js';

/** Un registro mínimo para estas cuentas. */
function registro({ id = 'a', fecha = '2026-11-01', creado = '2026-11-01T10:00:00-03:00', anulado = false, ...datos } = {}) {
  return {
    id,
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

test('estadoDeExportacion: nuevo, exportado, corregido y anulado', () => {
  const r = registro();
  assert.equal(estadoDeExportacion(r), 'nuevo');
  r.exportado_como = aFilaCSV(r);
  assert.equal(estadoDeExportacion(r), 'exportado');
  r.datos.monto = 200;
  assert.equal(estadoDeExportacion(r), 'corregido');
  r.anulado = true;
  assert.equal(estadoDeExportacion(r), 'anulado');
});
