// @ts-check

import { TIPOS, CATEGORIAS_INGRESO, CATEGORIAS_EGRESO, MEDIOS, MONEDAS } from './listas.js';

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

/** "comida" → "Comida". ARS y USD quedan igual. */
function conMayuscula(/** @type {string} */ texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "2026-11-01" → "01/11/2026", el formato de fechas de la bóveda. */
function fechaLegible(/** @type {string} */ fecha) {
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

const FORMATOS = {
  ARS: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2 }),
  USD: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }),
};

/**
 * 3500 → "$ 3.500" · 20 en USD → "US$ 20".
 *
 * @param {number} monto
 * @param {string} moneda
 */
function formatearMonto(monto, moneda) {
  return (moneda === 'USD' ? FORMATOS.USD : FORMATOS.ARS).format(monto);
}

/** Las categorías que corresponden a un tipo. */
function categoriasDe(/** @type {string} */ tipo) {
  return tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;
}

// ---------- Botones de opciones ----------

/**
 * Dibuja un grupo de botones donde se elige uno solo (tipo, categoría, medio, moneda).
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

// ---------- Formulario ----------

/**
 * @typedef {object} ValoresFormulario
 * @property {string} tipo
 * @property {string} categoria
 * @property {string} medio
 * @property {string} moneda
 * @property {string} monto     como texto, tal cual va en el campo
 * @property {string} detalle
 * @property {string} fecha
 * @property {string} proyecto
 * @property {boolean} editando si se está editando un registro guardado
 */

/**
 * Llena el formulario con estos valores.
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
  dibujarOpciones($('opciones-moneda'), MONEDAS, v.moneda);

  campo('monto').value = v.monto;
  campo('detalle').value = v.detalle;
  campo('fecha').value = v.fecha;
  campo('proyecto').value = v.proyecto;

  $('titulo-formulario').textContent = v.editando ? 'Editar registro' : 'Anotar';
  $('boton-guardar').textContent = v.editando ? 'Guardar cambios' : 'Guardar';
  $('boton-cancelar').hidden = !v.editando;
  /** @type {HTMLDetailsElement} */ ($('mas-opciones')).open = v.editando;
  limpiarErrores();
}

/**
 * Lo que está cargado en el formulario. El monto vuelve como texto: lo convierte app.js con
 * leerMonto. Al detalle y al proyecto se les sacan los espacios de los bordes, y el proyecto
 * pasa a mayúsculas (p05 → P05).
 */
export function leerFormulario() {
  return {
    fecha: campo('fecha').value,
    montoTexto: campo('monto').value,
    datos: {
      tipo: valorElegido('opciones-tipo'),
      categoria: valorElegido('opciones-categoria'),
      detalle: campo('detalle').value.trim(),
      moneda: valorElegido('opciones-moneda'),
      medio: valorElegido('opciones-medio'),
      proyecto: campo('proyecto').value.trim().toUpperCase(),
    },
  };
}

/** Dónde poner el foco cuando un campo tiene error. */
const FOCO_DE_CAMPO = {
  tipo: '#opciones-tipo button',
  monto: '#monto',
  categoria: '#opciones-categoria button',
  medio: '#opciones-medio button',
  detalle: '#detalle',
  fecha: '#fecha',
  moneda: '#opciones-moneda button',
  proyecto: '#proyecto',
};

/**
 * Muestra cada error al lado de su campo y lleva el foco al primero.
 *
 * @param {import('./tipos.js').ErrorDeValidacion[]} errores
 */
export function mostrarErrores(errores) {
  limpiarErrores();
  for (const { campo: nombre, mensaje } of errores) {
    const lugar = document.querySelector(`[data-error="${nombre}"]`);
    if (lugar && !lugar.textContent) lugar.textContent = mensaje;
  }
  // Si el error está en "Más opciones", se despliega para que se vea.
  if (errores.some((e) => ['fecha', 'moneda', 'proyecto'].includes(e.campo))) {
    /** @type {HTMLDetailsElement} */ ($('mas-opciones')).open = true;
  }
  const primero = errores[0] && document.querySelector(FOCO_DE_CAMPO[/** @type {keyof typeof FOCO_DE_CAMPO} */ (errores[0].campo)]);
  if (primero instanceof HTMLElement) {
    primero.focus();
    primero.scrollIntoView({ block: 'center' });
  }
}

