// @ts-check

import { TIPOS, CATEGORIAS_INGRESO, CATEGORIAS_EGRESO, MEDIOS, ACTIVIDADES, METAS_SEMANA, MOMENTOS } from './listas.js';

/** @typedef {'plata' | 'deporte' | 'tiempo' | 'comidas'} ClaseDeAnotar lo que se elige en el menú "Qué" */

/** El formulario de cada opción del menú "Qué". */
const FORMULARIOS = {
  plata: 'formulario',
  deporte: 'formulario-deporte',
  tiempo: 'formulario-tiempo',
  comidas: 'formulario-comidas',
};

// Dibuja y lee la pantalla. No decide nada: recibe los datos ya calculados y avisa a app.js
// cuando se toca algo (con las funciones que app.js le pasa, como alEditar o alBorrar).
//
// Seguridad: el texto que escribe el usuario (el detalle) se pone siempre con textContent,
// nunca con innerHTML. Así, si un detalle tuviera algo como <script>, se muestra como texto y
// no se ejecuta.

// ---------- Ayudas ----------

/**
 * Busca un elemento por id.
 *
 * @param {string} id
 * @returns {HTMLElement}
 */
function $(id) {
  const elemento = document.getElementById(id);
  if (!elemento) throw new Error(`Falta el elemento #${id} en index.html`);
  return elemento;
}

/**
 * Un campo de texto o de fecha por id.
 *
 * @param {string} id
 * @returns {HTMLInputElement}
 */
function campo(id) {
  return /** @type {HTMLInputElement} */ ($(id));
}

/**
 * Crea un elemento con sus atributos y su contenido: el('p', {class: 'meta'}, 'texto').
 *
 * @param {string} etiqueta
 * @param {Record<string, string>} [atributos]
 * @param {...(string | Node)} hijos texto o elementos (el texto entra como texto, nunca como HTML)
 * @returns {HTMLElement}
 */
function el(etiqueta, atributos = {}, ...hijos) {
  const elemento = document.createElement(etiqueta);
  for (const [nombre, valor] of Object.entries(atributos)) {
    elemento.setAttribute(nombre, valor);
  }
  elemento.append(...hijos);
  return elemento;
}

/** "comida" → "Comida". */
function conMayuscula(/** @type {string} */ texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "2026-11-01" → "01/11/2026", el formato de fechas de la bóveda. */
function fechaLegible(/** @type {string} */ fecha) {
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

const DIA_DE_LA_SEMANA = new Intl.DateTimeFormat('es-AR', { weekday: 'long', timeZone: 'UTC' });

/** "2026-11-09" → "lunes 09/11". Se arma en UTC para que la zona horaria no mueva el día. */
function diaConNombre(/** @type {string} */ fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const nombre = DIA_DE_LA_SEMANA.format(new Date(Date.UTC(anio, mes - 1, dia)));
  return `${nombre} ${fechaLegible(fecha).slice(0, 5)}`;
}

const FORMATOS = {
  ARS: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2 }),
  USD: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }),
};

/**
 * 3500 → "$ 3.500". Los registros viejos en USD se siguen mostrando como "US$ 20".
 *
 * @param {number} monto
 * @param {string} moneda
 */
function formatearMonto(monto, moneda) {
  return (moneda === 'USD' ? FORMATOS.USD : FORMATOS.ARS).format(monto);
}

const NUMERO_AR = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

/** Las categorías que corresponden a un tipo. */
function categoriasDe(/** @type {string} */ tipo) {
  return tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;
}

// ---------- Botones de opciones ----------

/**
 * Dibuja un grupo de botones donde se elige uno solo (tipo, categoría, medio, día o semana).
 * El valor elegido queda guardado en el propio contenedor (data-valor).
 *
 * @param {HTMLElement} contenedor
 * @param {readonly string[]} valores
 * @param {string} elegido
 * @param {(valor: string) => void} [alCambiar] se llama cuando se elige otro valor
 */
function dibujarOpciones(contenedor, valores, elegido, alCambiar) {
  contenedor.dataset.valor = elegido;
  contenedor.replaceChildren(
    ...valores.map((valor) => {
      const boton = el(
        'button',
        { type: 'button', role: 'radio', 'aria-checked': String(valor === elegido), 'data-valor': valor },
        conMayuscula(valor),
      );
      boton.addEventListener('click', () => {
        contenedor.dataset.valor = valor;
        for (const otro of contenedor.children) {
          otro.setAttribute('aria-checked', String(otro.getAttribute('data-valor') === valor));
        }
        alCambiar?.(valor);
      });
      return boton;
    }),
  );
}

/** El valor elegido en un grupo de opciones ('' si ninguno). */
function valorElegido(/** @type {string} */ id) {
  return $(id).dataset.valor ?? '';
}

// ---------- Arriba de Anotar: fecha y qué se anota ----------

/** Pone la fecha de arriba de Anotar ("aaaa-mm-dd"). */
export function ponerFecha(/** @type {string} */ fecha) {
  campo('fecha-registro').value = fecha;
}

/** La fecha de arriba de Anotar ("aaaa-mm-dd", o '' si se borró). */
export function leerFecha() {
  return campo('fecha-registro').value;
}

/**
 * Conecta el menú "Qué": cada vez que se elige otra opción, avisa a app.js. Se llama una vez al
 * arrancar.
 *
 * @param {(clase: ClaseDeAnotar) => void} alCambiar
 */
export function conectarMenuClase(alCambiar) {
  const menu = /** @type {HTMLSelectElement} */ ($('clase'));
  menu.addEventListener('change', () => alCambiar(/** @type {ClaseDeAnotar} */ (menu.value)));
}

/**
 * Elige una opción del menú "Qué" y muestra su formulario (y oculta los otros).
 *
 * @param {ClaseDeAnotar} clase
 */
export function elegirClase(clase) {
  /** @type {HTMLSelectElement} */ ($('clase')).value = clase;
  for (const [opcion, id] of Object.entries(FORMULARIOS)) {
    $(id).hidden = opcion !== clase;
  }
}

