/**
 * Números del carrusel 3D de sobres: geometría del anillo y de la cámara, tiempos de la entrada con caja, del guardado y del rasgado,
 * e intensidades de los brillos. Están juntos para ajustarlos en un solo lugar; unidades de la escena 3D salvo que el comentario diga otra cosa.
 */

export const RING_R = 2.5;
/** Radio mínimo por sobre del anillo: con más de ~26 sobres el anillo deja de ser el de `RING_R` y crece. */
export const RING_PER_PACK = 0.095;
export const CAM_D = 12;
export const CAM_FOV = 36;
/** Pantallas más angostas que esto (ancho / alto) usan la cámara de teléfono; a `MOBILE_FULL` o menos, del todo. */
export const MOBILE_FROM = 0.9;
export const MOBILE_FULL = 0.45;
/** Campo de visión vertical en teléfono: más ancho = más perspectiva. */
export const MOBILE_FOV = 64;
/** Qué fracción del ancho de la pantalla ocupa el sobre del frente (en escritorio y en teléfono). */
export const DESKTOP_FRONT_SHARE = 0.28;
export const MOBILE_FRONT_SHARE = 0.425;
/**
 * Con muchos sobres el anillo es grande y desde el nivel del suelo solo se ve la fila del frente (tapa a las demás). La cámara se sube y se
 * inclina hacia abajo: el anillo se ve como una elipse y se alcanzan a ver los sobres del fondo por encima de los del frente. Con pocos
 * sobres (hasta `TILT_FROM`) la vista sigue de frente; el máximo se alcanza con `TILT_FULL` o más.
 */
export const TILT_MAX = 0.34;
export const TILT_FROM = 6;
export const TILT_FULL = 36;
export const FRONT_PUSH = 1.8;
export const BASE_S = 0.86;
/** Separación (en anchos de sobre) del primero de cada lado, de los siguientes, cuánto se alejan y se achican, y su giro. */
export const SIDE_GAP = 1.3;
export const FAR_GAP = 0.75;
export const SIDE_DEPTH = 0.35;
export const SIDE_SHRINK = 0.45;
export const SIDE_TILT = 0.3;
/** Segundos con el sobre presionado, quieto, para que cuente como «mantener» y se elija; y segundos de presión que tarda en abrirse ya elegido. */
export const HOLD_ARM_S = 0.4;
export const HOLD_OPEN_S = 6;
export const HOLD_SLOP_PX = 12;
export const POP_S = 0.42;
export const FOG_NEAR = 11;
export const FOG_FAR = 30;
export const CHOOSE_S = 0.7;
export const INTRO_S = 1.3;

// Entrada con caja (segundos).
export const BOX_W = 3;
export const BOX_H = 2.06;
export const BOX_D = 1.9;
export const LID_H = 0.56;
export const BOX_DROP_FROM = 7;
export const BOX_DROP = 0.8;
export const BOX_LID_AT = 1.05;
export const BOX_LID_DUR = 0.5;
export const BOX_LID_ANGLE = 2.0;
export const BOX_FIRST_LAUNCH = 1.25;
export const BOX_STAGGER = 0.26;
/** Con muchos sobres la salida se acelera: toda la tanda tarda a lo más ~3 s en salir de la caja. */
export const BOX_LAUNCH_SPAN = 3;
export const BOX_FLIGHT = 1.05;
export const BOX_EXIT_DUR = 0.7;

// Al elegir un sobre (con caja): la caja cae otra vez al centro, los demás sobres se guardan en ella y el elegido sigue en su lugar.
export const STORE_DROP = 0.7;
export const STORE_LID = 0.4;
export const STORE_START = 0.95;
export const STORE_FLIGHT = 0.55;
export const STORE_STAGGER = 0.07;
export const STORE_SPAN = 0.8;
export const STORE_CLOSE = 0.3;
export const STORE_EXIT = 0.5;

// El sobre elegido solo se acerca un poco más a la cámara desde su lugar del frente (para rasgarlo ahí mismo).
export const HERO_COME = 1.2;
export const HERO_SCALE = 1.12;

// La caja al fondo, a un lado del sobre elegido, para volver a ver todos los sobres.
export const BACK_SCALE = 0.34;
export const BACK_SCALE_NARROW = 0.26;
export const RETURN_MOVE = 0.7;

// Rasgado sobre el propio sobre 3D.
export const TEAR_LIFT = 0.14;
/** Cuánto se echa hacia atrás la tira al rasgar (rad). */
export const TEAR_TILT_BACK = 0.3;
export const TEAR_OFF_DUR = 0.7;
/** Fracción del halo, el reflejo y el borde brillante que se conserva una vez rasgado el sobre. */
export const TORN_GLOW = 0.5;

// Al pasar el puntero: el sobre se levanta y se acerca a la cámara.
export const HOVER_Z = 0.8;
export const HOVER_Y = 0.14;
export const HOVER_SCALE = 0.1;
export const HOVER_SPEED = 9;

// Halo luminoso que bordea cada sobre (más fuerte en el del frente): sobresale `HALO_MARGIN` por cada lado y se difumina hacia afuera.
export const HALO_MARGIN = 0.15;
export const HALO_OPACITY = 0.9;

// Destello que recorre el borde de cada sobre (dos cometas que lo rodean sin parar).
export const STREAK_OPACITY = 1;
export const STREAK_Z = 0.03;

// Reflejo de cada sobre (más fuerte en el del frente), como si flotara sobre un espejo de agua: se desvanece hacia abajo.
export const REFLECT_GAP = 0.07;
export const REFLECT_OPACITY = 0.5;
/** Qué tan fuerte se ve en el reflejo el halo y el borde brillante del sobre, respecto del original. */
export const REFLECT_FX = 0.55;

/** Cuántos tramos (de izquierda a derecha) tiene el borde rasgado; el rasgado los va dejando ver de a uno. */
export const TEAR_EDGE_STEPS = 64;
