# Guía de uso

Cómo integrar `amoxtli-opener` en una web o en una app. Para un caso completo, con el servidor incluido, ver el [ejemplo de integración](ejemplo-de-integracion.md); para la lista completa de opciones, la [referencia de la API](referencia-api.md).

## La idea en un minuto

1. Tu servidor emite un **código** de un solo uso por cada sobre (`PK-7F3A-92XC`).
2. Tu página crea el abridor con ese código y una función `redeem`.
3. La persona rasga el sobre. En ese momento la librería llama a `redeem(code)`; tu servidor marca el sobre como abierto y **devuelve las cartas**.
4. La librería muestra las cartas con sus efectos, y al terminar entrega un `OpenResult` con lo ocurrido.

La librería no decide qué cartas salen ni guarda nada: solo presenta el resultado que tu servidor ya decidió.

## Instalar y montar

```ts
import { createPackOpener } from 'amoxtli-opener';

const opener = createPackOpener({ mount: document.querySelector('#stage')!, code, redeem });
const result = await opener.open();
```

- `mount` es un elemento con tamaño propio (la librería se adapta a él). Dentro de él no se toca nada más que lo suyo.
- `open()` inicia la experiencia y devuelve una promesa que se resuelve al terminar, con un [`OpenResult`](referencia-api.md#resultado-openresult).
- Con `flow.startPaused: true`, `open()` no arranca solo; llamas a `opener.start()` cuando quieras.
- Sin bundler, usa la etiqueta `<script src="dist/amoxtli-opener.global.js">` y `AmoxtliOpener.createPackOpener(...)`.

## El contrato con tu servidor (`redeem`)

```ts
redeem: async (code, { attempt, signal }) => {
  const res = await fetch('/api/packs/open', { method: 'POST', body: JSON.stringify({ code }), signal });
  if (!res.ok) throw new Error('No se pudo abrir');
  return res.json();   // { cards: CardInput[], packId?: string }  o solo CardInput[]
}
```

- **Cuándo se llama:** una vez por intento, al completar el rasgado (o al iniciar, si `flow.steps` no incluye `tear`). Mientras responde se muestra «Abriendo…».
- **Si falla** (rechaza o lanza): la persona ve el error con **Reintentar** (llama otra vez con `attempt + 1`) y **Cerrar** (termina con `outcome: 'failed'`).
- **Debe ser idempotente:** repetir el mismo `code` tiene que devolver **las mismas cartas**. Así, si la respuesta se pierde por la red, el reintento no gasta otro sobre.
- **`signal`:** se aborta si se destruye el abridor con la petición en curso. Pásalo a `fetch`.
- **El servidor es la fuente de verdad:** valida que el código sea de esa persona y esté sin abrir, lo marca abierto y decide las cartas.
- **`packId`:** si tu servidor asigna un identificador, devuélvelo y reemplazará al `pack.id` en el resultado.

### Qué es una carta (`CardInput`)

Mínimo `{ id, image }`. Opcionales:

| Campo | Para qué |
|---|---|
| `name` | Nombre que se muestra y se anuncia. |
| `rarity` | Dato que, por defecto, se clasifica para decidir el efecto. |
| `tier` | Si tu servidor ya conoce el nivel, lo manda y gana sobre toda clasificación. |
| `foil` | Marca la carta como brillante, aunque su nivel sea mate. |
| `isNew` | Muestra la insignia «Nueva». |
| `thumb` | Miniatura para la pila y el abanico (se usa `image` en la vista de cerca). |
| `back` | Dorso propio de esa carta. |
| `meta` | Datos tuyos; vuelven **intactos** en los eventos y el resultado. Ahí van tipo, número, etc. |

## Pedir datos antes de entrar (`gate`)

Si tu sitio necesita algo de la persona antes de mostrarle la experiencia (un **código de acceso**, su nombre, un correo), pasa `gate`: un formulario que sale primero, con el mismo aspecto que el resto. La selección y el sobre no aparecen hasta que lo completa.

```ts
createPackOpener({
  /* … */
  gate: {
    title: 'Código de acceso',
    message: 'Te lo dio quien creó la página.',
    fields: [
      { name: 'code', label: 'Código', transform: 'uppercase', maxLength: 16 },
      { name: 'name', label: 'Tu nombre', required: false },
    ],
    submitLabel: 'Continuar',
    cancelLabel: 'Cancelar',
    validate: async (values, { signal }) => {
      const res = await fetch('/api/packs/check', { method: 'POST', body: JSON.stringify(values), signal });
      if (!res.ok) throw new Error((await res.json()).message);   // se muestra en el formulario
    },
  },
  redeem: async (code, { gate }) => {
    // gate.code y gate.name son lo que escribió la persona
    const res = await fetch('/api/packs/open', { method: 'POST', body: JSON.stringify({ code, ...gate }) });
    return res.json();
  },
});
```

- **Casillas:** un campo `type: 'checkbox'` (con `links` opcionales a los términos o al aviso de privacidad) sirve para pedir una aceptación; si es obligatoria hay que marcarla y llega a `redeem` como `'true'`.
- **`validate`** sirve para avisar de un problema **antes** de que la persona rasgue el sobre (un código inválido, un dato que falta) sin gastar nada: es una comprobación, no la apertura. Si lanza un error, su mensaje aparece en el formulario y se puede corregir.
- **`redeem` sigue siendo la fuente de verdad:** vuelve a validar todo y es lo que abre el sobre. Lo que se comprobó en `validate` puede haber cambiado entre una y otra.
- Si la persona se retira, `open()` se resuelve con `outcome: 'aborted'` y `redeem` no se llama. Detalle de las opciones en la [referencia](referencia-api.md#gateoptions-y-gatefield).

## Qué efecto lleva cada carta

Tú declaras la asociación en `tiers`. Se resume así:

```ts
tiers: {
  field: 'meta.rarity',   // qué dato clasificar
  levels: [
    { key: 'common', label: 'Común', color: '#9aa0a6', values: ['Common'],        vfx: 'matte' },
    { key: 'ultra',  label: 'Ultra',  color: '#a78bfa', values: ['Rare Ultra'],   vfx: 'rainbow',
      hit: { burst: 40, flash: 0.5, rays: 0.5, anticipationMs: 500 } },
  ],
}
```

Los valores llegan con las cartas, así que la asociación es dinámica. Detalle completo en [personalización](personalizacion.md#rarezas-y-efectos-tiers).

## Varios sobres a elegir

En lugar de `code`, pasa `packs`. Se muestran todos y la persona elige uno; `redeem` se llama solo con el código del elegido.

```ts
import * as THREE from 'three';

createPackOpener({
  mount, redeem,
  three: THREE,               // opcional: carrusel 3D. Sin esto (o sin WebGL) se usa el estante 2D
  packs: [
    { code: 'AMX-0001', id: 'basico', caption: 'Sobre básico' },
    { code: 'AMX-0002', id: 'holo',   caption: 'Con holo', badge: 'Holo', accent: '#4ade80' },
  ],
});
```

El evento `select` (`{ packId, code }`) avisa de la elección. Con un solo sobre no hay selección: se abre directo.

## Qué hacer al terminar

El resumen tiene botones que tú defines con `actions`. La acción elegida llega en `result.actionId`.

```ts
const opener = createPackOpener({
  /* … */
  actions: [
    { id: 'collect', label: 'Agregar a mi colección', primary: true },
    { id: 'again',   label: 'Abrir otro' },
  ],
});

const result = await opener.open();

if (result.outcome !== 'failed') {
  await saveToCollection(result.cards.map((entry) => entry.card));   // tu lógica
}
if (result.actionId === 'again') { /* crea otro abridor */ }
```

`result.outcome` puede ser `completed`, `skipped` (la persona saltó), `aborted` (se destruyó antes de terminar) o `failed` (el servidor no entregó las cartas). Un ejemplo completo de un sitio anfitrión, con inicio, colección y aviso, está en [`demo/index.html`](../demo/index.html).

## Escuchar lo que pasa

```ts
opener.on('card:reveal', ({ card, index, tier, isLast }) => { /* … */ });
opener.on('hit', ({ card, tier }) => analytics.track('rare_pull', card.id));
opener.on('warning', (w) => console.warn(w.code, w.message));
```

También por `options.on` y como `CustomEvent` en `mount` con el prefijo `amoxtli-opener:`. Lista completa en la [referencia](referencia-api.md#eventos).

## Cambiar cosas en caliente

```ts
opener.update({ audio: { enabled: false }, labels: { skip: 'Skip' } });
```

Cambia el volumen o silencia, y cambia los textos: lo que ya está en pantalla se repinta. Lo demás se define al crear el abridor.

## Limpieza

Llama a `opener.destroy()` al salir de la pantalla. Aborta la petición en curso, detiene timers y animaciones, quita listeners y retira todo el DOM de la librería. Si todavía no había terminado, `open()` se resuelve con `outcome: 'aborted'`.

## Para web y para app

- **Web:** todo funciona con mouse, teclado y táctil. Ver cómo se comporta cada uno en [la experiencia](experiencia.md#web-y-móvil).
- **App (webview):** funciona igual. Conviene pasar a `haptics` un objeto `{ vibrate(pattern) }` que use el motor háptico nativo; ver [personalización](personalizacion.md#sonido-y-vibración).
- **Rendimiento:** en equipos modestos, `effects: { profile: 'low' }` quita los efectos más costosos. Por defecto (`'auto'`) ya se activa con movimiento reducido.

## Accesibilidad

Cada carta que se revela se anuncia en una región `aria-live`. Se puede operar con teclado: Enter o Espacio para elegir y avanzar, flechas para moverse, Escape para volver o cerrar. Se respeta `prefers-reduced-motion` (opción `effects.reducedMotion`). Los textos de las etiquetas (`aria-label` incluidos) salen de `labels`.
