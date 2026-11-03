# Aviso de atribución

Varios efectos visuales de esta librería están adaptados (reescritos en TypeScript y desacoplados de
Pokémon) de **OpenPack**, de **Luango**: <https://github.com/Luango/openpack>.

El repositorio original no incluía archivo de licencia. El autor confirmó por mensaje que pretendía
publicarlo bajo MIT y autorizó su uso. Hasta que añada el `LICENSE` en su repositorio, esta nota deja
constancia del origen y del permiso.

Partes adaptadas:

| Archivo aquí | Origen en OpenPack | Qué hace |
|---|---|---|
| `src/render/spring.ts` | `src/motion.js` | Motor de resortes |
| `src/render/particles.ts` | `src/particles.js` | Partículas de luz en canvas |
| `src/render/flowlight.ts` | `src/flowlight.js` | Luz fluida WebGL sobre el corte |
| `src/render/styles.ts` (foil, brillo y destello) | `src/card.css` | Foil holo por rareza guiado por el puntero |
| `src/core/tear.ts` (`TurnGuard`, `splitPack`) | `src/pack.js` + `docs/tear-and-exit.md` | Rasgado que se anula al doblarse y parte el sobre en dos piezas |
| `src/render/fan-view.ts`, `src/render/fan.ts` y `styles.ts` (`.ao-haul`) | `src/reveal.js` (haul) | Abanico arrastrable del botín |
| `src/render/carousel3d.ts`, `carousel3d-parts.ts` y `carousel3d-config.ts` | `src/select3d.js` | Carrusel 3D de sobres (geometría de bolsa, iluminación, inercia, lanzamiento) |
| `src/audio/synth.ts` | `src/sfx.js` | Bus maestro para teléfono y recetas de sonido sintetizado |

Los parámetros de los efectos del reveal (ráfagas, paletas, “hit”) siguen las ideas de `src/reveal.js`.
Lo no listado aquí es de esta librería (MIT, ver `LICENSE`).
