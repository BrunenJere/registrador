// @ts-check

import { crearAlmacen, pedirPersistencia } from './almacen.js';
import {
  formatearRitmo,
  nombresDeEjercicios,
  resumenDeSemana,
  resumenDeSesion,
  segundosPorKm,
  ultimaSesionDeFuerza,
} from './deporte.js';
import { textoDeDetalle } from './exportar.js';
import { hoyLocal, lunesDe, momentoLocal, sumarDias } from './fechas.js';
import { leerEntero, leerMonto } from './numeros.js';
import { descargarRespaldo, importarRespaldo, tocaRespaldo } from './respaldo.js';
import { registrosDelDia, registrosDelPeriodo, totales, ultimoMedio } from './resumen.js';
import { validarEjercicio, validarFinanza } from './validar.js';
import {
  agregarEjercicio,
  cargarEjercicios,
  conectarFormularioDeporte,
  conectarMenuClase,
  dibujarConfiguracion,
  dibujarFormulario,
  dibujarFormularioDeporte,
  dibujarPeriodoDetalle,
  dibujarRegistrosDia,
  dibujarRegistrosSemana,
  dibujarVistaRegistros,
  elegirClase,
  leerFecha,
  leerFechaDetalle,
  leerFechaRegistros,
  leerFormulario,
  leerFormularioDeporte,
  mostrarAviso,
  mostrarErrores,
  mostrarPestana,
  ponerFecha,
} from './pantalla.js';

// Arranque y conexiones: cada botón llama a la lógica y después se vuelve a dibujar.
// Es el único archivo que conoce a la vez la pantalla y los datos.

const almacen = crearAlmacen();

/** Estado que vive sólo mientras la app está abierta. */
const estado = {
  /** @type {'plata' | 'deporte'} qué formulario se ve en Anotar */
  clase: 'plata',
  /** @type {string | null} el id del registro que se está editando, o null si es uno nuevo */
  editandoId: null,
  /** @type {string} la última actividad anotada, para dejarla elegida en el formulario */
  ultimaActividad: 'correr',
  /** @type {'día' | 'semana'} qué se ve en Registros */
  vista: 'día',
  /** @type {'semana' | 'día'} qué se copia en Configuración */
  periodo: 'semana',
};

/** Lee los registros; si están dañados, avisa y devuelve una lista vacía para no romper la app. */
function leerRegistros() {
  try {
    return almacen.leerTodos();
  } catch (error) {
    avisarError(error);
    return [];
  }
}

/** Muestra un error en rojo, sin que se vaya solo. */
function avisarError(/** @type {unknown} */ error) {
  const mensaje = error instanceof Error ? error.message : String(error);
  mostrarAviso(mensaje, { error: true, persistente: true, accion: { texto: 'Cerrar', alTocar: () => {} } });
}

/** 3.5 → "3,5", como se escribe en el formulario (y como lo vuelve a leer leerMonto). */
function aTexto(/** @type {number | null} */ numero) {
  return numero === null ? '' : String(numero).replace('.', ',');
}

/** El registro que se está editando, o null si se está anotando uno nuevo. */
function registroEditado() {
  return estado.editandoId ? (leerRegistros().find((r) => r.id === estado.editandoId) ?? null) : null;
}

// ---------- Qué se anota ----------

/** Cambia el formulario que se ve. Si se estaba editando algo, se cancela la edición. */
function alCambiarClase(/** @type {'plata' | 'deporte'} */ clase) {
  estado.clase = clase;
  if (estado.editandoId) {
    formularioNuevo();
    formularioDeporteNuevo();
    ponerFecha(hoyLocal());
  }
  elegirClase(clase);
}

// ---------- Formulario de plata ----------

/** Deja el formulario de plata listo para anotar uno nuevo. */
function formularioNuevo() {
  estado.editandoId = null;
  dibujarFormulario({
    tipo: 'egreso',
    categoria: '',
    medio: ultimoMedio(leerRegistros()),
    monto: '',
    detalle: '',
    editando: false,
  });
}

/** Guardar plata: convertir el monto, validar y, si no hay errores, agregar o editar. */
function alGuardar(/** @type {SubmitEvent} */ evento) {
  evento.preventDefault(); // que el formulario no recargue la página
  const { montoTexto, datos } = leerFormulario();
  const original = registroEditado();
  const registro = {
    fecha: leerFecha(),
    datos: {
      ...datos,
      monto: leerMonto(montoTexto),
      moneda: 'ARS', // desde el 14/11/2026 todo se anota en pesos
      proyecto: original?.datos.proyecto ?? '', // ya no se pregunta; al editar, se conserva
    },
  };

  const errores = validarFinanza(registro);
  if (errores.length > 0) {
    mostrarErrores(errores, 'formulario');
    return;
  }
  if (guardar('finanza', registro)) formularioNuevo();
}

