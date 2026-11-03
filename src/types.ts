export interface CardInput {
  id: string;
  image: string;
  thumb?: string;
  name?: string;
  rarity?: string;
  /** Si el host ya conoce el tier, gana sobre `rarity`. */
  tier?: number;
  foil?: boolean;
  isNew?: boolean;
  back?: string;
  /** Opaco: vuelve intacto en eventos y resultado. */
  meta?: Record<string, unknown>;
}

export type SoundKey = 'crinkle' | 'rip' | 'open' | 'flick' | 'riser' | 'impact' | 'chime' | 'collect' | 'sparkle' | 'conclude' | 'hover' | 'reject' | 'slide' | 'snap';

export interface AudioProvider {
  play(key: SoundKey, options?: { tier?: number }): void;
  /** Desbloquea el audio tras un gesto del usuario (los navegadores lo exigen). */
  unlock?(): void;
  setVolume?(volume: number): void;
  setEnabled?(enabled: boolean): void;
  dispose?(): void;
}

export interface AudioOptions {
  enabled?: boolean;
  /** 0..1. Def. 0.7. */
  volume?: number;
  /** 'synth' (def.): WebAudio sin archivos. 'none': silencio. O un proveedor propio. */
  provider?: 'synth' | 'none' | AudioProvider;
  /** Reemplaza un sonido concreto por una función del host. */
  sounds?: Partial<Record<SoundKey, () => void>>;
}

/** `true` usa navigator.vibrate; un objeto permite otro mecanismo (p. ej. un plugin nativo). */
export type HapticsOption = boolean | { vibrate(pattern: number | number[]): void };

/** El efecto especial de una carta rara al voltearla. Todo lo que sale (destello, rayos, partículas, sonidos) espera `anticipationMs`. */
export interface HitProfile {
  /** Cantidad de partículas de la ráfaga. */
  burst: number;
  /** Intensidad del destello de pantalla, 0..1. */
  flash: number;
  /** Intensidad de los rayos giratorios, 0..1. Con 0 no hay rayos. */
  rays: number;
  /** Pausa, en ms, entre voltear la carta y el estallido; mientras tanto suena el `riser`. */
  anticipationMs: number;
  /** Patrón de vibración. Def.: `[40, 30, 60 + nivel·10]`. */
  haptic?: number | number[];
  /** Sonido del impacto; def. 'impact'. */
  sound?: SoundKey;
}

/** Un nivel de rareza (o de la clasificación que uses): cómo se reconocen sus cartas y qué efectos llevan. */
export interface TierLevel {
  /** Identificador interno del nivel. */
  key: string;
  /** Nombre que se muestra y se anuncia. */
  label: string;
  /** Color del anillo, el brillo, el destello y las partículas de este nivel. */
  color: string;
  /**
   * Valores exactos del campo clasificado (ver `TierSystem.field`) que caen en este nivel. Se comparan sin distinguir mayúsculas ni espacios
   * de los bordes: `values: ['Rare Holo VMAX']` solo coincide con ese valor. Es la forma directa de decir «este tipo lleva este efecto».
   */
  values?: string[];
  /** Fragmentos de texto: coincide si el valor del campo clasificado los contiene (p. ej. 'holo' acepta «Rare Holo VMAX»). */
  keywords?: string[];
  /** Condición propia: si devuelve true la carta cae en este nivel, sea cual sea su valor. Útil para reglas que combinan varios datos. */
  when?: (card: CardInput) => boolean;
  /** Brillo permanente de la carta, que sigue al puntero: 'matte' (ninguno), 'shimmer', 'holo', 'rainbow' o 'cross'. */
  vfx: string;
  /** Efecto especial al voltear una carta de este nivel. Solo los niveles que lo definen lo llevan. */
  hit?: HitProfile;
}

export interface TierSystem {
  /** Ordenados de menor a mayor: si una carta cumple varios, gana el de mayor índice. */
  levels: TierLevel[];
  /**
   * Qué dato de la carta se clasifica. Def.: 'rarity'. Un texto es la ruta a un campo de la carta, con puntos para entrar en `meta`
   * (p. ej. 'meta.type'); una función devuelve el valor (texto, número o una lista de ellos: basta con que uno coincida, p. ej. los tipos
   * de una carta de Pokémon). Así el sistema sirve para cualquier clasificación, no solo rareza.
   */
  field?: string | ((card: CardInput) => unknown);
  /** Reemplaza a todo lo demás: devuelve directamente el número de nivel de la carta. */
  resolve?: (card: CardInput) => number;
  /** Nivel mínimo para el efecto de «golpe» (`hit`). Def.: el primer nivel que tenga un `hit` definido. */
  hitFrom?: number;
}

