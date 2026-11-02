// @ts-check

import { crearAlmacen, pedirPersistencia } from './almacen.js';
import {
  formatearRitmo,
  lunesDe,
  nombresDeEjercicios,
  resumenDeSemana,
  resumenDeSesion,
  segundosPorKm,
  ultimaSesionDeFuerza,
} from './deporte.js';
import { estadoDeExportacion, pendientes, textoParaClaude } from './exportar.js';
import { hoyLocal, momentoLocal } from './fechas.js';
import { leerEntero, leerMonto } from './numeros.js';
import { descargarRespaldo, importarRespaldo, tocaRespaldo } from './respaldo.js';
import { registrosDelDia, totales, ultimoMedio } from './resumen.js';
import { validarEjercicio, validarFinanza } from './validar.js';
import {
  agregarEjercicio,
  cargarEjercicios,
  conectarFormularioDeporte,
  dibujarDeporteHoy,
  dibujarExportar,
  dibujarFormulario,
  dibujarFormularioDeporte,
  dibujarHoy,
  dibujarSelectorClase,
  leerFormulario,
  leerFormularioDeporte,
  mostrarAviso,
  mostrarErrores,
  mostrarPestana,
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
  /** @type {import('./almacen.js').CopiaDeExportacion[] | null} para Deshacer la última exportación */
  copiaExportacion: null,
  /** @type {string | null} el último texto copiado, para poder volver a verlo */
  ultimoTexto: null,
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

// ---------- Plata | Deporte ----------

/** Cambia el formulario que se ve. Si se estaba editando algo, se cancela la edición. */
function alCambiarClase(/** @type {'plata' | 'deporte'} */ clase) {
  estado.clase = clase;
  if (estado.editandoId) {
    formularioNuevo();
    formularioDeporteNuevo();
  }
  dibujarSelectorClase(clase, alCambiarClase);
}

// ---------- Formulario de plata ----------

/** Deja el formulario de plata listo para anotar uno nuevo. */
function formularioNuevo() {
  estado.editandoId = null;
  dibujarFormulario({
    tipo: 'egreso',
    categoria: '',
    medio: ultimoMedio(leerRegistros()),
    moneda: 'ARS',
    monto: '',
    detalle: '',
    fecha: hoyLocal(),
    proyecto: '',
    editando: false,
  });
}

/** Guardar plata: convertir el monto, validar y, si no hay errores, agregar o editar. */
function alGuardar(/** @type {SubmitEvent} */ evento) {
  evento.preventDefault(); // que el formulario no recargue la página
  const { fecha, montoTexto, datos } = leerFormulario();
  const registro = { fecha, datos: { ...datos, monto: leerMonto(montoTexto) } };

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
      nota: '',
      fecha: hoyLocal(),
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
  const registro = {
    fecha: f.fecha,
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
      nota: f.nota,
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
      mostrarPestana('hoy');
    } else {
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

/** Editar: carga el registro en su formulario y va a Anotar. */
function alEditar(/** @type {string} */ id) {
  const registro = leerRegistros().find((r) => r.id === id);
  if (!registro) return;
  const { datos } = registro;

  if (registro.clase === 'ejercicio') {
    estado.clase = 'deporte';
    dibujarSelectorClase('deporte', alCambiarClase);
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
        nota: datos.nota,
        fecha: registro.fecha,
        nombres: nombresDeEjercicios(leerRegistros()),
        editando: true,
      },
      textoDeRitmo,
    );
  } else {
    estado.clase = 'plata';
    dibujarSelectorClase('plata', alCambiarClase);
    dibujarFormulario({
      tipo: datos.tipo,
      categoria: datos.categoria,
      medio: datos.medio,
      moneda: datos.moneda,
      monto: aTexto(datos.monto), // 3500.5 → "3500,5", como lo lee leerMonto
      detalle: datos.detalle,
      fecha: registro.fecha,
      proyecto: datos.proyecto,
      editando: true,
    });
  }
  // Se marca después de dibujar, porque dibujar un formulario nuevo deja editandoId en null.
  estado.editandoId = id;
  mostrarPestana('anotar');
}

/** Cancelar una edición: vuelve a Hoy con los formularios vacíos. */
function alCancelar() {
  formularioNuevo();
  formularioDeporteNuevo();
  mostrarPestana('hoy');
}

/** Borrar: pide confirmación; si ya se exportó, explica que queda anulado. */
function alBorrar(/** @type {string} */ id) {
  const registro = leerRegistros().find((r) => r.id === id);
  if (!registro) return;
  const nombre =
    registro.clase === 'ejercicio' ? resumenDeSesion(registro.datos, { corto: true }) : registro.datos.detalle;
  const pregunta =
    registro.exportado === null
      ? `¿Borrar «${nombre}»?`
      : `«${nombre}» ya se lo pasaste a Claude. Va a quedar anulado y se avisa en la próxima exportación. ¿Seguir?`;
  if (!confirm(pregunta)) return;
  try {
    almacen.borrar(id);
  } catch (error) {
    avisarError(error);
  }
  refrescar();
}

// ---------- Exportar ----------

/** Copiar para Claude: copia el texto y, si se pudo copiar, marca todo como exportado. */
async function alCopiar() {
  const registros = leerRegistros();
  const pend = pendientes(registros);
  const texto = textoParaClaude(pend, momentoLocal(), registros);
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    // Si no se pudo copiar, no se marca nada: así no queda nada como exportado sin estarlo.
    avisarError(new Error('No se pudo copiar. Abrí «Ver el texto» y copialo a mano.'));
    return;
  }
  const ids = [...pend.nuevos, ...pend.corregidos, ...pend.anulados].map((r) => r.id);
  try {
    estado.copiaExportacion = almacen.marcarExportados(ids);
    estado.ultimoTexto = texto;
    mostrarAviso('Copiado. Pegáselo a Claude.', { accion: { texto: 'Deshacer', alTocar: alDeshacer } });
  } catch (error) {
    avisarError(error);
  }
  refrescar();
}