/** El título de Anotar: "Anotar" o "Editar registro". */
function ponerTitulo(/** @type {boolean} */ editando) {
  $('titulo-formulario').textContent = editando ? 'Editar registro' : 'Anotar';
}

// ---------- Formulario de plata ----------

/**
 * @typedef {object} ValoresFormulario
 * @property {string} tipo
 * @property {string} categoria
 * @property {string} medio
 * @property {string} monto     como texto, tal cual va en el campo
 * @property {string} detalle
 * @property {boolean} editando si se está editando un registro guardado
 */

/**
 * Llena el formulario de plata con estos valores.
 *
 * @param {ValoresFormulario} v
 */
export function dibujarFormulario(v) {
  const categorias = $('opciones-categoria');
  // Al cambiar el tipo, cambian las categorías posibles y la elegida se borra.
  dibujarOpciones($('opciones-tipo'), TIPOS, v.tipo, (tipo) =>
    dibujarOpciones(categorias, categoriasDe(tipo), ''),
  );
  dibujarOpciones(categorias, categoriasDe(v.tipo), v.categoria);
  dibujarOpciones($('opciones-medio'), MEDIOS, v.medio);

  campo('monto').value = v.monto;
  campo('detalle').value = v.detalle;

  ponerTitulo(v.editando);
  $('boton-guardar').textContent = v.editando ? 'Guardar cambios' : 'Guardar';
  $('boton-cancelar').hidden = !v.editando;
  limpiarErrores($('formulario'));
}

/**
 * Lo que está cargado en el formulario de plata. El monto vuelve como texto: lo convierte app.js
 * con leerMonto. Al detalle se le sacan los espacios de los bordes.
 */
export function leerFormulario() {
  return {
    montoTexto: campo('monto').value,
    datos: {
      tipo: valorElegido('opciones-tipo'),
      categoria: valorElegido('opciones-categoria'),
      detalle: campo('detalle').value.trim(),
      medio: valorElegido('opciones-medio'),
    },
  };
}

// ---------- Errores ----------

// Los dos formularios tienen un campo "detalle", así que los errores se buscan siempre DENTRO del
// formulario que corresponde. La fecha es común a los dos y está arriba: su error va aparte.

/** @type {Record<string, Record<string, string>>} dónde poner el foco cuando un campo tiene error */
const FOCO_DE_CAMPO = {
  formulario: {
    tipo: '#opciones-tipo button',
    monto: '#monto',
    categoria: '#opciones-categoria button',
    medio: '#opciones-medio button',
    detalle: '#detalle',
  },
  'formulario-deporte': {
    actividad: '#opciones-actividad button',
    km: '#km',
    minutos: '#minutos',
    detalle: '#detalle-deporte',
  },
  'formulario-tiempo': {
    minutos: '#minutos-tiempo',
    que: '#que-tiempo',
  },
  'formulario-comidas': {
    momento: '#opciones-momento button',
    items: '#boton-agregar-item',
    detalle: '#detalle-comida',
  },
};

/**
 * Muestra cada error al lado de su campo y lleva el foco al primero.
 *
 * @param {import('./tipos.js').ErrorDeValidacion[]} errores
 * @param {'formulario' | 'formulario-deporte' | 'formulario-tiempo' | 'formulario-comidas'} idFormulario
 */
export function mostrarErrores(errores, idFormulario) {
  const formulario = $(idFormulario);
  limpiarErrores(formulario);
  for (const { campo: nombre, mensaje } of errores) {
    const lugar = nombre === 'fecha' ? $('error-fecha') : formulario.querySelector(`[data-error="${nombre}"]`);
    if (lugar && !lugar.textContent) lugar.textContent = mensaje;
  }
  const primero = errores[0] && focoDe(formulario, idFormulario, errores[0].campo);
  if (primero instanceof HTMLElement) {
    primero.focus();
    primero.scrollIntoView({ block: 'center' });
  }
}

/**
 * El elemento donde poner el foco para un campo con error. Un error "ejercicio-1" va al primer
 * campo del segundo ejercicio; uno de fecha, a la fecha de arriba.
 *
 * @param {HTMLElement} formulario
 * @param {string} idFormulario
 * @param {string} nombre
 * @returns {Element | null}
 */
function focoDe(formulario, idFormulario, nombre) {
  if (nombre === 'fecha') return $('fecha-registro');
  // "ejercicio-1" o "item-1": el primer campo de esa fila (las dos usan la clase fila-ejercicio).
  const fila = /^(?:ejercicio|item)-(\d+)$/.exec(nombre);
  if (fila) {
    return formulario.querySelectorAll('.fila-ejercicio')[Number(fila[1])]?.querySelector('input') ?? null;
  }
  const selector = FOCO_DE_CAMPO[idFormulario][nombre];
  return selector ? formulario.querySelector(selector) : null;
}

/** Borra los errores que se ven en un formulario (y el de la fecha de arriba). */
function limpiarErrores(/** @type {HTMLElement} */ formulario) {
  for (const lugar of formulario.querySelectorAll('[data-error]')) lugar.textContent = '';
  $('error-fecha').textContent = '';
}

// ---------- Formulario de deporte ----------

/**
 * Un ejercicio como se escribe en el formulario: todo texto, lo convierte app.js.
 *
 * @typedef {object} EjercicioTexto
 * @property {string} nombre
 * @property {string} series
 * @property {string} repeticiones
 * @property {string} kg
 */

/**
 * @typedef {object} ValoresDeporte
 * @property {string} actividad
 * @property {string} km
 * @property {string} minutos
 * @property {string} detalle
 * @property {EjercicioTexto[]} ejercicios
 * @property {string[]} nombres     los nombres de ejercicios usados antes, para sugerir
 * @property {boolean} editando
 */

