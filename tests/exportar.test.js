import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aFilaCSV, filaEsperada, lineaDeRegistro, estadoDeExportacion, pendientes, textoParaClaude } from '../js/exportar.js';

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

/** Una sesión de deporte; cada prueba cambia lo que necesita. */
function sesion({ datos = {}, ...resto } = {}) {
  return {
    id: 's',
    version: 1,
    clase: 'ejercicio',
    fecha: '2026-11-02',
    creado: '2026-11-02T08:00:00-03:00',
    actualizado: '2026-11-02T08:00:00-03:00',
    texto: '',
    exportado: null,
    exportado_como: null,
    anulado: false,
    ...resto,
    datos: { actividad: 'correr', minutos: 32, km: 3.2, detalle: '', ejercicios: [], nota: '', ...datos },
  };
}

test('lineaDeRegistro: CSV para la plata y una línea para el deporte', () => {
  assert.equal(lineaDeRegistro(registro()), aFilaCSV(registro()));
  assert.equal(lineaDeRegistro(sesion()), '2026-11-02 · correr · 3,2 km · 32 min · 10:00 min/km');
});

test('una sesión exportada y editada queda corregida', () => {
  const s = sesion();
  s.exportado_como = lineaDeRegistro(s);
  assert.equal(estadoDeExportacion(s), 'exportado');
  s.datos.km = 3.5;
  assert.equal(estadoDeExportacion(s), 'corregido');
  assert.equal(pendientes([s]).corregidos.length, 1);
});

test('textoParaClaude suma el deporte y la fila de S03 de cada semana tocada', () => {
  const gasto = registro({ id: 'g', fecha: '2026-11-02' });
  const corrida = sesion({ id: 'c1' });
  const fuerza = sesion({
    id: 'f',
    fecha: '2026-11-03',
    datos: { actividad: 'fuerza', km: null, minutos: 40, ejercicios: [{ nombre: 'sentadilla', series: 3, repeticiones: 12, kg: 12.5 }] },
  });
  // Una corrida del lunes ya exportada: no está pendiente, pero cuenta en la fila de la semana.
  const yaExportada = sesion({ id: 'c0', creado: '2026-11-02T07:00:00-03:00', datos: { km: 3.3, minutos: 33 } });
  yaExportada.exportado_como = lineaDeRegistro(yaExportada);

  const todos = [gasto, corrida, fuerza, yaExportada];
  const texto = textoParaClaude(pendientes(todos), '2026-11-03T22:00:00-03:00', todos);

  assert.equal(
    texto,
    [
      'REGISTRADOR · exportado el 03/11/2026 22:00',
      'Nuevos: 3 · Corregidos: 0 · Anulados: 0',
      '',
      '## Filas nuevas para el historial',
      'fecha,tipo,categoria,detalle,monto,moneda,medio,proyecto',
      '2026-11-02,egreso,comida,súper,3500,ARS,débito,',
      '',
      '## Deporte: sesiones nuevas',
      '2026-11-02 · correr · 3,2 km · 32 min · 10:00 min/km',
      '2026-11-03 · fuerza · 40 min · sentadilla 3x12 12,5 kg · 450 kg movidos',
      '',
      '## Métricas de S03 (reemplazar la fila de estas semanas)',
      '| 02/11/2026 | 2 | 1 | 6,5 | | 1,8 h de entrenamiento |',
    ].join('\n'),
  );
});

test('textoParaClaude sin deporte queda igual que antes', () => {
  const texto = textoParaClaude(pendientes([registro()]), '2026-11-01T22:10:05-03:00', [registro()]);
  assert.ok(!texto.includes('Deporte'));
  assert.ok(!texto.includes('S03'));
});
