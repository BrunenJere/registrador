import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearAlmacen, CLAVE_GUARDADOS } from '../js/almacen.js';
import { guardadosDe, buscarGuardado } from '../js/guardados.js';

/** Un almacenamiento falso, en memoria. */
function storageFalso() {
  const datos = new Map();
  return {
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => datos.set(clave, String(valor)),
  };
}

const RUN_EASY = { actividad: 'correr', km: 3, minutos: 30, detalle: '', ejercicios: [] };

test('agregarGuardado guarda con un id y lo lee de nuevo', () => {
  const storage = storageFalso();
  const g = crearAlmacen(storage).agregarGuardado({ clase: 'ejercicio', nombre: ' Run easy ', datos: RUN_EASY });
  assert.equal(typeof g.id, 'string');
  assert.equal(g.nombre, 'Run easy'); // sin los espacios de los bordes
  assert.deepEqual(crearAlmacen(storage).leerGuardados(), [g]);
});

test('agregarGuardado con el mismo nombre (sin importar mayúsculas) reemplaza los datos', () => {
  const almacen = crearAlmacen(storageFalso());
  const primero = almacen.agregarGuardado({ clase: 'ejercicio', nombre: 'Run easy', datos: RUN_EASY });
  const segundo = almacen.agregarGuardado({ clase: 'ejercicio', nombre: 'run EASY', datos: { ...RUN_EASY, km: 4 } });
  assert.equal(segundo.id, primero.id);
  assert.equal(almacen.leerGuardados().length, 1);
  assert.equal(almacen.leerGuardados()[0].datos.km, 4);
});

test('el mismo nombre en otra clase es otro guardado', () => {
  const almacen = crearAlmacen(storageFalso());
  almacen.agregarGuardado({ clase: 'ejercicio', nombre: 'Lunes', datos: RUN_EASY });
  almacen.agregarGuardado({ clase: 'comida', nombre: 'Lunes', datos: { momento: 'almuerzo', items: [] } });
  assert.equal(almacen.leerGuardados().length, 2);
});

test('el guardado es una copia: cambiar los datos originales no lo cambia', () => {
  const almacen = crearAlmacen(storageFalso());
  const datos = { ...RUN_EASY, ejercicios: [{ nombre: 'sentadilla', series: 3, repeticiones: 12, kg: 10 }] };
  almacen.agregarGuardado({ clase: 'ejercicio', nombre: 'Fuerza A', datos });
  datos.ejercicios[0].kg = 99;
  assert.equal(almacen.leerGuardados()[0].datos.ejercicios[0].kg, 10);
});

test('borrarGuardado lo saca', () => {
  const almacen = crearAlmacen(storageFalso());
  const g = almacen.agregarGuardado({ clase: 'ejercicio', nombre: 'Run easy', datos: RUN_EASY });
  almacen.borrarGuardado(g.id);
  assert.deepEqual(almacen.leerGuardados(), []);
});

test('guardados dañados: avisa y no pisa nada', () => {
  const storage = storageFalso();
  storage.setItem(CLAVE_GUARDADOS, '{roto');
  assert.throws(() => crearAlmacen(storage).leerGuardados(), /dañados/);
});

test('guardadosDe: sólo esa clase, por nombre', () => {
  const lista = [
    { id: '1', clase: 'ejercicio', nombre: 'Run largo', datos: {} },
    { id: '2', clase: 'comida', nombre: 'Desayuno', datos: {} },
    { id: '3', clase: 'ejercicio', nombre: 'Fuerza A', datos: {} },
  ];
  assert.deepEqual(guardadosDe(lista, 'ejercicio').map((g) => g.id), ['3', '1']);
});

test('buscarGuardado: por nombre sin importar mayúsculas ni tildes, dentro de la clase', () => {
  const lista = [{ id: '1', clase: 'comida', nombre: 'Almuerzo rápido', datos: {} }];
  assert.equal(buscarGuardado(lista, 'comida', 'almuerzo rapido')?.id, '1');
  assert.equal(buscarGuardado(lista, 'ejercicio', 'almuerzo rapido'), null);
});
