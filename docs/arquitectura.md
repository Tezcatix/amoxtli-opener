# Arquitectura

Cómo está organizada la librería y las decisiones detrás.

## Qué es y qué no es

**Es** un componente de presentación: recibe *qué salió del sobre* y *cómo debe verse y sonar*, ejecuta la experiencia de apertura y devuelve *qué hizo la persona* mediante eventos y un resultado.

**No es:**
- Un generador de cartas ni de probabilidades. El resultado llega **ya decidido** por el servidor.
- Un cliente de ninguna API ni catálogo. Solo recibe URLs de imagen.
- Ligada a un juego. «Carta», «rareza» y «sobre» son conceptos genéricos; los presets de juegos concretos viven fuera del paquete (`examples/`).
- Ligada a un framework. Es JS/TS sin dependencias; cualquier framework la envuelve con un adaptador fino.

## Capas

```
          ┌────────────────────────────────────────────┐
 host ──▶ │  render/opener.ts   createPackOpener       │ ◀── DOM, three.js, CSS
          │     │                                      │
          │     ▼                                      │
          │  core/session.ts    OpeningSession         │ ◀── sin DOM: fases, cartas, eventos
          │     │          ▲                           │
          │     ▼          │                           │
          │  core/tiers.ts, core/tear.ts               │ ◀── reglas puras
          └────────────────────────────────────────────┘
                        audio/ (sintetizador, mezcla)
```

- **`core/`** no toca el DOM: la máquina de estados (`OpeningSession`), la clasificación de rareza (`resolveTier`) y la lógica del rasgado (`TearTracker`, `TurnGuard`, `splitPack`). Se prueba sin navegador.
- **`render/`** pinta y reacciona: `createPackOpener` crea la sesión, escucha sus eventos y construye el DOM de cada fase.
- **`audio/`** genera los sonidos y la vibración, con un proveedor intercambiable.
- **`presets/`** trae un único preset neutro (`generic5`). Los presets reales van en `examples/`.

## Flujo de datos

1. `createPackOpener(options)` resuelve las opciones (`labels`, `timing`, etc.), crea la `OpeningSession` y monta el contenedor.
2. `open()` inicia la sesión (`idle → select | tear`).
3. Al completar el rasgado, `requestCards()` llama a `redeem(code)`. La respuesta pasa a `session.provideCards()`, que calcula el nivel de cada carta (`resolveTier`), las ordena y emite `warning` si algo no cuadra.
4. La sesión avanza por las fases y emite eventos. El render los escucha: `phase` construye la pantalla de la fase, `card:reveal` voltea una carta y lanza sus efectos.
5. Al terminar, la sesión entrega un `OpenResult` y `open()` se resuelve.

## Fases

`idle → select → redeeming → tear → stack → fan → summary → done`. La sesión decide la secuencia según `flow.steps` y si hay varios sobres. `redeeming` es una pausa mientras responde el servidor; si falla, ofrece reintentar. El render solo pinta la fase en curso y limpia sus listeners al salir.

## Mapa del código

### `src/`
| Archivo | Qué hace |
|---|---|
| `index.ts` | Punto de entrada: lo que exporta el paquete. |
| `types.ts` | Todos los tipos públicos: opciones, cartas, eventos y resultado. |

### `src/core/` (sin DOM)
| Archivo | Qué hace |
|---|---|
| `session.ts` | `OpeningSession`: máquina de estados, cartas, orden, eventos y resultado. |
| `tiers.ts` | `resolveTier` (de carta a nivel) y `hitFromOf`. |
| `tear.ts` | `TearTracker` (progreso del trazo), `TurnGuard` (anula el trazo que se dobla) y `splitPack` (divide el sobre en dos piezas). |
| `emitter.ts` | Emisor de eventos tipado. |

