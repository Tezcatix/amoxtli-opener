# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). La librería está en **pre-lanzamiento** (0.0.x): la API puede cambiar entre versiones, y aquí se anota todo lo que rompe.

## [Sin publicar]

### Cambios que rompen
- **Textos (`labels`):** se quitaron `labelsEs` y `labelsEn` del paquete. `labels` es la única entrada de textos; lo que no se pase queda en un texto de reserva en inglés. Ahora se pueden cambiar en caliente con `opener.update({ labels })`.
- **Forma del sobre:** se quitaron `pack.aspectRatio` y `pack.stripRatio`. El sobre siempre se dibuja con la plantilla de la librería (`PACK_TEMPLATE`: proporción 0.632 y línea de corte al 18.5 %); la imagen se ajusta recortando lo que sobre. Ver [personalización](docs/personalizacion.md#la-plantilla-del-sobre-la-forma-es-de-la-librería).
- **Sobre generado por código:** `defaultPackArt(accent, label)` pasa a `defaultPackArt(accent)`: ya no imprime texto. `pack.label` ahora es solo el nombre de respaldo en la selección (si no hay `caption`).
- **Rarezas:** `TierSystem.hitFrom` ya no tiene un valor fijo de 4: por defecto es el primer nivel con `hit`.
- **Documentación:** el borrador `docs/01-analisis-inputs-outputs.md` se reemplazó por la documentación nueva.

### Añadido
- **Seguridad de la puerta de entrada:** los `links` con esquemas peligrosos (`javascript:`, `data:`…) se descartan, y un campo llamado `__proto__` ya no altera el prototipo de los valores. Nueva guía [docs/seguridad.md](docs/seguridad.md) con lo que la librería cubre, lo que debe validar el servidor y los riesgos que dependen de quien integra.
- **Puerta de entrada, accesibilidad:** el título del formulario usa un `id` único por instancia (antes era fijo y se repetía con varios abridores); internamente `gate.ts` se separó en `buildHeader`, `buildField` y `runGate` sin cambiar el comportamiento.
- **Botón «Salir» (`ui.exitButton`):** arriba a la izquierda y visible en todas las fases, también en la puerta de entrada y la selección; termina con `outcome: 'aborted'`. Nueva etiqueta `labels.exit` y método `opener.exit()`.
- **`update({ actions })`:** reemplaza en caliente los botones del resumen (se leen al llegar a él), p. ej. para ofrecer «Abrir otro» solo si al servidor le quedan sobres.
- **Puerta de entrada (`gate`):** un formulario previo a la experiencia para pedir datos que el sitio necesita (un código de acceso, un nombre…), con validación asíncrona (`validate`) que muestra su error en el formulario y sin gastar nada. Lo escrito llega a `redeem` en `context.gate` (nuevo campo de `RedeemContext`, `{}` si no hay puerta). Si la persona se retira, `open()` termina con `outcome: 'aborted'`. Los campos pueden ser de texto, correo, teléfono o casilla (`type: 'checkbox'`, con `links` y `requiredMessage` propios, para aceptar términos). Tipos `GateOptions`, `GateField` y `GateValidateContext`; `OpeningSession.cancelBeforeStart()`. Ver la [guía](docs/guia-de-uso.md#pedir-datos-antes-de-entrar-gate).
- **Clasificación propia de cartas:** `tiers.field` (qué dato se clasifica: `'rarity'`, una ruta como `'meta.type'` o una función), y por nivel `values` (exactos), `keywords` y `when(card)`.
- **Colores desde la imagen:** `effects.colorSource: 'image'` calcula el brillo de sobres y cartas con los colores dominante y secundario de su imagen. Helper `extractPalette`.
- **Tiempos configurables:** opción `timing` (`holdToOpenMs`, `holdArmMs`, `lastCardHoldMs`, `summaryStaggerMs`, `packDropMs`, `flipMs` y `pace`).
- **Interfaz opcional:** `ui.hints` y `ui.counter` para ocultar los textos de ayuda y el contador.
- **Textura propia del sobre:** `pack.texture` mezcla una imagen sobre el arte; apagada por defecto.
- **Selección de sobres:**
  - Carrusel 3D estilo cover flow, con flechas y puntos de paginación.
  - Etiqueta corta junto al nombre (`badge`).
  - Aviso sobre cómo elegir y abrir.
- **Abrir un sobre:**
  - Mantener presionado lo abre directamente desde la selección (6 s, configurable).
  - Zonas de corte y de apertura marcadas sobre el sobre elegido.
  - Aviso bajo la caja para volver a ver todos los sobres.
- **Experiencia:**
  - La luz de la boca del sobre y la salida de las cartas, sincronizadas.
  - Contador `n/N`, pulso en el dorso de la siguiente carta rara y deslizar para pasar cartas.
  - Resumen con la mejor carta destacada y sobre vacío que cae.
  - Aviso arriba del abanico para ver una carta de cerca.
- **Sonidos nuevos:** `slide` y `snap`.
- **Exports:** `resolveTier` ahora acompañado de `hitFromOf`, además de `extractPalette`, `paletteFromPixels`, `composePackArt`, `resolvePackTexture`, `PACK_TEMPLATE` y `coverRect`.
- **Documentación:** `README.md` y siete documentos en `docs/` (guía, experiencia, personalización, referencia, arquitectura, desarrollo y este ejemplo de integración), más este historial.

### Cambiado
- **Móvil:** los sobres se ven un 15 % más chicos, las cartas se ajustan al ancho del sobre, y en la selección no hay corte por deslizamiento (solo mantener presionado).
- **Tiempos más largos** en la salida de las cartas, la pausa tras la última carta, el giro de cada carta y la caída del sobre vacío, para disfrutar los efectos.
- **Rasgado:** la tira cae en arco, el brillo del sobre baja en dos tiempos y el halo y las cometas se recortan al sobre que queda.
- **Internamente:** `opener.ts` y `carousel3d.ts` se dividieron en módulos más pequeños (`timing`, `label-binder`, `zones`, `util`, `easing`, `pack-size`, `pack-texture`, `palette`, `carousel3d-config` y `carousel3d-parts`).
- **Demo:** simula un sitio completo (inicio, colección, aviso) y trae 20 sobres de datos falsos; con `?debug` muestra los controles de prueba.

### Corregido
- Una carta rara se veía boca abajo por usar `filter` sobre un elemento 3D (aplana el giro); el brillo ahora es `box-shadow`.
- El abanico se descuadraba en móvil porque las posiciones de las cartas ya vistas usaban un ancho fijo de 240 px.
- Los botones del abanico y del resumen quedaban tapados por el sobre 3D que se queda detrás.
- El sobre se veía estirado cuando la proporción declarada no era la de su imagen.

## [0.0.1]

Versión inicial, sin publicar en npm: núcleo sin DOM (`OpeningSession`), render del rasgado, pila, abanico y resumen, carrusel 3D opcional con `three`, sonido sintetizado y preset de ejemplo de Amoxtli.
