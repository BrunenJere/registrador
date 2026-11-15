// @ts-check

import { buscarAlimento, leerDecimal, leerTablaCSV, valoresPorPorciones } from './alimentos.js';
import { crearAlmacen, pedirPersistencia } from './almacen.js';
import { alimentosAnotados, resumenDeComida, totalesDeComida, totalesDeComidas } from './comidas.js';
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
import { buscarGuardado, guardadosDe } from './guardados.js';
import { leerEntero, leerMonto } from './numeros.js';
import { descargarRespaldo, importarRespaldo, tocaRespaldo } from './respaldo.js';
import { registrosDelDia, registrosDelPeriodo, totales, ultimoMedio } from './resumen.js';
import { resumenDeTiempo, temasDeTiempo, tiempoPorTema } from './tiempo.js';
import { validarComida, validarEjercicio, validarFinanza, validarTiempo } from './validar.js';
import {
  agregarEjercicio,
  agregarItemComida,
  cargarEjercicios,
  cargarItemsComida,
  conectarFormularioDeporte,
  conectarGuardados,
  conectarMenuClase,
  dibujarConfiguracion,
  dibujarFormulario,
  dibujarFormularioComida,
  dibujarFormularioDeporte,
  dibujarFormularioTiempo,
  dibujarGuardados,
  dibujarPeriodoDetalle,
  dibujarRegistrosDia,
  dibujarRegistrosSemana,
  dibujarVistaRegistros,
  elegirClase,
  leerFecha,
  leerFechaDetalle,
  leerFechaRegistros,
  leerFormulario,
  leerFormularioComida,
  leerFormularioDeporte,
  leerFormularioTiempo,
  mostrarAviso,
  mostrarErrores,
  mostrarPestana,
  ponerFecha,
} from './pantalla.js';

// Arranque y conexiones: cada botón llama a la lógica y después se vuelve a dibujar.
// Es el único archivo que conoce a la vez la pantalla y los datos.

const almacen = crearAlmacen();

/** @typedef {'plata' | 'deporte' | 'tiempo' | 'comidas'} ClaseDeAnotar */

/** La clase guardada en el registro para cada opción del menú "Qué". */
const CLASE_DE_REGISTRO = { plata: 'finanza', deporte: 'ejercicio', tiempo: 'tiempo', comidas: 'comida' };

