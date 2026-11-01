# Registrador

Una app web para anotar desde el celular lo que pasa en el día: **ingresos y egresos**,
ejercicio, estudio y comidas. Funciona sin internet y guarda todo en el celular.

> **Herramienta personal, en desarrollo.** La pensé para mí: el objetivo es que anotar sea más
> fácil que olvidarse. Todavía no está lista para usar.

## Cómo se hizo

El código lo escribe una IA (Claude, de Anthropic) a partir de una especificación que armé yo:
qué tiene que hacer cada función, cómo se guardan los datos y qué se prueba. Cada función se
revisa conmigo antes de pasar a la siguiente. 

## Qué hace 

- Se instala en Android desde Chrome ("Agregar a la pantalla principal") y abre sin conexión.
- Los datos quedan en localStorage. No hay servidor, cuenta ni
  base de datos, y no se envía nada a ningún lado.
- Exporta lo anotado como texto y CSV, y permite descargar e importar un respaldo en JSON.
- No usa IA: interpreta lo que se escribe con reglas propias, para que funcione sin internet.

## Estado

| Fase | Qué incluye | Estado |
|---|---|---|
| 1 | Ingresos y egresos por formulario, exportar, respaldo, uso sin conexión | En construcción |
| 2 | Texto libre interpretado y dictado por voz | Pendiente |
| 3 | Ejercicio y estudio | Pendiente |
| 4 | Comidas | Pendiente |
| 5 | Vista para imprimir | Pendiente |

## Stack

HTML, CSS y JavaScript. Tipos con JSDoc y `// @ts-check`.
Publicado con GitHub Pages.

## Pruebas

Con Node instalado (v24 o más nuevo), desde la carpeta del repo:

```bash
node --test
```