/** Lo que pantalla.js necesita de app.js para el formulario de deporte. */
let ritmoDe = /** @type {(km: string, minutos: string) => string} */ (() => '');

/**
 * Llena el formulario de deporte.
 *
 * @param {ValoresDeporte} v
 * @param {(km: string, minutos: string) => string} calcularRitmo da el texto del ritmo ("10:00 min/km") o ''
 */
export function dibujarFormularioDeporte(v, calcularRitmo) {
  ritmoDe = calcularRitmo;
  dibujarOpciones($('opciones-actividad'), ACTIVIDADES, v.actividad, ajustarSegunActividad);

  campo('km').value = v.km;
  campo('minutos').value = v.minutos;
  campo('detalle-deporte').value = v.detalle;

  $('nombres-ejercicios').replaceChildren(...v.nombres.map((nombre) => el('option', { value: nombre })));
  cargarEjercicios(v.ejercicios);

  ponerTitulo(v.editando);
  $('boton-guardar-deporte').textContent = v.editando ? 'Guardar cambios' : 'Guardar';
  $('boton-cancelar-deporte').hidden = !v.editando;
  ajustarSegunActividad(v.actividad);
  actualizarRitmo();
  limpiarErrores($('formulario-deporte'));
}

/**
 * Muestra u oculta campos según la actividad: los km al correr y en "otro", los ejercicios en
 * fuerza, y el detalle pasa a ser obligatorio en "otro".
 */
function ajustarSegunActividad(/** @type {string} */ actividad) {
  $('campo-km').hidden = actividad === 'fuerza';
  $('campo-ejercicios').hidden = actividad !== 'fuerza';
  $('etiqueta-detalle-deporte').textContent = actividad === 'otro' ? 'Qué fue' : 'Detalle (opcional)';
  campo('detalle-deporte').placeholder =
    actividad === 'otro' ? 'caminar, bici, limpiar el fondo…' : 'con Thiago, si dolió algo…';
  campo('km').placeholder = actividad === 'otro' ? 'opcional' : '3,2';
  actualizarRitmo();
}

/** El ritmo, debajo de los minutos, mientras se escribe (sólo al correr). */
function actualizarRitmo() {
  const correr = valorElegido('opciones-actividad') === 'correr';
  $('ritmo').textContent = correr ? ritmoDe(campo('km').value, campo('minutos').value) : '';
}

/**
 * Reemplaza los ejercicios del formulario (lo usa también "Repetir la última sesión").
 *
 * @param {EjercicioTexto[]} ejercicios
 */
export function cargarEjercicios(ejercicios) {
  $('ejercicios').replaceChildren(...ejercicios.map(filaDeEjercicio));
  numerarErroresDeEjercicios();
}

/** Suma un ejercicio vacío y pone el foco en su nombre. */
export function agregarEjercicio() {
  const fila = filaDeEjercicio({ nombre: '', series: '', repeticiones: '', kg: '' });
  $('ejercicios').append(fila);
  numerarErroresDeEjercicios();
  fila.querySelector('input')?.focus();
}

/**
 * Una fila de ejercicio: el nombre (con sugerencias) y, abajo, series, repeticiones, kg y el
 * botón para quitarlo.
 *
 * @param {EjercicioTexto} e
 * @returns {HTMLElement}
 */
function filaDeEjercicio(e) {
  /** @param {string} etiqueta @param {string} clase @param {string} valor @param {string} modo */
  const numero = (etiqueta, clase, valor, modo) => {
    const entrada = el('input', { type: 'text', inputmode: modo, class: clase, 'aria-label': etiqueta });
    /** @type {HTMLInputElement} */ (entrada).value = valor;
    return el('div', {}, el('label', {}, etiqueta), entrada);
  };
  const nombre = el('input', { type: 'text', class: 'nombre', list: 'nombres-ejercicios', placeholder: 'sentadilla, flexiones…', 'aria-label': 'Ejercicio', maxlength: '60' });
  /** @type {HTMLInputElement} */ (nombre).value = e.nombre;

  const quitar = el('button', { type: 'button', class: 'quitar', 'aria-label': 'Quitar ejercicio' }, '✕');
  const fila = el(
    'div',
    { class: 'fila-ejercicio' },
    nombre,
    el(
      'div',
      { class: 'numeros' },
      numero('Series', 'series', e.series, 'numeric'),
      numero('Reps', 'repeticiones', e.repeticiones, 'numeric'),
      numero('Kg', 'kg', e.kg, 'decimal'),
      quitar,
    ),
    el('p', { class: 'error' }),
  );
  quitar.addEventListener('click', () => {
    fila.remove();
    numerarErroresDeEjercicios();
  });
  return fila;
}

/**
 * Cada fila tiene su lugar de error con el número que le corresponde ("ejercicio-0",
 * "ejercicio-1"…), el mismo que usa validarEjercicio. Se vuelven a numerar cada vez que se
 * agrega o se quita una fila.
 */
function numerarErroresDeEjercicios() {
  $('ejercicios')
    .querySelectorAll('.fila-ejercicio')
    .forEach((fila, i) => fila.querySelector('.error')?.setAttribute('data-error', `ejercicio-${i}`));
}

/**
 * Lo cargado en el formulario de deporte, todo como texto: lo convierte app.js. Los ejercicios
 * totalmente vacíos se ignoran.
 */
export function leerFormularioDeporte() {
  const ejercicios = [...$('ejercicios').querySelectorAll('.fila-ejercicio')]
    .map((fila) => {
      const valor = (/** @type {string} */ clase) => /** @type {HTMLInputElement} */ (fila.querySelector(`.${clase}`)).value.trim();
      return { nombre: valor('nombre'), series: valor('series'), repeticiones: valor('repeticiones'), kg: valor('kg') };
    })
    .filter((e) => e.nombre || e.series || e.repeticiones || e.kg);
  return {
    actividad: valorElegido('opciones-actividad'),
    kmTexto: campo('km').value,
    minutosTexto: campo('minutos').value,
    detalle: campo('detalle-deporte').value.trim(),
    ejercicios,
  };
}