// ---------- Formulario de deporte ----------

/** Deja el formulario de deporte listo para anotar una sesión nueva. */
function formularioDeporteNuevo() {
  estado.editandoId = null;
  dibujarFormularioDeporte(
    {
      actividad: estado.ultimaActividad,
      km: '',
      minutos: '',
      detalle: '',
      ejercicios: [],
      nombres: nombresDeEjercicios(leerRegistros()),
      editando: false,
    },
    textoDeRitmo,
  );
}

/** El ritmo mientras se escribe: "Ritmo: 10:00 min/km", o '' si todavía no se puede calcular. */
function textoDeRitmo(/** @type {string} */ kmTexto, /** @type {string} */ minutosTexto) {
  const km = leerMonto(kmTexto);
  const minutos = leerEntero(minutosTexto);
  if (km === null || !minutos) return '';
  const segundos = segundosPorKm(minutos, km);
  return segundos === null ? '' : `Ritmo: ${formatearRitmo(segundos)}`;
}

/**
 * Un número opcional escrito en el formulario (km, kg): vacío es null. Si se escribió algo que
 * no se puede leer, da NaN, para que la validación lo marque en vez de tomarlo como vacío.
 */
function numeroOpcional(/** @type {string} */ texto) {
  return texto.trim() === '' ? null : (leerMonto(texto) ?? NaN);
}

/** Guardar deporte: convertir los números, validar y, si no hay errores, agregar o editar. */
function alGuardarDeporte(/** @type {SubmitEvent} */ evento) {
  evento.preventDefault();
  const f = leerFormularioDeporte();
  const esFuerza = f.actividad === 'fuerza';
  const original = registroEditado();
  const registro = {
    fecha: leerFecha(),
    datos: {
      actividad: f.actividad,
      minutos: leerEntero(f.minutosTexto),
      km: esFuerza ? null : numeroOpcional(f.kmTexto),
      detalle: f.detalle,
      ejercicios: esFuerza
        ? f.ejercicios.map((e) => ({
            nombre: e.nombre,
            series: leerEntero(e.series),
            repeticiones: leerEntero(e.repeticiones),
            kg: numeroOpcional(e.kg),
          }))
        : [],
      nota: original?.datos.nota ?? '', // ya no se pregunta; al editar, se conserva
    },
  };

  const errores = validarEjercicio(registro);
  if (errores.length > 0) {
    mostrarErrores(errores, 'formulario-deporte');
    return;
  }
  estado.ultimaActividad = f.actividad;
  if (guardar('ejercicio', registro)) formularioDeporteNuevo();
}

/** Repetir la última sesión: copia los ejercicios de la última fuerza al formulario. */
function alRepetir() {
  const ejercicios = ultimaSesionDeFuerza(leerRegistros());
  if (ejercicios.length === 0) {
    mostrarAviso('Todavía no hay una sesión de fuerza con ejercicios para repetir.');
    return;
  }
  cargarEjercicios(
    ejercicios.map((e) => ({
      nombre: e.nombre,
      series: String(e.series ?? ''),
      repeticiones: String(e.repeticiones ?? ''),
      kg: aTexto(e.kg),
    })),
  );
}

// ---------- Guardar, editar y borrar (las dos clases) ----------

/**
 * Agrega o edita un registro ya validado y vuelve a dibujar.
 *
 * @param {'finanza' | 'ejercicio'} clase
 * @param {{fecha: string, datos: object}} registro
 * @returns {boolean} true si se guardó (si no, el formulario queda como está para no perder lo escrito)
 */
function guardar(clase, registro) {
  let guardado = false;
  try {
    if (estado.editandoId) {
      almacen.editar(estado.editandoId, registro);
      mostrarAviso('Cambios guardados.');
      ponerFecha(hoyLocal()); // terminada la edición, la fecha vuelve a hoy
      mostrarPestana('registros');
    } else {
      // La fecha queda como está: si estás cargando varias cosas de ayer, no hay que volver a
      // elegirla cada vez. Al abrir la app vuelve a hoy.
      almacen.agregar({ clase, ...registro });
      mostrarAviso('Guardado.');
    }
    guardado = true;
  } catch (error) {
    avisarError(error);
  }
  refrescar();
  return guardado;
}