export type Step = 'select' | 'tear' | 'stack' | 'fan' | 'summary';
export type TearMode = 'swipe' | 'tap' | 'auto';
export type RevealMode = 'tap-through' | 'auto-advance' | 'all-at-once';

/** Qué pasos tiene la experiencia y cómo avanzan. */
export interface FlowOptions {
  /** Pasos que se muestran, en orden fijo. Def.: tear, stack, fan y summary (select se añade solo si hay varios sobres). */
  steps?: Step[];
  /** 'swipe' (def.): deslizar por la línea de corte; 'tap': un toque; 'auto': se abre solo. */
  tearMode?: TearMode;
  /** 'tap-through' (def.): tocar para voltear cada carta; 'auto-advance': solas, cada `autoAdvanceMs`; 'all-at-once': todas de golpe. */
  revealMode?: RevealMode;
  /** Pausa entre cartas con `revealMode: 'auto-advance'`, en ms. Def. 1200. */
  autoAdvanceMs?: number;
  /** La carta de mayor nivel va al final de la pila. Def. true. */
  sortByTier?: boolean;
  /** Muestra el botón «Saltar». Def. true. */
  allowSkip?: boolean;
  /** `open()` no arranca solo: hay que llamar a `start()`. Def. false. */
  startPaused?: boolean;
}

/** Un botón del resumen. */
export interface ActionDefinition {
  /** Identificador que llega en `result.actionId` y en el evento `action`. */
  id: string;
  /** Texto del botón. */
  label: string;
  /** Botón destacado (color de acento). */
  primary?: boolean;
  /** Cierra la experiencia al elegirlo. */
  closes?: boolean;
}

export type TearLine = 'top' | 'free' | { y: number };

export interface TearConfig {
  /** 'top' (def.): banda superior; { y }: banda alrededor de esa fracción de alto (0..1); 'free': cualquier trazo. */
  line?: TearLine;
  /** Fracción del ancho que hay que recorrer para completar. Def. 0.8. */
  minLengthRatio?: number;
}

/**
 * La caja de la que salen los sobres en la entrada del carrusel 3D (cae desde arriba, se abre y los sobres vuelan de ella
 * a su lugar del anillo). Solo se usa con `three` y `packs`, y no con movimiento reducido.
 */
export interface PackBoxDefinition {
  /** Cara frontal del cuerpo de la caja (640 × 440 en el ejemplo; la proporción fija el tamaño de la caja). */
  front: string;
  /** Tapa: se estira en su cara frontal y en la de arriba (640 × 120 en el ejemplo). */
  lid?: string;
  /** Costados y parte trasera (440 × 440 en el ejemplo). */
  side?: string;
  /** Color de la luz que sale al abrirla. */
  accent?: string;
}

/** Un sobre dentro de la pantalla de selección. Los campos de `pack` se mezclan sobre `options.pack`. */
export interface PackChoice extends PackDefinition {
  /** Código canjeable de este sobre (se pasa a `redeem`). */
  code: string;
  /** Texto bajo el sobre en la selección. */
  caption?: string;
  /** Etiqueta corta junto al texto (p. ej. «Holo»), en una pastilla del color del sobre. */
  badge?: string;
}

/**
 * Textura que se mezcla sobre el arte del sobre: una foto de foil arrugado, de papel, de tela… La pones tú (por ejemplo, la que sube la
 * persona junto con su sobre): la librería no trae ninguna. Es opcional y está **apagada por defecto**: sin `texture`, o con `enabled: false`,
 * el sobre se ve exactamente como su arte. La textura no sale de la silueta del arte.
 */
export interface PackTexture {
  /** Imagen de la textura (URL). Requerida: sin ella no se aplica nada. Si es de otro origen necesita cabeceras CORS; si no se puede leer, el sobre sigue con su arte. */
  src: string;
  /** Activa o desactiva la textura sin quitar su configuración. Def. true. */
  enabled?: boolean;
  /** Cómo se mezcla con el arte. Def. 'overlay' (realza luces y sombras conservando el color). */
  blend?: 'overlay' | 'soft-light' | 'multiply' | 'screen' | 'normal';
  /** Intensidad, 0..1. Def. 0.5. */
  opacity?: number;
  /** Cuántas veces se repite a lo ancho del sobre; 1 la ajusta para cubrirlo. Def. 1. */
  repeat?: number;
}

