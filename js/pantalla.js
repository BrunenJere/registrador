// @ts-check

import { TIPOS, CATEGORIAS_INGRESO, CATEGORIAS_EGRESO, MEDIOS, ACTIVIDADES, METAS_SEMANA } from './listas.js';

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
 * @param {(clase: 'plata' | 'deporte') => void} alCambiar
 */
export function conectarMenuClase(alCambiar) {
  const menu = /** @type {HTMLSelectElement} */ ($('clase'));
  menu.addEventListener('change', () => alCambiar(/** @type {'plata' | 'deporte'} */ (menu.value)));
}

/**
 * Elige una opción del menú "Qué" y muestra su formulario.
 *
 * @param {'plata' | 'deporte'} clase
 */
export function elegirClase(clase) {
  /** @type {HTMLSelectElement} */ ($('clase')).value = clase;
  $('formulario').hidden = clase !== 'plata';
  $('formulario-deporte').hidden = clase !== 'deporte';
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
};

/**
 * Muestra cada error al lado de su campo y lleva el foco al primero.
 *
 * @param {import('./tipos.js').ErrorDeValidacion[]} errores
 * @param {'formulario' | 'formulario-deporte'} idFormulario
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
  const ejercicio = /^ejercicio-(\d+)$/.exec(nombre);
  if (ejercicio) {
    return formulario.querySelectorAll('.fila-ejercicio')[Number(ejercicio[1])]?.querySelector('input') ?? null;
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
 * Registros, vista de un día: la plata del día y, para el deporte, la semana arriba y las
 * sesiones del día abajo.
 *
 * @param {object} p
 * @param {import('./tipos.js').Registro[]} p.plata los de plata del día, ya ordenados
 * @param {ReturnType<typeof import('./resumen.js').totales>} p.totales
 * @param {string} p.lunes el lunes de esa semana
 * @param {{corridas: number, fuerza: number, km: number, minutos: number}} p.semana
 * @param {import('./tipos.js').Registro[]} p.sesiones las de deporte del día, ya ordenadas
 * @param {(datos: import('./tipos.js').DatosEjercicio) => string} p.resumirSesion la línea corta de una sesión
 * @param {Acciones} p.acciones
 */
export function dibujarRegistrosDia({ plata, totales, lunes, semana, sesiones, resumirSesion, acciones }) {
  mostrarListasDe('día');
  $('titulo-plata').textContent = 'Plata del día';
  dibujarTotales(totales);
  dibujarSemanaDeporte(lunes, semana);
  dibujarLista($('lista'), plata.map((r) => itemDePlata(r, acciones)), 'No hay plata anotada este día.');
  dibujarLista(
    $('lista-deporte'),
    sesiones.map((r) => itemDeSesion(r, resumirSesion, acciones)),
    'No hay sesiones este día.',
  );
}

/**
 * Registros, vista de una semana (de lunes a domingo): los totales de plata, el resumen de
 * deporte y todos los registros agrupados por día.
 *
 * @param {object} p
 * @param {string} p.lunes
 * @param {ReturnType<typeof import('./resumen.js').totales>} p.totales los de toda la semana
 * @param {{corridas: number, fuerza: number, km: number, minutos: number}} p.semana
 * @param {import('./tipos.js').Registro[]} p.registros los de la semana, en orden
 * @param {(datos: import('./tipos.js').DatosEjercicio) => string} p.resumirSesion
 * @param {Acciones} p.acciones
 */
export function dibujarRegistrosSemana({ lunes, totales, semana, registros, resumirSesion, acciones }) {
  mostrarListasDe('semana');
  $('titulo-plata').textContent = `Plata de la semana del ${fechaLegible(lunes)}`;
  dibujarTotales(totales);
  dibujarSemanaDeporte(lunes, semana);

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
    lista?.append(
      registro.clase === 'ejercicio'
        ? itemDeSesion(registro, resumirSesion, acciones)
        : itemDePlata(registro, acciones),
    );
  }
  contenedor.replaceChildren(...bloques);
}

/** En la vista de día se ven las dos listas de siempre; en la de semana, la lista agrupada. */
function mostrarListasDe(/** @type {'día' | 'semana'} */ vista) {
  $('lista').hidden = vista !== 'día';
  $('lista-deporte').hidden = vista !== 'día';
  $('lista-semana').hidden = vista !== 'semana';
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
 */
export function dibujarConfiguracion({ desde, hasta, texto, ultimoRespaldo }) {
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