/** Editar: carga el registro en su formulario, con su fecha arriba, y va a Anotar. */
function alEditar(/** @type {string} */ id) {
  const registro = leerRegistros().find((r) => r.id === id);
  if (!registro) return;
  const { datos } = registro;

  if (registro.clase === 'ejercicio') {
    estado.clase = 'deporte';
    dibujarFormularioDeporte(
      {
        actividad: datos.actividad,
        km: aTexto(datos.km),
        minutos: String(datos.minutos ?? ''),
        detalle: datos.detalle,
        ejercicios: datos.ejercicios.map((/** @type {import('./tipos.js').Ejercicio} */ e) => ({
          nombre: e.nombre,
          series: String(e.series ?? ''),
          repeticiones: String(e.repeticiones ?? ''),
          kg: aTexto(e.kg),
        })),
        nombres: nombresDeEjercicios(leerRegistros()),
        editando: true,
      },
      textoDeRitmo,
    );
  } else {
    estado.clase = 'plata';
    dibujarFormulario({
      tipo: datos.tipo,
      categoria: datos.categoria,
      medio: datos.medio,
      monto: aTexto(datos.monto), // 3500.5 → "3500,5", como lo lee leerMonto
      detalle: datos.detalle,
      editando: true,
    });
  }
  elegirClase(estado.clase);
  ponerFecha(registro.fecha);
  // Se marca después de dibujar, porque dibujar un formulario nuevo deja editandoId en null.
  estado.editandoId = id;
  mostrarPestana('anotar');
}

/** Cancelar una edición: vuelve a Registros con los formularios vacíos y la fecha de hoy. */
function alCancelar() {
  formularioNuevo();
  formularioDeporteNuevo();
  ponerFecha(hoyLocal());
  mostrarPestana('registros');
}

/** Borrar: pide confirmación y lo saca. */
function alBorrar(/** @type {string} */ id) {
  const registro = leerRegistros().find((r) => r.id === id);
  if (!registro) return;
  const nombre =
    registro.clase === 'ejercicio'
      ? resumenDeSesion(registro.datos, { corto: true })
      : registro.datos.detalle || registro.datos.categoria;
  if (!confirm(`¿Borrar «${nombre}»?`)) return;
  try {
    almacen.borrar(id);
  } catch (error) {
    avisarError(error);
  }
  refrescar();
}

// ---------- Configuración ----------

/** El período de Copiar detalle: la semana (de lunes a domingo) o el día de la fecha elegida. */
function periodoDetalle() {
  const fecha = leerFechaDetalle() || hoyLocal();
  if (estado.periodo === 'día') return { desde: fecha, hasta: fecha };
  const lunes = lunesDe(fecha);
  return { desde: lunes, hasta: sumarDias(lunes, 6) };
}

/** Copiar detalle: copia todo lo del período elegido. */
async function alCopiar() {
  const { desde, hasta } = periodoDetalle();
  const texto = textoDeDetalle(leerRegistros(), desde, hasta, momentoLocal());
  try {
    await navigator.clipboard.writeText(texto);
    mostrarAviso('Copiado. Pegáselo a Claude.');
  } catch {
    avisarError(new Error('No se pudo copiar. Abrí «Ver el texto» y copialo a mano.'));
  }
}

/** Descargar respaldo y anotar la fecha. */
function alDescargar() {
  try {
    descargarRespaldo(almacen.leerTodos());
    almacen.guardarUltimoRespaldo();
  } catch (error) {
    avisarError(error);
  }
  refrescar();
}

/** Importar respaldo: une el archivo elegido con lo guardado. */
async function alImportar(/** @type {Event} */ evento) {
  const entrada = /** @type {HTMLInputElement} */ (evento.target);
  const archivo = entrada.files?.[0];
  entrada.value = ''; // para poder elegir el mismo archivo otra vez
  if (!archivo) return;
  try {
    const r = await importarRespaldo(archivo, almacen);
    mostrarAviso(`Importado: ${r.agregados} nuevos, ${r.actualizados} actualizados, ${r.sin_cambios} sin cambios.`);
  } catch (error) {
    avisarError(error);
  }
  refrescar();
}

// ---------- Dibujar ----------

const acciones = { alEditar, alBorrar };

/** La línea corta de una sesión, para las listas. */
const resumirSesion = (/** @type {import('./tipos.js').DatosEjercicio} */ datos) => resumenDeSesion(datos, { corto: true });