function limpiarErrores() {
  for (const lugar of document.querySelectorAll('[data-error]')) lugar.textContent = '';
}

// ---------- Hoy ----------

const ETIQUETA_DE_ESTADO = {
  nuevo: 'sin exportar',
  exportado: 'exportado',
  corregido: 'corregido · falta exportar',
  anulado: 'anulado',
};

/**
 * Dibuja los totales y la lista de un día.
 *
 * @param {object} p
 * @param {import('./tipos.js').Registro[]} p.registros los del día, ya ordenados
 * @param {ReturnType<typeof import('./resumen.js').totales>} p.totales
 * @param {(registro: import('./tipos.js').Registro) => keyof typeof ETIQUETA_DE_ESTADO} p.estadoDe
 * @param {(id: string) => void} p.alEditar
 * @param {(id: string) => void} p.alBorrar
 */
export function dibujarHoy({ registros, totales, estadoDe, alEditar, alBorrar }) {
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

  const lista = $('lista');
  if (registros.length === 0) {
    lista.replaceChildren(el('li', { class: 'vacio' }, 'No hay registros este día.'));
    return;
  }

  lista.replaceChildren(
    ...registros.map((registro) => {
      const { tipo, categoria, detalle, monto, moneda, medio } = registro.datos;
      const estado = estadoDe(registro);
      const signo = tipo === 'ingreso' ? '+' : '−';

      const resumen = el(
        'button',
        { type: 'button', 'aria-expanded': 'false' },
        el(
          'span',
          {},
          el('span', { class: 'detalle' }, detalle),
          el('span', { class: 'meta' }, `${conMayuscula(categoria)} · ${medio} · ${ETIQUETA_DE_ESTADO[estado]}`),
        ),
        el('span', { class: `monto ${tipo}` }, `${signo} ${formatearMonto(monto ?? 0, moneda)}`),
      );

      const item = el('li', { class: `registro${registro.anulado ? ' anulado' : ''}` }, resumen);

      // Al tocar un registro (no anulado) aparecen Editar y Borrar.
      if (!registro.anulado) {
        const editar = el('button', { type: 'button', class: 'boton-secundario' }, 'Editar');
        const borrar = el('button', { type: 'button', class: 'boton-secundario' }, 'Borrar');
        editar.addEventListener('click', () => alEditar(registro.id));
        borrar.addEventListener('click', () => alBorrar(registro.id));
        const acciones = el('div', { class: 'acciones' }, editar, borrar);
        acciones.hidden = true;
        resumen.addEventListener('click', () => {
          acciones.hidden = !acciones.hidden;
          resumen.setAttribute('aria-expanded', String(!acciones.hidden));
        });
        item.append(acciones);
      }
      return item;
    }),
  );
}

/** Una tarjeta de total. */
function total(/** @type {string} */ titulo, /** @type {string} */ valor) {
  return el('div', { class: 'total' }, el('span', {}, titulo), el('strong', {}, valor));
}

// ---------- Exportar ----------

/**
 * @param {object} p
 * @param {{nuevos: number, corregidos: number, anulados: number}} p.cuantos
 * @param {string} p.texto el texto para Claude que se muestra en "Ver el texto"
 * @param {boolean} p.puedeDeshacer
 * @param {string | null} p.ultimoRespaldo
 */
export function dibujarExportar({ cuantos, texto, puedeDeshacer, ultimoRespaldo }) {
  const totalPendientes = cuantos.nuevos + cuantos.corregidos + cuantos.anulados;
  $('resumen-pendientes').textContent =
    totalPendientes === 0
      ? 'No hay nada pendiente: todo está pasado a Claude.'
      : `Pendientes: ${cuantos.nuevos} nuevos · ${cuantos.corregidos} corregidos · ${cuantos.anulados} anulados.`;
  /** @type {HTMLButtonElement} */ ($('boton-copiar')).disabled = totalPendientes === 0;
  $('boton-deshacer').hidden = !puedeDeshacer;
  $('texto-claude').textContent = texto;
  $('ultimo-respaldo').textContent = ultimoRespaldo
    ? `Último respaldo: ${fechaLegible(ultimoRespaldo)}.`
    : 'Todavía no descargaste ningún respaldo.';
}

// ---------- Pestañas y avisos ----------

/**
 * Muestra una pestaña y oculta las otras.
 *
 * @param {'anotar' | 'hoy' | 'exportar'} nombre
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
