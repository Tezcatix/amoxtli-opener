# Personalización

Todo lo que se puede cambiar desde las opciones de `createPackOpener`. Las opciones completas con sus tipos están en la [referencia](referencia-api.md).

- [Colores y estilo general (`theme`)](#colores-y-estilo-general-theme)
- [Colores a partir de la imagen (`effects.colorSource`)](#colores-a-partir-de-la-imagen-effectscolorsource)
- [Rarezas y efectos (`tiers`)](#rarezas-y-efectos-tiers)
- [Sobres y caja](#sobres-y-caja)
- [Textura sobre el sobre (`pack.texture`)](#textura-sobre-el-sobre-packtexture)
- [Cartas](#cartas)
- [Textos (`labels`)](#textos-labels)
- [Tiempos (`timing`)](#tiempos-timing)
- [Efectos, rendimiento y avisos (`effects`, `ui`)](#efectos-rendimiento-y-avisos-effects-ui)
- [Sonido y vibración](#sonido-y-vibración)
- [Flujo (`flow`)](#flujo-flow)
- [Preset de Amoxtli](#preset-de-amoxtli)
- [Lo que no se puede cambiar](#lo-que-no-se-puede-cambiar)

## Colores y estilo general (`theme`)

`theme` es un objeto de variables CSS que se aplican al contenedor.

| Variable | Qué cambia |
|---|---|
| `--ao-bg` | Fondo (color, degradado o imagen). |
| `--ao-fg` | Color del texto. |
| `--ao-accent` | Acento: botón principal, luces, color del sobre por defecto. |
| `--ao-on-accent` | Color del texto sobre el acento. |
| `--ao-radius` | Radio de esquinas de cartas y recuadros. |
| `--ao-font` | Tipografía. |
| `--ao-card-w` | Ancho de las cartas. Por defecto sale de una fórmula según la pantalla; si lo fijas aquí se respeta. |

```ts
theme: { '--ao-bg': '#10121f', '--ao-accent': '#604aff', '--ao-radius': '14px', '--ao-font': "'Satoshi', system-ui, sans-serif" }
```

## Colores a partir de la imagen (`effects.colorSource`)

Por defecto el brillo de un sobre sale de su `accent` y el de una carta, de su rareza (`'manual'`). Con `'image'` se calcula de los colores de la propia imagen:

```ts
effects: { colorSource: 'image' }
```

- **Sobres:** el halo toma el color **dominante** del arte (si el sobre no trae `accent` propio, que gana) y las cometas del borde, el **secundario**.
- **Cartas:** el resplandor toma el dominante y un halo más amplio (carta del centro y carta levantada) el secundario. El anillo fino conserva el color de la rareza, así que la rareza se sigue distinguiendo.
- **Cómo se calcula:** se reduce la imagen a ~40 px y se agrupan los píxeles por tono. Cada píxel pesa según su saturación y su distancia a negro y blanco, así que el fondo oscuro o los bordes blancos no dominan. El resultado se ajusta para verse como luz (saturación mínima y luminosidad media).
- **Límite:** el navegador solo deja leer los píxeles de imágenes del mismo origen o con cabeceras CORS. Si no se pueden leer, esa imagen usa el color manual, sin error.
- El helper está disponible por separado: `extractPalette(src)` devuelve `{ dominant, secondary }`.

## Rarezas y efectos (`tiers`)

El sistema tiene dos pasos: **de carta a nivel** y **de nivel a efectos**.

```ts
const tiers = {
  field: 'meta.rarity',                           // qué dato se clasifica (def.: 'rarity')
  levels: [                                       // de menor a mayor
    { key: 'common', label: 'Común', color: '#9ca3af', values: ['Common', 'Uncommon'], vfx: 'matte' },
    { key: 'holo',   label: 'Holo',   color: '#4ade80', values: ['Rare Holo'],           vfx: 'holo' },
    { key: 'ultra',  label: 'Ultra',  color: '#a78bfa', values: ['Rare Ultra', 'Rare Holo VMAX'], vfx: 'rainbow',
      hit: { burst: 40, flash: 0.5, rays: 0.5, anticipationMs: 500 } },
  ],
};
```

### De carta a nivel

Para cada carta, en este orden:

1. **`card.tier`:** si tu servidor ya manda el número, gana.
2. **`tiers.resolve(card)`:** una función tuya que devuelve el número.
3. **Reglas por nivel**, del más alto al más bajo; gana el primero que cumpla alguna:
   - `values`: valores **exactos** del dato (sin distinguir mayúsculas). «Rare Holo» no atrapa «Rare Holo VMAX».
   - `keywords`: fragmentos; coincide si el valor los **contiene**.
   - `when(card)`: condición propia que puede combinar varios datos (`card.foil && Number(card.meta?.number) >= 100`).
4. Un valor que ninguna regla reconoce cae al nivel 0 y emite un `warning` `UNKNOWN_RARITY`. Sin dato, nivel 0 sin aviso.

### Qué dato se clasifica (`field`)

- `'rarity'` (por defecto), o una ruta con puntos para entrar en `meta`: `'meta.type'`.
- Una función `(card) => valor`, que puede devolver una **lista**: basta con que un valor coincida (p. ej. los tipos de una carta de Pokémon: `['Fire', 'Water']`).

Así la clasificación sirve para cualquier cosa, no solo rareza, y se actualiza sola con los datos que traen las cartas.

### De nivel a efectos

| Campo del nivel | Qué hace |
|---|---|
| `color` | Color del anillo, del brillo, del destello y las partículas de ese nivel. |
| `label` | Nombre que se muestra y se anuncia. |
| `vfx` | Brillo permanente de la carta, que sigue al puntero: `matte` (ninguno), `shimmer` (destello blanco), `holo` (bandas del color del nivel), `rainbow` (arcoíris), `cross` (arcoíris con trama cruzada). |
| `hit` | Efecto especial al descubrirla (ver abajo). Solo los niveles que lo definen lo llevan. |

`hitFrom` indica desde qué nivel hay golpe; por defecto, el primer nivel que define `hit`.

### El efecto de golpe (`hit`)

Se dispara al voltear una carta rara. Un único tiempo, `anticipationMs`, gobierna todo lo que sale en ese momento:

| Campo | Qué es |
|---|---|
| `anticipationMs` | Pausa entre voltear la carta y el estallido. Mientras tanto suena el `riser`. |
| `flash` | Intensidad (0..1) del destello de pantalla. |
| `rays` | Intensidad (0..1) de los rayos giratorios. Con 0 no hay rayos. |
| `burst` | Cantidad de partículas de la ráfaga. |
| `sound` | Sonido del impacto (def. `impact`). |
| `haptic` | Patrón de vibración (def. `[40, 30, 60 + nivel·10]`). |

Además hay una onda de choque, y la carta crece un instante. Las dos rarezas más altas usan la paleta arcoíris en las partículas. Con `effects.profile: 'low'` o movimiento reducido el golpe visual no se crea.

## Sobres y caja

**Un sobre** (`pack`, o cada elemento de `packs`):

| Campo | Para qué |
|---|---|
| `art` | Imagen o SVG del sobre. Sin él, se genera uno por código con el `accent`. |
| `accent` | Color del halo y las luces de ese sobre. |
| `tear` | `line` (`'top'`, `'free'` o `{ y }`) y `minLengthRatio` (def. 0.8). |
| `label` | Nombre del sobre; en la selección se muestra bajo él si no hay `caption`. |

### La plantilla del sobre (la forma es de la librería)

El sobre **siempre se dibuja con la misma forma**, la defina quien la defina: la librería la fija (`PACK_TEMPLATE`) para que mida lo mismo en todas partes y el corte caiga siempre en su sitio (la tira que se arranca y las zonas de corte y de apertura dependen de ella). No hay opciones de tamaño ni de proporción: no se pueden romper.

| | Valor | Para qué |
|---|---|---|
| Proporción (ancho / alto) | **0.632** | Un sobre real mide ~64 × 119 mm (0.54); las cartas, 0.716. Con 0.632 se ve proporcionado junto a ellas. |
| Línea de corte | al **18.5 %** del alto, desde arriba | Lo que se arranca al rasgar. |
| Tamaño recomendado de tu imagen | **800 × 1266 px** | Cumple la proporción. |
| Ancho mínimo | **512 px** | Por debajo se ve borrosa en el carrusel 3D. |

**Qué pasa con tu imagen:** se ajusta a la plantilla sin deformarse (*cover*): se escala hasta cubrir la forma del sobre y se **recorta, centrada, lo que sobre**. Da igual si es chica o grande: siempre ocupa lo mismo en pantalla.
- Si tiene la proporción 0.632, no se recorta nada y se ve completa.
- Si es más ancha o más alta, pierde un poco de los bordes.
- Los SVG deben venir ya con esa proporción (en el 3D no se recortan).

**Cómo preparar el arte:** hazlo de 800 × 1266 px (o cualquier múltiplo exacto de 0.632) con la **línea punteada al 18.5 % del alto**, y deja los bordes importantes dentro: son lo primero que se recorta. `PACK_TEMPLATE` y `coverRect` están exportados, por si quieres validar o recortar la imagen en tu servidor antes de servirla.

Solo en `packs[]`: `code` (obligatorio), `caption` (nombre bajo el sobre) y `badge` (pastilla corta, p. ej. «Holo»).

**La caja** (`box`, solo con `three` y `packs`): `front`, `lid` y `side` son las imágenes del cuerpo, la tapa y los costados, y `accent` el color de la luz al abrirse. Sin `box`, los sobres entran escalando.

## Textura sobre el sobre (`pack.texture`)

Opcional y **apagada por defecto**: sin `texture` el sobre se ve exactamente como su arte. La librería **no trae ninguna textura ni la genera**: la pones tú, por ejemplo la foto de foil arrugado que sube la persona junto con su sobre. Se mezcla con el arte y no sale de su silueta.

```ts
pack: {
  art: '/sobres/mio.png',
  texture: { src: '/texturas/foil-arrugado.jpg', blend: 'overlay', opacity: 0.6, repeat: 1 },
}
```

| Campo | Def. | Qué hace |
|---|---|---|
| `src` | | **Requerido.** Imagen de la textura. Sin ella no se aplica nada. |
| `enabled` | `true` | `false` la apaga sin borrar su configuración. |
| `blend` | `'overlay'` | `overlay` (realza luces y sombras conservando el color), `soft-light`, `multiply`, `screen` o `normal`. |
| `opacity` | `0.5` | Intensidad, 0..1. |
| `repeat` | `1` | Veces que se repite a lo ancho; 1 la ajusta para cubrir el sobre, sin deformarla. |

- **Dónde se ve:** en el carrusel 3D, el estante 2D y el sobre al rasgar. Se mezcla con el arte una sola vez al empezar (con un tope de espera de 1.5 s) y se guarda.
- **Por sobre:** va en `pack` o en cada elemento de `packs[]`, así que cada sobre puede llevar la suya.
- **Relieve y brillo:** la librería no los calcula. El aspecto de relieve (arrugas, pliegues) y de brillo metálico lo da la propia foto; un buen resultado depende de la textura que se suba. Con una foto de foil con luces y sombras, `overlay` o `soft-light` las transfieren al arte.
- **Límite:** si la imagen es de otro origen necesita cabeceras CORS; si no se puede leer, el sobre sigue con su arte, sin error.

## Cartas

| Opción | Para qué |
|---|---|
| `cardAspectRatio` | Ancho / alto de las cartas (def. 0.716, formato póker). Sirve cualquiera: 1 cuadrada, 1.5 vertical alta… |
| `cardBack` | Dorso por defecto, para las cartas que no traen `back`. |

Por carta: `image`, `thumb`, `back`, `foil`, `isNew`, `name` y `meta`. Ver la [guía](guia-de-uso.md#qué-es-una-carta-cardinput).

## Textos (`labels`)

`labels` es la **única** entrada de textos: los mandas en el idioma que uses. Lo que no pases queda en un texto de reserva en inglés.

```ts
labels: { skip: 'Saltar', continue: 'Continuar', collect: 'Agregar a mi colección' }
```

Se pueden cambiar **después**, y lo que ya está en pantalla se repinta:

```ts
opener.update({ labels: { skip: 'Skip', tapToOpen: 'Tap to open' } });
```

Un valor `undefined` no borra el texto que ya había. Las claves están en la [referencia](referencia-api.md#textos-labels). `announce` es una función que arma el anuncio de cada carta para lectores de pantalla.

Los botones de `actions` llevan su propio texto (`label`) y no salen de `labels`, salvo el botón por defecto «collect», que sí usa `labels.collect`.

## Tiempos (`timing`)

Todos opcionales; los valores indicados son los de siempre.

```ts
timing: {
  holdToOpenMs: 6000,    // presión sostenida para abrir
  holdArmMs: 400,        // presionado y quieto para que cuente como «mantener» (mínimo 350)
  lastCardHoldMs: 1800,  // pausa tras la última carta, antes del abanico (se suma la anticipación si es rara)
  summaryStaggerMs: 70,  // retraso entre las fichas del resumen
  packDropMs: 900,       // caída del sobre vacío al resumen
  flipMs: 700,           // giro de cada carta
  pace: 1,               // multiplicador de los bloques sincronizados
}
```

`pace` multiplica **a la vez** lo que debe ir sincronizado: la tira del rasgado que vuela, el brillo del sobre que baja, la espera antes de las cartas, la luz de la boca, la subida de las cartas, su acomodo y el sonido `snap`. Es una **duración**: 2 = el doble de lento, 0.5 = el doble de rápido; se limita a 0.25–4. Otros tiempos propios de cada rareza van en `tiers[i].hit.anticipationMs`, y `flow.autoAdvanceMs` fija el avance automático.

## Efectos, rendimiento y avisos (`effects`, `ui`)

```ts
effects: { profile: 'auto', reducedMotion: 'auto', colorSource: 'manual' }
ui: { hints: true, counter: true }
```

| Opción | Valores |
|---|---|
| `effects.profile` | `'high'`, `'low'` o `'auto'` (`low` si hay movimiento reducido). `low` quita animaciones de foil y brillos costosos. |
| `effects.reducedMotion` | `'auto'` (lo que diga el sistema) o un booleano. |
| `effects.colorSource` | `'manual'` o `'image'`. Ver [arriba](#colores-a-partir-de-la-imagen-effectscolorsource). |
| `ui.hints` | Muestra u oculta los textos de ayuda tenues («toca para revelar», «mejor carta»). |
| `ui.counter` | Muestra u oculta el contador `n/N` de la pila. |

Los avisos que explican cómo abrir el sobre (arriba de la selección, de la vista del sobre, del abanico) **no** se ocultan con `ui.hints`: son instrucciones necesarias. Los mensajes de error siempre se muestran.

## Sonido y vibración

```ts
audio: { enabled: true, volume: 0.7, provider: 'synth', sounds: { rip: () => miSonidoDeRasgado() } }
haptics: true    // o { vibrate(pattern) { /* motor háptico de tu app */ } }
```

- `provider`: `'synth'` (por defecto, WebAudio sin archivos), `'none'` (silencio) o un objeto propio `{ play(key, { tier }) }`.
- `sounds`: reemplaza un sonido concreto por una función tuya. Los sonidos son: `crinkle`, `rip`, `open`, `flick`, `riser`, `impact`, `chime`, `collect`, `sparkle`, `conclude`, `hover`, `reject`, `slide` y `snap`.
- El audio se desbloquea con el primer gesto de la persona (los navegadores lo exigen).
- `opener.update({ audio: { enabled, volume } })` cambia el volumen o silencia en caliente.

## Flujo (`flow`)

| Opción | Valores | Def. |
|---|---|---|
| `steps` | Subconjunto de `select`, `tear`, `stack`, `fan`, `summary` | `tear`, `stack`, `fan`, `summary` |
| `tearMode` | `'swipe'` (deslizar), `'tap'` (un toque), `'auto'` (solo) | `'swipe'` |
| `revealMode` | `'tap-through'`, `'auto-advance'`, `'all-at-once'` | `'tap-through'` |
| `autoAdvanceMs` | Pausa entre cartas con `auto-advance` | 1200 |
| `sortByTier` | La más rara va al final | `true` |
| `allowSkip` | Muestra «Saltar» | `true` |
| `startPaused` | `open()` no arranca solo; usa `start()` | `false` |

## Preset de Amoxtli

[`examples/amoxtli/`](../examples/amoxtli/) es a la vez el **ejemplo** de cómo personalizarla y los recursos **reales** de Amoxtli. No se publica en el paquete.

| Archivo | Qué es |
|---|---|
| `assets/pack-front-crop.png` | El sobre (540 × 855, proporción 0.632 y línea al 18.7 %): la vista frontal de `pack-front.png`, que es una hoja con tres vistas del sobre. |
| `assets/box-*.svg` | La caja: frente, tapa y costados. |
| `assets/card-back.svg` | Dorso de carta (240 × 335). |
| `tiers.ts` | 8 niveles que cubren las 45 rarezas del catálogo (Común → Hiper Rara). El golpe empieza en Ultra Rara. |
| `index.ts` | `amoxtliTheme`, `amoxtliLabels` y `amoxtliPreset(assetsBase)`. |

```ts
import { createPackOpener } from 'amoxtli-opener';
import { amoxtliPreset } from '…/examples/amoxtli';   // copiar o enlazar desde la app

createPackOpener({ mount, code, redeem, ...amoxtliPreset('/images/opener') });
```

Copia los SVG a `public/images/opener/` (o sírvelos desde donde convenga y pasa esa ruta a `amoxtliPreset`).

## Lo que no se puede cambiar

Estas cosas son fijas en el código (no hay opción). Si necesitas alguna, se puede exponer:

- **Entrada de la caja y guardado de los sobres:** la coreografía y sus tiempos.
- **Formación del abanico:** posiciones, ángulos y tamaños.
- **Disposición del carrusel 3D:** separación, giro, profundidad y tamaño de los sobres laterales, cámara y campo de visión.
- **Altura de la zona de corte** (8 % bajo la línea punteada) y los umbrales de «móvil».
- **Nombres de `vfx`:** solo los cinco de la tabla; el aspecto de cada uno está en el CSS.
- **Fondo decorativo** (rayas y destellos) y la forma de flechas, puntos y pastillas.
- **Sonidos del sintetizador:** se pueden reemplazar, no ajustar.

Los números del carrusel 3D están juntos en `src/render/carousel3d-config.ts`; los estilos, en `src/render/styles.ts`.