/** Conecta lo que se recalcula mientras se escribe. Se llama una vez al arrancar. */
export function conectarFormularioDeporte() {
  campo('km').addEventListener('input', actualizarRitmo);
  campo('minutos').addEventListener('input', actualizarRitmo);
}

// ---------- Formulario de tiempo ----------

/**
 * Llena el formulario de tiempo.
 *
 * @param {{minutos: string, que: string, temas: string[], editando: boolean}} v
 */
export function dibujarFormularioTiempo(v) {
  campo('minutos-tiempo').value = v.minutos;
  campo('que-tiempo').value = v.que;
  $('temas-tiempo').replaceChildren(...v.temas.map((tema) => el('option', { value: tema })));
  ponerTitulo(v.editando);
  $('boton-guardar-tiempo').textContent = v.editando ? 'Guardar cambios' : 'Guardar';
  $('boton-cancelar-tiempo').hidden = !v.editando;
  limpiarErrores($('formulario-tiempo'));
}

/** Lo cargado en el formulario de tiempo; los minutos como texto. */
export function leerFormularioTiempo() {
  return { minutosTexto: campo('minutos-tiempo').value, que: campo('que-tiempo').value.trim() };
}

// ---------- Formulario de comidas ----------

/**
 * Un alimento como se escribe en el formulario: todo texto, lo convierte app.js.
 *
 * @typedef {object} ItemTexto
 * @property {string} alimento
 * @property {string} porciones
 * @property {string} kcal
 * @property {string} proteinas
 * @property {string} carbohidratos
 * @property {string} grasas
 */

/**
 * Lo que pantalla.js necesita de app.js para el formulario de comidas:
 * - buscarEnTabla: si el alimento está en la tabla, sus valores para esas porciones (como texto)
 *   y lo que es una porción; si no, null;
 * - totalDeItems: la línea de totales de la comida ("Total: 650 kcal · …") o ''.
 */
let ayudaComidas = {
  /** @type {(alimento: string, porciones: string) => ({valores: Omit<ItemTexto, 'alimento' | 'porciones'>, porcion: string} | null)} */
  buscarEnTabla: () => null,
  /** @type {(items: ItemTexto[]) => string} */
  totalDeItems: () => '',
};

/**
 * Llena el formulario de comidas.
 *
 * @param {{momento: string, items: ItemTexto[], detalle: string, alimentos: string[], editando: boolean}} v
 * @param {typeof ayudaComidas} ayuda
 */
export function dibujarFormularioComida(v, ayuda) {
  ayudaComidas = ayuda;
  dibujarOpciones($('opciones-momento'), MOMENTOS, v.momento);
  campo('detalle-comida').value = v.detalle;
  $('alimentos-comida').replaceChildren(...v.alimentos.map((nombre) => el('option', { value: nombre })));
  cargarItemsComida(v.items);
  ponerTitulo(v.editando);
  $('boton-guardar-comidas').textContent = v.editando ? 'Guardar cambios' : 'Guardar';
  $('boton-cancelar-comidas').hidden = !v.editando;
  limpiarErrores($('formulario-comidas'));
}

/**
 * Reemplaza los alimentos del formulario (lo usan también los guardados).
 *
 * @param {ItemTexto[]} items
 */
export function cargarItemsComida(items) {
  $('items-comida').replaceChildren(...items.map(filaDeItem));
  numerarErroresDeItems();
  actualizarTotalesComida();
}

/** Suma un alimento vacío (con 1 porción) y pone el foco en su nombre. */
export function agregarItemComida() {
  const fila = filaDeItem({ alimento: '', porciones: '1', kcal: '', proteinas: '', carbohidratos: '', grasas: '' });
  $('items-comida').append(fila);
  numerarErroresDeItems();
  fila.querySelector('input')?.focus();
}

/**
 * Una fila de alimento: el nombre (con sugerencias), porciones y kcal, y los tres macros con el
 * botón para quitarla. Si el nombre está en la tabla, completa los valores para las porciones y
 * los recalcula cuando cambian; después se pueden editar a mano.
 *
 * @param {ItemTexto} item
 * @returns {HTMLElement}
 */
function filaDeItem(item) {
  /** @param {string} etiqueta @param {string} clase @param {string} valor */
  const numero = (etiqueta, clase, valor) => {
    const entrada = el('input', { type: 'text', inputmode: 'decimal', class: clase, 'aria-label': etiqueta });
    /** @type {HTMLInputElement} */ (entrada).value = valor;
    return el('div', {}, el('label', {}, etiqueta), entrada);
  };
  const nombre = el('input', { type: 'text', class: 'nombre', list: 'alimentos-comida', placeholder: 'banana, milanesa…', 'aria-label': 'Alimento', maxlength: '60' });
  /** @type {HTMLInputElement} */ (nombre).value = item.alimento;
  const porcion = el('p', { class: 'ayuda' });
  const quitar = el('button', { type: 'button', class: 'quitar', 'aria-label': 'Quitar alimento' }, '✕');

  const fila = el(
    'div',
    { class: 'fila-ejercicio fila-item' },
    nombre,
    porcion,
    el('div', { class: 'numeros' }, numero('Porciones', 'porciones', item.porciones), numero('Kcal', 'kcal', item.kcal)),
    el(
      'div',
      { class: 'macros' },
      numero('Prot. (g)', 'proteinas', item.proteinas),
      numero('Carb. (g)', 'carbohidratos', item.carbohidratos),
      numero('Grasas (g)', 'grasas', item.grasas),
      quitar,
    ),
    el('p', { class: 'error' }),
  );

  /** @param {string} clase */
  const entrada = (clase) => /** @type {HTMLInputElement} */ (fila.querySelector(`.${clase}`));
  const completarDesdeTabla = () => {
    const encontrado = ayudaComidas.buscarEnTabla(entrada('nombre').value, entrada('porciones').value);
    porcion.textContent = encontrado ? `De la tabla · 1 porción = ${encontrado.porcion}` : '';
    if (encontrado) {
      for (const [clave, valor] of Object.entries(encontrado.valores)) entrada(clave).value = valor;
    }
    actualizarTotalesComida();
  };
  nombre.addEventListener('change', completarDesdeTabla);
  entrada('porciones').addEventListener('input', completarDesdeTabla);
  for (const clave of ['kcal', 'proteinas', 'carbohidratos', 'grasas']) {
    entrada(clave).addEventListener('input', actualizarTotalesComida);
  }
  quitar.addEventListener('click', () => {
    fila.remove();
    numerarErroresDeItems();
    actualizarTotalesComida();
  });
  // Al cargar una fila con un alimento de la tabla, se muestra qué es una porción.
  if (item.alimento) {
    const encontrado = ayudaComidas.buscarEnTabla(item.alimento, item.porciones);
    porcion.textContent = encontrado ? `De la tabla · 1 porción = ${encontrado.porcion}` : '';
  }
  return fila;
}

