import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  armarRespaldo,
  nombreDelRespaldo,
  leerRespaldo,
  unirRegistros,
  importarRespaldo,
  tocaRespaldo,
} from '../js/respaldo.js';
import { crearAlmacen, CLAVE } from '../js/almacen.js';

const MOMENTO = '2026-11-01T22:10:05-03:00';

/** Un registro mínimo; cada prueba cambia lo que necesita. */
function registro(id, actualizado = '2026-11-01T10:00:00-03:00', monto = 3500) {
  return {
    id,
    version: 1,
    clase: 'finanza',
    fecha: '2026-11-01',
    creado: '2026-11-01T10:00:00-03:00',
    actualizado,
    texto: '',
    datos: { tipo: 'egreso', categoria: 'comida', detalle: 'súper', monto, moneda: 'ARS', medio: 'débito', proyecto: '' },
    exportado: null,
    exportado_como: null,
    anulado: false,
  };
}

/** Un almacenamiento falso, en memoria. */
function storageFalso() {
  const datos = new Map();
  return {
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => datos.set(clave, String(valor)),
  };
}

test('armarRespaldo y leerRespaldo van y vuelven sin perder nada', () => {
  const registros = [registro('a'), registro('b')];
  const texto = armarRespaldo(registros, MOMENTO);
  const contenido = JSON.parse(texto);
  assert.equal(contenido.app, 'registrador');
  assert.equal(contenido.version, 1);
  assert.equal(contenido.fecha, MOMENTO);
  assert.deepEqual(leerRespaldo(texto), registros);
});

test('nombreDelRespaldo lleva la fecha', () => {
  assert.equal(nombreDelRespaldo(MOMENTO), 'registrador-respaldo-2026-11-01.json');
});

test('leerRespaldo rechaza lo que no es un respaldo del registrador', () => {
  assert.throws(() => leerRespaldo('esto no es JSON'), /no es un respaldo/);
  assert.throws(() => leerRespaldo('{"app":"otra","version":1,"registros":[]}'), /no es un respaldo/);
  assert.throws(() => leerRespaldo('{"app":"registrador","version":1}'), /no es un respaldo/);
});

test('leerRespaldo rechaza versiones más nuevas y registros incompletos', () => {
  assert.throws(() => leerRespaldo('{"app":"registrador","version":2,"registros":[]}'), /versión más nueva/);
  assert.throws(
    () => leerRespaldo('{"app":"registrador","version":1,"registros":[{"id":"a"}]}'),
    /incompletos/,
  );
});

test('unirRegistros agrega lo que falta y se queda con lo editado más recientemente', () => {
  const actuales = [
    registro('igual'),
    registro('viejo-aca', '2026-11-01T10:00:00-03:00', 1000),
    registro('nuevo-aca', '2026-11-01T20:00:00-03:00', 2000),
    registro('solo-aca'),
  ];
  const delRespaldo = [
    registro('igual'),
    registro('viejo-aca', '2026-11-01T15:00:00-03:00', 1500), // el respaldo es más nuevo
    registro('nuevo-aca', '2026-11-01T12:00:00-03:00', 9999), // el respaldo es más viejo
    registro('solo-en-respaldo'),
  ];

  const { registros, agregados, actualizados, sin_cambios } = unirRegistros(actuales, delRespaldo);
  const montos = Object.fromEntries(registros.map((r) => [r.id, r.datos.monto]));

  assert.deepEqual({ agregados, actualizados, sin_cambios }, { agregados: 1, actualizados: 1, sin_cambios: 2 });
  assert.deepEqual(montos, {
    igual: 3500,
    'viejo-aca': 1500,
    'nuevo-aca': 2000,
    'solo-aca': 3500,
    'solo-en-respaldo': 3500,
  });
});

test('unirRegistros no cambia las listas que recibe', () => {
  const actuales = [registro('a')];
  unirRegistros(actuales, [registro('b')]);
  assert.equal(actuales.length, 1);
});

test('importar el mismo respaldo dos veces no duplica nada', async () => {
  const storage = storageFalso();
  const almacen = crearAlmacen(storage);
  const archivo = new Blob([armarRespaldo([registro('a'), registro('b')], MOMENTO)]);

  assert.deepEqual(await importarRespaldo(archivo, almacen), { agregados: 2, actualizados: 0, sin_cambios: 0 });
  assert.deepEqual(await importarRespaldo(archivo, almacen), { agregados: 0, actualizados: 0, sin_cambios: 2 });
  assert.equal(almacen.leerTodos().length, 2);
});

test('si el archivo no sirve, no se cambia nada de lo guardado', async () => {
  const storage = storageFalso();
  const almacen = crearAlmacen(storage);
  almacen.guardarTodos([registro('a')]);
  const antes = storage.getItem(CLAVE);

  await assert.rejects(importarRespaldo(new Blob(['basura']), almacen), /no es un respaldo/);
  assert.equal(storage.getItem(CLAVE), antes);
});

test('tocaRespaldo: nunca hecho, o 7 días o más', () => {
  assert.equal(tocaRespaldo(null, '2026-11-01'), true);
  assert.equal(tocaRespaldo('2026-11-01T22:00:00-03:00', '2026-11-07'), false); // 6 días
  assert.equal(tocaRespaldo('2026-11-01T22:00:00-03:00', '2026-11-08'), true); // 7 días
});

test('el almacén recuerda cuándo fue el último respaldo', () => {
  const almacen = crearAlmacen(storageFalso());
  assert.equal(almacen.leerUltimoRespaldo(), null);
  almacen.guardarUltimoRespaldo(MOMENTO);
  assert.equal(almacen.leerUltimoRespaldo(), MOMENTO);
});
