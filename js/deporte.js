// @ts-check

// Cuentas de deporte (§13 de la especificación). Funciones puras: reciben datos y devuelven
// datos o texto. Todo lo que se calcula acá (ritmo, kilos movidos, la semana) no se guarda:
// se calcula cada vez a partir de lo anotado (principio 5).

// Números con coma decimal y punto de miles, como se escriben en la Argentina: 9.6 → "9,6",
// 1250 → "1.250".
const NUMERO = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

/** @param {number} n */
function numeroAR(n) {
  return NUMERO.format(n);
}

// ---------- Corridas ----------

/**
 * El ritmo de una corrida, en segundos por kilómetro (redondeado al segundo).
 *
 * @param {number} minutos
 * @param {number} km
 * @returns {number | null} null si no hay km (no se puede dividir por 0)
 */
export function segundosPorKm(minutos, km) {
  if (!(km > 0)) return null;
  return Math.round((minutos * 60) / km);
}

/**
 * 600 → "10:00 min/km" · 605 → "10:05 min/km".
 *
 * @param {number} segundos
 */
export function formatearRitmo(segundos) {
  const min = Math.floor(segundos / 60);
  const seg = String(segundos % 60).padStart(2, '0');
  return `${min}:${seg} min/km`;
}

// ---------- Fuerza ----------

/**
 * Los kilos movidos en una sesión: la suma de series × repeticiones × kg de cada ejercicio con
 * peso. Los de peso corporal (kg vacío) no suman acá: suman en repeticionesTotales.
 *
 * @param {import('./tipos.js').Ejercicio[]} ejercicios
 * @returns {number}
 */
export function kilosMovidos(ejercicios) {
  let total = 0;
  for (const { series, repeticiones, kg } of ejercicios) {
    if (kg) total += (series ?? 0) * (repeticiones ?? 0) * kg;
  }
  return Math.round(total * 100) / 100; // a centésimos, por los restos de los decimales en binario
}

/**
 * Todas las repeticiones de una sesión, con peso y sin peso.
 *
 * @param {import('./tipos.js').Ejercicio[]} ejercicios
 * @returns {number}
 */
export function repeticionesTotales(ejercicios) {
  return ejercicios.reduce((suma, e) => suma + (e.series ?? 0) * (e.repeticiones ?? 0), 0);
}

/**
 * "sentadilla 3x12 12,5 kg" · "flexiones 3x10" (sin kg: peso corporal).
 *
 * @param {import('./tipos.js').Ejercicio} e
 */
function describirEjercicio(e) {
  const peso = e.kg ? ` ${numeroAR(e.kg)} kg` : '';
  return `${e.nombre} ${e.series}x${e.repeticiones}${peso}`;
}

/**
 * Los ejercicios de la última sesión de fuerza (sin contar anuladas), para el botón "Repetir la
 * última sesión". Lista vacía si no hay ninguna.
 *
 * @param {import('./tipos.js').Registro[]} registros
 * @returns {import('./tipos.js').Ejercicio[]}
 */
export function ultimaSesionDeFuerza(registros) {
  let ultima = null;
  for (const r of registros) {
    if (r.clase !== 'ejercicio' || r.anulado || r.datos.actividad !== 'fuerza') continue;
    if (r.datos.ejercicios.length === 0) continue; // una sesión sin detalle no sirve para repetir
    if (!ultima || r.creado > ultima.creado) ultima = r;
  }
  // Se devuelve una copia, para que cambiarla en el formulario no cambie lo guardado.
  return ultima ? ultima.datos.ejercicios.map((/** @type {any} */ e) => ({ ...e })) : [];
}

/**
 * Los nombres de ejercicios usados alguna vez, sin repetir y en orden alfabético, para
 * sugerirlos al escribir.
 *
 * @param {import('./tipos.js').Registro[]} registros
 * @returns {string[]}
 */
export function nombresDeEjercicios(registros) {
  const nombres = new Set(); // un Set guarda cada valor una sola vez
  for (const r of registros) {
    if (r.clase !== 'ejercicio' || r.anulado) continue;
    for (const e of r.datos.ejercicios) nombres.add(e.nombre);
  }
  return [...nombres].sort((a, b) => a.localeCompare(b, 'es'));
}

// ---------- Una sesión en una línea ----------