### `src/render/` (DOM y WebGL)
| Archivo | Qué hace |
|---|---|
| `opener.ts` | `createPackOpener`: orquesta las fases, el DOM y las interacciones. |
| `fan-view.ts`, `fan.ts` | El abanico: la vista (arrastre, vista de cerca) y su geometría. |
| `carousel3d.ts` | El carrusel 3D de sobres con three.js: caja, anillo, rasgado sobre el sobre 3D, mantener presionado. |
| `carousel3d-config.ts` | Los números del carrusel 3D (geometría, cámara, tiempos, intensidades), juntos. |
| `carousel3d-parts.ts` | Piezas puras del carrusel: arte como textura, geometrías, texturas de brillo y shaders. |
| `easing.ts` | Funciones de suavizado. |
| `zones.ts` | Las zonas de corte y de apertura marcadas sobre el sobre. |
| `timing.ts` | Valores por defecto y límites de `timing`. |
| `label-binder.ts` | Liga los textos a `labels` para repintarlos con `update({ labels })`. |
| `labels.ts` | Textos de reserva (inglés). |
| `palette.ts` | Colores dominante y secundario de una imagen. |
| `pack-art.ts` | El sobre generado por código (con la forma de la plantilla). |
| `pack-size.ts` | La plantilla fija del sobre (`PACK_TEMPLATE`) y el ajuste de cualquier imagen a ella (`coverRect`). |
| `pack-texture.ts` | Mezcla la textura que sube el usuario sobre el arte del sobre. |
| `styles.ts` | Todo el CSS de la librería. |
| `particles.ts`, `flowlight.ts`, `spring.ts` | Partículas de luz en canvas, luz fluida WebGL sobre el corte y motor de resortes (inclinación). |
| `dom.ts`, `util.ts` | Ayudas pequeñas. |

### `src/audio/`
| Archivo | Qué hace |
|---|---|
| `synth.ts` | Sintetizador WebAudio: recetas de cada sonido con bus maestro, limitador y reverb. |
| `controller.ts` | Mezcla sonido y vibración y deja reemplazar sonidos sueltos. |

### Fuera de `src/`
| Carpeta | Qué contiene |
|---|---|
| `examples/amoxtli/` | El preset real de Amoxtli (tema, textos, rarezas y arte). No se publica. |
| `demo/` | Sitio de prueba que simula al anfitrión, con un servidor falso y datos generados. |
| `tests/` | Pruebas con Vitest. |
| `docs/` | Esta documentación. |

## Decisiones de diseño

- **Las cartas no viajan por adelantado.** Se podrían leer en el inspector. La librería pide las cartas con `redeem` en el momento del rasgado y el servidor es la fuente de verdad; por eso `redeem` debe ser idempotente.
- **La forma del sobre es de la librería.** Proporción y línea de corte son constantes (`PACK_TEMPLATE`), no opciones: así el sobre mide lo mismo siempre, el corte se pinta bien y nadie puede romperlo. Las imágenes se ajustan a la forma recortando, no al revés.
- **Sin acoplamiento a ningún juego.** La rareza no es un enum de la librería: la defines tú con `tiers` (`field`, `values`, `keywords`, `when`) y la asociación es dinámica.
- **three.js se inyecta.** No es dependencia: el host pasa `three` y, sin WebGL, se cae al estante 2D.
- **Un solo origen de textos.** `labels` es la única entrada y se puede actualizar en caliente; no hay catálogos de idiomas dentro de la librería.
- **Configurable donde no rompe la sincronía.** Los tiempos independientes van en `timing`; los que deben ir sincronizados se mueven juntos con `pace`.
- **Rendimiento.** Perfil `low` y movimiento reducido quitan efectos costosos; los brillos 3D son planos con mezcla aditiva y shaders pequeños, no postprocesado.
- **Los brillos de las cartas son CSS** (`box-shadow` y capas de degradados), no `filter`: `filter` sobre un elemento 3D lo aplana y muestra el dorso.

## Atribuciones

Varios efectos están adaptados de [OpenPack](https://github.com/Luango/openpack) (Luango), con permiso del autor. La lista de qué viene de dónde está en [NOTICE.md](../NOTICE.md).
