# Registrador

Una app web para anotar desde el celular lo que pasa en el día: **ingresos y egresos**,
deporte, tiempo y comidas. Funciona sin internet y guarda todo en el celular.

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
- Copia el detalle de una semana o de un día como texto (la plata, en filas CSV), y permite
  descargar e importar un respaldo en JSON.
- No usa IA: todo funciona con reglas propias, para que ande sin internet.

## Estado

| Parte | Qué incluye | Estado |
|---|---|---|
| Plata | Ingresos y egresos, respaldo, uso sin conexión | Hecha |
| Deporte | Correr, fuerza y otras actividades, con el resumen de la semana | Hecha |
| Registros y Configuración | Ver el día o la semana; copiar el detalle | Hecha |
| Tiempo | Minutos y en qué fueron | Pendiente |
| Guardados | Sesiones y comidas que completan el formulario | Pendiente |
| Comidas | Con calorías y macros desde una hoja de cálculo | Pendiente |
| Texto libre y voz | Escribir o dictar una frase y que la app la entienda | Postergado |

## Stack

HTML, CSS y JavaScript. Tipos con JSDoc y `// @ts-check`.
Publicado con GitHub Pages.

## Pruebas

Con Node instalado (v24 o más nuevo), desde la carpeta del repo:

```bash
node --test
```
