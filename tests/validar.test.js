import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarFinanza, validarEjercicio, validarTiempo } from '../js/validar.js';

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
    camposConError(egreso({ tipo: 'ingreso', categoria: 'familia', medio: 'efectivo' })),
    [],
  );
  assert.deepEqual(camposConError(egreso({ monto: 0.29, proyecto: 'P05', detalle: '' })), []); // el detalle es opcional
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

test('el detalle es opcional', () => {
  assert.deepEqual(camposConError(egreso({ detalle: '' })), []);
  assert.deepEqual(camposConError(egreso({ detalle: '   ' })), []);
});

test('sin monto, el mensaje pide escribirlo', () => {
  const [error] = validarFinanza(egreso({ monto: null }), HOY);
  assert.equal(error.mensaje, 'Escribí el monto (por ejemplo, 3.500 o 3500,50).');
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
  assert.deepEqual(camposConError(egreso({ moneda: 'USD' })), ['moneda']); // desde el 14/11/2026, sólo pesos
  assert.deepEqual(camposConError(egreso({ medio: 'transferencia' })), ['medio']); // sólo efectivo y débito
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
  assert.deepEqual(camposConError({ fecha: HOY, datos: vacio }), ['categoria', 'monto', 'medio']);
});

// ---------- Deporte ----------

/** Una corrida válida; cada prueba cambia un solo dato. */
function sesion(cambios = {}, fecha = HOY) {
  return {
    fecha,
    datos: { actividad: 'correr', minutos: 32, km: 3.2, detalle: '', ejercicios: [], nota: '', ...cambios },
  };
}

function camposDeporte(registro) {
  return validarEjercicio(registro, HOY).map((error) => error.campo);
}

const SENTADILLA = { nombre: 'sentadilla', series: 3, repeticiones: 12, kg: 12.5 };
const FLEXIONES = { nombre: 'flexiones', series: 3, repeticiones: 10, kg: null };

test('deporte: correr, fuerza y otro completos no tienen errores', () => {
  assert.deepEqual(camposDeporte(sesion()), []);
  assert.deepEqual(camposDeporte(sesion({ actividad: 'fuerza', km: null, minutos: 40, ejercicios: [SENTADILLA, FLEXIONES] })), []);
  assert.deepEqual(camposDeporte(sesion({ actividad: 'fuerza', km: null, minutos: 40 })), []); // sin detalle también vale
  assert.deepEqual(camposDeporte(sesion({ actividad: 'otro', km: null, minutos: 90, detalle: 'limpieza del fondo' })), []);
  assert.deepEqual(camposDeporte(sesion({ actividad: 'otro', km: 2, minutos: 25, detalle: 'caminar' })), []);
});

test('deporte: la fecha tiene que existir y no ser futura', () => {
  assert.deepEqual(camposDeporte(sesion({}, '2026-11-02')), ['fecha']);
  assert.deepEqual(camposDeporte(sesion({}, '2026-02-30')), ['fecha']);
});

test('deporte: con una actividad inválida no se revisa el resto', () => {
  assert.deepEqual(camposDeporte(sesion({ actividad: 'natación', minutos: null })), ['actividad']);
});

test('deporte: minutos enteros entre 1 y 600', () => {
  assert.deepEqual(camposDeporte(sesion({ minutos: null })), ['minutos']);
  assert.deepEqual(camposDeporte(sesion({ minutos: 0 })), ['minutos']);
  assert.deepEqual(camposDeporte(sesion({ minutos: 601 })), ['minutos']);
  assert.deepEqual(camposDeporte(sesion({ minutos: 32.5 })), ['minutos']);
});

test('deporte: km obligatorios al correr, prohibidos en fuerza, con límites', () => {
  assert.deepEqual(camposDeporte(sesion({ km: null })), ['km']);
  assert.deepEqual(camposDeporte(sesion({ km: 101 })), ['km']);
  assert.deepEqual(camposDeporte(sesion({ km: 3.255 })), ['km']);
  assert.deepEqual(camposDeporte(sesion({ actividad: 'fuerza', km: 3 })), ['km']);
});

test('deporte: "otro" necesita decir qué fue', () => {
  assert.deepEqual(camposDeporte(sesion({ actividad: 'otro', km: null, detalle: '  ' })), ['detalle']);
});

test('deporte: cada ejercicio de fuerza tiene que estar completo', () => {
  const fuerza = (ejercicios) => sesion({ actividad: 'fuerza', km: null, minutos: 40, ejercicios });
  assert.deepEqual(camposDeporte(fuerza([SENTADILLA, { ...FLEXIONES, nombre: '' }])), ['ejercicio-1']);
  assert.deepEqual(camposDeporte(fuerza([{ ...SENTADILLA, series: null }])), ['ejercicio-0']);
  assert.deepEqual(camposDeporte(fuerza([{ ...SENTADILLA, repeticiones: 0 }])), ['ejercicio-0']);
  assert.deepEqual(camposDeporte(fuerza([{ ...SENTADILLA, kg: 0 }])), ['ejercicio-0']);
  const [error] = validarEjercicio(fuerza([SENTADILLA, { ...FLEXIONES, nombre: '' }]), HOY);
  assert.equal(error.mensaje, 'Ejercicio 2: escribí el nombre.');
});

test('deporte: sólo la fuerza lleva ejercicios, y la nota es corta', () => {
  assert.deepEqual(camposDeporte(sesion({ ejercicios: [SENTADILLA] })), ['actividad']);
  assert.deepEqual(camposDeporte(sesion({ nota: 'x'.repeat(201) })), ['nota']);
});

// ---------- Tiempo ----------

function camposTiempo(datos, fecha = HOY) {
  return validarTiempo({ fecha, datos: { minutos: 90, que: 'GCI', ...datos } }, HOY).map((e) => e.campo);
}

test('tiempo: completo no tiene errores', () => {
  assert.deepEqual(camposTiempo({}), []);
});

test('tiempo: fecha, minutos entre 1 y 960 y en qué fue', () => {
  assert.deepEqual(camposTiempo({}, '2026-11-02'), ['fecha']);
  assert.deepEqual(camposTiempo({ minutos: null }), ['minutos']);
  assert.deepEqual(camposTiempo({ minutos: 0 }), ['minutos']);
  assert.deepEqual(camposTiempo({ minutos: 961 }), ['minutos']);
  assert.deepEqual(camposTiempo({ minutos: 30.5 }), ['minutos']);
  assert.deepEqual(camposTiempo({ que: '  ' }), ['que']);
  assert.deepEqual(camposTiempo({ que: 'x'.repeat(121) }), ['que']);
});
