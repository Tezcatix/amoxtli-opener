# Referencia de la API

Todo lo que entra y sale de la librería. Los tipos están en [`src/types.ts`](../src/types.ts) y se exportan desde el paquete (`import type { CardInput, OpenResult } from 'amoxtli-opener'`).

- [Entradas: `createPackOpener(options)`](#entradas-createpackopeneroptions)
- [Tipos de las entradas](#tipos-de-las-entradas)
- [Salidas: el objeto `PackOpener`](#salidas-el-objeto-packopener)
- [Eventos](#eventos)
- [Resultado (`OpenResult`)](#resultado-openresult)
- [Textos (`labels`)](#textos-labels)
- [Otras funciones exportadas](#otras-funciones-exportadas)

## Entradas: `createPackOpener(options)`

Solo `mount` y `redeem` son obligatorios.

| Opción | Tipo | Descripción |
|---|---|---|
| `mount` | `HTMLElement` | **Requerida.** Contenedor donde se monta la experiencia. |
| `redeem` | `RedeemFunction` | **Requerida.** Pide las cartas al servidor al rasgar el sobre. |
| `code` | `string` | Código del sobre (un solo sobre). Se abre directo. |
| `packs` | `PackChoice[]` | Varios sobres a elegir; sustituye a `code`/`pack`. |
| `pack` | `PackDefinition` | Apariencia del sobre. Con `packs`, es la base sobre la que se mezcla cada uno. |
| `three` | `THREE` | Espacio de nombres de three.js. Con `packs` activa el carrusel 3D; sin WebGL cae al estante 2D. |
| `box` | `PackBoxDefinition` | Caja de la que salen los sobres en la entrada del carrusel 3D. |
| `cardAspectRatio` | `number` | Ancho / alto de las cartas. Def. 0.716. |
| `cardBack` | `string` | Dorso (URL) para las cartas que no traen `back`. |
| `tiers` | `TierSystem` | Qué dato se clasifica y qué efecto lleva cada valor. Def.: `generic5`. |
| `flow` | `FlowOptions` | Pasos y modos de la experiencia. |
| `effects` | `EffectsOptions` | Perfil de efectos, movimiento reducido y origen de los colores. |
| `ui` | `UiOptions` | Textos de ayuda y contador. |
| `timing` | `TimingOptions` | Tiempos configurables. |
| `audio` | `AudioOptions` | Sonido. |
| `haptics` | `boolean \| { vibrate }` | Vibración. Def. `true` (`navigator.vibrate`). |
| `labels` | `Partial<Labels>` | **Única** entrada de textos. Lo no pasado queda en inglés. |
| `theme` | `Record<string, string>` | Variables CSS `--ao-*` aplicadas al contenedor. |
| `actions` | `ActionDefinition[]` | Botones del resumen. Def.: una acción `collect`. |
| `on` | `{ [evento]?: (payload) => void }` | Alternativa a `opener.on(...)`. |

## Tipos de las entradas

### `RedeemFunction`
```ts
(code: string, context: { attempt: number; signal: AbortSignal }) => Promise<RedeemResult | CardInput[]>
```
`RedeemResult` es `{ cards: CardInput[]; packId?: string }`. `attempt` es 1 la primera vez y crece en cada reintento. `signal` se aborta si se destruye el abridor.

### `CardInput`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | **Requerido.** Identificador único (los repetidos emiten `DUPLICATE_CARD_ID`). |
| `image` | `string` | **Requerido.** URL de la imagen. |
| `thumb` | `string` | Miniatura para la pila y el abanico. |
| `name` | `string` | Nombre. |
| `rarity` | `string` | Dato que se clasifica por defecto. |
| `tier` | `number` | Nivel ya conocido; gana sobre toda clasificación. |
| `foil` | `boolean` | Marca la carta como brillante aunque su nivel sea mate. |
| `isNew` | `boolean` | Muestra la insignia «Nueva». |
| `back` | `string` | Dorso propio. |
| `meta` | `Record<string, unknown>` | Datos tuyos; vuelven intactos en eventos y resultado. |

### `PackDefinition` y `PackChoice`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Identificador del sobre (aparece en `OpenResult.packId`). |
| `art` | `string` | Imagen o SVG del sobre. Se ajusta a la plantilla del sobre (proporción 0.632, línea de corte al 18.5 %), recortando lo que sobre. Sin él se genera uno por código. |
| `label` | `string` | Nombre del sobre; en la selección se muestra bajo él si no hay `caption`. |
| `tear` | `TearConfig` | Cómo se corta. |
| `accent` | `string` | Color del halo y las luces del sobre. |
| `texture` | `PackTexture \| false` | Textura propia sobre el arte. Apagada por defecto. Ver abajo. |

`PackChoice` añade: `code` (**requerido**, se pasa a `redeem`), `caption` (nombre bajo el sobre) y `badge` (pastilla corta junto al nombre).

### `PackTexture`
| Campo | Tipo | Descripción |
|---|---|---|
| `src` | `string` | **Requerido.** Tu imagen de textura. |
| `enabled` | `boolean` | Def. `true`. Con `false` se apaga. |
| `blend` | `'overlay' \| 'soft-light' \| 'multiply' \| 'screen' \| 'normal'` | Def. `'overlay'`. |
| `opacity` | `number` | 0..1. Def. 0.5. |
| `repeat` | `number` | Repeticiones a lo ancho (0.25–32). Def. 1. |

### `TearConfig`
| Campo | Valores | Descripción |
|---|---|---|
| `line` | `'top'` (def.), `'free'`, `{ y: 0..1 }` | `'top'`: banda superior (30 % de arriba). `{ y }`: banda de ±15 % alrededor de esa fracción de alto. `'free'`: cualquier trazo. |
| `minLengthRatio` | `number` | Fracción del ancho que hay que recorrer. Def. 0.8. |

### `PackBoxDefinition`
`front` (cara frontal), `lid` (tapa), `side` (costados y fondo) son imágenes; `accent` es el color de la luz al abrirse.

### `TierSystem`, `TierLevel` y `HitProfile`
| Campo | Dónde | Descripción |
|---|---|---|
| `levels` | `TierSystem` | **Requerido.** Niveles de menor a mayor. |
| `field` | `TierSystem` | Qué se clasifica: `'rarity'` (def.), una ruta (`'meta.type'`) o una función `(card) => valor \| lista`. |
| `resolve` | `TierSystem` | `(card) => número`. Reemplaza la clasificación por niveles. |
| `hitFrom` | `TierSystem` | Nivel mínimo del golpe. Def.: el primer nivel con `hit`. |
| `key`, `label`, `color` | `TierLevel` | **Requeridos.** Identificador, nombre y color. |
| `vfx` | `TierLevel` | **Requerido.** `matte`, `shimmer`, `holo`, `rainbow` o `cross`. |
| `values` | `TierLevel` | Valores exactos que caen en el nivel. |
| `keywords` | `TierLevel` | Fragmentos de texto que caen en el nivel. |
| `when` | `TierLevel` | `(card) => boolean`: condición propia. |
| `hit` | `TierLevel` | `HitProfile` del golpe. |
| `burst`, `flash`, `rays`, `anticipationMs` | `HitProfile` | **Requeridos.** Partículas, destello (0..1), rayos (0..1) y anticipación en ms. |
| `haptic`, `sound` | `HitProfile` | Vibración (número o patrón) y sonido del impacto. |

Orden de decisión: `card.tier` → `tiers.resolve` → reglas por nivel (del más alto al más bajo: `when`, `values`, `keywords`). Ver [personalización](personalizacion.md#rarezas-y-efectos-tiers).

### `FlowOptions`
`steps` (`'select' | 'tear' | 'stack' | 'fan' | 'summary'`), `tearMode` (`'swipe' | 'tap' | 'auto'`), `revealMode` (`'tap-through' | 'auto-advance' | 'all-at-once'`), `autoAdvanceMs`, `sortByTier`, `allowSkip`, `startPaused`. Valores por defecto en [personalización](personalizacion.md#flujo-flow).

### `EffectsOptions`
`profile` (`'auto' | 'high' | 'low'`), `reducedMotion` (`'auto' | boolean`) y `colorSource` (`'manual' | 'image'`).

### `UiOptions`
`hints` (textos de ayuda tenues) y `counter` (contador `n/N`); ambos `true` por defecto.

### `TimingOptions`
| Campo | Def. | Descripción |
|---|---|---|
| `holdToOpenMs` | 6000 | Presión sostenida para abrir. |
| `holdArmMs` | 400 | Presionado y quieto para que cuente como «mantener». Mínimo 350. |
| `lastCardHoldMs` | 1800 | Pausa tras la última carta. |
| `summaryStaggerMs` | 70 | Retraso entre las fichas del resumen. |
| `packDropMs` | 900 | Caída del sobre vacío. |
| `flipMs` | 700 | Giro de cada carta. |
| `pace` | 1 | Multiplicador de los bloques sincronizados (0.25–4). |

### `AudioOptions` y `HapticsOption`
- `AudioOptions`: `enabled`, `volume` (0..1, def. 0.7), `provider` (`'synth' | 'none' | AudioProvider`) y `sounds` (`Partial<Record<SoundKey, () => void>>`).
- `AudioProvider`: `play(key, { tier? })` y, opcionalmente, `unlock`, `setVolume`, `setEnabled` y `dispose`.
- `SoundKey`: `crinkle`, `rip`, `open`, `flick`, `riser`, `impact`, `chime`, `collect`, `sparkle`, `conclude`, `hover`, `reject`, `slide`, `snap`.
- `HapticsOption`: `boolean` o `{ vibrate(pattern: number | number[]) }`.

### `ActionDefinition`
`id` y `label` (**requeridos**), `primary` (botón destacado) y `closes` (cierra al elegirlo).

## Salidas: el objeto `PackOpener`

| Método | Descripción |
|---|---|
| `open()` | Inicia la experiencia (salvo `flow.startPaused`) y devuelve una promesa con el [`OpenResult`](#resultado-openresult). Llamarlo de nuevo devuelve la misma promesa. |
| `start()` | Inicia manualmente si usaste `startPaused`. |
| `skip()` | Salta al resumen. |
| `update({ audio?, labels? })` | Cambia en caliente el volumen (o silencia) y los textos; lo que ya está en pantalla se repinta. |
| `getState()` | `{ phase, index }`: la fase actual y la carta en curso. |
| `on(evento, fn)` / `off(evento, fn)` | Suscribe o quita un listener. |
| `destroy()` | Cierra (`outcome: 'aborted'` si no había terminado) y limpia listeners, timers y DOM. |

## Eventos

Se emiten en la instancia (`opener.on`), en `options.on` y como `CustomEvent` en `mount` con el prefijo `amoxtli-opener:` (p. ej. `amoxtli-opener:complete`, con el payload en `event.detail`).

| Evento | Payload | Cuándo |
|---|---|---|
| `phase` | `{ from, to }` | Cambia la fase: `idle`, `select`, `redeeming`, `tear`, `stack`, `fan`, `summary`, `done`. |
| `select` | `{ packId, code }` | La persona eligió un sobre. |
| `tear:progress` | `{ progress }` (0..1) | Avanza el rasgado. |
| `tear:complete` | `{}` | El rasgado terminó. |
| `card:reveal` | `{ card, index, tier, isLast }` | Se voltea una carta. |
| `hit` | `{ card, tier }` | Sale una carta con nivel ≥ `hitFrom`. |
| `skip` | `{ atIndex }` | La persona saltó. |
| `action` | `{ id, result }` | Eligió un botón del resumen. |
| `complete` | `OpenResult` | La experiencia terminó. |
| `error` | `{ code: 'REDEEM_FAILED', message, cause? }` | Falló `redeem`. |
| `warning` | `{ code, message, detail? }` | `UNKNOWN_RARITY`, `TIER_OUT_OF_RANGE`, `DUPLICATE_CARD_ID`, `IMAGE_LOAD_FAILED` o `IMAGE_LOAD_FAILED`. |

## Resultado (`OpenResult`)

| Campo | Descripción |
|---|---|
| `outcome` | `'completed'`, `'skipped'`, `'aborted'` o `'failed'`. |
| `cards` | `RevealedCard[]`: `{ card, tier, revealedAt, viewed }` en el orden en que se revelaron. `revealedAt` son ms desde el inicio (o `null` si no se llegó a ver en la pila). |
| `bestPull` | `{ card, tier }` de la carta de mayor nivel, o `null`. |
| `actionId` | El botón elegido en el resumen, o `null`. |
| `packId` | El del servidor (si lo devolvió `redeem`) o el de `pack.id`. |
| `durationMs` | Duración total. |
| `skipped` | Si saltó. |
| `interactions` | `{ tearAttempts, taps }`. |
| `error` | `{ code, message, cause? }` si falló el servidor. |

## Textos (`labels`)

Todas las claves de `Labels`. Se pasan en `options.labels` o `update({ labels })`.

| Clave | Dónde se usa |
|---|---|
| `skip` | Botón «Saltar». |
| `choosePack` | Estante 2D y `aria-label` del carrusel. |
| `selectPack` | Aviso de arriba de la selección (clic elige, mantener abre). |
| `swipeToOpen` | `aria-label` del sobre al rasgar. |
| `tapToOpen` | Aviso con `tearMode: 'tap'` y `aria-label` del sobre. |
| `swipeOrHold` | Aviso de la vista del sobre elegido (deslizar por la línea o mantener presionado). |
| `seeAllPacks` | Aviso bajo la caja del fondo para volver a ver los sobres. |
| `tapToReveal` | Aviso y `aria-label` de la pila. |
| `browseHaul` | `aria-label` del abanico y su aviso tenue. |
| `liftToInspect` | Aviso de arriba del abanico. |
| `continue` | Botón «Continuar» del abanico. |
| `collect` | Botón por defecto del resumen. |
| `bestPull` | Encabezado de «Mejor carta». |
| `newBadge` | Insignia de las cartas nuevas. |
| `opening` | «Abriendo…» mientras responde el servidor. |
| `openFailed`, `retry`, `close` | Pantalla de error. |
| `announce(position, total, name, tierLabel)` | Función que arma el anuncio de cada carta para lectores de pantalla. |

## Otras funciones exportadas

Además de `createPackOpener`, el paquete exporta piezas sueltas, útiles para tu servidor, tus pruebas o tu propia interfaz:

| Export | Para qué |
|---|---|
| `generic5` | Preset neutro de cinco niveles (common → legendary). |
| `resolveTier(card, tiers)` | Calcula el nivel de una carta como lo haría la librería. |
| `hitFromOf(tiers)` | Primer nivel con golpe de un sistema. |
| `extractPalette(src)` / `paletteFromPixels(data)` | Colores dominante y secundario de una imagen / de unos píxeles. |
| `composePackArt(art, texture, ratio)` / `resolvePackTexture(texture)` | Mezcla tu textura sobre un arte (devuelve una imagen) / completa sus valores. |
| `PACK_TEMPLATE` / `coverRect(w, h, ratio)` | La plantilla fija del sobre (proporción, línea de corte, tamaño recomendado) / la zona de una imagen que lo llena sin deformarse. |
| `defaultPackArt(accent)` | El SVG (data URI) del sobre generado por código. |
| `createOpeningSession(options)` / `OpeningSession` | La máquina de estados sin DOM (fases, cartas, eventos). |
| `TearTracker`, `TurnGuard`, `splitPack`, `roughen` | La lógica del rasgado (progreso, anulación por giro, división del sobre). |
| `SynthAudio`, `createFeedback` | El sintetizador y el mezclador de sonido y vibración. |
| `createCarousel3D` | El carrusel 3D de sobres, por separado. |
| `Emitter` | El emisor de eventos que usa la sesión. |
| `FEATURES` | Lista de capacidades de la versión (útil para comprobar que se cargó el build correcto). |