/** Cada alimento tiene su lugar de error ("item-0", "item-1"…), como en validarComida. */
function numerarErroresDeItems() {
  $('items-comida')
    .querySelectorAll('.fila-item')
    .forEach((fila, i) => fila.querySelector(':scope > .error')?.setAttribute('data-error', `item-${i}`));
}

/** Los totales de la comida, debajo de los alimentos, mientras se escribe. */
function actualizarTotalesComida() {
  $('totales-comida').textContent = ayudaComidas.totalDeItems(leerItemsComida());
}

/** Los alimentos cargados, como texto; los totalmente vacíos se ignoran. */
function leerItemsComida() {
  return [...$('items-comida').querySelectorAll('.fila-item')]
    .map((fila) => {
      const valor = (/** @type {string} */ clase) => /** @type {HTMLInputElement} */ (fila.querySelector(`.${clase}`)).value.trim();
      return {
        alimento: valor('nombre'),
        porciones: valor('porciones'),
        kcal: valor('kcal'),
        proteinas: valor('proteinas'),
        carbohidratos: valor('carbohidratos'),
        grasas: valor('grasas'),
      };
    })
    .filter((i) => i.alimento || i.kcal || i.proteinas || i.carbohidratos || i.grasas);
}

/** Lo cargado en el formulario de comidas, todo como texto. */
export function leerFormularioComida() {
  return {
    momento: valorElegido('opciones-momento'),
    items: leerItemsComida(),
    detalle: campo('detalle-comida').value.trim(),
  };
}

// ---------- Guardados ----------

/**
 * Llena el menú de guardados de deporte o de comidas.
 *
 * @param {'deporte' | 'comidas'} donde
 * @param {{id: string, nombre: string}[]} guardados ya ordenados
 * @param {string} [elegido] el id que queda elegido ('' para ninguno)
 */
export function dibujarGuardados(donde, guardados, elegido = '') {
  const menu = /** @type {HTMLSelectElement} */ ($(`guardados-${donde}`));
  const vacio = guardados.length === 0 ? 'Todavía no hay guardados' : 'Elegir un guardado…';
  menu.replaceChildren(el('option', { value: '' }, vacio), ...guardados.map((g) => el('option', { value: g.id }, g.nombre)));
  menu.value = elegido;
  $(`borrar-guardado-${donde}`).hidden = elegido === '';
}

/**
 * Conecta el menú y los botones de guardados. Se llama una vez al arrancar, por cada formulario.
 *
 * @param {'deporte' | 'comidas'} donde
 * @param {{alElegir: (id: string) => void, alGuardarComo: () => void, alBorrar: (id: string) => void}} acciones
 */
export function conectarGuardados(donde, { alElegir, alGuardarComo, alBorrar }) {
  const menu = /** @type {HTMLSelectElement} */ ($(`guardados-${donde}`));
  menu.addEventListener('change', () => {
    $(`borrar-guardado-${donde}`).hidden = menu.value === '';
    if (menu.value) alElegir(menu.value);
  });
  $(`guardar-como-${donde}`).addEventListener('click', alGuardarComo);
  $(`borrar-guardado-${donde}`).addEventListener('click', () => {
    if (menu.value) alBorrar(menu.value);
  });
}

// ---------- Registros ----------

/**
 * @typedef {object} Acciones lo que hacer al tocar Editar o Borrar en un registro
 * @property {(id: string) => void} alEditar
 * @property {(id: string) => void} alBorrar
 */

/**
 * Dibuja Día | Semana y la fecha de Registros.
 *
 * @param {'día' | 'semana'} vista
 * @param {string} fecha "aaaa-mm-dd"
 * @param {(vista: 'día' | 'semana') => void} alCambiarVista
 */
export function dibujarVistaRegistros(vista, fecha, alCambiarVista) {
  dibujarOpciones($('opciones-vista'), ['día', 'semana'], vista, (valor) =>
    alCambiarVista(/** @type {'día' | 'semana'} */ (valor)),
  );
  campo('dia').value = fecha;
}

/** La fecha elegida en Registros ("aaaa-mm-dd", o '' si se borró). */
export function leerFechaRegistros() {
  return campo('dia').value;
}

/**
 * Cómo describir cada clase en una línea (las funciones vienen de app.js).
 *
 * @typedef {object} Resumidores
 * @property {(datos: any) => string} sesion  "correr · 3,2 km · 32 min · 10:00 min/km"
 * @property {(datos: any) => string} comida  "almuerzo · milanesa x1 · 600 kcal"
 */

/**
 * @typedef {object} TotalesDeComidas
 * @property {number} kcal
 * @property {number} proteinas
 * @property {number} carbohidratos
 * @property {number} grasas
 * @property {number} sinValores
 */

