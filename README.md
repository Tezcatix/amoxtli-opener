# amoxtli-opener

**Interactive Pack Opening Engine.** Una librería para animar la apertura y revelación de sobres (de cartas y de cualquier cosa que se «abra» y se revele en orden): elegir sobre → rasgar → revelar → resumen.

Recibe **qué salió del sobre** y **cómo debe verse y sonar**; devuelve **qué hizo la persona** mediante eventos y un resultado final.

- TypeScript, ESM, sin dependencias en runtime. `three` es opcional y lo inyecta quien integra la librería.
- Independiente de cualquier juego: «carta», «rareza» y «sobre» son conceptos genéricos que tú defines.
- Las cartas **nunca** viajan antes de abrir el sobre: la librería las pide a tu servidor con una función `redeem` en el momento del rasgado.
- Todo lo visual y los textos se pueden cambiar desde las opciones, en caliente cuando tiene sentido.
- Núcleo sin DOM (probado con tests) y render reemplazable. Licencia MIT.

Estado: **v0.0.1, pre-lanzamiento**. La API puede cambiar.

## Instalación

Aún no está publicada en npm. Para usarla, clona [Tezcatix/amoxtli-opener](https://github.com/Tezcatix/amoxtli-opener), ejecuta `npm ci && npm run build` y consume `dist/`:

- **ESM:** `dist/index.js` (con tipos en `dist/index.d.ts`).
- **Etiqueta `<script>`:** `dist/amoxtli-opener.global.js` expone `window.AmoxtliOpener`.
- **Carrusel 3D (opcional):** instala también `three` (≥ 0.160) y pásalo en las opciones.

## Uso mínimo

```ts
import { createPackOpener, generic5 } from 'amoxtli-opener';

const opener = createPackOpener({
  mount: document.querySelector('#stage')!,
  code: 'PK-7F3A-92XC',                           // token de un solo uso emitido por tu servidor
  redeem: async (code, { attempt, signal }) => {  // tu servidor marca el sobre abierto y devuelve las cartas
    const res = await fetch('/api/packs/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      signal,
    });
    if (!res.ok) throw new Error('No se pudo abrir');
    return res.json();                            // { cards: CardInput[], packId?: string }  (o solo CardInput[])
  },
  tiers: generic5,
  labels: { skip: 'Saltar', continue: 'Continuar', collect: 'Agregar a mi colección' },
});

const result = await opener.open();               // OpenResult
```

Cada carta es, como mínimo, `{ id, image }`; con `rarity` (u otro dato que clasifiques) la librería decide qué efecto lleva. Para varios sobres a elegir, el carrusel 3D, los textos, los colores y los tiempos, sigue la documentación.

## Documentación

| Documento | Para qué sirve |
|---|---|
| [docs/guia-de-uso.md](docs/guia-de-uso.md) | Integrarla en una web o app: el contrato con tu servidor, varios sobres, acciones, errores y limpieza. |
| [docs/ejemplo-de-integracion.md](docs/ejemplo-de-integracion.md) | Una integración completa paso a paso: servidor, página, resultado y app. |
| [docs/experiencia.md](docs/experiencia.md) | Qué ve y qué hace la persona en cada fase, con sus gestos (web y móvil) y accesibilidad. |
| [docs/personalizacion.md](docs/personalizacion.md) | Colores, rarezas y efectos, sobres y caja, textos, tiempos, sonido. |
| [docs/referencia-api.md](docs/referencia-api.md) | Todas las opciones, tipos, métodos, eventos y resultado. |
| [docs/arquitectura.md](docs/arquitectura.md) | Cómo está organizado el código y por qué. |
| [docs/desarrollo.md](docs/desarrollo.md) | Scripts, pruebas, demo, CI y cómo extenderla. |

El índice completo está en [docs/README.md](docs/README.md). Qué cambió entre versiones: [CHANGELOG.md](CHANGELOG.md).

## Demo

```
npm run demo:data     # genera los datos falsos (20 sobres de 6 cartas)
npm run demo          # build + servidor local en /demo/
```

`demo/index.html` simula el sitio que rodea a la librería (inicio, colección, aviso). Con `?debug` en la URL aparecen los controles de prueba.

## Recursos de Amoxtli

[examples/amoxtli/](examples/amoxtli/) es el **ejemplo** de cómo personalizarla y a la vez los recursos reales que usa Amoxtli: tema, textos, rarezas (8 niveles que cubren las 45 del catálogo) y arte del sobre, la caja y el dorso. No se publica en el paquete. Ver [personalizacion.md](docs/personalizacion.md#preset-de-amoxtli).

## Créditos y licencia

Varios efectos están adaptados de [OpenPack](https://github.com/Luango/openpack) (Luango), con permiso del autor; ver [NOTICE.md](NOTICE.md). El resto es de esta librería, bajo licencia MIT ([LICENSE](LICENSE)).
