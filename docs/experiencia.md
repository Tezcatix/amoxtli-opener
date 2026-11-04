# La experiencia

Qué ve y qué hace la persona en cada fase. Las fases son las que reporta el evento `phase`: `idle → select → redeeming → tear → stack → fan → summary → done`. Con `flow.steps` puedes quitar pasos (por defecto: `tear`, `stack`, `fan`, `summary`; `select` se añade solo si hay varios sobres).

## 0. Puerta de entrada (opcional)

Solo si pasaste `gate`. Antes de cualquier otra cosa se muestra un formulario centrado, sobre el mismo fondo, con los campos que definiste (el primero ya enfocado). La fase sigue en `idle` y el botón «Saltar» no aparece.

- **Continuar** (o Enter): revisa que estén los campos obligatorios, llama a `validate` (el botón muestra `busyLabel` y el formulario se bloquea) y, si todo está bien, empieza la experiencia. Si algo falla, el mensaje aparece en rojo bajo los campos y se puede corregir.
- **Cancelar** o **Escape:** la persona se retira; `open()` termina con `outcome: 'aborted'`.

El formulario es un `role="dialog"` y sus campos tienen etiqueta; los obligatorios llevan `aria-required`.

## 1. Selección (`select`)

Solo si pasaste `packs`.