/**
 * Registros, vista de un día: la plata del día; el deporte (la semana arriba y las sesiones del
 * día abajo); y, si hay, el tiempo y las comidas del día.
 *
 * @param {object} p
 * @param {import('./tipos.js').Registro[]} p.plata los de plata del día, ya ordenados
 * @param {ReturnType<typeof import('./resumen.js').totales>} p.totales
 * @param {string} p.lunes el lunes de esa semana
 * @param {{corridas: number, fuerza: number, km: number, minutos: number}} p.semana
 * @param {import('./tipos.js').Registro[]} p.sesiones las de deporte del día, ya ordenadas
 * @param {import('./tipos.js').Registro[]} p.tiempo los de tiempo del día
 * @param {import('./tipos.js').Registro[]} p.comidas las comidas del día
 * @param {TotalesDeComidas} p.totalesComidas
 * @param {Resumidores} p.resumir
 * @param {Acciones} p.acciones
 */
export function dibujarRegistrosDia({ plata, totales, lunes, semana, sesiones, tiempo, comidas, totalesComidas, resumir, acciones }) {
  mostrarListasDe('día');
  $('titulo-plata').textContent = 'Plata del día';
  dibujarTotales(totales);
  dibujarSemanaDeporte(lunes, semana);
  dibujarLista($('lista'), plata.map((r) => itemDePlata(r, acciones)), 'No hay plata anotada este día.');
  dibujarLista(
    $('lista-deporte'),
    sesiones.map((r) => itemDeSesion(r, resumir.sesion, acciones)),
    'No hay sesiones este día.',
  );

  $('bloque-tiempo').hidden = tiempo.length === 0;
  $('titulo-tiempo').textContent = 'Tiempo del día';
  const minutos = tiempo.reduce((suma, r) => suma + (r.datos.minutos ?? 0), 0);
  $('totales-tiempo').replaceChildren(total('Total', `${NUMERO_AR.format(minutos / 60)} h`));
  dibujarLista($('lista-tiempo'), tiempo.map((r) => itemDeTiempo(r, acciones)), '');

  $('bloque-comidas').hidden = comidas.length === 0;
  $('titulo-comidas').textContent = 'Comidas del día';
  dibujarTotalesComidas(totalesComidas);
  dibujarLista($('lista-comidas'), comidas.map((r) => itemDeComida(r, resumir.comida, acciones)), '');
}

/**
 * Registros, vista de una semana (de lunes a domingo): los totales de plata, el resumen de
 * deporte, el tiempo por tema y las comidas (si hay), y todos los registros agrupados por día.
 *
 * @param {object} p
 * @param {string} p.lunes
 * @param {ReturnType<typeof import('./resumen.js').totales>} p.totales los de toda la semana
 * @param {{corridas: number, fuerza: number, km: number, minutos: number}} p.semana
 * @param {{que: string, minutos: number}[]} p.porTema el tiempo de la semana por tema
 * @param {TotalesDeComidas} p.totalesComidas los de la semana
 * @param {number} p.diasConComidas para el promedio por día
 * @param {import('./tipos.js').Registro[]} p.registros los de la semana, en orden
 * @param {Resumidores} p.resumir
 * @param {Acciones} p.acciones
 */
export function dibujarRegistrosSemana({ lunes, totales, semana, porTema, totalesComidas, diasConComidas, registros, resumir, acciones }) {
  mostrarListasDe('semana');
  $('titulo-plata').textContent = `Plata de la semana del ${fechaLegible(lunes)}`;
  dibujarTotales(totales);
  dibujarSemanaDeporte(lunes, semana);

  $('bloque-tiempo').hidden = porTema.length === 0;
  $('titulo-tiempo').textContent = 'Tiempo de la semana';
  const minutos = porTema.reduce((suma, t) => suma + t.minutos, 0);
  $('totales-tiempo').replaceChildren(
    total('Total', `${NUMERO_AR.format(minutos / 60)} h`),
    ...porTema.slice(0, 5).map((t) => total(t.que, `${NUMERO_AR.format(t.minutos / 60)} h`)), // los 5 temas con más horas
  );

  $('bloque-comidas').hidden = diasConComidas === 0;
  $('titulo-comidas').textContent = 'Comidas de la semana';
  $('totales-comidas').replaceChildren(
    total('Kcal en la semana', NUMERO_AR.format(totalesComidas.kcal)),
    total('Promedio por día', NUMERO_AR.format(diasConComidas > 0 ? totalesComidas.kcal / diasConComidas : 0)),
  );
  $('aviso-comidas').textContent = avisoSinValores(totalesComidas.sinValores);

  const contenedor = $('lista-semana');
  if (registros.length === 0) {
    contenedor.replaceChildren(el('p', { class: 'vacio' }, 'No hay registros esta semana.'));
    return;
  }
  // Agrupa por día: cada vez que cambia la fecha, un título nuevo con su lista.
  /** @type {HTMLElement[]} */
  const bloques = [];
  /** @type {HTMLElement | null} */
  let lista = null;
  let fechaActual = '';
  for (const registro of registros) {
    if (registro.fecha !== fechaActual) {
      fechaActual = registro.fecha;
      lista = el('ul', { class: 'lista' });
      bloques.push(el('h3', { class: 'titulo-dia' }, diaConNombre(fechaActual)), lista);
    }
    lista?.append(itemSegunClase(registro, resumir, acciones));
  }
  contenedor.replaceChildren(...bloques);
}

/** El item de la lista que corresponde a la clase del registro. */
function itemSegunClase(/** @type {import('./tipos.js').Registro} */ registro, /** @type {Resumidores} */ resumir, /** @type {Acciones} */ acciones) {
  if (registro.clase === 'ejercicio') return itemDeSesion(registro, resumir.sesion, acciones);
  if (registro.clase === 'tiempo') return itemDeTiempo(registro, acciones);
  if (registro.clase === 'comida') return itemDeComida(registro, resumir.comida, acciones);
  return itemDePlata(registro, acciones);
}

