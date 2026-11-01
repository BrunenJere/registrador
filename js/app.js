// @ts-check

import { crearAlmacen, pedirPersistencia } from './almacen.js';
import { estadoDeExportacion, pendientes, textoParaClaude } from './exportar.js';
import { hoyLocal, momentoLocal } from './fechas.js';
import { leerMonto } from './numeros.js';
import { descargarRespaldo, importarRespaldo, tocaRespaldo } from './respaldo.js';
import { registrosDelDia, totales, ultimoMedio } from './resumen.js';
import { validarFinanza } from './validar.js';
import {
  dibujarExportar,
  dibujarFormulario,
  dibujarHoy,
  leerFormulario,
  mostrarAviso,
  mostrarErrores,
  mostrarPestana,
} from './pantalla.js';

// Arranque y conexiones: cada botón llama a la lógica y después se vuelve a dibujar.
// Es el único archivo que conoce a la vez la pantalla y los datos.

const almacen = crearAlmacen();

/** Estado que vive sólo mientras la app está abierta. */
const estado = {
  /** @type {string | null} el id del registro que se está editando, o null si es uno nuevo */
  editandoId: null,
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

// ---------- Formulario ----------

/** Deja el formulario listo para anotar uno nuevo. */
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

/** Guardar: convertir el monto, validar y, si no hay errores, agregar o editar. */
function alGuardar(/** @type {SubmitEvent} */ evento) {
  evento.preventDefault(); // que el formulario no recargue la página
  const { fecha, montoTexto, datos } = leerFormulario();
  const registro = { fecha, datos: { ...datos, monto: leerMonto(montoTexto) } };

  const errores = validarFinanza(registro);
  if (errores.length > 0) {
    mostrarErrores(errores);
    return;
  }

  try {
    if (estado.editandoId) {
      almacen.editar(estado.editandoId, registro);
      mostrarAviso('Cambios guardados.');
      formularioNuevo();
      mostrarPestana('hoy');
    } else {
      almacen.agregar({ clase: 'finanza', ...registro });
      mostrarAviso('Guardado.');
      formularioNuevo();
    }
  } catch (error) {
    avisarError(error);
  }
  refrescar();
}

/** Editar: carga el registro en el formulario y va a Anotar. */
function alEditar(/** @type {string} */ id) {
  const registro = leerRegistros().find((r) => r.id === id);
  if (!registro) return;
  estado.editandoId = id;
  const { datos } = registro;
  dibujarFormulario({
    tipo: datos.tipo,
    categoria: datos.categoria,
    medio: datos.medio,
    moneda: datos.moneda,
    monto: String(datos.monto).replace('.', ','), // 3500.5 → "3500,5", como lo lee leerMonto
    detalle: datos.detalle,
    fecha: registro.fecha,
    proyecto: datos.proyecto,
    editando: true,
  });
  mostrarPestana('anotar');
}

/** Borrar: pide confirmación; si ya se exportó, explica que queda anulado. */
function alBorrar(/** @type {string} */ id) {
  const registro = leerRegistros().find((r) => r.id === id);
  if (!registro) return;
  const pregunta =
    registro.exportado === null
      ? `¿Borrar «${registro.datos.detalle}»?`
      : `«${registro.datos.detalle}» ya se lo pasaste a Claude. Va a quedar anulado y se avisa en la próxima exportación. ¿Seguir?`;
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

  dibujarHoy({
    registros: delDia,
    totales: totales(delDia),
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
  formularioNuevo();
  refrescar();

  document.getElementById('formulario')?.addEventListener('submit', alGuardar);
  document.getElementById('boton-cancelar')?.addEventListener('click', () => {
    formularioNuevo();
    mostrarPestana('hoy');
  });
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
