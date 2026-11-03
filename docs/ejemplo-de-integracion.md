# Ejemplo de integración paso a paso

Una integración completa de principio a fin: el servidor que entrega los sobres y las cartas, la página que muestra la experiencia y qué hacer con el resultado. Al final, las diferencias si va dentro de una app (webview). Para la lista de opciones, ver la [referencia](referencia-api.md).

## Qué vas a construir

```
Tu página                          Tu servidor
─────────                          ───────────
1. Pide mis sobres sin abrir  ───▶ GET  /api/packs            → [{ code, label }]
2. Muestra la experiencia
3. Al rasgar, la librería     ───▶ POST /api/packs/open       → { cards: [...] }   (marca el sobre abierto)
4. Termina: guardas el resultado ▶ (opcional) POST /api/collection
```

La regla de oro: **las cartas nunca salen del servidor antes de rasgar**, y abrir un mismo código dos veces devuelve **las mismas cartas** (idempotente). Así, si se cae la red a mitad de la apertura, el reintento no gasta otro sobre.

## 1. El servidor

Hacen falta dos endpoints. Lo esencial, en pseudocódigo:

```
GET /api/packs
  → los sobres sin abrir de esta persona: [{ code: "PK-7F3A", label: "Sobre básico" }, …]
  (nunca incluye las cartas)

POST /api/packs/open   { code }
  1. Busca el sobre por `code`, que debe ser de esta persona.   → si no, 404
  2. Si ya estaba abierto, devuelve las cartas que ya se guardaron (idempotencia).
  3. Si no, decide las cartas, guarda el resultado y marca el sobre como abierto, todo en una transacción.
  4. Devuelve { packId, cards: [{ id, name, image, rarity, isNew, meta }, …] }
```

Ejemplo en Laravel (adapta nombres a tu proyecto):

```php
public function open(Request $request): JsonResponse
{
    $pack = Pack::where('code', $request->string('code'))
        ->where('user_id', $request->user()->id)
        ->firstOrFail();

    $cards = DB::transaction(function () use ($pack) {
        if ($pack->opened_at === null) {
            $pack->cards()->sync($this->drawCards($pack));   // decides las cartas aquí
            $pack->update(['opened_at' => now()]);
        }

        return $pack->cards()->get();                        // igual si se repite
    });

    return response()->json([
        'packId' => $pack->code,
        'cards' => CardResource::collection($cards),         // { id, name, image, rarity, isNew, meta }
    ]);
}
```

Lo que devuelve cada carta se describe en [CardInput](referencia-api.md#cardinput): como mínimo `id` e `image`; con `rarity` (o el dato que clasifiques) la librería decide el efecto.

## 2. La página

```html
<div id="stage" style="position: fixed; inset: 0"></div>

<script type="module">
  import { createPackOpener } from 'amoxtli-opener';
  import * as THREE from 'three';                // opcional: carrusel 3D (sin él hay un estante 2D)

  const packs = await (await fetch('/api/packs')).json();

  const opener = createPackOpener({
    mount: document.querySelector('#stage'),
    three: THREE,
    packs: packs.map((p) => ({ code: p.code, caption: p.label, art: p.art })),

    // La librería llama a esto al rasgar. Pasa `signal` a fetch para cancelar si se cierra.
    redeem: async (code, { signal }) => {
      const res = await fetch('/api/packs/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
        body: JSON.stringify({ code }),
        signal,
      });
      if (!res.ok) throw new Error('No se pudo abrir');   // la librería ofrece reintentar
      return res.json();                                    // { packId?, cards }
    },

    // Cómo clasificas las cartas: ver «Rarezas y efectos» en personalización.
    tiers: {
      field: 'rarity',
      levels: [
        { key: 'common', label: 'Común', color: '#9aa0a6', values: ['Common'], vfx: 'matte' },
        { key: 'ultra',  label: 'Ultra',  color: '#a78bfa', values: ['Rare Ultra'], vfx: 'rainbow',
          hit: { burst: 40, flash: 0.5, rays: 0.5, anticipationMs: 500 } },
      ],
    },

    labels: { skip: 'Saltar', continue: 'Continuar', collect: 'Agregar a mi colección' },
    actions: [{ id: 'collect', label: 'Agregar a mi colección', primary: true }],
  });

  const result = await opener.open();
  opener.destroy();                                         // limpia todo al terminar
</script>
```

Con **un solo sobre** (por ejemplo, desde su ficha), pasa `code` en lugar de `packs` y no habrá selección.

## 3. Qué hacer con el resultado

`open()` se resuelve cuando la persona termina. Revisa `outcome`:

```js
switch (result.outcome) {
  case 'completed':   // vio las cartas y eligió una acción
  case 'skipped':     // saltó la animación: las cartas igual salieron
    showCollection(result.cards.map((entry) => entry.card));
    break;
  case 'failed':      // el servidor no pudo entregarlas y cerró
    showError();
    break;
  case 'aborted':     // se destruyó el abridor antes de terminar
    break;
}
```

Las cartas se guardan en el servidor **al abrir el sobre**, no al elegir «Agregar»; el botón solo decide qué ve la persona después. Si tu producto exige una confirmación posterior, guárdala tú con `result.actionId`.

## 4. El arte del sobre

El sobre siempre se dibuja con la **plantilla de la librería** (proporción 0.632 y línea de corte al 18.5 % del alto); tu imagen se ajusta a ella recortando lo que sobre. Para que se vea exacto:

- Imagen de **800 × 1266 px** (o múltiplo exacto), PNG con bordes transparentes si quieres esquinas redondeadas.
- La **línea punteada al 18.5 %** del alto: es por donde se rasga.
- Los detalles importantes dentro, lejos de los bordes (es lo primero que se recorta).

Detalles y valores en [personalización](personalizacion.md#la-plantilla-del-sobre-la-forma-es-de-la-librería). Si cada persona sube su propio arte, valida o recorta la imagen en tu servidor con las medidas anteriores.

## 5. Dentro de una app (webview)

Funciona igual. Tres cosas a tener en cuenta:

1. **Vibración nativa.** El `navigator.vibrate` del navegador no existe en todas las webviews. Pasa tu propio motor háptico:

   ```js
   haptics: { vibrate: (pattern) => NativeBridge.haptic(pattern) }
   ```
2. **Imágenes servidas desde otro dominio.** Si usas `effects.colorSource: 'image'` o `texture`, el servidor de imágenes necesita cabeceras CORS; si no, esa imagen se ve igual pero sin colores calculados ni textura.
3. **Rendimiento.** En equipos modestos usa `effects: { profile: 'low' }`. Por defecto (`'auto'`) ya se activa con movimiento reducido.

El audio necesita un gesto de la persona para activarse (los navegadores y las webviews lo exigen): ya se desbloquea con el primer toque, no necesitas hacer nada.

## 6. Comprobar que todo va bien

- **Abre el mismo sobre dos veces** (recargando a mitad): debe devolver las mismas cartas.
- **Corta la red al rasgar:** debe salir el mensaje con «Reintentar» y, al volver la red, abrir sin perder el sobre.
- **Escucha los avisos** durante el desarrollo, para detectar rarezas sin regla o imágenes que no cargan:

  ```js
  opener.on('warning', (w) => console.warn(w.code, w.message));
  ```

Un ejemplo de sitio completo (inicio, colección y aviso) está en [`demo/index.html`](../demo/index.html), con un servidor falso que cumple este mismo contrato.