/** Estado que vive sólo mientras la app está abierta. */
const estado = {
  /** @type {ClaseDeAnotar} qué formulario se ve en Anotar */
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

/** Lee los guardados; si están dañados, avisa y devuelve una lista vacía. */
function leerGuardados() {
  try {
    return almacen.leerGuardados();
  } catch (error) {
    avisarError(error);
    return [];
  }
}

/** Lee la tabla de alimentos; si está dañada, avisa y devuelve una lista vacía. */
function leerAlimentos() {
  try {
    return almacen.leerAlimentos();
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

/** 3.5 → "3,5", como se escribe en el formulario. null → "". */
function aTexto(/** @type {number | null | undefined} */ numero) {
  return numero === null || numero === undefined ? '' : String(numero).replace('.', ',');
}

/** El registro que se está editando, o null si se está anotando uno nuevo. */
function registroEditado() {
  return estado.editandoId ? (leerRegistros().find((r) => r.id === estado.editandoId) ?? null) : null;
}

/**
 * Un número opcional escrito a la argentina (km, kg): vacío es null. Si se escribió algo que no
 * se puede leer, da NaN, para que la validación lo marque en vez de tomarlo como vacío.
 */
function numeroOpcional(/** @type {string} */ texto) {
  return texto.trim() === '' ? null : (leerMonto(texto) ?? NaN);
}

/**
 * Un decimal opcional de una comida (porciones, kcal, macros): acepta 0 y coma o punto decimal.
 * Vacío es null; algo que no se puede leer, NaN.
 */
function decimalOpcional(/** @type {string} */ texto) {
  return texto.trim() === '' ? null : (leerDecimal(texto) ?? NaN);
}

// ---------- Qué se anota ----------

/** Deja los cuatro formularios vacíos (y sin edición en curso). */
function formulariosNuevos() {
  formularioNuevo();
  formularioDeporteNuevo();
  formularioTiempoNuevo();
  formularioComidaNuevo();
}

/** Cambia el formulario que se ve. Si se estaba editando algo, se cancela la edición. */
function alCambiarClase(/** @type {ClaseDeAnotar} */ clase) {
  estado.clase = clase;
  if (estado.editandoId) {
    formulariosNuevos();
    ponerFecha(hoyLocal());
  }
  elegirClase(clase);
}

// ---------- Plata ----------

/** Deja el formulario de plata listo para anotar uno nuevo. */
function formularioNuevo() {
  estado.editandoId = null;
  dibujarFormulario({ tipo: 'egreso', categoria: '', medio: ultimoMedio(leerRegistros()), monto: '', detalle: '', editando: false });
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
  if (errores.length > 0) return mostrarErrores(errores, 'formulario');
  if (guardar('finanza', registro)) formularioNuevo();
}

// ---------- Deporte ----------

/** Los datos de deporte como texto, para el formulario (de un registro o de un guardado). */
function deporteATexto(/** @type {any} */ datos) {
  return {
    actividad: datos.actividad,
    km: aTexto(datos.km),
    minutos: String(datos.minutos ?? ''),
    detalle: datos.detalle ?? '',
    ejercicios: (datos.ejercicios ?? []).map((/** @type {import('./tipos.js').Ejercicio} */ e) => ({
      nombre: e.nombre,
      series: String(e.series ?? ''),
      repeticiones: String(e.repeticiones ?? ''),
      kg: aTexto(e.kg),
    })),
  };
}

/** Deja el formulario de deporte listo para anotar una sesión nueva. */
function formularioDeporteNuevo() {
  estado.editandoId = null;
  dibujarFormularioDeporte(
    { actividad: estado.ultimaActividad, km: '', minutos: '', detalle: '', ejercicios: [], nombres: nombresDeEjercicios(leerRegistros()), editando: false },
    textoDeRitmo,
  );
  redibujarGuardados('deporte');
}

/** El ritmo mientras se escribe: "Ritmo: 10:00 min/km", o '' si todavía no se puede calcular. */
function textoDeRitmo(/** @type {string} */ kmTexto, /** @type {string} */ minutosTexto) {
  const km = leerMonto(kmTexto);
  const minutos = leerEntero(minutosTexto);
  if (km === null || !minutos) return '';
  const segundos = segundosPorKm(minutos, km);
  return segundos === null ? '' : `Ritmo: ${formatearRitmo(segundos)}`;
}

/** Los datos de deporte del formulario, ya convertidos (para guardar o para un guardado). */
function datosDeDeporte() {
  const f = leerFormularioDeporte();
  const esFuerza = f.actividad === 'fuerza';
  return {
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
  };
}

/** Guardar deporte: convertir los números, validar y, si no hay errores, agregar o editar. */
function alGuardarDeporte(/** @type {SubmitEvent} */ evento) {
  evento.preventDefault();
  const original = registroEditado();
  const datos = { ...datosDeDeporte(), nota: original?.datos.nota ?? '' }; // la nota ya no se pregunta; al editar, se conserva
  const registro = { fecha: leerFecha(), datos };
  const errores = validarEjercicio(registro);
  if (errores.length > 0) return mostrarErrores(errores, 'formulario-deporte');
  estado.ultimaActividad = datos.actividad;
  if (guardar('ejercicio', registro)) formularioDeporteNuevo();
}

/** Repetir la última sesión: copia los ejercicios de la última fuerza al formulario. */
function alRepetir() {
  const ejercicios = ultimaSesionDeFuerza(leerRegistros());
  if (ejercicios.length === 0) {
    mostrarAviso('Todavía no hay una sesión de fuerza con ejercicios para repetir.');
    return;
  }
  cargarEjercicios(deporteATexto({ ejercicios }).ejercicios);
}

// ---------- Tiempo ----------

/** Deja el formulario de tiempo listo para anotar uno nuevo. */
function formularioTiempoNuevo() {
  estado.editandoId = null;
  dibujarFormularioTiempo({ minutos: '', que: '', temas: temasDeTiempo(leerRegistros()), editando: false });
}

/** Guardar tiempo: validar y, si no hay errores, agregar o editar. */
function alGuardarTiempo(/** @type {SubmitEvent} */ evento) {
  evento.preventDefault();
  const f = leerFormularioTiempo();
  const registro = { fecha: leerFecha(), datos: { minutos: leerEntero(f.minutosTexto), que: f.que } };
  const errores = validarTiempo(registro);
  if (errores.length > 0) return mostrarErrores(errores, 'formulario-tiempo');
  if (guardar('tiempo', registro)) formularioTiempoNuevo();
}

// ---------- Comidas ----------

/** Los datos de una comida como texto, para el formulario (de un registro o de un guardado). */
function comidaATexto(/** @type {any} */ datos) {
  return {
    momento: datos.momento,
    detalle: datos.detalle ?? '',
    items: (datos.items ?? []).map((/** @type {any} */ i) => ({
      alimento: i.alimento,
      porciones: aTexto(i.porciones),
      kcal: aTexto(i.kcal),
      proteinas: aTexto(i.proteinas),
      carbohidratos: aTexto(i.carbohidratos),
      grasas: aTexto(i.grasas),
    })),
  };
}

/** Los items de una comida, ya convertidos de texto a números. */
function itemsDeTexto(/** @type {import('./pantalla.js').ItemTexto[]} */ items) {
  return items.map((i) => ({
    alimento: i.alimento,
    porciones: decimalOpcional(i.porciones),
    kcal: decimalOpcional(i.kcal),
    proteinas: decimalOpcional(i.proteinas),
    carbohidratos: decimalOpcional(i.carbohidratos),
    grasas: decimalOpcional(i.grasas),
  }));
}

/** Lo que el formulario de comidas necesita para ayudar: la tabla y los totales. */
const ayudaComidas = {
  /** Si el alimento está en la tabla, sus valores para esas porciones (como texto). */
  buscarEnTabla(/** @type {string} */ alimento, /** @type {string} */ porcionesTexto) {
    const encontrado = buscarAlimento(leerAlimentos(), alimento);
    const porciones = leerDecimal(porcionesTexto);
    if (!encontrado || porciones === null) return null;
    const v = valoresPorPorciones(encontrado, porciones);
    return {
      valores: { kcal: aTexto(v.kcal), proteinas: aTexto(v.proteinas), carbohidratos: aTexto(v.carbohidratos), grasas: aTexto(v.grasas) },
      porcion: encontrado.porcion,
    };
  },
  /** La línea de totales de la comida, mientras se escribe. */
  totalDeItems(/** @type {import('./pantalla.js').ItemTexto[]} */ items) {
    const conNumeros = itemsDeTexto(items).map((i) => ({
      ...i,
      // lo que todavía no se puede leer cuenta como vacío en el total (la validación lo marca al guardar)
      kcal: Number.isFinite(i.kcal) ? i.kcal : null,
      proteinas: Number.isFinite(i.proteinas) ? i.proteinas : null,
      carbohidratos: Number.isFinite(i.carbohidratos) ? i.carbohidratos : null,
      grasas: Number.isFinite(i.grasas) ? i.grasas : null,
    }));
    if (conNumeros.length === 0) return '';
    const t = totalesDeComida(conNumeros);
    const f = (/** @type {number} */ n) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(n);
    const faltan = t.sinValores > 0 ? ` (${t.sinValores} sin kcal)` : '';
    return `Total: ${f(t.kcal)} kcal · P ${f(t.proteinas)} g · C ${f(t.carbohidratos)} g · G ${f(t.grasas)} g${faltan}`;
  },
};

/** Los alimentos para sugerir: los de la tabla y los ya anotados, sin repetir. */
function alimentosParaSugerir() {
  const nombres = new Map();
  for (const nombre of [...leerAlimentos().map((a) => a.alimento), ...alimentosAnotados(leerRegistros())]) {
    nombres.set(nombre.toLowerCase(), nombre);
  }
  return [...nombres.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

/** Deja el formulario de comidas listo para anotar una nueva, con un alimento vacío. */
function formularioComidaNuevo() {
  estado.editandoId = null;
  dibujarFormularioComida(
    {
      momento: '',
      items: [{ alimento: '', porciones: '1', kcal: '', proteinas: '', carbohidratos: '', grasas: '' }],
      detalle: '',
      alimentos: alimentosParaSugerir(),
      editando: false,
    },
    ayudaComidas,
  );
  redibujarGuardados('comidas');
}

/** Los datos de la comida del formulario, ya convertidos. */
function datosDeComida() {
  const f = leerFormularioComida();
  return { momento: f.momento, items: itemsDeTexto(f.items), detalle: f.detalle };
}

/** Guardar comida: validar y, si no hay errores, agregar o editar. */
function alGuardarComida(/** @type {SubmitEvent} */ evento) {
  evento.preventDefault();
  const registro = { fecha: leerFecha(), datos: datosDeComida() };
  const errores = validarComida(registro);
  if (errores.length > 0) return mostrarErrores(errores, 'formulario-comidas');
  if (guardar('comida', registro)) formularioComidaNuevo();
}

// ---------- Guardados (deporte y comidas) ----------

/** @typedef {'deporte' | 'comidas'} DondeGuardados */

/** Vuelve a llenar el menú de guardados de un formulario. */
function redibujarGuardados(/** @type {DondeGuardados} */ donde, elegido = '') {
  dibujarGuardados(donde, guardadosDe(leerGuardados(), CLASE_DE_REGISTRO[donde]), elegido);
}

/** Elegir un guardado: completa el formulario. No guarda nada. */
function alElegirGuardado(/** @type {DondeGuardados} */ donde, /** @type {string} */ id) {
  const guardado = leerGuardados().find((g) => g.id === id);
  if (!guardado) return;
  if (donde === 'deporte') {
    dibujarFormularioDeporte(
      { ...deporteATexto(guardado.datos), nombres: nombresDeEjercicios(leerRegistros()), editando: estado.editandoId !== null },
      textoDeRitmo,
    );
  } else {
    dibujarFormularioComida(
      { ...comidaATexto(guardado.datos), alimentos: alimentosParaSugerir(), editando: estado.editandoId !== null },
      ayudaComidas,
    );
  }
  redibujarGuardados(donde, id);
  mostrarAviso(`Se completó con «${guardado.nombre}». Revisá y tocá Guardar.`);
}

/**
 * Guardar como…: guarda lo que está en el formulario con un nombre. Pasa por la misma validación
 * que un registro (con la fecha de hoy, que no se guarda), así un guardado nunca queda a medias.
 */
function alGuardarComo(/** @type {DondeGuardados} */ donde) {
  const esDeporte = donde === 'deporte';
  const datos = esDeporte ? datosDeDeporte() : datosDeComida();
  const errores = esDeporte ? validarEjercicio({ fecha: hoyLocal(), datos: { ...datos, nota: '' } }) : validarComida({ fecha: hoyLocal(), datos });
  if (errores.length > 0) {
    mostrarErrores(errores, esDeporte ? 'formulario-deporte' : 'formulario-comidas');
    mostrarAviso('Completá el formulario antes de guardarlo.');
    return;
  }
  const nombre = prompt(esDeporte ? 'Nombre del guardado (por ejemplo, Run easy):' : 'Nombre del guardado (por ejemplo, Desayuno de siempre):');
  if (!nombre || !nombre.trim()) return;
  const clase = CLASE_DE_REGISTRO[donde];
  if (buscarGuardado(leerGuardados(), clase, nombre) && !confirm(`Ya hay un guardado «${nombre.trim()}». ¿Reemplazarlo?`)) return;
  try {
    const guardado = almacen.agregarGuardado({ clase, nombre, datos });
    redibujarGuardados(donde, guardado.id);
    mostrarAviso(`Guardado como «${guardado.nombre}».`);
  } catch (error) {
    avisarError(error);
  }
}

/** Borrar un guardado (no toca los registros que se anotaron con él). */
function alBorrarGuardado(/** @type {DondeGuardados} */ donde, /** @type {string} */ id) {
  const guardado = leerGuardados().find((g) => g.id === id);
  if (!guardado || !confirm(`¿Borrar el guardado «${guardado.nombre}»? Lo ya anotado no cambia.`)) return;
  try {
    almacen.borrarGuardado(id);
    redibujarGuardados(donde);
  } catch (error) {
    avisarError(error);
  }
}

// ---------- Guardar, editar y borrar (todas las clases) ----------

/**
 * Agrega o edita un registro ya validado y vuelve a dibujar.
 *
 * @param {string} clase "finanza", "ejercicio", "tiempo" o "comida"
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
    dibujarFormularioDeporte({ ...deporteATexto(datos), nombres: nombresDeEjercicios(leerRegistros()), editando: true }, textoDeRitmo);
  } else if (registro.clase === 'tiempo') {
    estado.clase = 'tiempo';
    dibujarFormularioTiempo({ minutos: String(datos.minutos ?? ''), que: datos.que, temas: temasDeTiempo(leerRegistros()), editando: true });
  } else if (registro.clase === 'comida') {
    estado.clase = 'comidas';
    dibujarFormularioComida({ ...comidaATexto(datos), alimentos: alimentosParaSugerir(), editando: true }, ayudaComidas);
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
  formulariosNuevos();
  ponerFecha(hoyLocal());
  mostrarPestana('registros');
}

/** Cómo se nombra un registro en la pregunta de Borrar. */
function nombreDe(/** @type {import('./tipos.js').Registro} */ registro) {
  if (registro.clase === 'ejercicio') return resumenDeSesion(registro.datos, { corto: true });
  if (registro.clase === 'tiempo') return resumenDeTiempo(registro.datos);
  if (registro.clase === 'comida') return resumenDeComida(registro.datos);
  return registro.datos.detalle || registro.datos.categoria;
}

/** Borrar: pide confirmación y lo saca. */
function alBorrar(/** @type {string} */ id) {
  const registro = leerRegistros().find((r) => r.id === id);
  if (!registro || !confirm(`¿Borrar «${nombreDe(registro)}»?`)) return;
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

/** Descargar respaldo (registros, guardados y tabla) y anotar la fecha. */
function alDescargar() {
  try {
    descargarRespaldo(almacen.leerTodos(), { guardados: almacen.leerGuardados(), alimentos: almacen.leerAlimentos() });
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
    const extras = [r.guardados > 0 ? `${r.guardados} guardados` : '', r.tabla ? 'la tabla de comidas' : ''].filter(Boolean);
    mostrarAviso(
      `Importado: ${r.agregados} nuevos, ${r.actualizados} actualizados, ${r.sin_cambios} sin cambios` +
        (extras.length > 0 ? `, y ${extras.join(' y ')}.` : '.'),
    );
    formulariosNuevos();
  } catch (error) {
    avisarError(error);
  }
  refrescar();
}

/** Cargar la tabla de comidas desde un CSV. Si tiene errores, no se carga nada. */
async function alCargarTabla(/** @type {Event} */ evento) {
  const entrada = /** @type {HTMLInputElement} */ (evento.target);
  const archivo = entrada.files?.[0];
  entrada.value = '';
  if (!archivo) return;
  const { alimentos, errores } = leerTablaCSV(await archivo.text());
  if (errores.length > 0) {
    const primeros = errores.slice(0, 3).join(' ');
    const mas = errores.length > 3 ? ` Y ${errores.length - 3} más.` : '';
    avisarError(new Error(`No se cargó la tabla. ${primeros}${mas}`));
    return;
  }
  if (leerAlimentos().length > 0 && !confirm(`¿Reemplazar la tabla actual por esta, con ${alimentos.length} alimentos?`)) return;
  try {
    almacen.guardarAlimentos(alimentos);
    mostrarAviso(`Se cargaron ${alimentos.length} alimentos.`);
    formularioComidaNuevo();
  } catch (error) {
    avisarError(error);
  }
  refrescar();
}

/** Borrar la tabla de comidas (las comidas ya anotadas no cambian). */
function alBorrarTabla() {
  if (!confirm('¿Borrar la tabla de comidas? Las comidas ya anotadas no cambian.')) return;
  try {
    almacen.guardarAlimentos([]);
    formularioComidaNuevo();
  } catch (error) {
    avisarError(error);
  }
  refrescar();
}

// ---------- Dibujar ----------

const acciones = { alEditar, alBorrar };

/** Cómo se describe cada clase en las listas. */
const resumir = {
  sesion: (/** @type {any} */ datos) => resumenDeSesion(datos, { corto: true }),
  comida: (/** @type {any} */ datos) => resumenDeComida(datos),
};

/** Vuelve a dibujar Registros y Configuración con los datos guardados. */
function refrescar() {
  const registros = leerRegistros();
  const fecha = leerFechaRegistros() || hoyLocal();
  const lunes = lunesDe(fecha);
  const semana = resumenDeSemana(registros, lunes);
  /** @param {import('./tipos.js').Registro[]} lista @param {string} clase */
  const deClase = (lista, clase) => lista.filter((r) => r.clase === clase);

  if (estado.vista === 'día') {
    const delDia = registrosDelDia(registros, fecha);
    const plata = deClase(delDia, 'finanza');
    const comidas = deClase(delDia, 'comida');
    dibujarRegistrosDia({
      plata,
      totales: totales(plata),
      lunes,
      semana,
      sesiones: deClase(delDia, 'ejercicio'),
      tiempo: deClase(delDia, 'tiempo'),
      comidas,
      totalesComidas: totalesDeComidas(comidas),
      resumir,
      acciones,
    });
  } else {
    const deLaSemana = registrosDelPeriodo(registros, lunes, sumarDias(lunes, 6));
    const comidas = deClase(deLaSemana, 'comida');
    dibujarRegistrosSemana({
      lunes,
      totales: totales(deLaSemana),
      semana,
      porTema: tiempoPorTema(deLaSemana),
      totalesComidas: totalesDeComidas(comidas),
      diasConComidas: new Set(comidas.map((r) => r.fecha)).size,
      registros: deLaSemana,
      resumir,
      acciones,
    });
  }

  const { desde, hasta } = periodoDetalle();
  dibujarConfiguracion({
    desde,
    hasta,
    texto: textoDeDetalle(registros, desde, hasta, momentoLocal()),
    ultimoRespaldo: almacen.leerUltimoRespaldo(),
    alimentosEnTabla: leerAlimentos().length,
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
  for (const donde of /** @type {const} */ (['deporte', 'comidas'])) {
    conectarGuardados(donde, {
      alElegir: (id) => alElegirGuardado(donde, id),
      alGuardarComo: () => alGuardarComo(donde),
      alBorrar: (id) => alBorrarGuardado(donde, id),
    });
  }
  elegirClase(estado.clase);
  formulariosNuevos();
  refrescar();

  /** @param {string} id @param {string} evento @param {(e: any) => void} accion */
  const conectar = (id, evento, accion) => document.getElementById(id)?.addEventListener(evento, accion);
  conectar('formulario', 'submit', alGuardar);
  conectar('formulario-deporte', 'submit', alGuardarDeporte);
  conectar('formulario-tiempo', 'submit', alGuardarTiempo);
  conectar('formulario-comidas', 'submit', alGuardarComida);
  for (const id of ['boton-cancelar', 'boton-cancelar-deporte', 'boton-cancelar-tiempo', 'boton-cancelar-comidas']) {
    conectar(id, 'click', alCancelar);
  }
  conectar('boton-agregar-ejercicio', 'click', agregarEjercicio);
  conectar('boton-repetir', 'click', alRepetir);
  conectar('boton-agregar-item', 'click', agregarItemComida);
  conectar('dia', 'change', refrescar);
  conectar('fecha-detalle', 'change', refrescar);
  conectar('boton-copiar', 'click', alCopiar);
  conectar('boton-descargar', 'click', alDescargar);
  conectar('archivo-respaldo', 'change', alImportar);
  conectar('archivo-tabla', 'change', alCargarTabla);
  conectar('boton-borrar-tabla', 'click', alBorrarTabla);
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
