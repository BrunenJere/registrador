import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearAlmacen, CLAVE, pedirPersistencia } from '../js/almacen.js';
import { pendientes } from '../js/exportar.js';

/** Un almacenamiento falso, en memoria, con lo mismo que usa la app de localStorage. */
function storageFalso(textoInicial) {
  const datos = new Map();
  if (textoInicial !== undefined) datos.set(CLAVE, textoInicial);
  return {
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => datos.set(clave, String(valor)),
    datos,
  };
}

const MOMENTO = '2026-11-01T10:00:00-03:00';
const MAS_TARDE = '2026-11-01T22:00:00-03:00';

/** Lo que carga el formulario. */
function entrada(cambios = {}) {
  return {
    clase: 'finanza',
    fecha: '2026-11-01',
    datos: {
      tipo: 'egreso',
      categoria: 'comida',
      detalle: 'súper',
      monto: 3500,
      moneda: 'ARS',
      medio: 'débito',
      proyecto: '',
      ...cambios,
    },
  };
}

/** Cuántos pendientes hay de cada clase. */
function contar(almacen) {
  const p = pendientes(almacen.leerTodos());
  return { nuevos: p.nuevos.length, corregidos: p.corregidos.length, anulados: p.anulados.length };
}

test('sin nada guardado, la lista está vacía', () => {
  assert.deepEqual(crearAlmacen(storageFalso()).leerTodos(), []);
});

test('agregar arma el registro completo y queda guardado', () => {
  const storage = storageFalso();
  const r = crearAlmacen(storage).agregar(entrada(), MOMENTO);

  assert.equal(typeof r.id, 'string');
  assert.equal(r.version, 1);
  assert.equal(r.clase, 'finanza');
  assert.equal(r.creado, MOMENTO);
  assert.equal(r.actualizado, MOMENTO);
  assert.equal(r.exportado, null);
  assert.equal(r.exportado_como, null);
  assert.equal(r.anulado, false);
  // Otro almacén sobre el mismo almacenamiento lo encuentra: quedó guardado, no sólo en memoria.
  assert.deepEqual(crearAlmacen(storage).leerTodos(), [r]);
});

test('cada registro tiene un id distinto', () => {
  const almacen = crearAlmacen(storageFalso());
  const a = almacen.agregar(entrada(), MOMENTO);
  const b = almacen.agregar(entrada(), MOMENTO);
  assert.notEqual(a.id, b.id);
});

test('editar cambia fecha, datos y actualizado; id y creado no', () => {
  const almacen = crearAlmacen(storageFalso());
  const r = almacen.agregar(entrada(), MOMENTO);
  const editado = almacen.editar(r.id, { ...entrada({ monto: 4500 }), fecha: '2026-10-31' }, MAS_TARDE);

  assert.equal(editado.datos.monto, 4500);
  assert.equal(editado.fecha, '2026-10-31');
  assert.equal(editado.actualizado, MAS_TARDE);
  assert.equal(editado.id, r.id);
  assert.equal(editado.creado, MOMENTO);
});

test('editar un registro exportado lo deja como corregido', () => {
  const almacen = crearAlmacen(storageFalso());
  const r = almacen.agregar(entrada(), MOMENTO);
  almacen.marcarExportados([r.id], MOMENTO);
  almacen.editar(r.id, entrada({ monto: 4500 }), MAS_TARDE);
  assert.deepEqual(contar(almacen), { nuevos: 0, corregidos: 1, anulados: 0 });
});

test('editar avisa si el registro no existe o está anulado', () => {
  const almacen = crearAlmacen(storageFalso());
  assert.throws(() => almacen.editar('no-existe', entrada()), /No se encontró/);

  const r = almacen.agregar(entrada(), MOMENTO);
  almacen.marcarExportados([r.id], MOMENTO);
  almacen.borrar(r.id, MAS_TARDE);
  assert.throws(() => almacen.editar(r.id, entrada()), /anulado/);
});

