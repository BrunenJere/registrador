import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerMonto } from '../js/numeros.js';

test('lee montos con punto de miles y coma decimal', () => {
  assert.equal(leerMonto('3500'), 3500);
  assert.equal(leerMonto('3.500'), 3500);
  assert.equal(leerMonto('3500,50'), 3500.5);
  assert.equal(leerMonto('3.500,5'), 3500.5);
  assert.equal(leerMonto('1.234.567,89'), 1234567.89);
  assert.equal(leerMonto('0,50'), 0.5);
});

test('ignora espacios y el signo $', () => {
  assert.equal(leerMonto('$ 12.000'), 12000);
  assert.equal(leerMonto('  200000 '), 200000);
  assert.equal(leerMonto('12 000'), 12000); // espacio duro, el que a veces pega el celular
});

test('rechaza lo que no tiene forma de monto', () => {
  assert.equal(leerMonto(''), null);
  assert.equal(leerMonto('abc'), null);
  assert.equal(leerMonto('-5'), null);
  assert.equal(leerMonto('3500.'), null);
  assert.equal(leerMonto(',5'), null);
});

test('rechaza los casos dudosos en vez de adivinar', () => {
  assert.equal(leerMonto('3.5'), null); // ¿3,5 o 3.500?
  assert.equal(leerMonto('35.00'), null); // un grupo de miles tiene 3 dígitos
  assert.equal(leerMonto('1234.567'), null); // antes del primer punto van de 1 a 3 dígitos
  assert.equal(leerMonto('1,234'), null); // más de 2 decimales
});

test('rechaza el cero', () => {
  assert.equal(leerMonto('0'), null);
  assert.equal(leerMonto('0,00'), null);
});
