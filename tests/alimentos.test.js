import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partirLinea, leerDecimal, leerTablaCSV, buscarAlimento, valoresPorPorciones } from '../js/alimentos.js';

const BANANA = { alimento: 'Banana', porcion: '1 unidad', kcal: 105, proteinas: 1.3, carbohidratos: 27, grasas: 0.4 };

test('partirLinea respeta las comillas', () => {
  assert.deepEqual(partirLinea('a,b, c ', ','), ['a', 'b', 'c']);
  assert.deepEqual(partirLinea('"pan, lactal";2', ';'), ['pan, lactal', '2']);
  assert.deepEqual(partirLinea('"el ""chino""",1', ','), ['el "chino"', '1']);
});

test('leerDecimal: coma o punto decimal, sin miles, de 0 en adelante', () => {
  assert.equal(leerDecimal('12,5'), 12.5);
  assert.equal(leerDecimal('12.5'), 12.5);
  assert.equal(leerDecimal('0'), 0);
  assert.equal(leerDecimal(' 105 '), 105);
  assert.equal(leerDecimal(''), null);
  assert.equal(leerDecimal('-3'), null);
  assert.equal(leerDecimal('1.234,5'), null);
  assert.equal(leerDecimal('abc'), null);
});

test('leerTablaCSV: con comas (Google Sheets)', () => {
  const csv = 'alimento,porcion,kcal,proteinas,carbohidratos,grasas\nBanana,1 unidad,105,1.3,27,0.4\n';
  assert.deepEqual(leerTablaCSV(csv), { alimentos: [BANANA], errores: [] });
});

test('leerTablaCSV: con punto y coma, coma decimal, tildes y columnas en otro orden (Excel)', () => {
  const csv = '﻿Alimento;Porción;Proteínas;Carbohidratos;Grasas;Kcal\r\nBanana;1 unidad;1,3;27;0,4;105\r\n\r\n';
  assert.deepEqual(leerTablaCSV(csv), { alimentos: [BANANA], errores: [] });
});

test('leerTablaCSV: sin porción usa "1 porción"', () => {
  const csv = 'alimento,porcion,kcal,proteinas,carbohidratos,grasas\nMate,,0,0,0,0';
  assert.equal(leerTablaCSV(csv).alimentos[0].porcion, '1 porción');
});

test('leerTablaCSV: si una fila tiene error, no carga nada y dice cuál', () => {
  const csv = [
    'alimento,porcion,kcal,proteinas,carbohidratos,grasas',
    'Banana,1 unidad,105,1.3,27,0.4',
    ',100 g,10,1,1,1',
    'Arroz,100 g,muchas,2,28,0.3',
    'banana,1 unidad,105,1.3,27,0.4',
  ].join('\n');
  const { alimentos, errores } = leerTablaCSV(csv);
  assert.deepEqual(alimentos, []);
  assert.equal(errores.length, 3);
  assert.match(errores[0], /^Fila 3: falta el nombre/);
  assert.match(errores[1], /^Fila 4: «kcal» de Arroz no es un número/);
  assert.match(errores[2], /^Fila 5: «banana» está repetido/);
});

test('leerTablaCSV: avisa si faltan columnas, si está vacío o si sólo tiene títulos', () => {
  assert.deepEqual(leerTablaCSV('alimento,kcal\nBanana,105').errores, ['Faltan columnas en la primera fila: porcion, proteinas, carbohidratos, grasas.']);
  assert.deepEqual(leerTablaCSV('  \n').errores, ['El archivo está vacío.']);
  assert.deepEqual(leerTablaCSV('alimento,porcion,kcal,proteinas,carbohidratos,grasas').errores, ['La tabla no tiene alimentos: sólo la fila de títulos.']);
});

test('buscarAlimento: sin importar mayúsculas ni tildes', () => {
  const tabla = [BANANA, { ...BANANA, alimento: 'Pollo al horno' }];
  assert.equal(buscarAlimento(tabla, 'banana')?.alimento, 'Banana');
  assert.equal(buscarAlimento(tabla, ' POLLO al hórno ')?.alimento, 'Pollo al horno');
  assert.equal(buscarAlimento(tabla, 'manzana'), null);
});

test('valoresPorPorciones multiplica y redondea a un decimal', () => {
  assert.deepEqual(valoresPorPorciones(BANANA, 2), { kcal: 210, proteinas: 2.6, carbohidratos: 54, grasas: 0.8 });
  assert.deepEqual(valoresPorPorciones(BANANA, 0.5), { kcal: 52.5, proteinas: 0.7, carbohidratos: 13.5, grasas: 0.2 });
});
