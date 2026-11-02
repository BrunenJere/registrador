// Service worker: guarda en el celular una copia de la app para que abra sin internet.
//
// AL PUBLICAR UN CAMBIO hay que subir el número de VERSION. Si no, el celular sigue usando la
// copia vieja. Y si se agrega un archivo a la app, hay que sumarlo a ARCHIVOS.

const VERSION = 'registrador-v2';

const ARCHIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/estilos.css',
  './js/app.js',
  './js/deporte.js',
  './js/almacen.js',
  './js/exportar.js',
  './js/fechas.js',
  './js/listas.js',
  './js/numeros.js',
  './js/pantalla.js',
  './js/respaldo.js',
  './js/resumen.js',
  './js/validar.js',
  './iconos/icono.svg',
  './iconos/icono-192.png',
  './iconos/icono-512.png',
];

// Al instalarse: guardar la copia de todos los archivos.
self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ARCHIVOS)));
});

// Al activarse: borrar las copias de versiones viejas. Sólo las del registrador, porque todas
// las apps de brunenjere.github.io comparten el mismo lugar.
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombres) =>
        Promise.all(
          nombres
            .filter((nombre) => nombre.startsWith('registrador-') && nombre !== VERSION)
            .map((nombre) => caches.delete(nombre)),
        ),
      ),
  );
});

// Cada vez que la app pide un archivo: darlo desde la copia y, si no está, buscarlo en internet.
self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;
  evento.respondWith(
    caches.match(evento.request).then((guardado) => guardado || fetch(evento.request)),
  );
});

// Cuando la app avisa que se tocó "Recargar", la versión nueva deja de esperar y toma el control.
self.addEventListener('message', (evento) => {
  if (evento.data === 'activar') self.skipWaiting();
});