/**
 * Describe una sesión en una línea, para la lista de Hoy y para el texto que se exporta.
 *
 * - correr: "correr · 3,2 km · 32 min · 10:00 min/km"
 * - fuerza: "fuerza · 40 min · sentadilla 3x12 12,5 kg; flexiones 3x10 · 450 kg movidos"
 *   (corto: "fuerza · 40 min · 2 ejercicios · 450 kg movidos")
 * - otro:   "otro · limpieza del fondo · 90 min"
 * El detalle (en correr y fuerza) y la nota se suman al final si los hay; la nota, sólo en la
 * versión larga.
 *
 * @param {import('./tipos.js').DatosEjercicio} d
 * @param {{corto?: boolean}} [opciones] corto: para la lista de Hoy
 * @returns {string}
 */
export function resumenDeSesion(d, { corto = false } = {}) {
  const partes = [d.actividad];

  if (d.actividad === 'otro') partes.push(d.detalle);
  if (d.km) partes.push(`${numeroAR(d.km)} km`);
  partes.push(`${d.minutos} min`);

  if (d.actividad === 'correr' && d.km && d.minutos) {
    const ritmo = segundosPorKm(d.minutos, d.km);
    if (ritmo !== null) partes.push(formatearRitmo(ritmo));
  }

  if (d.actividad === 'fuerza' && d.ejercicios.length > 0) {
    partes.push(
      corto
        ? `${d.ejercicios.length} ejercicio${d.ejercicios.length === 1 ? '' : 's'}`
        : d.ejercicios.map(describirEjercicio).join('; '),
    );
    const kilos = kilosMovidos(d.ejercicios);
    if (kilos > 0) partes.push(`${numeroAR(kilos)} kg movidos`);
  }

  if (d.actividad !== 'otro' && d.detalle) partes.push(d.detalle);
  if (!corto && d.nota) partes.push(`nota: ${d.nota}`);

  return partes.join(' · ');
}

// ---------- La semana ----------

/**
 * El lunes de la semana de una fecha (las semanas van de lunes a domingo, como en S03).
 *
 * @param {string} fecha "aaaa-mm-dd"
 * @returns {string} "aaaa-mm-dd"
 */
export function lunesDe(fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  // getUTCDay da 0 el domingo, 1 el lunes… 6 el sábado. Días que hay que volver hasta el lunes:
  // lunes 0, martes 1… domingo 6.
  const desdeElLunes = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - desdeElLunes);
  return d.toISOString().slice(0, 10); // en UTC no hay corrimiento: es la fecha armada arriba
}

/**
 * Suma una cantidad de días a una fecha.
 *
 * @param {string} fecha "aaaa-mm-dd"
 * @param {number} dias
 */
function sumarDias(fecha, dias) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/**
 * Lo de una semana, para la fila de Métricas de S03 y el indicador de las 168 h.
 * - corridas y fuerza: cuántas sesiones;
 * - km: sólo los de las corridas (caminar o la bici no son parte de lo que mide S03);
 * - minutos: de todas las actividades (es el entrenamiento real de la semana).
 *
 * @param {import('./tipos.js').Registro[]} registros
 * @param {string} lunes el lunes de la semana, "aaaa-mm-dd"
 * @returns {{corridas: number, fuerza: number, km: number, minutos: number}}
 */
export function resumenDeSemana(registros, lunes) {
  const domingo = sumarDias(lunes, 6);
  const semana = { corridas: 0, fuerza: 0, km: 0, minutos: 0 };
  for (const r of registros) {
    if (r.clase !== 'ejercicio' || r.anulado) continue;
    if (r.fecha < lunes || r.fecha > domingo) continue;
    const d = r.datos;
    if (d.actividad === 'correr') {
      semana.corridas++;
      semana.km += d.km ?? 0;
    }
    if (d.actividad === 'fuerza') semana.fuerza++;
    semana.minutos += d.minutos ?? 0;
  }
  semana.km = Math.round(semana.km * 100) / 100;
  return semana;
}

/**
 * La fila de Métricas de S03: | Semana | Corridas | Fuerza | km | Peso | Nota |.
 * El peso queda vacío (no se registra en esta fase) y las horas van en la nota.
 *
 * @param {ReturnType<typeof resumenDeSemana>} semana
 * @param {string} lunes "aaaa-mm-dd"
 * @returns {string} por ejemplo "| 02/11/2026 | 3 | 2 | 9,6 | | 2,9 h de entrenamiento |"
 */
export function filaSemanalS03(semana, lunes) {
  const [anio, mes, dia] = lunes.split('-');
  const horas = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(semana.minutos / 60);
  return `| ${dia}/${mes}/${anio} | ${semana.corridas} | ${semana.fuerza} | ${numeroAR(semana.km)} | | ${horas} h de entrenamiento |`;
}
