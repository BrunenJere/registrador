// @ts-check

import { TIPOS, CATEGORIAS_INGRESO, CATEGORIAS_EGRESO, MEDIOS, MONEDAS, ACTIVIDADES, METAS_SEMANA } from './listas.js';

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
  limpiarErrores($('formulario'));
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

// Los dos formularios tienen campos con el mismo nombre (detalle, fecha), así que los errores se
// buscan siempre DENTRO del formulario que corresponde.

/** @type {Record<string, Record<string, string>>} dónde poner el foco cuando un campo tiene error */
const FOCO_DE_CAMPO = {
  formulario: {
    tipo: '#opciones-tipo button',
    monto: '#monto',
    categoria: '#opciones-categoria button',
    medio: '#opciones-medio button',
    detalle: '#detalle',
    fecha: '#fecha',
    moneda: '#opciones-moneda button',
    proyecto: '#proyecto',
  },
  'formulario-deporte': {
    actividad: '#opciones-actividad button',
    km: '#km',
    minutos: '#minutos',
    detalle: '#detalle-deporte',
    fecha: '#fecha-deporte',
    nota: '#nota',
  },
};

/** @type {Record<string, {id: string, campos: string[]}>} qué campos están en "Más opciones" */
const MAS_OPCIONES = {
  formulario: { id: 'mas-opciones', campos: ['fecha', 'moneda', 'proyecto'] },
  'formulario-deporte': { id: 'mas-opciones-deporte', campos: ['fecha', 'nota'] },
};

/**
 * Muestra cada error al lado de su campo y lleva el foco al primero.
 *
 * @param {import('./tipos.js').ErrorDeValidacion[]} errores
 * @param {'formulario' | 'formulario-deporte'} [idFormulario] el de plata, si no se dice
 */
export function mostrarErrores(errores, idFormulario = 'formulario') {
  const formulario = $(idFormulario);
  limpiarErrores(formulario);
  for (const { campo: nombre, mensaje } of errores) {
    const lugar = formulario.querySelector(`[data-error="${nombre}"]`);
    if (lugar && !lugar.textContent) lugar.textContent = mensaje;
  }
  // Si el error está en "Más opciones", se despliega para que se vea.
  const mas = MAS_OPCIONES[idFormulario];
  if (errores.some((e) => mas.campos.includes(e.campo))) {
    /** @type {HTMLDetailsElement} */ ($(mas.id)).open = true;
  }
  const primero = errores[0] && focoDe(formulario, idFormulario, errores[0].campo);
  if (primero instanceof HTMLElement) {
    primero.focus();
    primero.scrollIntoView({ block: 'center' });
  }
}

/**
 * El elemento donde poner el foco para un campo con error. Un error "ejercicio-1" va al primer
 * campo del segundo ejercicio.
 *
 * @param {HTMLElement} formulario
 * @param {string} idFormulario
 * @param {string} nombre
 * @returns {Element | null}
 */
function focoDe(formulario, idFormulario, nombre) {
  const ejercicio = /^ejercicio-(\d+)$/.exec(nombre);
  if (ejercicio) {
    return formulario.querySelectorAll('.fila-ejercicio')[Number(ejercicio[1])]?.querySelector('input') ?? null;
  }
  const selector = FOCO_DE_CAMPO[idFormulario][nombre];
  return selector ? formulario.querySelector(selector) : null;
}

/** Borra los errores que se ven en un formulario. */
function limpiarErrores(/** @type {HTMLElement} */ formulario) {
  for (const lugar of formulario.querySelectorAll('[data-error]')) lugar.textContent = '';
}

// ---------- Plata | Deporte ----------

/**
 * Dibuja el selector Plata | Deporte y muestra el formulario que corresponde.
 *
 * @param {'plata' | 'deporte'} elegido
 * @param {(clase: 'plata' | 'deporte') => void} alCambiar
 */
export function dibujarSelectorClase(elegido, alCambiar) {
  dibujarOpciones($('opciones-clase'), ['plata', 'deporte'], elegido, (valor) =>
    alCambiar(/** @type {'plata' | 'deporte'} */ (valor)),
  );
  mostrarFormulario(elegido);
}

