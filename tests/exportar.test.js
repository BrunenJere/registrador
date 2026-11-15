import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aFilaCSV, lineaDeRegistro, textoDeDetalle } from '../js/exportar.js';

const MOMENTO = '2026-11-15T21:30:00-03:00';

/** Un registro de plata; cada prueba cambia lo que necesita. */
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

/** Una sesión de deporte; cada prueba cambia lo que necesita. */
function sesion({ datos = {}, ...resto } = {}) {
  return {
    id: 's',
    version: 1,
    clase: 'ejercicio',
    fecha: '2026-11-09',
    creado: '2026-11-09T08:00:00-03:00',
    actualizado: '2026-11-09T08:00:00-03:00',
    texto: '',
    exportado: null,
    exportado_como: null,
    anulado: false,
    ...resto,
    datos: { actividad: 'correr', minutos: 32, km: 3.2, detalle: '', ejercicios: [], nota: '', ...datos },
  };
}

test('aFilaCSV arma la fila en el orden del historial', () => {
  assert.equal(aFilaCSV(registro()), '2026-11-01,egreso,comida,súper,3500,ARS,débito,');
  assert.equal(
    aFilaCSV(registro({ datos: { monto: 3500.5, proyecto: 'P05' } })),
    '2026-11-01,egreso,comida,súper,3500.5,ARS,débito,P05',
  );
  assert.equal(aFilaCSV(registro({ datos: { detalle: '' } })), '2026-11-01,egreso,comida,,3500,ARS,débito,'); // detalle opcional
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

test('lineaDeRegistro: CSV para la plata y una línea para el deporte', () => {
  assert.equal(lineaDeRegistro(registro()), aFilaCSV(registro()));
  assert.equal(lineaDeRegistro(sesion()), '2026-11-09 · correr · 3,2 km · 32 min · 10:00 min/km');
});

// Una semana de ejemplo: del lunes 09/11 al domingo 15/11/2026.
const SEMANA = [
  registro({ id: 'g1', fecha: '2026-11-09', creado: '2026-11-09T12:00:00-03:00', datos: { detalle: 'Compras', monto: 28000 } }),
  registro({ id: 'g2', fecha: '2026-11-09', creado: '2026-11-09T20:00:00-03:00', datos: { categoria: 'otros', detalle: 'Entrada pool party', monto: 10000 } }),
  sesion({ id: 'c1' }),
  sesion({
    id: 'f1',
    fecha: '2026-11-10',
    creado: '2026-11-10T08:00:00-03:00',
    datos: { actividad: 'fuerza', km: null, minutos: 40, ejercicios: [{ nombre: 'sentadilla', series: 3, repeticiones: 12, kg: 12.5 }] },
  }),
  registro({ id: 'fuera', fecha: '2026-11-16', datos: { detalle: 'de la semana siguiente' } }),
  registro({ id: 'borrado', fecha: '2026-11-11', anulado: true, datos: { detalle: 'anulado de antes' } }),
];

test('textoDeDetalle: una semana entera, con plata, deporte y la fila de S03', () => {
  assert.equal(
    textoDeDetalle(SEMANA, '2026-11-09', '2026-11-15', MOMENTO),
    [
      'REGISTRADOR · semana del 09/11/2026 al 15/11/2026 · copiado el 15/11/2026 21:30',
      '',
      '## Plata (filas para el historial)',
      'fecha,tipo,categoria,detalle,monto,moneda,medio,proyecto',
      '2026-11-09,egreso,comida,Compras,28000,ARS,débito,',
      '2026-11-09,egreso,otros,Entrada pool party,10000,ARS,débito,',
      '',
      '## Deporte',
      '2026-11-09 · correr · 3,2 km · 32 min · 10:00 min/km',
      '2026-11-10 · fuerza · 40 min · sentadilla 3x12 12,5 kg · 450 kg movidos',
      '',
      '## Métricas de S03',
      '| 09/11/2026 | 1 | 1 | 3,2 | | 1,2 h de entrenamiento |',
    ].join('\n'),
  );
});

test('textoDeDetalle: un día, sin la fila de S03', () => {
  assert.equal(
    textoDeDetalle(SEMANA, '2026-11-10', '2026-11-10', MOMENTO),
    [
      'REGISTRADOR · día 10/11/2026 · copiado el 15/11/2026 21:30',
      '',
      '## Deporte',
      '2026-11-10 · fuerza · 40 min · sentadilla 3x12 12,5 kg · 450 kg movidos',
    ].join('\n'),
  );
});

test('textoDeDetalle: sólo plata no lleva sección de deporte ni fila de S03', () => {
  const texto = textoDeDetalle(SEMANA.filter((r) => r.clase === 'finanza'), '2026-11-09', '2026-11-15', MOMENTO);
  assert.ok(texto.includes('## Plata'));
  assert.ok(!texto.includes('## Deporte'));
  assert.ok(!texto.includes('S03'));
});

test('textoDeDetalle: deja afuera los anulados y lo que está fuera del período', () => {
  const texto = textoDeDetalle(SEMANA, '2026-11-09', '2026-11-15', MOMENTO);
  assert.ok(!texto.includes('anulado de antes'));
  assert.ok(!texto.includes('semana siguiente'));
});

test('textoDeDetalle: sin registros lo dice', () => {
  assert.equal(
    textoDeDetalle(SEMANA, '2026-11-12', '2026-11-12', MOMENTO),
    'REGISTRADOR · día 12/11/2026 · copiado el 15/11/2026 21:30\n\nNo hay registros en este período.',
  );
});

test('textoDeDetalle: el tiempo, con las horas por tema si es una semana entera', () => {
  const tiempo = (id, fecha, minutos, que) => ({ id, clase: 'tiempo', fecha, creado: `${fecha}T10:00:00-03:00`, anulado: false, datos: { minutos, que } });
  const lista = [tiempo('t1', '2026-11-09', 90, 'GCI'), tiempo('t2', '2026-11-10', 240, 'pañalera'), tiempo('t3', '2026-11-10', 30, 'gci')];
  assert.equal(
    textoDeDetalle(lista, '2026-11-09', '2026-11-15', MOMENTO),
    [
      'REGISTRADOR · semana del 09/11/2026 al 15/11/2026 · copiado el 15/11/2026 21:30',
      '',
      '## Tiempo',
      '2026-11-09 · 90 min · GCI',
      '2026-11-10 · 240 min · pañalera',
      '2026-11-10 · 30 min · gci',
      '',
      '## Horas por tema en la semana',
      '- pañalera: 4 h',
      '- GCI: 2 h',
    ].join('\n'),
  );
  assert.ok(!textoDeDetalle(lista, '2026-11-10', '2026-11-10', MOMENTO).includes('Horas por tema')); // un día: sin el total por tema
});
