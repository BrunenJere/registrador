import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aFilaCSV, filaEsperada, pendientes, textoParaClaude } from '../js/exportar.js';

/** Un registro de egreso; cada prueba cambia lo que necesita. */
function registro({ datos = {}, ...resto } = {}) {
  return {
    id: 'a',
    version: 1,
    clase: 'finanza',
    fecha: '2026-11-01',
    creado: '2026-11-01T10:00:00-03:00',
    actualizado: '2026-11-01T10:00:00-03:00',
    texto: '',
    exportado: null,
    exportado_como: null,
    anulado: false,
    ...resto,
    datos: {
      tipo: 'egreso',
      categoria: 'comida',
      detalle: 'súper',
      monto: 3500,
      moneda: 'ARS',
      medio: 'débito',
      proyecto: '',
      ...datos,
    },
  };
}

test('aFilaCSV arma la fila en el orden del historial', () => {
  assert.equal(aFilaCSV(registro()), '2026-11-01,egreso,comida,súper,3500,ARS,débito,');
  assert.equal(
    aFilaCSV(registro({ datos: { monto: 3500.5, proyecto: 'P05' } })),
    '2026-11-01,egreso,comida,súper,3500.5,ARS,débito,P05',
  );
});

test('aFilaCSV pone entre comillas el detalle con coma o comillas', () => {
  assert.equal(
    aFilaCSV(registro({ datos: { detalle: 'pan, leche' } })),
    '2026-11-01,egreso,comida,"pan, leche",3500,ARS,débito,',
  );
  assert.equal(
    aFilaCSV(registro({ datos: { detalle: 'el "chino"' } })),
    '2026-11-01,egreso,comida,"el ""chino""",3500,ARS,débito,',
  );
});

test('filaEsperada es null si el registro está anulado', () => {
  assert.equal(filaEsperada(registro({ anulado: true })), null);
});

test('pendientes: un registro nunca exportado es nuevo', () => {
  const p = pendientes([registro()]);
  assert.equal(p.nuevos.length, 1);
  assert.equal(p.corregidos.length + p.anulados.length, 0);
});

test('pendientes: exportado y sin cambios no está pendiente', () => {
  const r = registro();
  r.exportado_como = aFilaCSV(r);
  const p = pendientes([r]);
  assert.equal(p.nuevos.length + p.corregidos.length + p.anulados.length, 0);
});

test('pendientes: exportado y editado es corregido; si se vuelve atrás, no', () => {
  const r = registro();
  r.exportado_como = aFilaCSV(r);
  r.datos.monto = 4500;
  assert.equal(pendientes([r]).corregidos.length, 1);
  r.datos.monto = 3500; // vuelve a lo que ya está en la bóveda
  assert.equal(pendientes([r]).corregidos.length, 0);
});

test('pendientes: anulado con fila en la bóveda es anulado; ya avisado, no', () => {
  const r = registro();
  r.exportado_como = aFilaCSV(r);
  r.anulado = true;
  assert.equal(pendientes([r]).anulados.length, 1);
  r.exportado_como = null; // así queda después de pasarle la anulación a Claude
  const p = pendientes([r]);
  assert.equal(p.nuevos.length + p.corregidos.length + p.anulados.length, 0);
});

test('pendientes ordena por fecha y, dentro del día, por cómo se anotó', () => {
  const tarde = registro({ id: 'tarde', creado: '2026-11-01T20:00:00-03:00' });
  const temprano = registro({ id: 'temprano', creado: '2026-11-01T08:00:00-03:00' });
  const ayer = registro({ id: 'ayer', fecha: '2026-10-31', creado: '2026-11-01T21:00:00-03:00' });
  assert.deepEqual(
    pendientes([tarde, temprano, ayer]).nuevos.map((r) => r.id),
    ['ayer', 'temprano', 'tarde'],
  );
});

test('textoParaClaude arma el texto con las tres secciones', () => {
  const nuevo = registro({ id: 'n' });
  const corregido = registro({ id: 'c', fecha: '2026-10-31', datos: { categoria: 'personal', detalle: 'café', monto: 2800, medio: 'efectivo' } });
  corregido.exportado_como = '2026-10-31,egreso,personal,café,1800,ARS,efectivo,';
  const anulado = registro({ id: 'x', anulado: true, exportado_como: '2026-11-01,egreso,casa,luz,9000,ARS,débito,' });

  const texto = textoParaClaude(pendientes([nuevo, corregido, anulado]), '2026-11-01T22:10:05-03:00');

  assert.equal(
    texto,
    [
      'REGISTRADOR · exportado el 01/11/2026 22:10',
      'Nuevos: 1 · Corregidos: 1 · Anulados: 1',
      '',
      '## Filas nuevas para el historial',
      'fecha,tipo,categoria,detalle,monto,moneda,medio,proyecto',
      '2026-11-01,egreso,comida,súper,3500,ARS,débito,',
      '',
      '## Correcciones de filas ya cargadas',
      'antes: 2026-10-31,egreso,personal,café,1800,ARS,efectivo,',
      'ahora: 2026-10-31,egreso,personal,café,2800,ARS,efectivo,',
      '',
      '## Filas anuladas (sacarlas del historial)',
      '2026-11-01,egreso,casa,luz,9000,ARS,débito,',
    ].join('\n'),
  );
});

test('textoParaClaude avisa si no hay nada pendiente', () => {
  const texto = textoParaClaude(pendientes([]), '2026-11-01T22:10:05-03:00');
  assert.equal(
    texto,
    'REGISTRADOR · exportado el 01/11/2026 22:10\nNuevos: 0 · Corregidos: 0 · Anulados: 0\n\nNo hay nada pendiente.',
  );
});
