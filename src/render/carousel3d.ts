/**
 * Carrusel 3D de sobres. Los sobres (bolsas «almohada» con sellos planos arriba y abajo) se colocan en fila al estilo cover flow: el del centro
 * es grande y brilla; los de los lados, más chicos, de frente y girados un poco hacia el centro. Se mueven con inercia al arrastrar. Tocar uno
 * lateral lo trae al centro; tocar el del centro (o Enter) lo elige y sube hacia la cámara, listo para rasgarse. Mantener presionado el del
 * centro lo rasga ahí mismo.
 *
 * Cada sobre lleva halo, borde con cometas y reflejo en el «agua». Con `box` entra una caja que cae, se abre y lanza los sobres a su sitio; al
 * elegir uno, los demás vuelven a la caja, que queda al fondo para volver a ver todos.
 *
 * three.js NO es dependencia de la librería: el host pasa el espacio de nombres (`three`) en las opciones y, si no hay WebGL, el render cae al
 * estante 2D. Los números de la escena están en `carousel3d-config.ts`.
 *
 * Adaptado de OpenPack (Luango, `src/select3d.js`: geometría del sobre, iluminación, entorno, inercia y lanzamiento) con permiso del autor.
 * Ver NOTICE.md. La caja, los reflejos, el borde luminoso, el rasgado sobre el sobre 3D y mantener presionado son de esta librería.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  RING_R, RING_PER_PACK, CAM_D, CAM_FOV, MOBILE_FROM, MOBILE_FULL,
  MOBILE_FOV, DESKTOP_FRONT_SHARE, MOBILE_FRONT_SHARE, TILT_MAX, TILT_FROM, TILT_FULL,
  FRONT_PUSH, BASE_S, SIDE_GAP, FAR_GAP, SIDE_DEPTH, SIDE_SHRINK,
  SIDE_TILT, HOLD_ARM_S, HOLD_OPEN_S, HOLD_SLOP_PX, POP_S, FOG_NEAR,
  FOG_FAR, CHOOSE_S, INTRO_S, BOX_W, BOX_H, BOX_D,
  LID_H, BOX_DROP_FROM, BOX_DROP, BOX_LID_AT, BOX_LID_DUR, BOX_LID_ANGLE,
  BOX_FIRST_LAUNCH, BOX_STAGGER, BOX_LAUNCH_SPAN, BOX_FLIGHT, BOX_EXIT_DUR, STORE_DROP,
  STORE_LID, STORE_START, STORE_FLIGHT, STORE_STAGGER, STORE_SPAN, STORE_CLOSE,
  STORE_EXIT, HERO_COME, HERO_SCALE, BACK_SCALE, BACK_SCALE_NARROW, RETURN_MOVE,
  TEAR_LIFT, TEAR_TILT_BACK, TEAR_OFF_DUR, TORN_GLOW, HOVER_Z, HOVER_Y,
  HOVER_SCALE, HOVER_SPEED, HALO_MARGIN, HALO_OPACITY, STREAK_OPACITY, STREAK_Z,
  REFLECT_GAP, REFLECT_OPACITY, REFLECT_FX, TEAR_EDGE_STEPS,
} from './carousel3d-config';
import {
  easeInOut, clamp01, easeOut, easeIn, easeOutBack,
} from './easing';
import type { ThreeNamespace } from './carousel3d-parts';
import {
  loadArt, tornEdgeGeometry, packGeometry, environment, glowTexture, outlineGlowTexture,
  STREAK_VERTEX, STREAK_FRAGMENT, reflectionMask,
} from './carousel3d-parts';

export type { ThreeNamespace } from './carousel3d-parts';

export interface Carousel3DItem {
  id: string;
  art: string;
  accent?: string;
  /** Segundo color (cometas del borde); si falta se usa `accent`. */
  accent2?: string;
}

export interface Carousel3DOptions {
  items: Carousel3DItem[];
  /** width / height de los sobres. */
  ratio: number;
  reduced: boolean;
  /** Teléfono / perfil bajo: menos resolución, sin partículas. */
  low: boolean;
  /** El sobre del frente cambió (también se llama una vez al inicio). */
  onFocus(index: number): void;
  /** El sobre elegido terminó su lanzamiento: el host sigue con el rasgado. */
  onChosen(index: number): void;
  /** Se empezó a elegir (para sonido / háptica). */
  onChoose?(index: number): void;
  /** Caja de la que salen los sobres al entrar (sin ella, o con movimiento reducido, entran escalando en su sitio). */
  box?: { front: string; lid?: string; side?: string; accent?: string } | null;
  /** Momentos de la entrada con caja, para sonido y háptica: la caja toca el piso, se abre la tapa y sale un sobre. */
  onIntroEvent?(event: 'land' | 'open' | 'launch'): void;
  /** La entrada terminó: ya se puede elegir. */
  onIntroEnd?(): void;
  /** Se pidió volver a ver todos los sobres (clic en la caja del fondo): el host regresa a la selección y llama `resume()`. */
  onReturned?(): void;
  /** Milisegundos de presión sostenida para abrir el sobre. Def. 6000. */
  holdOpenMs?: number;
  /** Milisegundos con el sobre presionado y quieto para que cuente como «mantener». Def. 400. */
  holdArmMs?: number;
  /** Multiplicador de duración del rasgado (la tira que vuela y el brillo que baja). Def. 1. */
  pace?: number;
  /** En qué puntos del sobre cuenta mantener presionado para abrir (el resto, p. ej. la zona de corte, no). Sin esto, en todo el sobre. */
  canHold?(clientX: number, clientY: number, pointerType: string): boolean;
  /** Se mantuvo presionado el sobre del frente el tiempo suficiente: se elige y, ya rasgable, se va abriendo mientras siga presionado. */
  onHoldStart?(): void;
  /** Avance (0..1) de la apertura por presión sostenida. */
  onHoldProgress?(progress: number): void;
  /** La presión sostenida llegó al final: hay que abrir el sobre. */
  onHoldComplete?(): void;
  /** Se soltó (o se movió el puntero) antes de terminar: el rasgado vuelve a cero. */
  onHoldCancel?(): void;
}

/** Los avisos que el host puede cambiar con `setHandlers` (al volver a la selección tiene una interfaz nueva). */
export type Carousel3DHandlers = Partial<Pick<Carousel3DOptions, 'onFocus' | 'onChosen' | 'onChoose' | 'onIntroEvent' | 'onIntroEnd' | 'onReturned' | 'onHoldStart' | 'onHoldProgress' | 'onHoldComplete' | 'onHoldCancel' | 'canHold'>>;

/** Rectángulo en pantalla (coordenadas del cliente) que ocupa el sobre elegido. */
export interface Carousel3DRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Carousel3D {
  focused(): number;
  /** Trae el sobre `index` al frente. */
  focus(index: number): void;
  choose(): void;
  /**
   * Prepara el rasgado sobre el propio sobre elegido: lo parte en dos mallas (la tira de arriba, que ocupa `stripRatio` del alto, y el cuerpo)
   * que conservan su material, su halo y su brillo. Solo vale cuando el carrusel ya entregó la elección (`onChosen`).
   */
  prepareTear(stripRatio: number): void;
  /** Dónde está el sobre elegido en pantalla (para medir el trazo del rasgado). */
  heroRect(): Carousel3DRect;
  /** Dónde está en pantalla el sobre que está al frente en la selección. */
  frontRect(): Carousel3DRect;
  /** Pone el avance del rasgado (0..1) y desde qué lado empezó (1 = de izquierda a derecha): la tira se levanta y se despega. */
  tearTo(progress: number, dir: 1 | -1): void;
  /** Termina de rasgar: la tira sale volando y el cuerpo se desvanece con un destello. */
  tearOff(dir: 1 | -1): void;
  /** Centro (en pantalla) del borde rasgado del sobre que queda, ya hundido: la boca de donde salen las cartas. Null si no hay sobre rasgado. */
  mouthPoint(): { x: number; y: number; width: number } | null;
  /** Dónde está en pantalla la caja del fondo mientras se puede hacer clic en ella para volver a los sobres; null si no. */
  backBoxRect(): Carousel3DRect | null;
  /**
   * Empieza a rasgar en su sitio el sobre del frente de la selección (sin elegirlo ni cambiar de vista): los demás se van desvaneciendo
   * mientras dure la presión sostenida, y si se suelta antes de tiempo todo vuelve a su lugar. Se llama desde `onHoldStart`.
   */
  beginHoldTear(stripRatio: number): void;
  /** Hay una apertura por presión sostenida en curso (el trazo libre no debe pisar el avance). */
  holdActive(): boolean;
  /** Hay caja (y por tanto se puede volver a ver todos los sobres desde el rasgado). */
  canReturn(): boolean;
  /** Pide volver a ver todos los sobres (avisa con `onReturned`; no anima nada por sí mismo). */
  returnToPacks(): void;
  /** Cambia los avisos del carrusel (el host reconstruye su interfaz al volver a la selección). */
  setHandlers(handlers: Carousel3DHandlers): void;
  /**
   * Vuelve a la selección en este mismo carrusel: el sobre elegido (sin rasgar) retrocede a su lugar del anillo y la caja, que se acerca al
   * centro y se abre, saca los sobres que faltan.
   */
  resume(): void;
  dispose(): void;
}