### Carrusel 3D (con `three`)
- Entra una caja que cae, se abre y de ella salen los sobres a su sitio (si pasaste `box`).
- El sobre del **centro** es el grande y brilla; los de los lados se ven de frente, más chicos, más oscuros y girados un poco hacia el centro, como en un cover flow.
- **Moverse entre sobres:** arrastrar, las flechas de los lados, los puntos de abajo, las flechas del teclado, o tocar un sobre lateral para traerlo al centro.
- **Elegirlo:** un **clic corto** sobre el sobre del centro (o Enter).
- **Abrirlo directamente:** **mantener presionado** el sobre del centro (ver [mantener presionado](#abrir-manteniendo-presionado)).
- Aviso de arriba: «Click para seleccionar · Mantén presionado para abrir».

### Estante 2D (sin `three` o sin WebGL)
Todos los sobres en fila; tocar uno lo elige. Las flechas del teclado pasan de uno a otro.

## 2. Rasgado (`tear`)

El sobre elegido queda al frente. Aparece el aviso «Desliza por la línea punteada, o mantén presionado debajo de ella, para abrir» y, si hay caja, un mensaje bajo ella: «Click en la caja para ver los sobres» (volver a elegir).

El sobre tiene dos zonas, marcadas con un relleno tenue:

| Zona | Dónde | Cómo se abre |
|---|---|---|
| **Corte** | De arriba hasta un poco debajo de la línea punteada | **Deslizar** en horizontal por la línea. |
| **Cuerpo** | El resto del sobre | **Mantener presionado.** |

### Deslizar por la línea punteada
- El corte sigue el trazo y se ve la tira de oro dentada; la tira se despega solo donde ya pasó el corte.
- Hay que recorrer el 80 % del ancho (configurable con `pack.tear.minLengthRatio`).
- Si el trazo se dobla sobre sí mismo (una U, un quiebre brusco), se anula, como un rasgado real.
- Con `flow.tearMode: 'tap'` basta un toque; con `'auto'` se abre solo.

### Abrir manteniendo presionado
- Con el sobre presionado y quieto ~0.4 s, empieza a rasgarse despacio, de izquierda a derecha, con chispas, crujido y vibración.
- Tarda **6 s** en abrirse (`timing.holdToOpenMs`). Si sueltas antes, el sobre se cierra y vuelve todo a su sitio.
- Si mueves el puntero más de ~12 px, se cancela.
- En la **selección**, mantener presionado abre el sobre directamente, sin pasar por esta vista: los otros sobres se van desvaneciendo mientras se rasga.

### Al completar el corte
La tira sale volando, hay un destello y, en el borde cortado, una luz que sube; después las cartas salen por esa boca. El sobre vacío se queda detrás hasta el resumen.

## 3. Pila (`stack`)

Las cartas salen del sobre en una pila, la más rara al final. Se toca (o desliza más de 40 px sobre la pila) para voltear la de arriba. Cada carta vista se acomoda debajo, formando ya el abanico.

- Un contador `n/N` indica el avance (opcional, `ui.counter`).
- El dorso de la **siguiente carta rara** pulsa con el color de su rareza antes de voltearla.
- Al voltear una carta rara hay anticipación y un golpe de efectos: destello, rayos, onda y partículas (ver [personalización](personalizacion.md#rarezas-y-efectos-tiers)).
- `flow.revealMode` cambia esto: `auto-advance` voltea sola cada `autoAdvanceMs`; `all-at-once` las muestra todas de golpe.
- Tras la última carta hay una pausa (más larga si es rara) antes del abanico.

## 4. Abanico (`fan`)

Todas las cartas en abanico, la más rara al centro y agrandada, con su nombre y rareza arriba.

- **Cambiar de carta:** arrastrar, rueda del mouse, flechas del teclado o tocar una carta lateral.
- **Verla de cerca:** arrastrar una carta **hacia arriba** la muestra aparte, más grande, con su brillo siguiendo al puntero. «Cerrar» (o Escape) la devuelve.
- Aviso de arriba: «Desliza la carta hacia arriba para verla mejor».
- «Continuar» pasa al resumen.

## 5. Resumen (`summary`)

Una cuadrícula con todas las cartas, la mejor un poco más grande y con borde blanco, y las nuevas con su insignia. Debajo, el texto «Mejor carta: …» (se oculta con `ui.hints: false`) y los botones de `actions`. El sobre vacío cae y se desvanece.

## Web y móvil

La librería detecta si es un dispositivo táctil (`pointer: coarse`), una pantalla vertical (relación de aspecto menor a 0.9) o angosta (640 px o menos).

| | Web (mouse) | Móvil (dedo) |
|---|---|---|
| Elegir sobre | Clic corto | Toque corto |
| Abrir desde la selección | Mantener presionado | Mantener presionado, en **todo** el sobre |
| Rasgar con el sobre elegido | Deslizar por la línea o mantener presionado | Igual |
| Avisos | Arriba, a media altura entre el borde y el sobre | Igual; en la vista de un solo sobre el aviso va abajo |
| Tamaño | El sobre del centro ocupa ~28 % del ancho | ~42 % |
| Cartas | Ancho según la altura, hasta 320 px | Se ajustan al ancho del sobre |

En la selección **no hay corte por deslizamiento** (en ninguna plataforma), para que no choque con arrastrar el carrusel o desplazar la página. El corte por línea punteada está solo en la vista del sobre ya elegido.

## Teclado

| Dónde | Teclas |
|---|---|
| Carrusel de sobres | ← → mover · Enter o Espacio elegir |
| Estante 2D | ← → mover · Enter elegir |
| Sobre elegido | Enter o Espacio rasga · Escape vuelve a ver todos los sobres |
| Pila | Enter o Espacio voltea |
| Abanico | ← → cambiar de carta · Escape cierra la vista de cerca |

El mantener presionado y el rasgado por deslizamiento son gestos de puntero; con teclado se usa Enter o Espacio.

## Salir

Con `ui.exitButton: true` hay un botón **Salir** fijo arriba a la izquierda en todas las fases: puerta de entrada, selección, rasgado, pila, abanico y resumen. Sin él, la persona solo puede salir con Escape o con los botones del resumen, y desde dentro no es evidente cómo; por eso se recomienda activarlo cuando la experiencia ocupa toda la pantalla. Salir termina con `outcome: 'aborted'` y no llama a `redeem` si todavía no se había rasgado el sobre; si el servidor ya había entregado las cartas, tu sitio debe mostrar lo que salió (la librería no lo hace al salir). También se puede salir por código con `opener.exit()`.

## Movimiento reducido y perfil bajo

Con `prefers-reduced-motion` (o `effects.reducedMotion: true`) se quitan animaciones largas, partículas y el mantener presionado; las esperas pasan a 0. Con `effects.profile: 'low'` se quitan los brillos y efectos costosos pero se mantienen las animaciones esenciales.