/** Muestra el formulario de plata o el de deporte. */
function mostrarFormulario(/** @type {'plata' | 'deporte'} */ clase) {
  $('formulario').hidden = clase !== 'plata';
  $('formulario-deporte').hidden = clase !== 'deporte';
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
 * @property {string} nota
 * @property {string} fecha
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
  campo('nota').value = v.nota;
  campo('fecha-deporte').value = v.fecha;

  $('nombres-ejercicios').replaceChildren(...v.nombres.map((nombre) => el('option', { value: nombre })));
  cargarEjercicios(v.ejercicios);

  $('boton-guardar-deporte').textContent = v.editando ? 'Guardar cambios' : 'Guardar';
  $('boton-cancelar-deporte').hidden = !v.editando;
  /** @type {HTMLDetailsElement} */ ($('mas-opciones-deporte')).open = v.editando;
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
  campo('detalle-deporte').placeholder = actividad === 'otro' ? 'caminar, bici, limpiar el fondo…' : 'con Thiago, en la plaza…';
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
    fecha: campo('fecha-deporte').value,
    actividad: valorElegido('opciones-actividad'),
    kmTexto: campo('km').value,
    minutosTexto: campo('minutos').value,
    detalle: campo('detalle-deporte').value.trim(),
    nota: campo('nota').value.trim(),
    ejercicios,
  };
}

/** Conecta lo que se recalcula mientras se escribe. Se llama una vez al arrancar. */
export function conectarFormularioDeporte() {
  campo('km').addEventListener('input', actualizarRitmo);
  campo('minutos').addEventListener('input', actualizarRitmo);
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
      const signo = tipo === 'ingreso' ? '+' : '−';
      return itemDeLista({
        registro,
        titulo: detalle,
        meta: `${conMayuscula(categoria)} · ${medio} · ${ETIQUETA_DE_ESTADO[estadoDe(registro)]}`,
        derecha: `${signo} ${formatearMonto(monto ?? 0, moneda)}`,
        claseDerecha: tipo,
        alEditar,
        alBorrar,
      });
    }),
  );
}

/**
 * Un registro de la lista de Hoy: el título y una línea chica a la izquierda, un valor a la
 * derecha. Al tocarlo (si no está anulado) aparecen Editar y Borrar.
 *
 * @param {object} p
 * @param {import('./tipos.js').Registro} p.registro
 * @param {string} p.titulo
 * @param {string} p.meta
 * @param {string} p.derecha
 * @param {string} p.claseDerecha  "ingreso", "egreso" o "" (cambia el color)
 * @param {(id: string) => void} p.alEditar
 * @param {(id: string) => void} p.alBorrar
 */
function itemDeLista({ registro, titulo, meta, derecha, claseDerecha, alEditar, alBorrar }) {
  const resumen = el(
    'button',
    { type: 'button', 'aria-expanded': 'false' },
    el('span', {}, el('span', { class: 'detalle' }, titulo), el('span', { class: 'meta' }, meta)),
    el('span', { class: `monto ${claseDerecha}` }, derecha),
  );

  const item = el('li', { class: `registro${registro.anulado ? ' anulado' : ''}` }, resumen);

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
}

const NUMERO_AR = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

/**
 * Dibuja la semana de deporte (la del día elegido) y las sesiones del día.
 *
 * @param {object} p
 * @param {string} p.lunes "aaaa-mm-dd"
 * @param {{corridas: number, fuerza: number, km: number, minutos: number}} p.semana
 * @param {import('./tipos.js').Registro[]} p.sesiones las del día, ya ordenadas
 * @param {(datos: import('./tipos.js').DatosEjercicio) => string} p.resumirSesion la línea corta de una sesión
 * @param {(registro: import('./tipos.js').Registro) => keyof typeof ETIQUETA_DE_ESTADO} p.estadoDe
 * @param {(id: string) => void} p.alEditar
 * @param {(id: string) => void} p.alBorrar
 */
export function dibujarDeporteHoy({ lunes, semana, sesiones, resumirSesion, estadoDe, alEditar, alBorrar }) {
  $('titulo-semana-deporte').textContent = `Deporte · semana del ${fechaLegible(lunes)}`;
  $('semana-deporte').replaceChildren(
    total('Corridas', `${semana.corridas} de ${METAS_SEMANA.corridas}`),
    total('Fuerza', `${semana.fuerza} de ${METAS_SEMANA.fuerza}`),
    total('Km', NUMERO_AR.format(semana.km)),
    total('Horas', NUMERO_AR.format(semana.minutos / 60)),
  );

  const lista = $('lista-deporte');
  if (sesiones.length === 0) {
    lista.replaceChildren(el('li', { class: 'vacio' }, 'No hay sesiones este día.'));
    return;
  }
  lista.replaceChildren(
    ...sesiones.map((registro) => {
      // "correr · 3,2 km · 32 min · 10:00 min/km" → título "Correr", el resto en la línea chica.
      const [actividad, ...resto] = resumirSesion(registro.datos).split(' · ');
      return itemDeLista({
        registro,
        titulo: conMayuscula(actividad),
        meta: [...resto, ETIQUETA_DE_ESTADO[estadoDe(registro)]].join(' · '),
        derecha: `${registro.datos.minutos} min`,
        claseDerecha: '',
        alEditar,
        alBorrar,
      });
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