/** Deshacer: vuelve a dejar pendiente lo de la última exportación. */
function alDeshacer() {
  if (!estado.copiaExportacion) return;
  try {
    almacen.deshacerExportacion(estado.copiaExportacion);
    estado.copiaExportacion = null;
    estado.ultimoTexto = null;
    mostrarAviso('Listo: vuelve a estar pendiente.');
  } catch (error) {
    avisarError(error);
  }
  refrescar();
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

/** Vuelve a dibujar Hoy y Exportar con los datos guardados. */
function refrescar() {
  const registros = leerRegistros();
  const dia = /** @type {HTMLInputElement} */ (document.getElementById('dia')).value || hoyLocal();
  const delDia = registrosDelDia(registros, dia);
  const plataDelDia = delDia.filter((r) => r.clase === 'finanza');

  dibujarHoy({
    registros: plataDelDia,
    totales: totales(plataDelDia),
    estadoDe: estadoDeExportacion,
    alEditar,
    alBorrar,
  });

  const lunes = lunesDe(dia);
  dibujarDeporteHoy({
    lunes,
    semana: resumenDeSemana(registros, lunes),
    sesiones: delDia.filter((r) => r.clase === 'ejercicio'),
    resumirSesion: (datos) => resumenDeSesion(datos, { corto: true }),
    estadoDe: estadoDeExportacion,
    alEditar,
    alBorrar,
  });

  const pend = pendientes(registros);
  const cuantos = { nuevos: pend.nuevos.length, corregidos: pend.corregidos.length, anulados: pend.anulados.length };
  const hayPendientes = cuantos.nuevos + cuantos.corregidos + cuantos.anulados > 0;
  dibujarExportar({
    cuantos,
    // Si no hay nada pendiente, se muestra el último texto copiado (por si hay que volver a copiarlo).
    texto: hayPendientes ? textoParaClaude(pend, momentoLocal(), registros) : (estado.ultimoTexto ?? textoParaClaude(pend, momentoLocal(), registros)),
    puedeDeshacer: estado.copiaExportacion !== null,
    ultimoRespaldo: almacen.leerUltimoRespaldo(),
  });
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
  /** @type {HTMLInputElement} */ (document.getElementById('dia')).value = hoyLocal();
  dibujarSelectorClase(estado.clase, alCambiarClase);
  conectarFormularioDeporte();
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
  document.getElementById('boton-copiar')?.addEventListener('click', alCopiar);
  document.getElementById('boton-deshacer')?.addEventListener('click', alDeshacer);
  document.getElementById('boton-descargar')?.addEventListener('click', alDescargar);
  document.getElementById('archivo-respaldo')?.addEventListener('change', alImportar);
  for (const boton of document.querySelectorAll('[data-ir]')) {
    boton.addEventListener('click', () => {
      mostrarPestana(/** @type {'anotar' | 'hoy' | 'exportar'} */ (/** @type {HTMLElement} */ (boton).dataset.ir));
      refrescar();
    });
  }

  // Recordar el respaldo semanal, si ya hay algo anotado.
  if (leerRegistros().length > 0 && tocaRespaldo(almacen.leerUltimoRespaldo(), hoyLocal())) {
    mostrarAviso('Hace una semana o más que no descargás un respaldo.', {
      persistente: true,
      accion: { texto: 'Ir', alTocar: () => mostrarPestana('exportar') },
    });
  }

  pedirPersistencia();
  registrarServiceWorker();
}

iniciar();
