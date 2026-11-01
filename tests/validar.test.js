import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarFinanza } from '../js/validar.js';

const HOY = '2026-11-01';

/** Un egreso válido; cada prueba cambia un solo dato. */
function egreso(cambios = {}, fecha = HOY) {
  return {
    fecha,
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

/** Los campos con error, para comparar sin depender del texto exacto del mensaje. */
function camposConError(registro) {
  return validarFinanza(registro, HOY).map((error) => error.campo);
}

test('un egreso y un ingreso completos no tienen errores', () => {
  assert.deepEqual(camposConError(egreso()), []);
  assert.deepEqual(
    camposConError(egreso({ tipo: 'ingreso', categoria: 'familia', medio: 'transferencia' })),
    [],
  );
  assert.deepEqual(camposConError(egreso({ moneda: 'USD', monto: 0.29, proyecto: 'P05' })), []);
});

test('la fecha tiene que existir y no ser futura', () => {
  assert.deepEqual(camposConError(egreso({}, '2026-02-30')), ['fecha']);
  assert.deepEqual(camposConError(egreso({}, '2026-11-02')), ['fecha']);
  assert.deepEqual(camposConError(egreso({}, '2026-10-31')), []); // un día pasado, sí
});

test('la categoría tiene que corresponder al tipo', () => {
  assert.deepEqual(camposConError(egreso({ categoria: 'sueldo' })), ['categoria']);
  assert.deepEqual(camposConError(egreso({ categoria: '' })), ['categoria']);
  const [error] = validarFinanza(egreso({ categoria: 'sueldo' }), HOY);
  assert.equal(error.mensaje, '«sueldo» no es una categoría de egreso.');
});

test('con un tipo inválido no se revisa la categoría', () => {
  assert.deepEqual(camposConError(egreso({ tipo: 'gasto' })), ['tipo']);
});

test('el detalle no puede estar vacío', () => {
  assert.deepEqual(camposConError(egreso({ detalle: '' })), ['detalle']);
  assert.deepEqual(camposConError(egreso({ detalle: '   ' })), ['detalle']);
});

test('el monto tiene que ser mayor que 0 y tener hasta 2 decimales', () => {
  assert.deepEqual(camposConError(egreso({ monto: null })), ['monto']); // leerMonto no pudo leerlo
  assert.deepEqual(camposConError(egreso({ monto: 0 })), ['monto']);
  assert.deepEqual(camposConError(egreso({ monto: -5 })), ['monto']);
  assert.deepEqual(camposConError(egreso({ monto: 1.234 })), ['monto']);
  assert.deepEqual(camposConError(egreso({ monto: 3500.5 })), []);
});

test('moneda y medio tienen que estar en su lista', () => {
  assert.deepEqual(camposConError(egreso({ moneda: 'EUR' })), ['moneda']);
  assert.deepEqual(camposConError(egreso({ medio: 'cheque' })), ['medio']);
  assert.deepEqual(camposConError(egreso({ medio: '' })), ['medio']);
});

test('el proyecto es opcional, pero si está tiene forma de ID', () => {
  assert.deepEqual(camposConError(egreso({ proyecto: 'p05' })), ['proyecto']);
  assert.deepEqual(camposConError(egreso({ proyecto: 'P5' })), ['proyecto']);
  assert.deepEqual(camposConError(egreso({ proyecto: 'C01' })), []);
});

test('informa todos los errores juntos, no sólo el primero', () => {
  const vacio = { tipo: 'egreso', categoria: '', detalle: '', monto: null, moneda: 'ARS', medio: '', proyecto: '' };
  assert.deepEqual(camposConError({ fecha: HOY, datos: vacio }), ['categoria', 'detalle', 'monto', 'medio']);
});
