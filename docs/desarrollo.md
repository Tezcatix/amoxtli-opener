# Desarrollo

Para quien trabaja en la librería. Para usarla, ver la [guía de uso](guia-de-uso.md).

## Requisitos

Node 18 o superior (la integración continua usa Node 22). `three` es dependencia de desarrollo (para la demo) y opcional para quien la usa.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run typecheck` | `tsc --noEmit`. |
| `npm test` | Pruebas con Vitest (`vitest run`). `npm run test:watch` las deja corriendo. |
| `npm run build` | Genera `dist/` (ver abajo) y `dist-examples/`. |
| `npm run demo:data` | Genera los datos falsos de la demo (`demo/data/`). |
| `npm run demo` | Build y servidor local con la demo en <http://localhost:5173/demo/>. |
| `npm run prepublishOnly` | Typecheck, pruebas y build, en ese orden. |

## Qué genera el build (`tsup`)

| Salida | Contenido |
|---|---|
| `dist/index.js` y `dist/index.d.ts` | ESM con tipos. Es lo que publica el paquete. |
| `dist/amoxtli-opener.global.js` | Versión IIFE minificada; expone `window.AmoxtliOpener`. |
| `dist-examples/amoxtli-preset.global.js` | El preset de Amoxtli para la demo (no se publica). |

El paquete publica solo `dist/` (`"files": ["dist"]`).

## Pruebas

Las pruebas están en [`tests/`](../tests/) y se agrupan por tema:

| Archivo | Qué cubre |
|---|---|
| `session.test.ts` | Máquina de estados: fases, orden, eventos y resultado. |
| `tiers.test.ts` | Clasificación: `values`, `keywords`, `when`, `field`, `hitFrom`. |
| `tear.test.ts` | Progreso del trazo, anulación por giro y división del sobre. |
| `opener.dom.test.ts` | El abridor completo en un DOM simulado (happy-dom): fases, `redeem`, textos, tiempos. |
| `select.test.ts` | Selección de varios sobres. |
| `effects.test.ts` | Efectos de las cartas en el render. |
| `audio.test.ts` | Sintetizador, mezcla de sonido y vibración. |
| `palette.test.ts` | Colores dominante y secundario de unos píxeles. |
| `render-helpers.test.ts` | `timing`, `labels` ligados y utilidades. |
| `amoxtli-preset.test.ts`, `demo-data.test.ts` | El preset de Amoxtli y los datos falsos de la demo. |

El carrusel 3D necesita WebGL y no se prueba en el DOM simulado: se verifica a mano con la demo. Por eso conviene que la lógica nueva viva en `core/` o en módulos pequeños y puros, que sí se prueban.

## La demo

`demo/index.html` simula el sitio que rodea a la librería:
- un **inicio** con contadores y el botón de abrir;
- un **servidor falso** (`fakeServer`): idempotente, marca los sobres abiertos en `localStorage`;
- una **colección** que se llena al elegir «Agregar» y un aviso al terminar.

Con `?debug` en la URL aparecen los controles de prueba (número de sobres, 3D o 2D, modo de rasgado, de revelado, perfil, origen de los colores, silencio, fallo del primer intento) y el registro. Sin él se ve la versión limpia, con los colores calculados de la imagen.

Los datos salen de `demo/make-data.mjs` (20 sobres de 6 cartas, con códigos `AMX-DEMO-…`). Para verla: `npm run demo:data` una vez y `npm run demo`. Se sirve por HTTP porque `fetch` no funciona con `file://`.

## Integración continua

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) corre en cada push a `main` y en cada pull request: `npm ci`, `typecheck`, `test` y `build`.

## Cómo extender

**Agregar una opción de texto.** Añade la clave a `Labels` ([`types.ts`](../src/types.ts)), su texto en inglés a `defaultLabels` ([`labels.ts`](../src/render/labels.ts)) y úsala con `bindText`/`bindAttr` (así se repinta con `update({ labels })`). Actualiza `amoxtliLabels` en el preset y la tabla de la [referencia](referencia-api.md#textos-labels). Una prueba del preset comprueba que tenga todas las claves.

**Agregar un tiempo configurable.** Añádelo a `TimingOptions` y a `DEFAULT_TIMING` ([`timing.ts`](../src/render/timing.ts)). Si es una duración CSS, pásala como variable en `createPackOpener` y úsala en [`styles.ts`](../src/render/styles.ts) con `var(--ao-…, valor)`. Si debe ir sincronizado con otros, escálalo con `pace` en vez de crear una opción aparte.

**Agregar un efecto visual de carta (`vfx`).** Hoy son cinco (`matte`, `shimmer`, `holo`, `rainbow`, `cross`) y su aspecto está en el CSS (`.ao-card[data-ao-vfx=…] .ao-foil`). Para uno nuevo, añade esa regla CSS y documenta el nombre en la [referencia](referencia-api.md#tiersystem-tierlevel-y-hitprofile).

**Ajustar el carrusel 3D.** Los números (separación, giro, cámara, tiempos de la caja, intensidades de los brillos) están juntos en [`carousel3d-config.ts`](../src/render/carousel3d-config.ts). La lógica de escena y animación, en [`carousel3d.ts`](../src/render/carousel3d.ts).

**Cambiar la clasificación de rarezas.** Es de [`core/tiers.ts`](../src/core/tiers.ts), con pruebas en `tiers.test.ts`.

## Convenciones

- TypeScript estricto, ESM, sin dependencias en runtime.
- La lógica sin DOM va en `core/`; en `render/` solo lo que toca el DOM o three.js.
- Los comentarios de documentación (`/** … */`) van en español y explican el porqué.
- Todo cambio de comportamiento lleva su prueba. Antes de entregarlo: `npm run typecheck && npm test && npm run build`.
- Nada de lo generado (`dist/`, `dist-examples/`) se edita a mano.

## Historial de cambios

Cada cambio que afecte a quien usa la librería se anota en [CHANGELOG.md](../CHANGELOG.md), en la sección «Sin publicar»; lo que rompe la API va en «Cambios que rompen».

## Publicar

Aún no está publicada en npm. Cuando se publique, `prepublishOnly` ejecutará el typecheck, las pruebas y el build.