export function createCarousel3D(THREE: ThreeNamespace, mount: HTMLElement, options: Carousel3DOptions): Carousel3D | null {
  const { items } = options;
  const N = items.length;
  // Con muchos sobres el radio crece (para que no se encimen) y la cámara se aleja lo mismo: el del frente se ve siempre igual de grande.
  const ringR = Math.max(RING_R, N * RING_PER_PACK);
  const camD = CAM_D + (ringR - RING_R);
  const fogShift = camD - CAM_D;
  if (N === 0) {
    return null;
  }
  let renderer: any;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !options.low, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas: HTMLCanvasElement = renderer.domElement;
  canvas.className = 'ao-carousel__canvas';
  mount.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x282b4d, FOG_NEAR + fogShift, FOG_FAR + fogShift * 2);
  const camera = new THREE.PerspectiveCamera(CAM_FOV, 1, 0.1, 100);
  camera.position.set(0, 0, camD);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 2.05));
  scene.add(new THREE.HemisphereLight(0xe4e9ff, 0x46406a, 3.4));
  const key = new THREE.DirectionalLight(0xfff1da, 1.55);
  key.position.set(-4, 5, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbcd2ff, 1.15);
  rim.position.set(0, 5, -10);
  scene.add(rim);
  const spot = new THREE.SpotLight(0xfff0d6, 70, 14, 0.66, 0.65, 1.15);
  spot.position.set(0.5, 2.6, camD - 3.5);
  spot.target.position.set(0, 0, ringR + FRONT_PUSH);
  scene.add(spot, spot.target);
  /** Reflejo del sobre: una luz chica que barre despacio el frente, así el brillo cambia según se mueve el sobre (y no queda una mancha fija). */
  const sheen = new THREE.PointLight(0xfff4e0, 5, 3.2, 2);
  sheen.position.set(0, 0.4, ringR + FRONT_PUSH + 1.1);
  scene.add(sheen);
  const env = environment(THREE);
  scene.environment = env;

  let dust: any = null;
  let dustSpeed: Float32Array | null = null;
  if (!options.low) {
    const count = 200;
    const positions = new Float32Array(count * 3);
    dustSpeed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 22 - 11;
      positions[i * 3 + 1] = ((Math.sin(i * 78.233) * 43758.5453) % 1) * 14 - 6;
      positions[i * 3 + 2] = ((Math.sin(i * 37.719) * 43758.5453) % 1) * 16 - 12;
      dustSpeed[i] = 0.2 + (Math.sin(i * 4.1) * 0.5 + 0.5) * 0.5;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    dust = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0xc9b8ff,
        size: 0.06,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    scene.add(dust);
  }

  const aspect = 1 / options.ratio;
  const geometry = packGeometry(THREE, aspect);
  const group = new THREE.Group();
  scene.add(group);
  const textures = new Map<string, any>();
  const loads = new Map<string, Promise<any>>();
  const materials: any[] = [];
  const meshes: any[] = [];
  const maxAnisotropy = renderer.capabilities?.getMaxAnisotropy?.() ?? 1;

  const boxMode = !!options.box && !options.reduced;
  const stagger = Math.min(BOX_STAGGER, BOX_LAUNCH_SPAN / N);
  const launchAt = (i: number): number => BOX_FIRST_LAUNCH + i * stagger;
  const exitAt = launchAt(N - 1) + 0.35;
  const introTotal = boxMode ? Math.max(launchAt(N - 1) + BOX_FLIGHT, exitAt + BOX_EXIT_DUR) + 0.15 : INTRO_S;
  const BOX_BASE_Y = -0.3;
  const boxMaterials: any[] = [];
  const boxTextures: any[] = [];
  const boxGeometries: any[] = [];
  let boxGroup: any = null;
  let boxBody: any = null;
  let boxLid: any = null;
  let lidPivot: any = null;
  let boxLight: any = null;
  let glowBloom: any = null;
  let glowShaft: any = null;
  let glowTex: any = null;
  const firedEvents = new Set<string>();

  if (boxMode && options.box) {
    const spec = options.box;
    const accentColor = new THREE.Color(spec.accent ?? '#8b7bff');
    const solid = (color: number): any => {
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.3, envMapIntensity: 1 });
      boxMaterials.push(material);
      return material;
    };
    const painted = (src: string | undefined, ratio: number): any => {
      const material = new THREE.MeshStandardMaterial({ color: 0x3a3170, roughness: 0.5, metalness: 0.35, envMapIntensity: 1.1, emissive: new THREE.Color(0x201a55), emissiveIntensity: 0.5 });
      boxMaterials.push(material);
      if (src) {
        void loadArt(THREE, src, ratio, maxAnisotropy, 1024)
          .then((texture) => {
            boxTextures.push(texture);
            material.map = texture;
            material.emissiveMap = texture;
            material.color.set(0xffffff);
            material.emissive.set(0xffffff);
            material.emissiveIntensity = 0.32;
            material.needsUpdate = true;
          })
          .catch(() => {});
      }
      return material;
    };
    const frontMat = painted(spec.front, 640 / 440);
    const sideMat = painted(spec.side, 1);
    const lidFrontMat = painted(spec.lid, 640 / 120);
    const lidTopMat = solid(0x2a2260);
    const inner = solid(0x0b0a1f);
    const floorMat = solid(0x0f1026);
    boxGroup = new THREE.Group();
    const bodyGeometry = new THREE.BoxGeometry(BOX_W, BOX_H, BOX_D);
    const lidGeometry = new THREE.BoxGeometry(BOX_W + 0.08, LID_H, BOX_D + 0.08);
    boxGeometries.push(bodyGeometry, lidGeometry);
    // Orden de caras de BoxGeometry: +x, -x, +y, -y, +z, -z.
    boxBody = new THREE.Mesh(bodyGeometry, [sideMat, sideMat, inner, floorMat, frontMat, sideMat]);
    boxGroup.add(boxBody);
    lidPivot = new THREE.Group();
    lidPivot.position.set(0, BOX_H / 2, -BOX_D / 2 - 0.04);
    const lid = new THREE.Mesh(lidGeometry, [sideMat, sideMat, lidTopMat, inner, lidFrontMat, sideMat]);
    boxLid = lid;
    lid.position.set(0, LID_H / 2, (BOX_D + 0.08) / 2);
    lidPivot.add(lid);
    boxGroup.add(lidPivot);

    glowTex = glowTexture(THREE);
    const makeGlow = (sx: number, sy: number): any => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: accentColor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      sprite.scale.set(sx, sy, 1);
      sprite.position.set(0, BOX_H / 2 + 0.2, 0.2);
      sprite.renderOrder = 900;
      boxGroup.add(sprite);
      return sprite;
    };
    glowBloom = makeGlow(5.5, 5.5);
    glowShaft = makeGlow(1.8, 9);
    boxLight = new THREE.PointLight(accentColor, 0, 10, 1.4);
    boxLight.position.set(0, BOX_H / 2 + 0.5, 0.9);
    boxGroup.add(boxLight);
    boxGroup.position.set(0, BOX_BASE_Y + BOX_DROP_FROM, 0);
    scene.add(boxGroup);
  }

  const fire = (key: string, event: 'land' | 'open' | 'launch'): void => {
    if (!firedEvents.has(key)) {
      firedEvents.add(key);
      options.onIntroEvent?.(event);
    }
  };

  /** Coreografía de la caja: cae, rebota, abre la tapa con un destello, y al terminar de salir los sobres se hunde y se desvanece. */
  const stepBox = (): void => {
    if (!boxGroup) {
      return;
    }
    const dropT = clamp01(introT / BOX_DROP);
    const sinceLand = Math.max(0, introT - BOX_DROP);
    let y = BOX_BASE_Y;
    if (dropT < 1) {
      y += BOX_DROP_FROM * (1 - dropT * dropT);
    } else if (sinceLand < 0.28) {
      y += Math.sin((sinceLand / 0.28) * Math.PI) * 0.16 * (1 - sinceLand / 0.28);
    }
    boxGroup.rotation.z = dropT < 1 ? (1 - dropT) * 0.25 : Math.sin(sinceLand * 18) * 0.03 * Math.exp(-sinceLand * 6);
    const open = clamp01((introT - BOX_LID_AT) / BOX_LID_DUR);
    lidPivot.rotation.x = -BOX_LID_ANGLE * easeOutBack(open);
    const exitT = clamp01((introT - exitAt) / BOX_EXIT_DUR);
    y -= easeIn(exitT) * 6;
    if (replay) {
      // Al volver a ver todos los sobres, la caja del fondo viaja al centro y crece, en vez de caer desde arriba.
      const m = easeInOut(clamp01((introT - replayT0) / RETURN_MOVE));
      boxGroup.position.set(replayFrom.x * (1 - m), replayFrom.y + (y - replayFrom.y) * m, replayFrom.z * (1 - m));
      boxGroup.scale.setScalar((replayFrom.s + (1 - replayFrom.s) * m) * (1 - exitT * 0.25));
      boxGroup.rotation.y = replayFrom.ry * (1 - m);
      boxGroup.rotation.z = 0;
    } else {
      boxGroup.position.set(0, y, 0);
      boxGroup.scale.setScalar(1 - exitT * 0.25);
    }
    const alpha = 1 - exitT;
    boxMaterials.forEach((material) => {
      material.transparent = alpha < 1;
      material.opacity = alpha;
    });
    const sinceOpen = Math.max(0, introT - BOX_LID_AT);
    const burst = open > 0 ? 0.35 + 0.65 * Math.exp(-sinceOpen * 1.6) : 0;
    glowBloom.material.transparent = true;
    glowShaft.material.transparent = true;
    glowBloom.material.opacity = 0.85 * open * burst * alpha;
    glowShaft.material.opacity = 0.6 * open * burst * alpha;
    glowShaft.scale.set(1.8, 3 + 6 * easeOut(open), 1);
    boxLight.intensity = 70 * open * burst * alpha;
    boxGroup.visible = exitT < 1;
    if (introT >= BOX_DROP) {
      fire('land', 'land');
    }
    if (introT >= BOX_LID_AT) {
      fire('open', 'open');
    }
    for (let i = 0; i < N; i++) {
      if (introT >= launchAt(i)) {
        fire(`launch${i}`, 'launch');
      }
    }
  };

  const makeMaterial = (map: any | null, accent?: string): any => {
    const material = new THREE.MeshStandardMaterial({
      map,
      roughness: 0.42,
      metalness: 0.45,
      envMapIntensity: 1.2,
      emissive: new THREE.Color(accent ?? '#ffffff'),
      emissiveMap: map,
      emissiveIntensity: 0.5,
      side: THREE.DoubleSide,
      alphaTest: 0.5,
    });
    materials.push(material);
    return material;
  };

  // Halo del sobre del frente: una luz del color del sobre detrás de él que respira suave.
  const haloTexture = outlineGlowTexture(THREE, 1, aspect, HALO_MARGIN);
  const haloGeometry = new THREE.PlaneGeometry(1 + HALO_MARGIN * 2, aspect + HALO_MARGIN * 2);
  const mirrorGeometry = new THREE.PlaneGeometry(1, aspect);
  const mirrorMask = reflectionMask(THREE);
  items.forEach((item, i) => {
    const pair = [makeMaterial(null, item.accent), makeMaterial(null, item.accent)];
    const mesh = new THREE.Mesh(geometry, pair);
    // Un plano (no un sprite): gira con el sobre, así que de canto casi no se ve, igual que el sobre.
    const halo = new THREE.Mesh(
      haloGeometry,
      new THREE.MeshBasicMaterial({ map: haloTexture, color: new THREE.Color(item.accent ?? '#8b7bff'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    halo.position.set(0, 0, -0.06);
    mesh.add(halo);
    const streakMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(item.accent2 ?? item.accent ?? '#8b7bff') },
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uHalf: { value: new THREE.Vector2(0.5, aspect / 2) },
        uMargin: { value: HALO_MARGIN },
        uReflect: { value: 0 },
      },
      vertexShader: STREAK_VERTEX,
      fragmentShader: STREAK_FRAGMENT,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    // Un plano por cada cara del sobre, para que el borde brille también visto por atrás.
    const streakFront = new THREE.Mesh(haloGeometry, streakMaterial);
    streakFront.position.set(0, 0, STREAK_Z);
    const streakBack = new THREE.Mesh(haloGeometry, streakMaterial);
    streakBack.position.set(0, 0, -STREAK_Z);
    streakFront.visible = false;
    streakBack.visible = false;
    mesh.add(streakFront, streakBack);
    const mirror = new THREE.Mesh(
      mirrorGeometry,
      new THREE.MeshBasicMaterial({ color: 0xc8c8d8, alphaMap: mirrorMask, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    mirror.scale.y = -1;
    mirror.position.set(0, -(aspect + REFLECT_GAP), 0);
    mirror.visible = false;
    mesh.add(mirror);
    // El halo y el borde brillante también se reflejan, igual que el sobre: invertidos y desvaneciéndose hacia abajo.
    const mirrorY = -(aspect + REFLECT_GAP);
    const mirrorHalo = new THREE.Mesh(
      haloGeometry,
      new THREE.MeshBasicMaterial({ map: haloTexture, alphaMap: mirrorMask, color: new THREE.Color(item.accent ?? '#8b7bff'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    mirrorHalo.scale.y = -1;
    mirrorHalo.position.set(0, mirrorY, -0.06);
    mirrorHalo.visible = false;
    const mirrorStreakMaterial = streakMaterial.clone();
    mirrorStreakMaterial.uniforms.uReflect.value = 1;
    const mirrorStreak = new THREE.Mesh(haloGeometry, mirrorStreakMaterial);
    mirrorStreak.scale.y = -1;
    mirrorStreak.position.set(0, mirrorY, STREAK_Z);
    mirrorStreak.visible = false;
    mesh.add(mirrorHalo, mirrorStreak);
    mesh.userData = {
      index: i,
      materials: pair,
      halo,
      mirror,
      streak: streakMaterial,
      streakMeshes: [streakFront, streakBack],
      mirrorHalo,
      mirrorStreak,
    };
    mesh.visible = false;
    group.add(mesh);
    meshes.push(mesh);
    let ready = loads.get(item.art);
    if (!ready) {
      ready = loadArt(THREE, item.art, options.ratio, maxAnisotropy, 512, 'cover');
      loads.set(item.art, ready);
    }
    void ready
      .then((texture) => {
        textures.set(item.art, texture);
        pair.forEach((material) => {
          material.map = texture;
          material.emissiveMap = texture;
          material.needsUpdate = true;
        });
        mirror.material.map = texture;
        mirror.material.needsUpdate = true;
        mesh.visible = true;
      })
      .catch(() => {
        mesh.visible = true;
      });
  });

  const STEP = (Math.PI * 2) / N;
  const holdOpenS = (options.holdOpenMs ?? HOLD_OPEN_S * 1000) / 1000;
  const holdArmS = (options.holdArmMs ?? HOLD_ARM_S * 1000) / 1000;
  const pace = options.pace ?? 1;
  const tearOffDur = TEAR_OFF_DUR * pace;
  let pos = 0;
  let vel = 0;
  let dragging = false;
  let targetPos: number | null = null;
  let lastIndex = -1;
  let time = 0;
  let introT = options.reduced ? introTotal : 0;
  let introEnded = options.reduced === true;
  let choosing = false;
  let chooseT = 0;
  let hero: any = null;
  /** El sobre del frente se está rasgando en su sitio, dentro de la selección (apertura por presión sostenida). */
  let inPlace = false;
  let othersDim = 1;
  let chooseTotal = CHOOSE_S;
  let held = false;
  let baseView = { fov: CAM_FOV, z: camD, y: 0, lookZ: 0 };
  let camTilt = 1;
  let camTiltTarget = 1;
  let camTiltApplied = -1;
  let backT = 0;
  let backHover = 0;
  let backHoverTarget = 0;
  let canReturnNow = false;
  let returnRequested = false;
  let replay = false;
  let replayT0 = 0;
  let replayHero = -1;
  let replayRestPos = 0;
  let replayFrom = { x: 0, y: 0, z: 0, s: 1, ry: 0 };
  let tearGroup: any = null;
  let stripPivot: any = null;
  let stripMesh: any = null;
  let bodyMesh: any = null;
  let seamGlow: any = null;
  let tearSeamY = 0;
  let tearTarget = 0;
  let tearShown = 0;
  /** Inclinación del sobre elegido siguiendo al puntero, y posición del puntero (de -1 a 1). */
  let heldTiltX = 0;
  let heldTiltY = 0;
  let pointerX = 0;
  let pointerY = 0;
  let tearDir: 1 | -1 = 1;
  let tearOffT = -1;
  const tearGeometries: any[] = [];
  const tearMaterials: any[] = [];
  /** Materiales de la tira: es lo único que se desvanece al rasgar; el cuerpo queda a la vista detrás de las cartas. */
  const stripMaterials: any[] = [];
  const tearEdges: any[] = [];
  /** Halo y cometas del sobre con su altura original, para recortarlos a la parte que queda tras el corte. */
  let effectBase: { object: any; y: number; scaleY: number }[] = [];
  let stripBase: Float32Array | null = null;
  let stripEdgeBase: Float32Array | null = null;
  let heroAt = 0;
  let heroLeaving = false;
  let storeCloseAt = 0;
  let storeExitAt = 0;
  let storeFrom: { x: number; y: number; z: number; s: number; ry: number }[] = [];
  let storeRank: number[] = [];
  let storeStagger = STORE_STAGGER;
  let raf: number | null = null;
  let last = 0;
  let disposed = false;
  const modIndex = (): number => ((Math.round(pos) % N) + N) % N;
  const hovers: number[] = new Array(N).fill(0);
  let hoverIndex = -1;

  const setOpacity = (mesh: any, opacity: number): void => {
    (mesh.userData.materials as any[]).forEach((material) => {
      material.transparent = opacity < 1;
      material.opacity = opacity;
    });
  };

  const setGlow = (mesh: any, front: number, flash = 0): void => {
    const f = Math.pow(front, 1.5);
    (mesh.userData.materials as any[]).forEach((material) => {
      material.emissiveIntensity = 0.18 + (0.82 - 0.18) * f + flash;
      material.envMapIntensity = 0.95 + (2.1 - 0.95) * f;
    });
  };

  const layout = (only: any = null): void => {
    const intro = boxMode ? 1 : easeOut(clamp01(introT / introTotal));
    const launching = boxMode && introT < introTotal;
    for (let i = 0; i < N; i++) {
      const mesh = meshes[i];
      if ((only && mesh !== only) || (heroLeaving && mesh === hero) || (inPlace && mesh === hero)) {
        continue;
      }
      const flying = launching && i !== replayHero;
      let a = (i - pos) * STEP;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      const front = Math.max(0, Math.cos(a));
      // Disposición tipo «cover flow»: el sobre al frente grande y los de los lados más chicos, de frente y girados un poco hacia el centro.
      const off = a / STEP;
      const along = Math.abs(off);
      const side = Math.sign(off);
      const edge = Math.min(N / 2, 3);
      const fade = (N >= 3 ? clamp01((edge - along) / 0.5) : 1) * (inPlace ? othersDim : 1);
      const tilt = -SIDE_TILT * Math.tanh(off * 2);
      mesh.position.x = side * (along <= 1 ? along * SIDE_GAP : SIDE_GAP + (along - 1) * FAR_GAP);
      mesh.position.z = ringR + FRONT_PUSH - along * SIDE_DEPTH;
      mesh.position.y = options.reduced ? 0 : Math.sin(time * 1.3 + i * 1.1) * 0.05 * (0.6 + 0.4 * front);
      mesh.rotation.y = tilt;
      mesh.rotation.z = 0;
      const base = ((BASE_S + POP_S) / (1 + SIDE_SHRINK * along)) * (fade > 0.01 ? 1 : 0.0001);
      const lift = hovers[i]!;
      if (lift > 0.001) {
        // Se levanta, se acerca a la cámara, se agranda un poco y se endereza hacia el frente.
        mesh.position.z += HOVER_Z * lift;
        mesh.position.y += HOVER_Y * lift;
        mesh.rotation.y = tilt * (1 - 0.6 * lift);
      }
      mesh.scale.setScalar(base * (0.55 + 0.45 * intro) * (1 + HOVER_SCALE * lift));
      if (i === replayHero) {
        // El sobre que se había elegido retrocede (se aleja de la cámara) hasta su lugar del anillo.
        const retreat = 1 - easeInOut(clamp01((introT - replayT0) / RETURN_MOVE));
        if (retreat > 0.001) {
          mesh.position.z += heroCome() * retreat;
          mesh.scale.multiplyScalar(1 + (heroScale() - 1) * retreat);
        }
      }
      mesh.renderOrder = Math.round(mesh.position.z * 10);
      setGlow(mesh, Math.max(front, lift * 0.75), lift * 0.18);
      // Halo y reflejo en todos los sobres, según su posición en el anillo: el del frente brilla al máximo, los de los lados menos y los de atrás apenas.
      const emphasis = 0.4 + 0.6 * front * front;
      const visibility = 0.25 + 0.75 * ((1 + Math.cos(a)) / 2);
      const level = emphasis * visibility * fade * (mesh.userData.materials[0].opacity ?? 1);
      const halo = mesh.userData.halo;
      if (halo) {
        const breathe = options.reduced ? 1 : 0.8 + 0.2 * Math.sin(time * 2.2 + i);
        halo.material.opacity = flying ? 0 : level * breathe * HALO_OPACITY * (1 + 0.35 * lift);
      }
      const streak = mesh.userData.streak;
      const streakLevel = flying ? 0 : level * STREAK_OPACITY * (1 + 0.5 * lift);
      streak.uniforms.uOpacity.value = streakLevel;
      streak.uniforms.uTime.value = options.reduced ? 0.3 + i * 0.37 : time + i * 0.37;
      mesh.userData.streakMeshes.forEach((plane: any) => {
        plane.visible = streakLevel > 0.01;
      });
      const reflection = mesh.userData.mirror;
      reflection.material.opacity = flying ? 0 : level * REFLECT_OPACITY * (1 + 0.25 * lift);
      reflection.visible = reflection.material.opacity > 0.01;
      const mirrorHalo = mesh.userData.mirrorHalo;
      const mirrorStreak = mesh.userData.mirrorStreak;
      mirrorHalo.material.opacity = (halo ? halo.material.opacity : 0) * REFLECT_FX;
      mirrorStreak.material.uniforms.uOpacity.value = streakLevel * REFLECT_FX;
      mirrorStreak.material.uniforms.uTime.value = streak.uniforms.uTime.value;
      mirrorHalo.visible = reflection.visible;
      mirrorStreak.visible = reflection.visible;
      if (!choosing) {
        setOpacity(mesh, (intro < 1 ? intro : 1) * fade);
      }
      if (flying) {
        // Sale volando de la caja: sube por la boca y describe un arco hasta su lugar del anillo.
        const p = clamp01((introT - launchAt(i)) / BOX_FLIGHT);
        if (p <= 0) {
          mesh.scale.setScalar(0.0001);
          continue;
        }
        const e = easeOut(p);
        const k = 1 - e;
        const sx = mesh.position.x;
        const sy = mesh.position.y;
        const sz = mesh.position.z;
        mesh.position.x = 2 * k * e * (sx * 0.45) + e * e * sx;
        mesh.position.y = k * k * BOX_BASE_Y + 2 * k * e * 3.6 + e * e * sy;
        mesh.position.z = 2 * k * e * (sz * 0.4 + 0.8) + e * e * sz;
        mesh.rotation.y = tilt * e;
        mesh.rotation.z = Math.sin(e * Math.PI) * 0.4 * (i % 2 === 0 ? 1 : -1);
        mesh.scale.setScalar(base * (0.42 + 0.58 * e));
        setGlow(mesh, front, (1 - p) * 0.7);
        setOpacity(mesh, 1);
      }
    }
  };

  /** La caja cae al centro como en la entrada, abre la tapa para recibir a los demás sobres, la cierra y se va. */
  const stepStoreBox = (): void => {
    const dropT = clamp01(chooseT / STORE_DROP);
    const sinceLand = Math.max(0, chooseT - STORE_DROP);
    let y = BOX_BASE_Y;
    if (dropT < 1) {
      y += BOX_DROP_FROM * (1 - dropT * dropT);
    } else if (sinceLand < 0.28) {
      y += Math.sin((sinceLand / 0.28) * Math.PI) * 0.16 * (1 - sinceLand / 0.28);
    }
    boxGroup.rotation.z = dropT < 1 ? (1 - dropT) * 0.25 : Math.sin(sinceLand * 18) * 0.03 * Math.exp(-sinceLand * 6);
    const open = clamp01(sinceLand / STORE_LID);
    const closing = easeIn(clamp01((chooseT - storeCloseAt) / STORE_CLOSE));
    lidPivot.rotation.x = -BOX_LID_ANGLE * easeOutBack(open) * (1 - closing);
    const exitT = clamp01((chooseT - storeExitAt) / STORE_EXIT);
    y -= easeIn(exitT) * 6;
    boxGroup.position.set(0, y, 0);
    boxGroup.scale.setScalar(1 - exitT * 0.25);
    boxGroup.visible = exitT < 1;
    const alpha = 1 - exitT;
    boxMaterials.forEach((material) => {
      material.transparent = alpha < 1;
      material.opacity = alpha;
    });
    const glow = open * (1 - closing) * alpha;
    glowBloom.material.opacity = 0.5 * glow;
    glowShaft.material.opacity = 0.3 * glow;
    boxLight.intensity = 40 * glow;
    if (chooseT >= STORE_DROP) {
      fire('store-land', 'land');
    }
    if (chooseT >= STORE_DROP + 0.05) {
      fire('store-open', 'open');
    }
  };

  /** Un sobre que no se eligió vuela a la boca de la caja, encogiéndose, y desaparece dentro. */
  const storePack = (mesh: any, i: number): void => {
    const from = storeFrom[i]!;
    const startAt = STORE_START + storeRank[i]! * storeStagger;
    const p = clamp01((chooseT - startAt) / STORE_FLIGHT);
    setOpacity(mesh, 1);
    if (p <= 0) {
      return;
    }
    fire(`store${i}`, 'launch');
    if (p >= 1) {
      mesh.scale.setScalar(0.0001);
      return;
    }
    const e = p * p * (3 - 2 * p);
    const k = 1 - e;
    mesh.position.x = k * k * from.x + 2 * k * e * (from.x * 0.45);
    mesh.position.y = k * k * from.y + 2 * k * e * 3.6 + e * e * (BOX_BASE_Y - 0.1);
    mesh.position.z = k * k * from.z + 2 * k * e * (from.z * 0.4 + 0.8);
    mesh.rotation.y = from.ry * k;
    mesh.rotation.z = Math.sin(e * Math.PI) * 0.4 * (i % 2 === 0 ? 1 : -1);
    mesh.scale.setScalar(from.s * (1 - 0.58 * e));
    mesh.renderOrder = 0;
  };

  const stepChoose = (dt: number): void => {
    chooseT += dt;
    const e = easeOut(clamp01((chooseT - heroAt) / CHOOSE_S));
    if (chooseT >= heroAt) {
      heroLeaving = true;
      const target = { x: 0, y: 0, z: ringR + FRONT_PUSH + heroCome(), s: (BASE_S + POP_S) * heroScale() };
      hero.position.x += (target.x - hero.position.x) * Math.min(1, dt * 8);
      hero.position.y += (target.y - hero.position.y) * Math.min(1, dt * 8);
      hero.position.z += (target.z - hero.position.z) * Math.min(1, dt * 7);
      hero.rotation.y = Math.atan2(Math.sin(hero.rotation.y), Math.cos(hero.rotation.y)) * (1 - Math.min(1, dt * 8));
      hero.scale.setScalar(hero.scale.x + (target.s - hero.scale.x) * Math.min(1, dt * 7));
      hero.renderOrder = 1000;
      setGlow(hero, 1, e * 0.9);
      hero.userData.halo.material.opacity = Math.min(1, HALO_OPACITY + e * 0.3);
    }
    meshes.forEach((mesh, i) => {
      if (mesh === hero) {
        return;
      }
      mesh.userData.halo.material.opacity = 0;
      mesh.userData.mirror.visible = false;
      mesh.userData.mirrorHalo.visible = false;
      mesh.userData.mirrorStreak.visible = false;
      mesh.userData.streakMeshes.forEach((plane: any) => {
        plane.visible = false;
      });
      if (boxGroup) {
        storePack(mesh, i);
      } else {
        setOpacity(mesh, Math.max(0, 1 - e * 1.4));
        mesh.position.z -= dt * 3;
      }
    });
    if (boxGroup) {
      stepStoreBox();
    }
    if (chooseT >= chooseTotal) {
      const index = hero.userData.index as number;
      choosing = false;
      held = true;
      options.onChosen(index);
    }
  };

  const backPosition = new THREE.Vector3();
  const backDirection = new THREE.Vector3();

  /** Dónde va la caja de fondo: a la derecha del sobre elegido y un poco abajo (arriba a la derecha en pantallas angostas), a su misma profundidad. */
  const placeBackBox = (): any => {
    const narrow = camera.aspect < 0.9;
    backDirection.set(narrow ? 0.6 : 0.5, narrow ? 0.62 : -0.2, 0.5).unproject(camera).sub(camera.position).normalize();
    const planeZ = ringR + FRONT_PUSH + heroCome();
    const distance = (planeZ - camera.position.z) / backDirection.z;
    return backPosition.copy(camera.position).addScaledVector(backDirection, distance);
  };

  /** La caja pequeña al fondo: aparece cuando el sobre elegido ya está en su lugar, se enciende al pasar el puntero y se esconde al empezar a rasgar. */
  const stepBackBox = (dt: number): void => {
    if (!boxGroup) {
      return;
    }
    backT += dt;
    const appear = easeOut(clamp01((backT - 0.3) / 0.7));
    const alpha = appear * (1 - clamp01(tearShown * 4)) * (tearOffT >= 0 ? 0 : 1);
    canReturnNow = alpha > 0.6;
    backHover += ((canReturnNow ? backHoverTarget : 0) - backHover) * Math.min(1, dt * 10);
    boxGroup.visible = alpha > 0.01;
    const place = placeBackBox();
    boxGroup.position.set(place.x, place.y + (1 - appear) * 2.5 + (options.reduced ? 0 : Math.sin(time * 1.4) * 0.04), place.z);
    boxGroup.scale.setScalar((camera.aspect < 0.9 ? BACK_SCALE_NARROW : BACK_SCALE) * (1 + 0.1 * backHover));
    boxGroup.rotation.set(0, -0.45, 0);
    lidPivot.rotation.x = -0.25 * backHover;
    boxMaterials.forEach((material) => {
      material.transparent = alpha < 1;
      material.opacity = alpha;
    });
    glowBloom.material.opacity = 0.3 * backHover * alpha;
    glowShaft.material.opacity = 0;
    boxLight.intensity = 8 * backHover * alpha;
  };

  const returnToPacks = (): void => {
    if (!held || returnRequested || !boxGroup || tearOffT >= 0 || tearShown > 0.05) {
      return;
    }
    returnRequested = true;
    canvas.style.cursor = '';
    options.onReturned?.();
  };

  /**
   * Ajusta el halo y las cometas al sobre que queda: `f` es la fracción de alto que conservan (1 = sobre entero,
   * el borde de abajo no se mueve) y `shrink` el hundimiento del cuerpo, para que sigan pegados a él.
   */
  const fitEffects = (f: number, shrink: number): void => {
    const lost = (aspect / 2) * (1 - f);
    effectBase.forEach(({ object, y, scaleY }) => {
      const sign = scaleY < 0 ? -1 : 1;
      const isHalo = object.material.uniforms === undefined;
      const height = isHalo ? (aspect * f + HALO_MARGIN * 2) / (aspect + HALO_MARGIN * 2) : (aspect * f / 2 + HALO_MARGIN) / (aspect / 2 + HALO_MARGIN);
      object.scale.x = shrink;
      object.scale.y = sign * height * shrink;
      object.position.y = (y - sign * lost) * shrink + (bodyMesh ? bodyMesh.position.y : 0);
      if (!isHalo) {
        object.material.uniforms.uHalf.value.y = (aspect * f) / 2;
      }
    });
  };

  /** Deshace el rasgado: el halo y los reflejos vuelven al sobre, las piezas se descartan y el sobre se vuelve a ver entero. */
  const restoreFromTear = (): void => {
    holdWanted = false;
    holdT = 0;
    heldTiltX = 0;
    heldTiltY = 0;
    if (hero) {
      hero.rotation.x = 0;
    }
    if (tearGroup) {
      bodyMesh.position.y = 0;
      fitEffects(1, 1);
      effectBase = [];
      [hero.userData.halo, hero.userData.mirror, hero.userData.mirrorHalo, hero.userData.mirrorStreak, ...hero.userData.streakMeshes].forEach((extra: any) => hero.add(extra));
      scene.remove(tearGroup);
      tearGeometries.splice(0).forEach((item) => item.dispose());
      tearMaterials.splice(0).forEach((material) => material.dispose());
      stripMaterials.length = 0;
      tearEdges.length = 0;
      stripBase = null;
      stripEdgeBase = null;
      tearGroup = null;
      stripPivot = null;
      stripMesh = null;
      bodyMesh = null;
      seamGlow = null;
    }
    hero.visible = true;
    tearShown = 0;
    tearTarget = 0;
    tearOffT = -1;
  };

  const resume = (): void => {
    if (!held || !boxGroup) {
      return;
    }
    restoreFromTear();
    camTiltTarget = 1;
    held = false;
    heroLeaving = false;
    choosing = false;
    returnRequested = false;
    replay = true;
    replayHero = hero.userData.index as number;
    replayRestPos = Math.round(pos);
    pos = replayRestPos;
    targetPos = null;
    vel = 0;
    replayFrom = { x: boxGroup.position.x, y: boxGroup.position.y, z: boxGroup.position.z, s: boxGroup.scale.x, ry: boxGroup.rotation.y };
    firedEvents.clear();
    firedEvents.add('land');
    replayT0 = BOX_LID_AT - 0.5;
    introT = replayT0;
    introEnded = false;
    lastIndex = -1;
    backT = 0;
    backHover = 0;
    backHoverTarget = 0;
    canReturnNow = false;
    canvas.style.cursor = '';
  };

  /**
   * La tira solo se despega donde el rasgado ya pasó: cada punto se inclina hacia atrás y sube un poco según
   * cuánto lo dejó atrás el frente del corte (`shown`); lo que aún no se rasga queda pegado al sobre.
   * Con `full` toda la tira queda despegada (el momento en que sale volando).
   */
  const bendStrip = (shown: number, dir: 1 | -1, full: boolean): void => {
    if (!stripBase || !stripMesh) {
      return;
    }
    const rise = TEAR_LIFT * 0.4;
    const bendOf = (x: number): number => {
      if (full) {
        return 1;
      }
      const behind = shown - (dir > 0 ? x + 0.5 : 0.5 - x);
      const k = clamp01(behind / 0.22);
      return k * k * (3 - 2 * k);
    };
    const attribute = stripMesh.geometry.getAttribute('position');
    const array = attribute.array as Float32Array;
    for (let i = 0; i < array.length; i += 3) {
      const bend = bendOf(stripBase[i]!);
      const angle = TEAR_TILT_BACK * bend;
      const rel = stripBase[i + 1]! - tearSeamY;
      array[i + 1] = tearSeamY + rel * Math.cos(angle) + rise * bend;
      array[i + 2] = stripBase[i + 2]! - rel * Math.sin(angle);
    }
    attribute.needsUpdate = true;
    if (stripEdgeBase) {
      tearEdges.forEach((ribbon) => {
        if (ribbon.scale.y >= 0) {
          return;
        }
        const edge = ribbon.geometry.getAttribute('position');
        const edgeArray = edge.array as Float32Array;
        for (let i = 0; i < edgeArray.length; i += 3) {
          edgeArray[i + 1] = stripEdgeBase![i + 1]! - rise * bendOf(stripEdgeBase![i]!);
        }
        edge.needsUpdate = true;
      });
    }
  };

  /**
   * Cuánto brillo conserva el sobre `t` segundos después de rasgarse: baja rápido al inicio (el borde recién cortado
   * se vería como una banda sólida) y luego despacio hasta `TORN_GLOW`.
   */
  const tornGlow = (t: number): number => {
    const quick = clamp01(t / (0.18 * pace));
    const slow = clamp01((t - 0.18 * pace) / (tearOffDur - 0.18 * pace));
    const mid = 0.6;
    return 1 - (1 - mid) * easeOut(quick) - (mid - TORN_GLOW) * slow;
  };

  /** Con el sobre ya elegido: el halo y el brillo del borde siguen vivos y la tira responde al rasgado. */
  const stepHeld = (dt: number): void => {
    if (!hero) {
      return;
    }
    if (!inPlace) {
      stepBackBox(dt);
    }
    if (!options.reduced) {
      const follow = Math.min(1, dt * 6);
      heldTiltX += (-pointerY * 0.1 - heldTiltX) * follow;
      heldTiltY += (pointerX * 0.16 - heldTiltY) * follow;
      const body = tearGroup ?? hero;
      body.rotation.x = heldTiltX;
      body.rotation.y = heldTiltY;
    }
    // El halo respira y el borde sigue brillando mientras se espera el rasgado; al rasgar se apagan con el sobre.
    const fade = tearOffT < 0 ? 1 : tornGlow(tearOffT);
    const breathe = options.reduced ? 1 : 0.8 + 0.2 * Math.sin(time * 2.2);
    hero.userData.halo.material.opacity = Math.min(1, HALO_OPACITY + 0.3) * breathe * fade;
    hero.userData.mirror.material.opacity = REFLECT_OPACITY * fade;
    hero.userData.mirror.visible = fade > 0.01;
    hero.userData.mirrorHalo.material.opacity = hero.userData.halo.material.opacity * REFLECT_FX;
    hero.userData.mirrorHalo.visible = fade > 0.01;
    hero.userData.mirrorStreak.material.uniforms.uTime.value = options.reduced ? 0.3 : time;
    hero.userData.mirrorStreak.material.uniforms.uOpacity.value = 0.9 * fade * fade * REFLECT_FX;
    hero.userData.mirrorStreak.visible = fade > 0.01;
    hero.userData.streak.uniforms.uTime.value = options.reduced ? 0.3 : time;
    hero.userData.streak.uniforms.uOpacity.value = 0.9 * fade * fade;
    hero.userData.streakMeshes.forEach((plane: any) => {
      plane.visible = fade > 0.01;
    });
    if (!tearGroup) {
      return;
    }
    if (tearOffT < 0 && holdWanted && pointerHeld) {
      holdT += dt;
      tearDir = 1;
      tearTarget = clamp01(holdT / holdOpenS);
      options.onHoldProgress?.(tearTarget);
      if (holdT >= holdOpenS) {
        holdWanted = false;
        holdT = 0;
        if (inPlace) {
          held = true;
          othersDim = 0;
          layout();
        }
        options.onHoldComplete?.();
      }
    }
    if (inPlace && !held && tearOffT < 0) {
      othersDim = 1 - clamp01(tearShown * 1.3);
    }
    const dir = tearDir;
    const seamY = tearSeamY;
    if (tearOffT < 0) {
      tearShown += (tearTarget - tearShown) * Math.min(1, dt * 14);
      const pivotX = dir > 0 ? 0.5 : -0.5;
      stripPivot.position.set(pivotX, seamY, tearShown * 0.02);
      stripMesh.position.set(-pivotX, -seamY, 0);
      stripPivot.rotation.set(0, 0, 0);
      bendStrip(tearShown, dir, false);
      const width = Math.max(0.0001, tearShown);
      seamGlow.scale.x = width;
      seamGlow.position.x = dir > 0 ? -0.5 + width / 2 : 0.5 - width / 2;
      seamGlow.material.opacity = tearShown > 0.01 ? 0.6 : 0;
      const shownSteps = Math.round(clamp01(tearShown) * TEAR_EDGE_STEPS);
      tearEdges.forEach((ribbon) => {
        ribbon.visible = shownSteps > 0;
        ribbon.geometry.setDrawRange((dir > 0 ? 0 : TEAR_EDGE_STEPS - shownSteps) * 6, shownSteps * 6);
      });
      return;
    }
    tearOffT += dt;
    const k = clamp01(tearOffT / tearOffDur);
    const fly = easeIn(k);
    const pivotX = dir > 0 ? 0.5 : -0.5;
    stripPivot.position.set(pivotX + dir * fly * 2.0, seamY + 1.4 * k - 2.6 * k * k, 0.02 + k * 0.98);
    bendStrip(1, dir, true);
    const spin = fly * 1.8;
    stripPivot.rotation.z = dir > 0 ? -spin : spin;
    stripPivot.rotation.x = fly * (TEAR_TILT_BACK + 1.05);
    stripPivot.rotation.y = dir * fly * 1.1;
    tearMaterials.forEach((material) => {
      material.emissiveIntensity = 0.9 + (1 - k) * 0.9;
    });
    stripMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 1 - clamp01((k - 0.45) / 0.55);
    });
    bodyMesh.scale.setScalar(1 - 0.06 * easeOut(k));
    bodyMesh.position.y = -easeIn(k) * 0.25;
    const bodyFraction = (tearSeamY + aspect / 2) / aspect;
    fitEffects(1 - (1 - bodyFraction) * easeOut(k), 1 - 0.06 * easeOut(k));
    seamGlow.scale.x = 1;
    seamGlow.position.x = 0;
    tearEdges.forEach((ribbon) => {
      ribbon.geometry.setDrawRange(0, TEAR_EDGE_STEPS * 6);
    });
    seamGlow.material.opacity = 0.6 * (1 - k);
  };

  const prepareTear = (stripRatio: number): void => {
    if (tearGroup || !hero) {
      return;
    }
    const ratio = Math.min(Math.max(stripRatio, 0.05), 0.5);
    hero.updateMatrixWorld(true);
    tearGroup = new THREE.Group();
    tearGroup.position.copy(hero.position);
    tearGroup.quaternion.copy(hero.quaternion);
    tearGroup.scale.copy(hero.scale);
    scene.add(tearGroup);
    tearSeamY = aspect * (0.5 - ratio);
    const stripGeometry = packGeometry(THREE, aspect, 1 - ratio, 1);
    const bodyGeometry = packGeometry(THREE, aspect, 0, 1 - ratio);
    tearGeometries.push(stripGeometry, bodyGeometry);
    // Material propio de cada pieza (para desvanecerlas por separado) con la misma textura y brillo que el sobre.
    const clonePair = (target?: any[]): any[] =>
      (hero.userData.materials as any[]).map((material) => {
        const clone = material.clone();
        tearMaterials.push(clone);
        target?.push(clone);
        return clone;
      });
    bodyMesh = new THREE.Mesh(bodyGeometry, clonePair());
    stripMesh = new THREE.Mesh(stripGeometry, clonePair(stripMaterials));
    stripBase = Float32Array.from(stripGeometry.getAttribute('position').array);
    stripPivot = new THREE.Group();
    stripPivot.add(stripMesh);
    tearGroup.add(bodyMesh, stripPivot);
    // Interior dorado metálico del sobre, con el filo irregular del rasgado, en las dos mitades y en las dos caras.
    const goldMaterial = new THREE.MeshStandardMaterial({ color: 0xd9a93a, roughness: 0.26, metalness: 1, envMapIntensity: 1.8, emissive: new THREE.Color(0x3d2a06), emissiveIntensity: 0.6, side: THREE.DoubleSide });
    tearMaterials.push(goldMaterial);
    stripMaterials.push(goldMaterial);
    const bodyEdge = tornEdgeGeometry(THREE, 1);
    const stripEdge = tornEdgeGeometry(THREE, 2);
    tearGeometries.push(bodyEdge, stripEdge);
    tearEdges.length = 0;
    [
      { geometry: bodyEdge, parent: bodyMesh, flip: 1 },
      { geometry: stripEdge, parent: stripMesh, flip: -1 },
    ].forEach(({ geometry: edge, parent, flip }) => {
      if (flip < 0) {
        stripEdgeBase = Float32Array.from(edge.getAttribute('position').array);
      }
      for (const side of [1, -1]) {
        const ribbon = new THREE.Mesh(edge, goldMaterial);
        ribbon.position.set(0, tearSeamY, side * 0.04);
        ribbon.scale.y = flip;
        ribbon.visible = false;
        parent.add(ribbon);
        tearEdges.push(ribbon);
      }
    });
    seamGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 0.03),
      new THREE.MeshBasicMaterial({ color: 0xfff6dc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }),
    );
    seamGlow.position.set(0, tearSeamY, 0.06);
    tearGeometries.push(seamGlow.geometry);
    tearMaterials.push(seamGlow.material);
    tearGroup.add(seamGlow);
    // El halo, el reflejo y el borde brillante del sobre pasan a las nuevas piezas, sin que se note el cambio.
    [hero.userData.halo, hero.userData.mirror, hero.userData.mirrorHalo, hero.userData.mirrorStreak, ...hero.userData.streakMeshes].forEach((extra: any) => tearGroup.add(extra));
    effectBase = [hero.userData.halo, hero.userData.mirrorHalo, hero.userData.mirrorStreak, ...hero.userData.streakMeshes].map((object: any) => ({ object, y: object.position.y, scaleY: object.scale.y }));
    hero.visible = false;
    stepHeld(0);
  };

  const rectOf = (target: any): Carousel3DRect => {
    if (!target) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }
    target.updateMatrixWorld(true);
    const bounds = canvas.getBoundingClientRect();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of [[-0.5, aspect / 2], [0.5, aspect / 2], [0.5, -aspect / 2], [-0.5, -aspect / 2]] as const) {
      const point = new THREE.Vector3(x, y, 0).applyMatrix4(target.matrixWorld).project(camera);
      const px = bounds.left + (point.x * 0.5 + 0.5) * bounds.width;
      const py = bounds.top + (1 - (point.y * 0.5 + 0.5)) * bounds.height;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
    return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
  };
  const heroRect = (): Carousel3DRect => rectOf(tearGroup ?? hero);
  const frontRect = (): Carousel3DRect => rectOf(meshes[modIndex()]);

  const frame = (now: number): void => {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    time += dt;
    if (introT < introTotal) {
      introT += dt;
      pos = boxMode
        ? replay
          ? replayRestPos
          : -0.9 * (1 - easeOut(clamp01((introT - BOX_FIRST_LAUNCH) / (introTotal - BOX_FIRST_LAUNCH))))
        : -3 * (1 - easeOut(clamp01(introT / introTotal)));
      if (boxMode) {
        stepBox();
      }
    } else if (!introEnded) {
      introEnded = true;
      replay = false;
      replayHero = -1;
      options.onIntroEnd?.();
    } else if (choosing) {
      stepChoose(dt);
    } else if (!dragging) {
      if (targetPos !== null) {
        pos += (targetPos - pos) * Math.min(1, dt * 9);
        if (Math.abs(targetPos - pos) < 0.001) {
          pos = targetPos;
          targetPos = null;
          vel = 0;
        }
      } else if (Math.abs(vel) > 0.45) {
        pos += vel * dt;
        vel *= Math.exp(-3.4 * dt);
      } else {
        vel = 0;
        const rest = Math.round(pos);
        pos += (rest - pos) * Math.min(1, dt * 10);
        if (Math.abs(rest - pos) < 0.0008) {
          pos = rest;
        }
      }
    }
    if (dust && dustSpeed) {
      const array = dust.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < dustSpeed.length; i++) {
        array[i * 3 + 1]! += dustSpeed[i]! * dt * 0.4;
        if (array[i * 3 + 1]! > 8) {
          array[i * 3 + 1] = -8;
        }
      }
      dust.geometry.attributes.position.needsUpdate = true;
    }
    if (camTilt !== camTiltTarget) {
      camTilt += (camTiltTarget - camTilt) * Math.min(1, dt * 4);
      if (Math.abs(camTiltTarget - camTilt) < 0.002) {
        camTilt = camTiltTarget;
      }
    }
    if (camTilt !== camTiltApplied) {
      applyCamera();
    }
    const canHover = !choosing && !dragging && introT >= introTotal;
    for (let i = 0; i < N; i++) {
      const target = canHover && i === hoverIndex ? 1 : 0;
      hovers[i] = hovers[i]! + (target - hovers[i]!) * Math.min(1, dt * HOVER_SPEED);
    }
    if (choosing && hero && !heroLeaving) {
      layout(hero);
    }
    if (pointerHeld && !holdMoved && !holdWanted && !options.reduced) {
      holdArm += dt;
      if (holdArm >= holdArmS) {
        holdWanted = true;
        holdT = 0;
        options.onHoldStart?.();
      }
    }
    if (held || inPlace) {
      stepHeld(dt);
    }
    const sweep = options.reduced ? 0 : time;
    sheen.position.set(Math.sin(sweep * 0.9) * 0.55 + tearShown * tearDir * 0.5 + (held ? heldTiltY * 5 : 0), 0.35 + Math.cos(sweep * 0.6) * 0.3 - (held ? heldTiltX * 4 : 0), ringR + FRONT_PUSH + 1.1);
    if (!choosing && !held) {
      layout();
      const index = modIndex();
      if (index !== lastIndex && introT >= introTotal && Math.abs(vel) < 6) {
        lastIndex = index;
        options.onFocus(index);
      }
    }
    renderer.render(scene, camera);
  };

  const play = (): void => {
    if (raf === null && !disposed) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  };
  const cancel = (): void => {
    if (raf !== null) {
      cancelAnimationFrame(raf);
    }
    raf = null;
  };

  /**
   * La cámara según la pantalla. En horizontal es la de siempre. En vertical (teléfono) el ancho es lo que falta: se ensancha el campo de visión
   * (más perspectiva, el anillo se curva y se alcanzan a ver los sobres de los lados) y la cámara se acerca para que el sobre del frente ocupe
   * una buena parte del ancho; entre una cosa y otra se interpola con la proporción de la pantalla, sin saltos.
   */
  /** 0 en pantallas horizontales y 1 en las más verticales (teléfono). */
  const narrowAmount = (aspect = camera.aspect): number => clamp01((MOBILE_FROM - aspect) / (MOBILE_FROM - MOBILE_FULL));
  /** En teléfono el sobre elegido casi no se adelanta ni se agranda (si no llena todo el ancho): se queda un poco hacia atrás. */
  const heroCome = (): number => HERO_COME * (1 - 0.85 * narrowAmount());
  const heroScale = (): number => 1 + (HERO_SCALE - 1) * (1 - narrowAmount());

  const cameraFor = (aspect: number): { fov: number; z: number; y: number; lookZ: number } => {
    const narrow = narrowAmount(aspect);
    const frontZ = ringR + FRONT_PUSH;
    let fov = CAM_FOV;
    let z = camD;
    if (narrow > 0) {
      fov = CAM_FOV + (MOBILE_FOV - CAM_FOV) * narrow;
      const share = DESKTOP_FRONT_SHARE + (MOBILE_FRONT_SHARE - DESKTOP_FRONT_SHARE) * narrow;
      const distance = (BASE_S + POP_S) / (share * 2 * Math.tan((fov * Math.PI) / 360) * aspect);
      z = frontZ + distance;
    }
    // Se sube la cámara y se apunta al sobre del frente: él sigue en el centro y los del fondo asoman por encima.
    const tilt = TILT_MAX * clamp01((N - TILT_FROM) / (TILT_FULL - TILT_FROM));
    return { fov, z, y: (z - frontZ) * Math.tan(tilt), lookZ: tilt > 0 ? frontZ : 0 };
  };

  /** La cámara con la inclinación actual (`camTilt`: 1 = la de la vista del anillo, 0 = a nivel, de frente). */
  const applyCamera = (): void => {
    camera.position.set(0, baseView.y * camTilt, baseView.z);
    camera.lookAt(0, 0, baseView.lookZ * camTilt);
    camTiltApplied = camTilt;
  };

  const resize = (): void => {
    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.low ? 1.5 : 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const view = cameraFor(width / height);
    camera.fov = view.fov;
    baseView = view;
    camTiltApplied = -1;
    applyCamera();
    camera.updateProjectionMatrix();
    if (scene.fog) {
      // La niebla se mide desde la cámara: se mueve con ella para que los sobres de atrás sigan perdiéndose igual.
      scene.fog.near = view.z - 1;
      scene.fog.far = view.z + 18 + (ringR - RING_R) * 2;
    }
  };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  observer?.observe(mount);
  resize();
  layout();

  const raycaster = new THREE.Raycaster();
  const hit = (event: PointerEvent): number => {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const found = raycaster.intersectObjects(meshes, false)[0];
    return found ? meshes.indexOf(found.object) : -1;
  };

  const focusTo = (index: number): void => {
    const current = Math.round(pos);
    let delta = ((((index - (((current % N) + N) % N)) % N) + N) % N);
    if (delta > N / 2) {
      delta -= N;
    }
    vel = 0;
    targetPos = current + delta;
  };

  const choose = (): void => {
    if (choosing || held || introT < introTotal) {
      return;
    }
    choosing = true;
    chooseT = 0;
    vel = 0;
    targetPos = null;
    pos = Math.round(pos);
    hero = meshes[modIndex()];
    camTiltTarget = 0;
    chooseTotal = CHOOSE_S;
    heroAt = 0;
    heroLeaving = false;
    if (boxGroup) {
      // Los demás sobres se guardan en la caja, de los más cercanos al elegido a los más lejanos.
      const chosen = hero.userData.index as number;
      const around = (i: number): number => Math.min(Math.abs(i - chosen), N - Math.abs(i - chosen));
      const others = meshes.map((_, i) => i).filter((i) => i !== chosen).sort((a, b) => around(a) - around(b));
      storeRank = new Array(N).fill(0);
      others.forEach((index, rank) => {
        storeRank[index] = rank;
      });
      storeStagger = Math.min(STORE_STAGGER, STORE_SPAN / Math.max(1, N - 1));
      storeCloseAt = STORE_START + Math.max(0, others.length - 1) * storeStagger + STORE_FLIGHT + 0.05;
      storeExitAt = storeCloseAt + STORE_CLOSE;
      heroAt = storeCloseAt + 0.1;
      chooseTotal = heroAt + CHOOSE_S;
      storeFrom = meshes.map((mesh) => ({ x: mesh.position.x, y: mesh.position.y, z: mesh.position.z, s: mesh.scale.x, ry: mesh.rotation.y }));
    }
    options.onChoose?.(hero.userData.index);
  };

  let pointerHeld = false;
  let holdStart = { x: 0, y: 0 };
  let holdArm = 0;
  let holdMoved = false;
  let holdWanted = false;
  let holdT = 0;
  const endHold = (): void => {
    pointerHeld = false;
    if (holdWanted) {
      holdWanted = false;
      holdT = 0;
      tearTarget = 0;
      if (inPlace && !held) {
        restoreFromTear();
        inPlace = false;
        othersDim = 1;
      }
      options.onHoldCancel?.();
    }
  };
  let down: { x: number; y: number; pos: number; moved: number; t: number; lastX: number; lastT: number } | null = null;
  const onDown = (event: PointerEvent): void => {
    if (held && tearGroup && tearOffT < 0 && !choosing) {
      const rect = heroRect();
      if (event.clientX >= rect.left && event.clientX <= rect.left + rect.width && event.clientY >= rect.top && event.clientY <= rect.top + rect.height && (options.canHold?.(event.clientX, event.clientY, event.pointerType) ?? true)) {
        pointerHeld = true;
        holdArm = 0;
        holdMoved = false;
        holdWanted = false;
        holdStart = { x: event.clientX, y: event.clientY };
        canvas.setPointerCapture?.(event.pointerId);
      }
      return;
    }
    if (choosing || held || introT < introTotal) {
      return;
    }
    if (hit(event) === modIndex() && (options.canHold?.(event.clientX, event.clientY, event.pointerType) ?? true)) {
      pointerHeld = true;
      holdArm = 0;
      holdMoved = false;
      holdWanted = false;
      holdStart = { x: event.clientX, y: event.clientY };
    }
    dragging = true;
    vel = 0;
    targetPos = null;
    down = { x: event.clientX, y: event.clientY, pos, moved: 0, t: performance.now(), lastX: event.clientX, lastT: performance.now() };
    canvas.setPointerCapture?.(event.pointerId);
  };
  const hitBackBox = (event: { clientX: number; clientY: number }): boolean => {
    if (!boxGroup || !boxGroup.visible || !boxBody) {
      return false;
    }
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects([boxBody, boxLid], false).length > 0;
  };
  const onClick = (event: MouseEvent): void => {
    if (held && canReturnNow && hitBackBox(event)) {
      returnToPacks();
    }
  };
  canvas.addEventListener('click', onClick);
  const updateHover = (event: PointerEvent): void => {
    if (held) {
      backHoverTarget = event.pointerType !== 'touch' && canReturnNow && hitBackBox(event) ? 1 : 0;
      canvas.style.cursor = backHoverTarget ? 'pointer' : '';
      return;
    }
    if (event.pointerType === 'touch' || choosing || introT < introTotal) {
      return;
    }
    hoverIndex = hit(event);
    canvas.style.cursor = hoverIndex >= 0 ? 'pointer' : '';
  };
  const onLeave = (): void => {
    hoverIndex = -1;
    canvas.style.cursor = '';
  };
  const onMove = (event: PointerEvent): void => {
    if (pointerHeld && !holdMoved && Math.hypot(event.clientX - holdStart.x, event.clientY - holdStart.y) > HOLD_SLOP_PX) {
      holdMoved = true;
      if (holdWanted) {
        endHold();
        pointerHeld = true;
      }
    }
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width > 0 && bounds.height > 0) {
      pointerX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointerY = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
    }
    if (!down) {
      updateHover(event);
      return;
    }
    if (choosing) {
      return;
    }
    const dx = event.clientX - down.x;
    down.moved = Math.max(down.moved, Math.abs(dx) + Math.abs(event.clientY - down.y));
    const perPack = (mount.clientWidth || window.innerWidth) / 4;
    pos = down.pos - dx / perPack;
    const t = performance.now();
    const dtMs = Math.max(8, t - down.lastT);
    vel = vel * 0.6 + (-(event.clientX - down.lastX) / perPack / (dtMs / 1000)) * 0.4;
    down.lastX = event.clientX;
    down.lastT = t;
  };
  const onUp = (event: PointerEvent): void => {
    endHold();
    if (!down || choosing) {
      return;
    }
    dragging = false;
    const tapped = down.moved < 8 && performance.now() - down.t < 350;
    canvas.releasePointerCapture?.(event.pointerId);
    if (tapped) {
      vel = 0;
      const index = hit(event);
      if (index >= 0) {
        if (index === modIndex()) {
          choose();
        } else {
          focusTo(index);
        }
      }
    } else if (Math.abs(vel) < 0.45) {
      vel = 0;
    }
    down = null;
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  const onContextMenu = (event: Event): void => event.preventDefault();
  canvas.addEventListener('contextmenu', onContextMenu);

  play();

  return {
    focused: modIndex,
    focus: focusTo,
    choose,
    prepareTear,
    heroRect,
    frontRect,
    tearTo(progress, dir) {
      tearTarget = clamp01(progress);
      tearDir = dir;
    },
    holdActive: () => holdWanted && pointerHeld,
    mouthPoint() {
      if (!tearGroup || !bodyMesh) {
        return null;
      }
      tearGroup.updateMatrixWorld(true);
      const bounds = canvas.getBoundingClientRect();
      const seam = tearSeamY * bodyMesh.scale.y + bodyMesh.position.y;
      const toScreen = (x: number): { x: number; y: number } => {
        const point = new THREE.Vector3(x * bodyMesh.scale.x, seam, 0.04).applyMatrix4(tearGroup.matrixWorld).project(camera);
        return { x: bounds.left + (point.x * 0.5 + 0.5) * bounds.width, y: bounds.top + (1 - (point.y * 0.5 + 0.5)) * bounds.height };
      };
      const left = toScreen(-0.5);
      const right = toScreen(0.5);
      return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2, width: Math.abs(right.x - left.x) };
    },
    beginHoldTear(stripRatio) {
      if (held || choosing || inPlace || introT < introTotal || tearGroup) {
        return;
      }
      hero = meshes[modIndex()];
      inPlace = true;
      othersDim = 1;
      prepareTear(stripRatio);
    },
    backBoxRect() {
      if (!boxGroup || !boxGroup.visible || !canReturnNow) {
        return null;
      }
      boxGroup.updateMatrixWorld(true);
      const bounds = canvas.getBoundingClientRect();
      const box = new THREE.Box3().setFromObject(boxBody).union(new THREE.Box3().setFromObject(boxLid));
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            const point = new THREE.Vector3(x, y, z).project(camera);
            const px = bounds.left + (point.x * 0.5 + 0.5) * bounds.width;
            const py = bounds.top + (1 - (point.y * 0.5 + 0.5)) * bounds.height;
            minX = Math.min(minX, px);
            maxX = Math.max(maxX, px);
            minY = Math.min(minY, py);
            maxY = Math.max(maxY, py);
          }
        }
      }
      return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
    },
    canReturn: () => boxMode && !!boxGroup && !inPlace,
    returnToPacks,
    resume,
    setHandlers(handlers) {
      Object.assign(options, handlers);
    },
    tearOff(dir) {
      if (tearOffT >= 0) {
        return;
      }
      tearDir = dir;
      tearOffT = 0;
    },
    dispose() {
      disposed = true;
      cancel();
      observer?.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('contextmenu', onContextMenu);
      geometry.dispose();
      boxGeometries.forEach((item) => item.dispose());
      boxMaterials.forEach((material) => material.dispose());
      boxTextures.forEach((texture) => texture.dispose());
      glowTex?.dispose();
      haloTexture.dispose();
      tearGeometries.forEach((item) => item.dispose());
      tearMaterials.forEach((material) => material.dispose());
      haloGeometry.dispose();
      mirrorGeometry.dispose();
      mirrorMask.dispose();
      meshes.forEach((mesh) => {
        mesh.userData.mirror?.material.dispose();
        mesh.userData.mirrorHalo?.material.dispose();
        mesh.userData.mirrorStreak?.material.dispose();
        mesh.userData.streak?.dispose();
      });
      meshes.forEach((mesh) => mesh.userData.halo?.material.dispose());
      glowBloom?.material.dispose();
      glowShaft?.material.dispose();
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      env.dispose();
      dust?.geometry.dispose();
      dust?.material.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