/** En la vista de día se ven las listas de cada clase; en la de semana, la lista agrupada. */
function mostrarListasDe(/** @type {'día' | 'semana'} */ vista) {
  for (const id of ['lista', 'lista-deporte', 'lista-tiempo', 'lista-comidas']) $(id).hidden = vista !== 'día';
  $('lista-semana').hidden = vista !== 'semana';
  $('titulo-lista-semana').hidden = vista !== 'semana';
}

/** Las tarjetas de kcal y macros de las comidas de un día. */
function dibujarTotalesComidas(/** @type {TotalesDeComidas} */ t) {
  $('totales-comidas').replaceChildren(
    total('Kcal', NUMERO_AR.format(t.kcal)),
    total('Proteínas', `${NUMERO_AR.format(t.proteinas)} g`),
    total('Carbohidratos', `${NUMERO_AR.format(t.carbohidratos)} g`),
    total('Grasas', `${NUMERO_AR.format(t.grasas)} g`),
  );
  $('aviso-comidas').textContent = avisoSinValores(t.sinValores);
}

/** Aclara que el total no está completo si a algún alimento le faltan los valores. */
function avisoSinValores(/** @type {number} */ sinValores) {
  if (sinValores === 0) return '';
  return `${sinValores} alimento${sinValores === 1 ? '' : 's'} sin kcal: el total no los cuenta.`;
}

/**
 * Un registro de tiempo en la lista: en qué fue y los minutos.
 *
 * @param {import('./tipos.js').Registro} registro
 * @param {Acciones} acciones
 */
function itemDeTiempo(registro, acciones) {
  return itemDeLista({
    registro,
    titulo: registro.datos.que,
    meta: 'Tiempo',
    derecha: `${registro.datos.minutos} min`,
    claseDerecha: '',
    acciones,
  });
}

/**
 * Una comida en la lista: el momento, los alimentos y las kcal (si se conocen).
 *
 * @param {import('./tipos.js').Registro} registro
 * @param {(datos: any) => string} resumirComida
 * @param {Acciones} acciones
 */
function itemDeComida(registro, resumirComida, acciones) {
  // "almuerzo · milanesa x1, ensalada x0,5 · 650,4 kcal · detalle" → título "Almuerzo",
  // las kcal a la derecha y el resto en la línea chica.
  const [momento, ...resto] = resumirComida(registro.datos).split(' · ');
  const kcal = resto.find((parte) => parte.includes('kcal')) ?? '';
  return itemDeLista({
    registro,
    titulo: conMayuscula(momento),
    meta: resto.filter((parte) => parte !== kcal).join(' · '),
    derecha: kcal.replace(/ \(.*\)$/, ''), // "600 kcal (1 sin datos)" → "600 kcal"
    claseDerecha: '',
    acciones,
  });
}

/** Las tarjetas de ingresos y egresos (y las de USD, si hay registros viejos en dólares). */
function dibujarTotales(/** @type {ReturnType<typeof import('./resumen.js').totales>} */ totales) {
  /** @type {HTMLElement[]} */
  const tarjetas = [
    total('Ingresos', formatearMonto(totales.ARS.ingresos, 'ARS')),
    total('Egresos', formatearMonto(totales.ARS.egresos, 'ARS')),
  ];
  if (totales.USD.ingresos > 0 || totales.USD.egresos > 0) {
    tarjetas.push(
      total('Ingresos en USD', formatearMonto(totales.USD.ingresos, 'USD')),
      total('Egresos en USD', formatearMonto(totales.USD.egresos, 'USD')),
    );
  }
  $('totales').replaceChildren(...tarjetas);
}

/**
 * La semana de deporte: corridas y fuerza contra las metas de S03, km y horas.
 *
 * @param {string} lunes
 * @param {{corridas: number, fuerza: number, km: number, minutos: number}} semana
 */
function dibujarSemanaDeporte(lunes, semana) {
  $('titulo-semana-deporte').textContent = `Deporte · semana del ${fechaLegible(lunes)}`;
  $('semana-deporte').replaceChildren(
    total('Corridas', `${semana.corridas} de ${METAS_SEMANA.corridas}`),
    total('Fuerza', `${semana.fuerza} de ${METAS_SEMANA.fuerza}`),
    total('Km', NUMERO_AR.format(semana.km)),
    total('Horas', NUMERO_AR.format(semana.minutos / 60)),
  );
}

/** Llena una lista, o deja un mensaje si está vacía. */
function dibujarLista(/** @type {HTMLElement} */ lista, /** @type {HTMLElement[]} */ items, /** @type {string} */ vacio) {
  lista.replaceChildren(...(items.length > 0 ? items : [el('li', { class: 'vacio' }, vacio)]));
}

/**
 * Un registro de plata en la lista: el detalle (o la categoría, si no hay detalle), la categoría
 * y el medio, y el monto con su signo.
 *
 * @param {import('./tipos.js').Registro} registro
 * @param {Acciones} acciones
 */
function itemDePlata(registro, acciones) {
  const { tipo, categoria, detalle, monto, moneda, medio } = registro.datos;
  const signo = tipo === 'ingreso' ? '+' : '−';
  return itemDeLista({
    registro,
    titulo: detalle || conMayuscula(categoria),
    meta: `${conMayuscula(categoria)} · ${medio}`,
    derecha: `${signo} ${formatearMonto(monto ?? 0, moneda)}`,
    claseDerecha: tipo,
    acciones,
  });
}

/**
 * Una sesión de deporte en la lista: "Correr", el resto de la línea y los minutos.
 *
 * @param {import('./tipos.js').Registro} registro
 * @param {(datos: import('./tipos.js').DatosEjercicio) => string} resumirSesion
 * @param {Acciones} acciones
 */
function itemDeSesion(registro, resumirSesion, acciones) {
  // "correr · 3,2 km · 32 min · 10:00 min/km" → título "Correr", el resto en la línea chica.
  const [actividad, ...resto] = resumirSesion(registro.datos).split(' · ');
  return itemDeLista({
    registro,
    titulo: conMayuscula(actividad),
    meta: resto.join(' · '),
    derecha: `${registro.datos.minutos} min`,
    claseDerecha: '',
    acciones,
  });
}