test('borrar un registro nunca exportado lo hace desaparecer', () => {
  const almacen = crearAlmacen(storageFalso());
  const r = almacen.agregar(entrada(), MOMENTO);
  almacen.borrar(r.id, MAS_TARDE);
  assert.deepEqual(almacen.leerTodos(), []);
});

test('borrar un registro exportado lo deja anulado, no lo saca', () => {
  const almacen = crearAlmacen(storageFalso());
  const r = almacen.agregar(entrada(), MOMENTO);
  almacen.marcarExportados([r.id], MOMENTO);
  almacen.borrar(r.id, MAS_TARDE);

  const [guardado] = almacen.leerTodos();
  assert.equal(guardado.anulado, true);
  assert.equal(guardado.actualizado, MAS_TARDE);
  assert.deepEqual(contar(almacen), { nuevos: 0, corregidos: 0, anulados: 1 });
});

test('marcarExportados deja todo al día y un anulado se avisa una sola vez', () => {
  const almacen = crearAlmacen(storageFalso());
  const a = almacen.agregar(entrada(), MOMENTO);
  const b = almacen.agregar(entrada({ detalle: 'verdulería' }), MOMENTO);
  almacen.marcarExportados([a.id, b.id], MOMENTO);
  assert.deepEqual(contar(almacen), { nuevos: 0, corregidos: 0, anulados: 0 });

  almacen.borrar(b.id, MAS_TARDE);
  almacen.marcarExportados([b.id], MAS_TARDE);
  assert.deepEqual(contar(almacen), { nuevos: 0, corregidos: 0, anulados: 0 });
  assert.equal(almacen.leerTodos()[1].exportado_como, null);
});

test('marcarExportados no cambia actualizado', () => {
  const almacen = crearAlmacen(storageFalso());
  const r = almacen.agregar(entrada(), MOMENTO);
  almacen.marcarExportados([r.id], MAS_TARDE);
  assert.equal(almacen.leerTodos()[0].actualizado, MOMENTO);
});

test('deshacerExportacion vuelve a dejarlos pendientes', () => {
  const almacen = crearAlmacen(storageFalso());
  const r = almacen.agregar(entrada(), MOMENTO);
  const copia = almacen.marcarExportados([r.id], MOMENTO);
  almacen.deshacerExportacion(copia);

  const [guardado] = almacen.leerTodos();
  assert.equal(guardado.exportado, null);
  assert.deepEqual(contar(almacen), { nuevos: 1, corregidos: 0, anulados: 0 });
});

test('con los datos dañados avisa y no pisa nada', () => {
  const storage = storageFalso('{esto no es JSON');
  const almacen = crearAlmacen(storage);
  assert.throws(() => almacen.leerTodos(), /dañados/);
  assert.throws(() => almacen.agregar(entrada()), /dañados/);
  assert.equal(storage.datos.get(CLAVE), '{esto no es JSON'); // quedó como estaba
});

test('sin espacio avisa con un mensaje claro', () => {
  const storage = storageFalso();
  storage.setItem = () => {
    throw new DOMException('lleno', 'QuotaExceededError');
  };
  assert.throws(() => crearAlmacen(storage).agregar(entrada()), /No queda espacio/);
});

test('pedirPersistencia da false donde no se puede pedir', async () => {
  assert.equal(await pedirPersistencia(), false); // Node no tiene navigator.storage
});

test('agregar guarda la clase que recibe', () => {
  const almacen = crearAlmacen(storageFalso());
  const sesion = almacen.agregar(
    { clase: 'ejercicio', fecha: '2026-11-01', datos: { actividad: 'correr', minutos: 32, km: 3.2, detalle: '', ejercicios: [], nota: '' } },
    MOMENTO,
  );
  assert.equal(sesion.clase, 'ejercicio');
  assert.equal(almacen.leerTodos()[0].datos.km, 3.2);
});