export interface PackDefinition {
  id?: string;
  /**
   * URL de imagen/SVG del sobre. Si falta se genera un sobre sencillo por código. El sobre siempre se dibuja con la plantilla de la librería
   * (`PACK_TEMPLATE`: proporción 0.632 y línea de corte al 18.5 %): tu imagen se ajusta a ella, recortando lo que sobre, nunca se estira. Para que
   * quede exacta, hazla de 800 × 1266 px con la línea punteada al 18.5 % del alto.
   */
  art?: string;
  /** Nombre del sobre; en la selección se muestra bajo él si no hay `caption`. */
  label?: string;
  tear?: TearConfig;
  accent?: string;
  /** Textura propia sobre el arte (ver `PackTexture`). Apagada por defecto. */
  texture?: PackTexture | false;
}

export interface EffectsOptions {
  /** 'low' desactiva animaciones de foil y brillos costosos. 'auto' = low si hay reduced-motion. */
  profile?: 'auto' | 'high' | 'low';
  reducedMotion?: 'auto' | boolean;
  /**
   * De dónde salen los colores de brillo. 'manual' (def.): el `accent` de cada sobre y el color de la rareza en las cartas. 'image': se calculan
   * de los colores de la propia imagen (dominante y secundario): el halo y las cometas del sobre (si no tiene `accent`) y el resplandor de
   * cada carta. El anillo fino de la carta conserva el color de la rareza. Si la imagen no se puede leer (otro origen sin CORS) se usa el modo manual.
   */
  colorSource?: 'manual' | 'image';
}

/**
 * Tiempos de la experiencia. Todos son opcionales y, si no se pasan, valen lo de siempre. Solo están los que pueden cambiarse sin descuadrar
 * otros efectos; lo que debe ir sincronizado (rasgado, luz de la boca, salida de las cartas, acomodo de cada carta) se mueve junto con `pace`.
 */
export interface TimingOptions {
  /** Segundos de presión sostenida sobre el sobre para abrirlo, en ms. Def. 6000. */
  holdToOpenMs?: number;
  /** Tiempo con el sobre presionado y quieto para que cuente como «mantener» (y no como un clic), en ms. Def. 400; mínimo 350. */
  holdArmMs?: number;
  /** Pausa tras voltear la última carta y antes del abanico, en ms. Si la carta es rara se le suma su anticipación. Def. 1800. */
  lastCardHoldMs?: number;
  /** Retraso entre la entrada de cada ficha del resumen, en ms. Def. 70. */
  summaryStaggerMs?: number;
  /** Caída del sobre vacío al llegar al resumen, en ms. Def. 900. */
  packDropMs?: number;
  /** Duración del giro de cada carta al voltearla, en ms. Def. 700. */
  flipMs?: number;
  /**
   * Multiplicador de duración de los bloques que van sincronizados: la tira del rasgado que vuela, la luz de la boca, la espera y la subida de
   * las cartas, y su acomodo (con su sonido). 1 = como hoy, 2 = el doble de lento, 0.5 = el doble de rápido. Se limita a 0.25–4.
   */
  pace?: number;
}

export interface UiOptions {
  /** Textos de ayuda («toca para abrir», etc.). Def. true. Los mensajes de error siempre se muestran. */
  hints?: boolean;
  /** Contador «n/N» bajo la pila de cartas. Def. true. */
  counter?: boolean;
}

/** Las etiquetas de texto fijo (todas salvo `announce`, que es una función). */
export type LabelKey = Exclude<keyof Labels, 'announce'>;

export interface Labels {
  skip: string;
  swipeToOpen: string;
  tapToOpen: string;
  choosePack: string;
  browseHaul: string;
  /** Aviso arriba del abanico: arrastrar una carta hacia arriba la muestra aparte, más grande. */
  liftToInspect: string;
  /** Aviso arriba de la selección: clic elige el sobre, mantener presionado lo abre. */
  selectPack: string;
  /** Aviso con el sobre ya elegido: se abre deslizando por la línea punteada o manteniendo presionado debajo de ella. */
  swipeOrHold: string;
  /** Aviso bajo la caja del fondo (en el rasgado) para volver a ver todos los sobres. */
  seeAllPacks: string;
  tapToReveal: string;
  continue: string;
  collect: string;
  bestPull: string;
  newBadge: string;
  opening: string;
  openFailed: string;
  retry: string;
  close: string;
  announce: (position: number, total: number, name: string, tierLabel: string) => string;
}