/**
 * Un registro de la lista: el título y una línea chica a la izquierda, un valor a la derecha.
 * Al tocarlo aparecen Editar y Borrar.
 *
 * @param {object} p
 * @param {import('./tipos.js').Registro} p.registro
 * @param {string} p.titulo
 * @param {string} p.meta
 * @param {string} p.derecha
 * @param {string} p.claseDerecha  "ingreso", "egreso" o "" (cambia el color)
 * @param {Acciones} p.acciones
 */
function itemDeLista({ registro, titulo, meta, derecha, claseDerecha, acciones }) {
  const resumen = el(
    'button',
    { type: 'button', 'aria-expanded': 'false' },
    el('span', {}, el('span', { class: 'detalle' }, titulo), el('span', { class: 'meta' }, meta)),
    el('span', { class: `monto ${claseDerecha}` }, derecha),
  );
  const editar = el('button', { type: 'button', class: 'boton-secundario' }, 'Editar');
  const borrar = el('button', { type: 'button', class: 'boton-secundario' }, 'Borrar');
  editar.addEventListener('click', () => acciones.alEditar(registro.id));
  borrar.addEventListener('click', () => acciones.alBorrar(registro.id));
  const botones = el('div', { class: 'acciones' }, editar, borrar);
  botones.hidden = true;
  resumen.addEventListener('click', () => {
    botones.hidden = !botones.hidden;
    resumen.setAttribute('aria-expanded', String(!botones.hidden));
  });
  return el('li', { class: 'registro' }, resumen, botones);
}

/** Una tarjeta de total. */
function total(/** @type {string} */ titulo, /** @type {string} */ valor) {
  return el('div', { class: 'total' }, el('span', {}, titulo), el('strong', {}, valor));
}

// ---------- Configuración ----------

/**
 * Dibuja Semana | Día y la fecha de Copiar detalle.
 *
 * @param {'semana' | 'día'} periodo
 * @param {string} fecha "aaaa-mm-dd"
 * @param {(periodo: 'semana' | 'día') => void} alCambiarPeriodo
 */
export function dibujarPeriodoDetalle(periodo, fecha, alCambiarPeriodo) {
  dibujarOpciones($('opciones-periodo'), ['semana', 'día'], periodo, (valor) =>
    alCambiarPeriodo(/** @type {'semana' | 'día'} */ (valor)),
  );
  campo('fecha-detalle').value = fecha;
}

/** La fecha elegida en Copiar detalle ("aaaa-mm-dd", o '' si se borró). */
export function leerFechaDetalle() {
  return campo('fecha-detalle').value;
}

/**
 * @param {object} p
 * @param {string} p.desde "aaaa-mm-dd"
 * @param {string} p.hasta "aaaa-mm-dd"
 * @param {string} p.texto lo que se va a copiar, para "Ver el texto"
 * @param {string | null} p.ultimoRespaldo
 * @param {number} p.alimentosEnTabla cuántos alimentos tiene la tabla de comidas
 */
export function dibujarConfiguracion({ desde, hasta, texto, ultimoRespaldo, alimentosEnTabla }) {
  $('estado-tabla').textContent =
    alimentosEnTabla > 0
      ? `Hay ${alimentosEnTabla} alimento${alimentosEnTabla === 1 ? '' : 's'} cargado${alimentosEnTabla === 1 ? '' : 's'}.`
      : 'No hay tabla cargada. Sin tabla, las kcal y los macros se escriben a mano (o quedan vacíos).';
  $('boton-borrar-tabla').hidden = alimentosEnTabla === 0;
  $('periodo-detalle').textContent =
    desde === hasta ? `Se copia el ${diaConNombre(desde)}.` : `Se copia del ${diaConNombre(desde)} al ${diaConNombre(hasta)}.`;
  $('texto-detalle').textContent = texto;
  $('ultimo-respaldo').textContent = ultimoRespaldo
    ? `Último respaldo: ${fechaLegible(ultimoRespaldo)}.`
    : 'Todavía no descargaste ningún respaldo.';
}

// ---------- Pestañas y avisos ----------

/**
 * Muestra una pestaña y oculta las otras.
 *
 * @param {'anotar' | 'registros' | 'configuracion'} nombre
 */
export function mostrarPestana(nombre) {
  for (const seccion of document.querySelectorAll('.pestana')) {
    /** @type {HTMLElement} */ (seccion).hidden = /** @type {HTMLElement} */ (seccion).dataset.pestana !== nombre;
  }
  for (const boton of document.querySelectorAll('[data-ir]')) {
    if (/** @type {HTMLElement} */ (boton).dataset.ir === nombre) boton.setAttribute('aria-current', 'page');
    else boton.removeAttribute('aria-current');
  }
  window.scrollTo(0, 0);
}

/**
 * Muestra un aviso arriba. Se va solo a los 4 segundos, salvo que sea persistente.
 *
 * @param {string} texto
 * @param {object} [opciones]
 * @param {boolean} [opciones.error] en rojo
 * @param {boolean} [opciones.persistente] no se va solo
 * @param {{texto: string, alTocar: () => void}} [opciones.accion] un botón dentro del aviso
 * @returns {() => void} una función que cierra el aviso
 */
export function mostrarAviso(texto, { error = false, persistente = false, accion } = {}) {
  const aviso = el('div', { class: `aviso${error ? ' error-general' : ''}`, role: error ? 'alert' : 'status' }, el('span', {}, texto));
  const cerrar = () => aviso.remove();
  if (accion) {
    const boton = el('button', { type: 'button' }, accion.texto);
    boton.addEventListener('click', () => {
      cerrar();
      accion.alTocar();
    });
    aviso.append(boton);
  }
  $('avisos').append(aviso);
  if (!persistente) setTimeout(cerrar, 4000);
  return cerrar;
}