/** Vuelve a dibujar Registros y Configuración con los datos guardados. */
function refrescar() {
  const registros = leerRegistros();
  const fecha = leerFechaRegistros() || hoyLocal();
  const lunes = lunesDe(fecha);
  const semana = resumenDeSemana(registros, lunes);

  if (estado.vista === 'día') {
    const delDia = registrosDelDia(registros, fecha);
    const plata = delDia.filter((r) => r.clase === 'finanza');
    dibujarRegistrosDia({
      plata,
      totales: totales(plata),
      lunes,
      semana,
      sesiones: delDia.filter((r) => r.clase === 'ejercicio'),
      resumirSesion,
      acciones,
    });
  } else {
    const deLaSemana = registrosDelPeriodo(registros, lunes, sumarDias(lunes, 6));
    dibujarRegistrosSemana({ lunes, totales: totales(deLaSemana), semana, registros: deLaSemana, resumirSesion, acciones });
  }

  const { desde, hasta } = periodoDetalle();
  dibujarConfiguracion({
    desde,
    hasta,
    texto: textoDeDetalle(registros, desde, hasta, momentoLocal()),
    ultimoRespaldo: almacen.leerUltimoRespaldo(),
  });
}

/** Día | Semana en Registros. */
function alCambiarVista(/** @type {'día' | 'semana'} */ vista) {
  estado.vista = vista;
  refrescar();
}

/** Semana | Día en Copiar detalle. */
function alCambiarPeriodo(/** @type {'semana' | 'día'} */ periodo) {
  estado.periodo = periodo;
  refrescar();
}

// ---------- Versión nueva (service worker) ----------

/** Registra el service worker y avisa cuando hay una versión nueva para recargar. */
function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  /** @param {ServiceWorker} nuevo */
  const avisarVersionNueva = (nuevo) =>
    mostrarAviso('Hay una versión nueva de la app.', {
      persistente: true,
      accion: { texto: 'Recargar', alTocar: () => nuevo.postMessage('activar') },
    });

  navigator.serviceWorker.register('./sw.js').then((registro) => {
    // Una versión nueva que quedó esperando de antes.
    if (registro.waiting && navigator.serviceWorker.controller) avisarVersionNueva(registro.waiting);
    // Una versión nueva que se baja ahora.
    registro.addEventListener('updatefound', () => {
      const nuevo = registro.installing;
      nuevo?.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) avisarVersionNueva(nuevo);
      });
    });
  });

  // Cuando la versión nueva toma el control, se recarga la página una sola vez.
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando) return;
    recargando = true;
    location.reload();
  });
}

// ---------- Arranque ----------

function iniciar() {
  const hoy = hoyLocal();
  ponerFecha(hoy);
  dibujarVistaRegistros(estado.vista, hoy, alCambiarVista);
  dibujarPeriodoDetalle(estado.periodo, hoy, alCambiarPeriodo);
  conectarMenuClase(alCambiarClase);
  conectarFormularioDeporte();
  elegirClase(estado.clase);
  formularioNuevo();
  formularioDeporteNuevo();
  refrescar();

  document.getElementById('formulario')?.addEventListener('submit', alGuardar);
  document.getElementById('formulario-deporte')?.addEventListener('submit', alGuardarDeporte);
  document.getElementById('boton-cancelar')?.addEventListener('click', alCancelar);
  document.getElementById('boton-cancelar-deporte')?.addEventListener('click', alCancelar);
  document.getElementById('boton-agregar-ejercicio')?.addEventListener('click', agregarEjercicio);
  document.getElementById('boton-repetir')?.addEventListener('click', alRepetir);
  document.getElementById('dia')?.addEventListener('change', refrescar);
  document.getElementById('fecha-detalle')?.addEventListener('change', refrescar);
  document.getElementById('boton-copiar')?.addEventListener('click', alCopiar);
  document.getElementById('boton-descargar')?.addEventListener('click', alDescargar);
  document.getElementById('archivo-respaldo')?.addEventListener('change', alImportar);
  for (const boton of document.querySelectorAll('[data-ir]')) {
    boton.addEventListener('click', () => {
      mostrarPestana(/** @type {'anotar' | 'registros' | 'configuracion'} */ (/** @type {HTMLElement} */ (boton).dataset.ir));
      refrescar();
    });
  }

  // Recordar el respaldo semanal, si ya hay algo anotado.
  if (leerRegistros().length > 0 && tocaRespaldo(almacen.leerUltimoRespaldo(), hoy)) {
    mostrarAviso('Hace una semana o más que no descargás un respaldo.', {
      persistente: true,
      accion: { texto: 'Ir', alTocar: () => mostrarPestana('configuracion') },
    });
  }

  pedirPersistencia();
  registrarServiceWorker();
}

iniciar();