export interface RedeemResult {
  cards: CardInput[];
  /** Sustituye a `pack.id` en el resultado, si el servidor lo asigna. */
  packId?: string;
}

export interface RedeemContext {
  /** 1 la primera vez; se incrementa en cada reintento. */
  attempt: number;
  /** Se aborta si la instancia se destruye mientras la petición sigue en curso. */
  signal: AbortSignal;
}

/**
 * Se llama una sola vez por intento, en el momento de abrir el sobre. Debe pedirle al servidor que
 * marque el sobre como abierto y devuelva las cartas. Si rechaza (reject/throw) se ofrece reintentar,
 * así que el servidor debería ser idempotente: repetir el mismo `code` devuelve las mismas cartas.
 */
export type RedeemFunction = (code: string, context: RedeemContext) => Promise<RedeemResult | CardInput[]>;

export interface PackOpenerOptions {
  mount: HTMLElement;
  /**
   * Código del sobre (un token de un solo uso emitido por el servidor). La librería nunca recibe
   * las cartas por adelantado: las obtiene llamando a `redeem(code)` en el momento de abrir.
   */
  code?: string;
  /**
   * Varios sobres a elegir: se muestran todos y la persona toca el que quiere abrir. Cada uno trae su
   * propio `code` (y opcionalmente su arte). Sustituye a `code`/`pack`.
   */
  packs?: PackChoice[];
  /**
   * three.js (`import * as THREE from 'three'` o `window.THREE`). Si se pasa junto con `packs`, la selección es
   * un carrusel 3D de sobres de foil en lugar del estante 2D. Si no hay WebGL se usa el estante.
   */
  three?: unknown;
  /** Caja de la que salen los sobres al entrar el carrusel 3D (ver `PackBoxDefinition`). */
  box?: PackBoxDefinition;
  redeem: RedeemFunction;
  pack?: PackDefinition;
  /** width / height de las cartas (def. 0.716, formato póker). Cualquier formato: 1 = cuadrada, 1.5 = vertical alta… */
  cardAspectRatio?: number;
  /** Dorso de las cartas (URL) cuando una carta no trae el suyo. */
  cardBack?: string;
  tiers?: TierSystem;
  flow?: FlowOptions;
  effects?: EffectsOptions;
  /** Elementos de interfaz opcionales (textos de ayuda, contador). */
  ui?: UiOptions;
  /** Tiempos de la experiencia (ver `TimingOptions`). */
  timing?: TimingOptions;
  audio?: AudioOptions;
  haptics?: HapticsOption;
  labels?: Partial<Labels>;
  /** Variables CSS --ao-* aplicadas al contenedor. */
  theme?: Record<string, string>;
  /** Botones del resumen. Def.: una acción 'collect'. */
  actions?: ActionDefinition[];
  /** Alternativa a escuchar eventos. */
  on?: { [K in keyof OpenerEvents]?: (payload: OpenerEvents[K]) => void };
}

export type Phase = 'idle' | 'select' | 'redeeming' | 'tear' | 'stack' | 'fan' | 'summary' | 'done';

export interface RevealedCard {
  card: CardInput;
  tier: number;
  /** ms desde el inicio; null si no se llegó a ver en la pila. */
  revealedAt: number | null;
  viewed: boolean;
}

export interface OpenResult {
  packId?: string;
  /** 'failed': el servidor no entregó las cartas y la persona cerró. */
  outcome: 'completed' | 'skipped' | 'aborted' | 'failed';
  cards: RevealedCard[];
  bestPull: { card: CardInput; tier: number } | null;
  actionId: string | null;
  durationMs: number;
  skipped: boolean;
  interactions: { tearAttempts: number; taps: number };
  error?: { code: 'REDEEM_FAILED'; message: string; cause?: unknown };
}

export interface OpenerWarning {
  code: 'UNKNOWN_RARITY' | 'TIER_OUT_OF_RANGE' | 'DUPLICATE_CARD_ID' | 'IMAGE_LOAD_FAILED';
  message: string;
  detail?: unknown;
}

export interface OpenerEvents {
  phase: { from: Phase; to: Phase };
  'tear:progress': { progress: number };
  'tear:complete': Record<string, never>;
  'card:reveal': { card: CardInput; index: number; tier: number; isLast: boolean };
  hit: { card: CardInput; tier: number };
  skip: { atIndex: number };
  action: { id: string; result: OpenResult };
  complete: OpenResult;
  error: { code: 'REDEEM_FAILED'; message: string; cause?: unknown };
  select: { packId: string; code: string };
  warning: OpenerWarning;
}
