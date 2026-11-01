import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  segundosPorKm,
  formatearRitmo,
  kilosMovidos,
  repeticionesTotales,
  ultimaSesionDeFuerza,
  nombresDeEjercicios,
  resumenDeSesion,
  lunesDe,
  resumenDeSemana,
  filaSemanalS03,
} from '../js/deporte.js';

const SENTADILLA = { nombre: 'sentadilla', series: 3, repeticiones: 12, kg: 12.5 };
const FLEXIONES = { nombre: 'flexiones', series: 3, repeticiones: 10, kg: null };

/** Una sesión guardada; cada prueba cambia lo que necesita. */
function sesion({ id = 'a', fecha = '2026-11-02', creado = '2026-11-02T08:00:00-03:00', anulado = false, ...datos } = {}) {
  return {
    id,
    clase: 'ejercicio',
    fecha,
    creado,
    anulado,
    datos: { actividad: 'correr', minutos: 32, km: 3.2, detalle: '', ejercicios: [], nota: '', ...datos },
  };
}

test('ritmo: segundos por km y su formato', () => {
  assert.equal(segundosPorKm(32, 3.2), 600);
  assert.equal(formatearRitmo(600), '10:00 min/km');
  assert.equal(formatearRitmo(segundosPorKm(35, 3.5)), '10:00 min/km');
  assert.equal(formatearRitmo(605), '10:05 min/km');
  assert.equal(segundosPorKm(30, 0), null); // sin km no hay ritmo
});

test('kilos movidos: sólo los ejercicios con peso', () => {
  assert.equal(kilosMovidos([SENTADILLA, FLEXIONES]), 450); // 3 × 12 × 12,5
  assert.equal(kilosMovidos([FLEXIONES]), 0);
  assert.equal(kilosMovidos([]), 0);
});

test('repeticiones totales: con y sin peso', () => {
  assert.equal(repeticionesTotales([SENTADILLA, FLEXIONES]), 66); // 36 + 30
});

test('ultimaSesionDeFuerza: la más nueva con ejercicios, como copia', () => {
  const vieja = sesion({ id: 'v', actividad: 'fuerza', km: null, creado: '2026-11-02T08:00:00-03:00', ejercicios: [FLEXIONES] });
  const nueva = sesion({ id: 'n', actividad: 'fuerza', km: null, creado: '2026-11-03T08:00:00-03:00', ejercicios: [SENTADILLA] });
  const sinDetalle = sesion({ id: 's', actividad: 'fuerza', km: null, creado: '2026-11-04T08:00:00-03:00', ejercicios: [] });
  const anulada = sesion({ id: 'x', actividad: 'fuerza', km: null, creado: '2026-11-05T08:00:00-03:00', ejercicios: [FLEXIONES], anulado: true });

  const ejercicios = ultimaSesionDeFuerza([vieja, nueva, sinDetalle, anulada, sesion()]);
  assert.deepEqual(ejercicios, [SENTADILLA]);
  ejercicios[0].kg = 99; // cambiar la copia…
  assert.equal(nueva.datos.ejercicios[0].kg, 12.5); // …no cambia lo guardado
  assert.deepEqual(ultimaSesionDeFuerza([sesion()]), []);
});

test('nombresDeEjercicios: sin repetir y en orden', () => {
  const lista = [
    sesion({ actividad: 'fuerza', km: null, ejercicios: [SENTADILLA, FLEXIONES] }),
    sesion({ actividad: 'fuerza', km: null, ejercicios: [{ ...FLEXIONES }, { nombre: 'dominadas', series: 3, repeticiones: 5, kg: null }] }),
  ];
  assert.deepEqual(nombresDeEjercicios(lista), ['dominadas', 'flexiones', 'sentadilla']);
});

test('resumenDeSesion: correr, fuerza y otro', () => {
  assert.equal(resumenDeSesion(sesion().datos), 'correr · 3,2 km · 32 min · 10:00 min/km');

  const fuerza = sesion({ actividad: 'fuerza', km: null, minutos: 40, ejercicios: [SENTADILLA, FLEXIONES], nota: 'bien' }).datos;
  assert.equal(
    resumenDeSesion(fuerza),
    'fuerza · 40 min · sentadilla 3x12 12,5 kg; flexiones 3x10 · 450 kg movidos · nota: bien',
  );
  assert.equal(resumenDeSesion(fuerza, { corto: true }), 'fuerza · 40 min · 2 ejercicios · 450 kg movidos');

  const otro = sesion({ actividad: 'otro', km: null, minutos: 90, detalle: 'limpieza del fondo' }).datos;
  assert.equal(resumenDeSesion(otro), 'otro · limpieza del fondo · 90 min');
});

test('lunesDe: el lunes de la semana, de lunes a domingo', () => {
  assert.equal(lunesDe('2026-11-02'), '2026-11-02'); // lunes
  assert.equal(lunesDe('2026-11-05'), '2026-11-02'); // jueves
  assert.equal(lunesDe('2026-11-08'), '2026-11-02'); // domingo: todavía es la misma semana
  assert.equal(lunesDe('2026-11-01'), '2026-10-26'); // domingo 01/11: semana anterior
  assert.equal(lunesDe('2027-01-01'), '2026-12-28'); // cruza el año
});

test('resumenDeSemana: cuenta sólo esa semana, sin anuladas', () => {
  const lista = [
    sesion({ fecha: '2026-11-02', km: 3.2, minutos: 32 }),
    sesion({ fecha: '2026-11-03', km: 3.3, minutos: 33 }),
    sesion({ fecha: '2026-11-03', actividad: 'fuerza', km: null, minutos: 40 }),
    sesion({ fecha: '2026-11-07', actividad: 'otro', km: 2, minutos: 25, detalle: 'caminar' }),
    sesion({ fecha: '2026-11-08', km: 3.1, minutos: 31, anulado: true }), // anulada
    sesion({ fecha: '2026-11-09', km: 3.5, minutos: 35 }), // la semana siguiente
  ];
  assert.deepEqual(resumenDeSemana(lista, '2026-11-02'), { corridas: 2, fuerza: 1, km: 6.5, minutos: 130 });
});

test('filaSemanalS03: la fila de Métricas, con el peso vacío', () => {
  assert.equal(
    filaSemanalS03({ corridas: 3, fuerza: 2, km: 9.6, minutos: 176 }, '2026-11-02'),
    '| 02/11/2026 | 3 | 2 | 9,6 | | 2,9 h de entrenamiento |',
  );
});
