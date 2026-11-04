# Seguridad

Amoxtli corre entera en el navegador. Lo que hace es **mostrar** una apertura de sobres; no puede **garantizar** nada. Quien decide qué cartas salen, si un código sirve o si se cobra algo es tu servidor, en `redeem`. Cualquier persona puede abrir la consola, saltarse la interfaz y llamar a tu endpoint directamente.

## Qué hace la librería

- **No inyecta HTML.** No usa `innerHTML`, `eval` ni `document.write`; los textos que vienen de fuera (nombres de cartas, mensajes de error de `validate` y `redeem`, etiquetas) se pintan con `textContent`.
- **Enlaces del `gate` filtrados.** Los `links` de un campo solo se pintan si el `href` es una ruta relativa o usa `http:`, `https:`, `mailto:` o `tel:`. `javascript:`, `data:` y cualquier otro esquema se descartan (`isSafeHref` en `src/render/gate.ts`). Los que pasan se abren con `target="_blank"` y `rel="noopener noreferrer"`.
- **Valores del `gate` sin contaminar prototipos.** Un campo llamado `__proto__` se guarda como propiedad propia y no cambia el prototipo del objeto que llega a `validate` y a `redeem`.
- **La respuesta de `redeem` se comprueba antes de pintar.** Debe ser un arreglo de cartas (o `{ cards }`), cada una con `id` e `image` de texto y, como mucho, 500 cartas (`MAX_CARDS_PER_OPENING` en `src/render/cards-guard.ts`). Si no cuadra, la persona ve el error de canje (`REDEEM_FAILED`) en lugar de una pantalla rota o un dispositivo sin memoria.
- **Un oyente roto no rompe la apertura.** Si un manejador tuyo (`opener.on(...)`) lanza una excepción, el resto de oyentes y la máquina de estados siguen (antes, un error en `complete` podía dejar `open()` sin resolverse). El error se relanza aparte para que lo veas en la consola.
- **Las cartas no viajan por adelantado.** Solo existen en el cliente después de `redeem`.
- **El arte por defecto es un SVG dentro de `<img>`,** que no ejecuta scripts. Las claves de `theme` pasan por `style.setProperty`.

## Qué no puede hacer (y debe hacer tu servidor)

| Vector | Por qué no lo cubre la librería | Qué hacer en el servidor |
|---|---|---|
| **Saltarse la puerta de entrada (`gate`)** | `validate`, `required` y `maxLength` son ayudas de interfaz. Se puede llamar a `redeem` sin formulario o con `gate` vacío o inventado. | Volver a validar todo en `redeem`: código, campos, términos aceptados y longitudes. |
| **Saltarse fases** (`skip`, `exit`, rasgado) | Las fases son animación, no control de acceso. | Decidir las cartas y marcar el sobre como abierto solo en el servidor. |
| **Ver las cartas en la red** | La respuesta de `redeem` es visible en la pestaña Network. | Asumir que quien canjea ve sus cartas; no mandar nada que no deba ver. |
| **Fuerza bruta o robo de códigos** | El código vive en el cliente; `transform: 'uppercase'` solo normaliza ahí. | Límite de intentos por IP y por código, códigos con suficiente aleatoriedad y normalización (mayúsculas, espacios) también en el servidor. |
| **Carrera entre `validate` y `redeem`** | Entre una llamada y otra el estado puede cambiar. | `redeem` es la fuente de verdad y debe ser idempotente y atómico. |
| **Resultado falsificado** (`outcome`, eventos) | Los eventos los emite el cliente. | No usar `onComplete`, `outcome` ni eventos para decidir premios, cobros ni estadísticas fiables. |

## Más cosas que le tocan al servidor

| Vector | Qué puede pasar | Qué hacer |
|---|---|---|
| **`redeem` que nunca responde** | La persona se queda en «canjeando»; la librería no tiene tiempo límite. | Responder siempre (o cortar con un tiempo límite en el servidor) y, en tu `redeem`, usar `AbortSignal.timeout(...)` combinado con `context.signal`. |
| **Reintentos en ráfaga** | La interfaz solo permite una petición a la vez, pero un script llama a `redeem` las veces que quiera. | Límite de peticiones por IP, sesión y código. |
| **Cartas con `image` o `thumb` de otro dominio** | Rastreo de la persona o contenido mixto. | Devolver solo URLs tuyas o de una CDN de confianza. |
| **Cartas repetidas o con rarezas inventadas** | La librería avisa (`DUPLICATE_CARD_ID`, `UNKNOWN_RARITY`) pero igual las pinta. | Generar las cartas y su rareza solo en el servidor. |
| **Respuestas enormes** | Más de 500 cartas se rechazan, pero 500 imágenes grandes igual pesan. | Limitar el tamaño y el número de cartas por sobre. |
| **Caché de paleta** | Con `colorSource: 'image'` la librería recuerda los colores de cada imagen vista durante la vida de la página. | Evitar URLs únicas por petición (con tokens que cambian) para no llenar esa caché. |

## Riesgos que dependen de quien integra

- **`image` y `thumb` de las cartas, y `pack.art`:** se cargan como `<img src>`. No ejecutan código, pero una URL ajena puede rastrear a la persona o dar contenido mixto. Sírvelas desde tu dominio o una CDN de confianza.
- **`accent` y colores:** se interpolan en el SVG por defecto y en variables CSS. Pasa colores que controlas, no texto de usuarios.
- **`gate.fields[].name`, `title`, `message`, `help`:** los define el sitio, no la persona. No los armes con datos sin confiar. El texto se pinta con `textContent`, así que no hay inyección de HTML.
- **Aislamiento:** el abridor vive en el DOM de la página (sin Shadow DOM). Un script de la misma página puede leer o quitar su interfaz; no pongas secretos en el cliente.

## Lista para el servidor

1. Revalidar todo en `redeem`.
2. Limitar intentos y usar códigos aleatorios.
3. `redeem` idempotente y atómico.
4. No confiar en nada que reporte el cliente.
5. Normalizar el código también en el servidor.
6. Responder siempre, con tiempo límite, y limitar el número y el peso de las cartas.
