import { createOpeningSession } from '../core/session';
import type { OpeningSession } from '../core/session';
import { TearTracker, TurnGuard, splitPack } from '../core/tear';
import type { Point } from '../core/tear';
import { generic5 } from '../presets/generic';
import type {
  ActionDefinition,
  AudioOptions,
  FlowOptions,
  LabelKey,
  Labels,
  OpenResult,
  OpenerEvents,
  Phase,
  PackChoice,
  PackDefinition,
  PackOpenerOptions,
  RevealedCard,
  TierSystem,
} from '../types';
import { createFeedback } from '../audio/controller';
import { defaultLabels } from './labels';
import { createCarousel3D } from './carousel3d';
import type { Carousel3D, Carousel3DHandlers } from './carousel3d';
import { assertValidCards } from './cards-guard';
import { el } from './dom';
import { runGate } from './gate';
import type { GateHandle } from './gate';
import type { Listen } from './dom';
import { fanOrder, poseTransform, stowedPose } from './fan';
import { renderFan as renderFanView } from './fan-view';
import { FLOW_FULL_OPEN, createFlowLight } from './flowlight';
import type { FlowLight } from './flowlight';
import { defaultPackArt } from './pack-art';
import { createParticles, lighten } from './particles';
import { hitFromOf } from '../core/tiers';
import { extractPalette, peekPalette } from './palette';
import { PACK_TEMPLATE } from './pack-size';
import { composePackArt, peekComposedArt, resolvePackTexture } from './pack-texture';
import { createLabelBinder } from './label-binder';
import { resolveTiming } from './timing';
import { definedOnly } from './util';
import { CUT_ZONE_BELOW_SEAM, trackZones as trackPackZones } from './zones';
import { createSpring } from './spring';
import { injectStyles } from './styles';

export interface PackOpener {
  /** Inicia la experiencia (salvo `flow.startPaused`, que espera a `start()`) y resuelve al terminar. */
  open(): Promise<OpenResult>;
  start(): void;
  /** Cambia en caliente el volumen (o silencia) y los textos: lo que ya está en pantalla se repinta con los textos nuevos. */
  update(options: {
    audio?: Pick<AudioOptions, 'enabled' | 'volume'>;
    labels?: Partial<Labels>;
    /** Reemplaza los botones del resumen (se leen al llegar a él), por ejemplo para ofrecer «Abrir otro» solo si al servidor le quedan sobres. */
    actions?: ActionDefinition[];
  }): void;
  skip(): void;
  /** Sale de la experiencia en cualquier fase (lo mismo que el botón `ui.exitButton`): termina con `outcome: 'aborted'`. */
  exit(): void;
  getState(): { phase: Phase; index: number };
  on: OpeningSession['events']['on'];
  off: OpeningSession['events']['off'];
  /** Cierra (outcome 'aborted' si no había terminado), limpia listeners, timers y DOM. */
  destroy(): void;
}

const EVENT_PREFIX = 'amoxtli-opener:';

const ADVANCE_MIN_MS = 140;
const TEAR_FLIGHT_MS = 650;
const SPARK_COUNT = 18;
const PICK_MS = 620;
const FOIL = ['#ff5d8f', '#ffd24a', '#5fcf8e', '#3fd6c8', '#6ea8fe', '#b072e6'];

export function createPackOpener(options: PackOpenerOptions): PackOpener {
  const { mount } = options;
  const doc = mount.ownerDocument;
  const tiers: TierSystem = options.tiers ?? generic5;
  const flow: Required<Pick<FlowOptions, 'tearMode' | 'revealMode' | 'autoAdvanceMs' | 'allowSkip' | 'startPaused'>> = {
    tearMode: options.flow?.tearMode ?? 'swipe',
    revealMode: options.flow?.revealMode ?? 'tap-through',
    autoAdvanceMs: options.flow?.autoAdvanceMs ?? 1200,
    allowSkip: options.flow?.allowSkip ?? true,
    startPaused: options.flow?.startPaused ?? false,
  };
  const labels: Labels = { ...defaultLabels, ...definedOnly(options.labels) };
  const { bindText, bindAttr, refresh: refreshLabels } = createLabelBinder(labels);
  const timing = resolveTiming(options.timing);
  const choices: PackChoice[] = options.packs ?? [];
  const selectable = choices.length > 0;
  const hitFrom = hitFromOf(tiers);
  const fallbackAccent = tiers.levels[tiers.levels.length - 1]?.color ?? '#d9a441';
  const imageColors = options.effects?.colorSource === 'image';
  const accentOf = (definition: PackDefinition): string =>
    definition.accent ?? (imageColors && definition.art ? peekPalette(definition.art)?.dominant : undefined) ?? options.pack?.accent ?? fallbackAccent;
  /** El arte del sobre: el suyo (o el generado por código) y, si tiene textura propia y ya está lista, con la textura mezclada. */
  const artOf = (definition: PackDefinition, color: string): string => {
    const base = definition.art ?? defaultPackArt(color);
    const texture = resolvePackTexture(definition.texture);
    return (texture ? peekComposedArt(base, texture)?.art : undefined) ?? base;
  };
  const accent2Of = (definition: PackDefinition): string | undefined => (imageColors && definition.art ? peekPalette(definition.art)?.secondary : undefined);
  /** Con `colorSource: 'image'`: el resplandor del elemento toma los colores de su imagen (el anillo conserva el de la rareza). */
  const tintGlow = (node: HTMLElement, src: string): void => {
    if (!imageColors) {
      return;
    }
    const apply = (palette: { dominant: string; secondary: string } | null): void => {
      if (palette && !destroyed) {
        node.style.setProperty('--ao-glow', palette.dominant);
        node.style.setProperty('--ao-glow2', palette.secondary);
      }
    };
    const known = peekPalette(src);
    if (known) {
      apply(known);
    } else {
      void extractPalette(src, doc).then(apply);
    }
  };
  const choiceDefinition = (choice: PackChoice): PackDefinition => ({ ...options.pack, ...choice });
  let pack: PackDefinition = options.pack ?? {};
  let accent = accentOf(pack);
  let code = options.code ?? '';
  const defaultActions: ActionDefinition[] = [
    { id: 'collect', label: labels.collect, primary: true, closes: true },
  ];
  /** Los botones del resumen que definió quien integra la librería (en `options` o con `update({ actions })`); sin ellos, el de reserva. */
  let hostActions: ActionDefinition[] | null = options.actions ?? null;

  const session = createOpeningSession({
    tiers,
    flow: options.flow ?? {},
    selectable,
    ...(pack.id !== undefined ? { packId: pack.id } : {}),
  });

  injectStyles(doc);
  const feedback = createFeedback(options.audio, options.haptics ?? true);

  const reduced =
    options.effects?.reducedMotion === true ||
    ((options.effects?.reducedMotion ?? 'auto') === 'auto' &&
      !!doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const lowProfile =
    options.effects?.profile === 'low' || ((options.effects?.profile ?? 'auto') === 'auto' && reduced);

  const root = el(doc, 'div', 'ao-root', {
    'data-ao-phase': 'idle',
    'data-ao-profile': lowProfile ? 'low' : 'high',
  });
  if (reduced) {
    root.setAttribute('data-ao-reduced', '');
  }
  if (options.ui?.hints === false) {
    root.setAttribute('data-ao-no-hints', '');
  }
  if (options.ui?.counter === false) {
    root.setAttribute('data-ao-no-counter', '');
  }
  root.style.setProperty('--ao-accent', accent);
  root.style.setProperty('--ao-flip', `${timing.flipMs}ms`);
  root.style.setProperty('--ao-stagger', `${timing.summaryStaggerMs}ms`);
  root.style.setProperty('--ao-drop', `${timing.packDropMs}ms`);
  root.style.setProperty('--ao-pace', String(timing.pace));
  if (options.cardAspectRatio) {
    root.style.setProperty('--ao-card-ratio', String(options.cardAspectRatio));
  }
  Object.entries(options.theme ?? {}).forEach(([key, value]) => root.style.setProperty(key, value));
  const stage = el(doc, 'div', 'ao-stage');
  const live = el(doc, 'div', 'ao-live', { 'aria-live': 'polite' });
  const skipButton = el(doc, 'button', 'ao-btn ao-skip', { type: 'button' });
  bindText(skipButton, 'skip');
  skipButton.hidden = true;
  const exitButton = options.ui?.exitButton ? el(doc, 'button', 'ao-btn ao-exit', { type: 'button' }) : null;
  if (exitButton) {
    bindText(exitButton, 'exit');
  }
  const sparks = el(doc, 'div', 'ao-sparks', { 'aria-hidden': 'true' });
  if (!lowProfile) {
    for (let i = 0; i < SPARK_COUNT; i++) {
      const spark = el(doc, 'span');
      spark.style.cssText = `--ao-x:${(i * 37 + 11) % 100}%;--ao-d:${6 + ((i * 5) % 7)}s;--ao-delay:-${(i * 1.3).toFixed(1)}s;--ao-s:${2 + (i % 3)}px`;
      sparks.appendChild(spark);
    }
  }
  const fxCanvas = el(doc, 'canvas', 'ao-fx', { 'aria-hidden': 'true' });
  root.append(sparks, stage, fxCanvas, live, skipButton);
  if (exitButton) {
    root.append(exitButton);
  }
  mount.appendChild(root);
  const particles = lowProfile ? null : createParticles(fxCanvas, reduced);

  const timers = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();
  let cleanups: Array<() => void> = [];
  /** El carrusel 3D sigue vivo tras elegir: el rasgado se hace sobre el propio sobre 3D y se libera al salir de esa fase. */
  let kept3d: { carousel: Carousel3D; host: HTMLElement } | null = null;
  /** Se pidió volver a ver todos los sobres: la selección reutiliza el mismo carrusel, que saca los sobres que faltan. */
  let reentering = false;
  /** Se rasgó el sobre: queda a la vista detrás mientras se piden y salen las cartas (`redeeming` y `stack`). */
  let packTorn = false;
  /** El sobre 2D rasgado que queda detrás de las cartas (en el 3D es el propio `kept3d`). */
  let keptPack: HTMLElement | null = null;
  const disposeKept = (): void => {
    kept3d?.carousel.dispose();
    kept3d?.host.remove();
    kept3d = null;
  };
  let cardEls: HTMLElement[] = [];
  let destroyed = false;
  let lastCardRevealed = false;
  let promise: Promise<OpenResult> | null = null;
  let resolveResult: (result: OpenResult) => void = () => undefined;

  const later = (fn: () => void, ms: number): void => {
    if (ms <= 0) {
      fn();
      return;
    }
    const id = setTimeout(() => {
      timers.delete(id);
      if (!destroyed) {
        fn();
      }
    }, ms);
    timers.add(id);
  };

  const listen: Listen = (target, type, handler, opts) => {
    target.addEventListener(type, handler as EventListener, opts);
    cleanups.push(() => target.removeEventListener(type, handler as EventListener, opts));
  };

  const endPhase = (keep?: HTMLElement): void => {
    cleanups.forEach((fn) => fn());
    cleanups = [];
    intervals.forEach(clearInterval);
    intervals.clear();
    cardEls = [];
    tilt.setCard(null);
    Array.from(stage.children).forEach((child) => {
      if (child !== keep) {
        child.remove();
      }
    });
  };

  const tierColor = (tier: number): string => tiers.levels[tier]?.color ?? '#888';

  /** Coordenadas de pantalla → coordenadas del lienzo de partículas. */
  const fxAt = (clientX: number, clientY: number): [number, number] => {
    const rect = root.getBoundingClientRect();
    return [clientX - rect.left, clientY - rect.top];
  };

  /**
   * Inclinación guiada por el puntero sobre la carta activa, con resorte: da perspectiva, mueve el
   * foil (--posx/--posy), el destello (--mx/--my) y su intensidad (--hyp).
   */
  const tilt = (() => {
    let card: HTMLElement | null = null;
    const vars = ['--ao-tx', '--ao-ty', '--posx', '--posy', '--mx', '--my', '--hyp'];
    const spring = createSpring({
      rest: { x: 0, y: 0, h: 0.3 },
      stiffness: 0.12,
      damping: 0.8,
      onTick: (c) => {
        if (!card) {
          return;
        }
        const px = `${(50 + c.x * 50).toFixed(1)}%`;
        const py = `${(50 + c.y * 50).toFixed(1)}%`;
        card.style.setProperty('--ao-tx', `${(-c.y * 14).toFixed(2)}deg`);
        card.style.setProperty('--ao-ty', `${(c.x * 16).toFixed(2)}deg`);
        card.style.setProperty('--posx', px);
        card.style.setProperty('--posy', py);
        card.style.setProperty('--mx', px);
        card.style.setProperty('--my', py);
        card.style.setProperty('--hyp', c.h.toFixed(3));
      },
    });
    const enabled = !lowProfile && !reduced;
    const move = (event: PointerEvent): void => {
      if (!card) {
        return;
      }
      const rect = card.getBoundingClientRect();
      if (rect.width === 0) {
        return;
      }
      const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
      const y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));
      spring.set({ x, y, h: Math.max(0.3, Math.min(1, Math.hypot(x, y))) });
    };
    const rest = (): void => spring.set({ x: 0, y: 0, h: 0.3 });
    if (enabled) {
      root.addEventListener('pointermove', move);
      root.addEventListener('pointerleave', rest);
    }
    return {
      setCard(next: HTMLElement | null): void {
        if (card === next) {
          return;
        }
        vars.forEach((name) => card?.style.removeProperty(name));
        card = enabled ? next : null;
        spring.reset();
      },
      dispose(): void {
        spring.stop();
        root.removeEventListener('pointermove', move);
        root.removeEventListener('pointerleave', rest);
      },
    };
  })();

  const buildCard = (entry: RevealedCard, depth: number, image: string): HTMLElement => {
    const level = tiers.levels[entry.tier];
    const card = el(doc, 'div', 'ao-card', {
      'data-ao-tier': String(entry.tier),
      'data-ao-vfx': entry.card.foil && (level?.vfx ?? 'matte') === 'matte' ? 'shimmer' : (level?.vfx ?? 'matte'),
    });
    card.style.setProperty('--ao-tier-color', tierColor(entry.tier));
    tintGlow(card, image);
    card.style.setProperty('--ao-depth', String(depth));
    const inner = el(doc, 'div', 'ao-card__inner');
    const back = el(doc, 'div', 'ao-card__face ao-card__face--back');
    const backSrc = entry.card.back ?? options.cardBack;
    if (backSrc) {
      const backImg = el(doc, 'img', undefined, { src: backSrc, alt: '' });
      back.appendChild(backImg);
    }
    const front = el(doc, 'div', 'ao-card__face ao-card__face--front');
    const img = el(doc, 'img', undefined, { src: image, alt: entry.card.name ?? '', decoding: 'async' });
    img.addEventListener('error', () => {
      card.classList.add('ao-card--broken');
      session.events.emit('warning', {
        code: 'IMAGE_LOAD_FAILED',
        message: `No se pudo cargar la imagen de la carta "${entry.card.id}".`,
        detail: { cardId: entry.card.id, src: image },
      });
    });
    front.append(img, el(doc, 'div', 'ao-foil'), el(doc, 'div', 'ao-sparkle'), el(doc, 'div', 'ao-glare'));
    if (entry.card.isNew) {
      const badge = el(doc, 'span', 'ao-badge-new');
      bindText(badge, 'newBadge');
      front.appendChild(badge);
    }
    inner.append(back, front);
    card.appendChild(inner);
    return card;
  };

  const buildTile = (entry: RevealedCard, best: boolean): HTMLElement => {
    const tile = el(doc, 'div', 'ao-tile', { 'data-ao-tier': String(entry.tier) });
    tile.style.setProperty('--ao-tier-color', tierColor(entry.tier));
    tintGlow(tile, entry.card.thumb ?? entry.card.image);
    if (best) {
      tile.setAttribute('data-ao-best', '');
    }
    const img = el(doc, 'img', undefined, { src: entry.card.image, alt: entry.card.name ?? '', loading: 'lazy' });
    tile.appendChild(img);
    if (entry.card.isNew) {
      const badge = el(doc, 'span', 'ao-badge-new');
      bindText(badge, 'newBadge');
      tile.appendChild(badge);
    }
    return tile;
  };

  const redeemAbort = new AbortController();
  let redeemAttempts = 0;
  let redeeming = false;
  /** Lo que la persona escribió en la puerta de entrada (`options.gate`); llega a `redeem` en `context.gate`. */
  let gateValues: Record<string, string> = {};
  let gateHandle: GateHandle | null = null;
  let gatePassed = false;

  /** Pide las cartas al servidor (una petición a la vez). Las cartas solo existen tras esta llamada. */
  const requestCards = (): void => {
    if (redeeming || session.cardsReady || destroyed) {
      return;
    }
    redeeming = true;
    session.clearError();
    const attempt = ++redeemAttempts;
    Promise.resolve()
      .then(() => options.redeem(code, { attempt, gate: gateValues, signal: redeemAbort.signal }))
      .then((response) => {
        if (destroyed) {
          return;
        }
        const { cards, packId } = Array.isArray(response) ? { cards: response, packId: undefined } : (response ?? {});
        assertValidCards(cards);
        cards.forEach((card) => {
          const preload = doc.createElement('img');
          preload.src = card.thumb ?? card.image;
        });
        redeeming = false;
        session.provideCards(cards, packId);
      })
      .catch((cause: unknown) => {
        redeeming = false;
        if (destroyed) {
          return;
        }
        session.fail({
          code: 'REDEEM_FAILED',
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        });
      });
  };

  /** Destello + onda + chispas que salen del sobre al rasgarlo. */
  const buildBurst = (color: string): HTMLElement => {
    const burst = el(doc, 'div', 'ao-burst', { 'aria-hidden': 'true' });
    burst.style.setProperty('--ao-burst-color', color);
    burst.append(el(doc, 'i', 'ao-burst__flash'));
    later(() => burst.remove(), 1100);
    return burst;
  };

  /** Chispas, crujido y vibración mientras se mantiene presionado el sobre (avance 0..1, `strip` = fracción de alto donde corta). */
  let lastCrinkle = 0;
  const holdFx = (carousel: Carousel3D, progress: number, strip: number): void => {
    const now = Date.now();
    if (now - lastCrinkle > 650) {
      lastCrinkle = now;
      feedback.sound('crinkle');
      feedback.buzz(8);
    }
    if (particles && progress > 0.05 && Math.random() < 0.5) {
      const rect = carousel.heroRect();
      const [fx, fy] = fxAt(rect.left + rect.width * progress, rect.top + rect.height * strip);
      particles.emit(fx, fy, { count: 1, speed: 1 + progress * 2, colors: FOIL, life: 24, size: 1.6 });
    }
  };

  /** El sobre cuya apertura por presión sostenida terminó en la selección: al pasar a la fase de rasgado se completa solo. */
  let autoTear = false;
  let autoDir: 1 | -1 = 1;

  const trackZones = (rectOf: Parameters<typeof trackPackZones>[1], strip: () => number, visible: () => boolean, withCut?: () => boolean): void =>
    trackPackZones({ doc, stage, onCleanup: (fn) => cleanups.push(fn) }, rectOf, strip, visible, withCut);

  /** Carrusel 3D de sobres (si el host pasó three y hay WebGL). Devuelve false para caer al estante 2D. */
  const renderSelect3d = (): boolean => {
    if (!options.three) {
      return false;
    }
    // Al volver desde el rasgado se reutiliza el mismo carrusel (con su caja y sus sobres): solo se reconstruye la interfaz.
    const reuse = reentering ? kept3d : null;
    reentering = false;
    if (!reuse) {
      disposeKept();
    }
    const host = reuse ? reuse.host : el(doc, 'div', 'ao-carousel', { role: 'group', tabindex: '0' });
    bindAttr(host, 'aria-label', 'choosePack');
    if (!reuse) {
      stage.appendChild(host);
    }
    const caption = el(doc, 'p', 'ao-carousel__caption');
    const hint = el(doc, 'div', 'ao-carousel__hint');
    const hintLabel = doc.createTextNode('');
    hint.append(el(doc, 'span', 'ao-hint__icon', { 'aria-hidden': 'true' }), hintLabel);
    bindText(hintLabel, 'selectPack');
    (hint.firstElementChild as HTMLElement).textContent = '⌖';
    const ui = el(doc, 'div', 'ao-carousel__ui');
    const dots = choices.map(() => el(doc, 'i', 'ao-dot'));
    const dotBar = el(doc, 'div', 'ao-dots', { 'aria-hidden': 'true' });
    dotBar.append(...dots);
    ui.append(caption);
    if (choices.length > 1) {
      ui.appendChild(dotBar);
    }
    stage.append(ui, hint);
    /** El aviso va a media altura entre el borde de arriba y la parte superior del sobre del frente. */
    let placeable: Carousel3D | null = null;
    const placeHint = (): void => {
      const rect = placeable?.frontRect();
      if (!rect || rect.height === 0) {
        return;
      }
      const bounds = stage.getBoundingClientRect();
      hint.style.top = `${Math.max(0, (rect.top - bounds.top) / 2).toFixed(0)}px`;
      hint.style.translate = '-50% -50%';
    };
    const onResize = (): void => placeHint();
    doc.defaultView?.addEventListener('resize', onResize);
    cleanups.push(() => doc.defaultView?.removeEventListener('resize', onResize));
    /** El sobre del frente ya se rasgó en su sitio: queda elegido y la fase de rasgado solo remata el corte. */
    const openFocusedInPlace = (direction: 1 | -1): void => {
      const choice = choices[placeable?.focused() ?? 0]!;
      const definition = choiceDefinition(choice);
      pack = definition;
      accent = accentOf(definition);
      code = choice.code;
      root.style.setProperty('--ao-accent', accent);
      autoTear = true;
      autoDir = direction;
      session.choosePack(choice.id ?? choice.code, choice.code);
    };
    const arrows = (['prev', 'next'] as const).map((side) => {
      const arrow = el(doc, 'button', `ao-nav ao-nav--${side}`, { type: 'button', 'aria-label': side === 'prev' ? '‹' : '›' });
      arrow.textContent = side === 'prev' ? '‹' : '›';
      return arrow;
    });
    if (choices.length > 1) {
      stage.append(...arrows);
      if (options.box && !reduced) {
        arrows.forEach((arrow) => arrow.classList.add('ao-nav--hidden'));
      }
    }
    if (options.box && !reduced) {
      ui.classList.add('ao-carousel__ui--hidden');
      hint.classList.add('ao-carousel__hint--hidden');
    }

    const handlers: Carousel3DHandlers = {
      onReturned: () => {
        reentering = true;
        if (!session.backToSelect()) {
          reentering = false;
        }
      },
      onIntroEvent: (event) => {
        feedback.sound(event === 'land' ? 'impact' : event === 'open' ? 'open' : 'flick');
        if (event === 'land') {
          feedback.buzz(25);
        }
      },
      onIntroEnd: () => {
        ui.classList.remove('ao-carousel__ui--hidden');
        hint.classList.remove('ao-carousel__hint--hidden');
        placeHint();
        arrows.forEach((arrow) => arrow.classList.remove('ao-nav--hidden'));
      },
      onFocus: (index) => {
        const choice = choices[index]!;
        const title = choice.caption ?? choice.label ?? choice.id ?? choice.code;
        caption.textContent = title;
        if (choice.badge) {
          const badge = el(doc, 'span', 'ao-carousel__badge');
          badge.textContent = choice.badge;
          caption.appendChild(badge);
        }
        root.style.setProperty('--ao-accent', accentOf(choiceDefinition(choice)));
        live.textContent = title;
        dots.forEach((dot, i) => dot.classList.toggle('ao-dot--on', i === index));
        placeHint();
        feedback.sound('hover');
      },
      onHoldStart: () => {
        feedback.sound('crinkle');
        feedback.buzz(15);
        ui.classList.add('ao-carousel__ui--hidden');
        hint.classList.add('ao-carousel__hint--hidden');
        arrows.forEach((arrow) => arrow.classList.add('ao-nav--hidden'));
        placeable?.beginHoldTear(PACK_TEMPLATE.strip);
      },
      onHoldProgress: (progress) => {
        if (placeable) {
          holdFx(placeable, progress, PACK_TEMPLATE.strip);
        }
      },
      onHoldCancel: () => {
        ui.classList.remove('ao-carousel__ui--hidden');
        hint.classList.remove('ao-carousel__hint--hidden');
        arrows.forEach((arrow) => arrow.classList.remove('ao-nav--hidden'));
        feedback.sound('reject');
      },
      onHoldComplete: () => openFocusedInPlace(1),
      onChoose: () => {
        feedback.sound('crinkle');
        feedback.buzz(20);
        ui.classList.add('ao-carousel__ui--hidden');
        arrows.forEach((arrow) => arrow.classList.add('ao-nav--hidden'));
        hint.classList.add('ao-carousel__hint--hidden');
      },
      onChosen: (index) => {
        const choice = choices[index]!;
        const definition = choiceDefinition(choice);
        pack = definition;
        accent = accentOf(definition);
        code = choice.code;
        root.style.setProperty('--ao-accent', accent);
        later(() => session.choosePack(choice.id ?? choice.code, choice.code), reduced ? 0 : 180);
      },
    };

    let carousel: Carousel3D | null;
    if (reuse) {
      carousel = reuse.carousel;
      carousel.setHandlers(handlers);
      carousel.resume();
    } else {
      carousel = createCarousel3D(options.three, host, {
        items: choices.map((choice) => {
          const definition = choiceDefinition(choice);
          const choiceAccent = accentOf(definition);
          const second = accent2Of(definition);
          const art = artOf(definition, choiceAccent);
          return { id: choice.id ?? choice.code, art, accent: choiceAccent, ...(second ? { accent2: second } : {}) };
        }),
        ratio: PACK_TEMPLATE.ratio,
        box: options.box ?? null,
        holdOpenMs: timing.holdToOpenMs,
        holdArmMs: timing.holdArmMs,
        pace: timing.pace,
        reduced,
        low: lowProfile,
        onFocus: handlers.onFocus!,
        onChosen: handlers.onChosen!,
        ...handlers,
      });
    }
    if (!carousel) {
      host.remove();
      ui.remove();
      hint.remove();
      arrows.forEach((arrow) => arrow.remove());
      return false;
    }
    const active = carousel;
    placeable = active;
    placeHint();
    trackZones(
      () => active.frontRect(),
      () => PACK_TEMPLATE.strip,
      () => !hint.classList.contains('ao-carousel__hint--hidden'),
      () => false,
    );
    kept3d = { carousel: active, host };
    listen(arrows[0]!, 'click', () => active.focus(active.focused() - 1));
    listen(arrows[1]!, 'click', () => active.focus(active.focused() + 1));
    listen(host, 'keydown', (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        active.focus(active.focused() + (event.key === 'ArrowRight' ? 1 : -1));
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        active.choose();
      }
    });
    host.focus({ preventScroll: true });
    return true;
  };

  const renderSelect = (): void => {
    if (renderSelect3d()) {
      return;
    }
    const shelf = el(doc, 'div', 'ao-shelf', { role: 'list' });
    let picked = false;
    const buttons = choices.map((choice, i) => {
      const definition = choiceDefinition(choice);
      const choiceAccent = accentOf(definition);
      const id = choice.id ?? choice.code;
      const text = choice.caption ?? choice.label;
      const button = el(doc, 'button', 'ao-choice', {
        type: 'button',
        role: 'listitem',
        'aria-label': text ?? id,
        'data-ao-pack': id,
      });
      button.style.setProperty('--ao-i', String(i));
      button.style.setProperty('--ao-pack-ratio', String(PACK_TEMPLATE.ratio));
      button.style.setProperty('--ao-choice-accent', choiceAccent);
      const art = el(doc, 'span', 'ao-choice__art');
      art.append(
        el(doc, 'img', undefined, { src: artOf(definition, choiceAccent), alt: '', draggable: 'false' }),
        el(doc, 'i', 'ao-choice__shine'),
      );
      button.appendChild(art);
      if (text) {
        const caption = el(doc, 'span', 'ao-choice__caption');
        caption.textContent = text;
        button.appendChild(caption);
      }
      listen(button, 'pointerenter', () => feedback.sound('hover'));
      if (!lowProfile) {
        listen(button, 'pointermove', (event: PointerEvent) => {
          const rect = button.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width - 0.5;
          const y = (event.clientY - rect.top) / rect.height - 0.5;
          button.style.setProperty('--ao-ry', `${(x * 18).toFixed(1)}deg`);
          button.style.setProperty('--ao-rx', `${(-y * 18).toFixed(1)}deg`);
          button.style.setProperty('--ao-gx', `${((x + 0.5) * 100).toFixed(0)}%`);
        });
        listen(button, 'pointerleave', () => {
          button.style.removeProperty('--ao-ry');
          button.style.removeProperty('--ao-rx');
        });
      }
      listen(button, 'click', () => {
        if (picked) {
          return;
        }
        picked = true;
        pack = definition;
        accent = choiceAccent;
        code = choice.code;
        root.style.setProperty('--ao-accent', accent);
        buttons.forEach((other) => other.classList.add(other === button ? 'ao-choice--picked' : 'ao-choice--away'));
        feedback.sound('crinkle');
        feedback.buzz(20);
        later(() => session.choosePack(id, choice.code), reduced ? 0 : PICK_MS);
      });
      listen(button, 'keydown', (event: KeyboardEvent) => {
        const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (delta !== 0) {
          event.preventDefault();
          buttons[(i + delta + buttons.length) % buttons.length]?.focus();
        }
      });
      return button;
    });
    shelf.append(...buttons);
    const hint = el(doc, 'div', 'ao-hint');
    bindText(hint, 'choosePack');
    stage.append(shelf, hint);
    buttons[0]?.focus({ preventScroll: true });
  };

  /** Ráfaga de luz al sacar una carta rara: destello, rayos y partículas con la paleta de su rareza. */
  const hitFx = (tier: number, card: HTMLElement | undefined): void => {
    const profile = tiers.levels[tier]?.hit;
    if (!profile) {
      return;
    }
    const color = tierColor(tier);
    const flash = el(doc, 'div', 'ao-flash', { 'aria-hidden': 'true' });
    flash.style.setProperty('--ao-flash-color', color);
    flash.style.setProperty('--ao-flash-peak', String(profile.flash));
    flash.style.setProperty('--ao-flash-delay', `${profile.anticipationMs}ms`);
    stage.appendChild(flash);
    later(() => flash.remove(), profile.anticipationMs + 700);
    if (profile.rays > 0) {
      const rays = el(doc, 'div', 'ao-rays', { 'aria-hidden': 'true' });
      rays.style.setProperty('--ao-rays-color', color);
      rays.style.setProperty('--ao-rays-peak', String(Math.min(1, profile.rays)));
      rays.style.setProperty('--ao-flash-delay', `${profile.anticipationMs}ms`);
      stage.appendChild(rays);
      later(() => rays.remove(), profile.anticipationMs + 2400);
    }
    if (!particles || !card) {
      return;
    }
    later(() => {
      const rect = card.getBoundingClientRect();
      const [cx, cy] = fxAt(rect.left + rect.width / 2, rect.top + rect.height * 0.44);
      const palette = tier >= (tiers.levels.length - 2) ? ['#ffffff', ...FOIL] : ['#ffffff', lighten(color, 0.55), color];
      particles.emit(cx, cy, { count: Math.round(profile.burst * 0.6), speed: 7.5, colors: palette, gravity: 0.05, life: 80, size: 3, bloom: true, trail: true });
      particles.emit(cx, cy, { count: Math.round(profile.burst * 0.4), speed: 9.5, colors: ['#ffffff', lighten(color, 0.65)], gravity: 0.04, life: 72, size: 2.6, shape: 'star', bloom: true, trail: true });
    }, reduced ? 0 : profile.anticipationMs);
  };

  const renderRedeeming = (): void => {
    const error = session.error;
    if (!error) {
      const spinner = el(doc, 'div', 'ao-spinner', { role: 'status' });
      bindAttr(spinner, 'aria-label', 'opening');
      const hint = el(doc, 'div', 'ao-hint ao-hint--float');
      bindText(hint, 'opening');
      stage.append(spinner, hint);
      requestCards();
      return;
    }
    const message = el(doc, 'div', 'ao-hint', { role: 'alert' });
    bindText(message, 'openFailed');
    const retry = el(doc, 'button', 'ao-btn ao-btn--primary', { type: 'button' });
    bindText(retry, 'retry');
    listen(retry, 'click', () => {
      session.clearError();
      renderPhase('redeeming');
    });
    const close = el(doc, 'button', 'ao-btn', { type: 'button' });
    bindText(close, 'close');
    listen(close, 'click', () => session.abort());
    const bar = el(doc, 'div', 'ao-actions');
    bar.append(retry, close);
    stage.append(message, bar);
  };

  /** Chispas y confeti a lo largo de la costura del sobre (`rect`, en pantalla) al completar el rasgado. */
  const tearFx = (rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>, strip: number): void => {
    if (!particles) {
      return;
    }
    const seamY = rect.top + rect.height * strip;
    const palette = ['#ffffff', lighten(accent, 0.5), accent];
    for (let i = 0; i <= 8; i++) {
      const [x, y] = fxAt(rect.left + (rect.width * i) / 8, seamY);
      particles.emit(x, y, { count: 3, speed: 4.5, colors: FOIL, life: 50, size: 2.6, shape: 'chip', dir: -Math.PI / 2, spread: Math.PI });
      particles.emit(x, y, { count: 1, speed: 5.5, colors: ['#fff', '#ffe7b0'], life: 30, size: 1.6 });
      particles.emit(x, y, { count: 2, speed: 2.4, colors: ['#f4efe4', '#d9cfc0'], gravity: 0.12, life: 70, size: 3, shape: 'chip', dir: -Math.PI / 2, spread: Math.PI });
    }
    const [cx, cy] = fxAt(rect.left + rect.width / 2, rect.top + rect.height * 0.5);
    particles.emit(cx, cy, { count: 16, speed: 1.6, colors: palette, gravity: 0.05, life: 72, size: 2.2, bloom: true });
  };


  /** Enter o Espacio ejecutan `action` (activación por teclado de un elemento con `role="button"`). */
  const onActivateKey =
    (action: () => void) =>
    (event: KeyboardEvent): void => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        action();
      }
    };

  const renderTear = (): void => {
    const ratio = PACK_TEMPLATE.ratio;
    const art = artOf(pack, accent);
    const strip = PACK_TEMPLATE.strip;
    const openKey: LabelKey = flow.tearMode === 'swipe' ? 'swipeToOpen' : 'tapToOpen';
    const packEl = el(doc, 'div', 'ao-pack', {
      role: 'button',
      tabindex: '0',
    });
    bindAttr(packEl, 'aria-label', openKey);
    packEl.style.setProperty('--ao-pack-ratio', String(ratio));
    packEl.style.setProperty('--ao-strip', `${(strip * 100).toFixed(2)}%`);
    packEl.append(
      el(doc, 'img', 'ao-pack__img ao-pack__body', { src: art, alt: '' }),
      el(doc, 'img', 'ao-pack__img ao-pack__strip', { src: art, alt: '' }),
    );
    const svgNs = 'http://www.w3.org/2000/svg';
    const trail = doc.createElementNS(svgNs, 'svg');
    trail.setAttribute('class', 'ao-pack__trail');
    const line = doc.createElementNS(svgNs, 'polyline');
    trail.appendChild(line);
    packEl.appendChild(trail);
    let glow: FlowLight | null = null;
    if (flow.tearMode === 'swipe' && !lowProfile) {
      const glowCanvas = el(doc, 'canvas', 'ao-pack__flow', { 'aria-hidden': 'true' });
      packEl.appendChild(glowCanvas);
      glow = createFlowLight(glowCanvas, accent);
      if (glow) {
        const light = glow;
        cleanups.push(() => light.dispose());
      } else {
        glowCanvas.remove();
      }
    }
    const hint = el(doc, 'div', 'ao-hint');
    bindText(hint, openKey);
    stage.append(packEl, hint);

    let path: Point[] = [];
    let torn = false;

    /** Parte el sobre en dos a lo largo del trazo: la mitad chica sale volando, la grande conserva las cartas. */
    const splitAlongTrace = (): void => {
      const rect = packEl.getBoundingClientRect();
      const result = splitPack(path, rect.width, rect.height);
      if (!result) {
        return;
      }
      packEl.classList.add('ao-pack--split');
      (['a', 'b'] as const).forEach((side) => {
        const polygon = (side === 'a' ? result.a : result.b).map((p) => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`).join(',');
        const mover = result.smaller === side;
        const piece = el(doc, 'img', `ao-pack__img ao-pack__piece ao-pack__piece--${mover ? 'mover' : 'stay'}`, { src: art, alt: '' });
        piece.style.clipPath = `polygon(${polygon})`;
        if (mover) {
          piece.style.setProperty('--ao-fly-x', `${Math.round(result.direction.x * 130)}px`);
          piece.style.setProperty('--ao-fly-y', `${Math.round(result.direction.y * 130)}px`);
          piece.style.setProperty('--ao-fly-rot', `${result.direction.x >= 0 ? 18 : -18}deg`);
        }
        packEl.appendChild(piece);
      });
    };

    const complete = (): void => {
      if (torn) {
        return;
      }
      torn = true;
      packTorn = true;
      keptPack = packEl;
      if (flow.tearMode === 'swipe' && path.length >= 2) {
        splitAlongTrace();
      }
      packEl.classList.add('ao-pack--torn');
      glow?.stop();
      if (!lowProfile) {
        stage.appendChild(buildBurst(accent));
        tearFx(packEl.getBoundingClientRect(), strip);
      }
      requestCards();
      feedback.sound('rip');
      feedback.buzz([30, 20, 40]);
      later(() => session.reportTearProgress(1), reduced ? 0 : TEAR_FLIGHT_MS * timing.pace);
    };

    if (flow.tearMode === 'swipe') {
      let tracker: TearTracker | null = null;
      let points: string[] = [];
      let guard = new TurnGuard();
      let rect = packEl.getBoundingClientRect();
      const local = (event: PointerEvent): [number, number] => [event.clientX - rect.left, event.clientY - rect.top];

      listen(packEl, 'pointerdown', (event: PointerEvent) => {
        if (torn) {
          return;
        }
        rect = packEl.getBoundingClientRect();
        tracker = new TearTracker({ width: rect.width, height: rect.height }, pack.tear);
        points = [];
        path = [];
        guard = new TurnGuard();
        if (glow) {
          glow.setViewBox(rect.width, rect.height);
          glow.resize();
        }
        packEl.setPointerCapture?.(event.pointerId);
        feedback.sound('crinkle');
        const [x, y] = local(event);
        points.push(`${x},${y}`);
        path.push({ x, y });
        guard.add(x, y);
        tracker.add(x, y);
      });
      listen(packEl, 'pointermove', (event: PointerEvent) => {
        if (!tracker || torn) {
          return;
        }
        const [x, y] = local(event);
        if (!guard.add(x, y)) {
          tracker = null;
          line.setAttribute('points', '');
          glow?.stop();
          session.reportTearAbandoned();
          feedback.sound('reject');
          feedback.buzz([15, 30, 15]);
          return;
        }
        points.push(`${x},${y}`);
        path.push({ x, y });
        const progress = tracker.add(x, y);
        if (glow) {
          glow.setPath(path, progress * FLOW_FULL_OPEN);
        } else {
          line.setAttribute('points', points.join(' '));
        }
        if (particles && progress > 0.15) {
          const [fx, fy] = fxAt(event.clientX, event.clientY);
          particles.emit(fx, fy, { count: 1, speed: 1 + progress * 2, colors: FOIL, life: 22, size: 1.5 });
        }
        if (progress >= 1) {
          complete();
        } else {
          session.reportTearProgress(Math.min(progress, 0.999));
        }
      });
      const release = (): void => {
        if (tracker && !torn) {
          session.reportTearAbandoned();
          line.setAttribute('points', '');
          glow?.stop();
        }
        tracker = null;
      };
      listen(packEl, 'pointerup', release);
      listen(packEl, 'pointercancel', release);
      listen(packEl, 'keydown', onActivateKey(complete));
    } else if (flow.tearMode === 'tap') {
      listen(packEl, 'click', complete);
      listen(packEl, 'keydown', onActivateKey(complete));
    } else {
      later(complete, 600);
    }
  };

  /** Rasgar el propio sobre 3D que se eligió: la tira de arriba se levanta con el trazo y, al completarlo, sale volando. */
  const renderTear3d = (carousel: Carousel3D): void => {
    const host = kept3d!.host;
    const strip = PACK_TEMPLATE.strip;
    carousel.prepareTear(strip);
    // El aviso va en una pastilla como los demás: en web arriba (a media altura entre el borde y el sobre) y en móvil abajo.
    const hint = el(doc, 'div', 'ao-carousel__hint');
    bindText(hint, flow.tearMode === 'swipe' ? 'swipeOrHold' : 'tapToOpen');
    stage.appendChild(hint);
    // Si no quiere este sobre: clic en la caja del fondo (o Escape) vuelve a sacar todos los sobres. El aviso flota debajo de la caja.
    if (selectable && carousel.canReturn()) {
      const note = el(doc, 'div', 'ao-carousel__hint ao-carousel__hint--box', { 'aria-hidden': 'true' });
      bindText(note, 'seeAllPacks');
      note.style.opacity = '0';
      stage.appendChild(note);
      const view = doc.defaultView;
      let frameId = 0;
      const track = (): void => {
        const rect = carousel.backBoxRect();
        if (rect) {
          const bounds = stage.getBoundingClientRect();
          note.style.left = `${(rect.left + rect.width / 2 - bounds.left).toFixed(0)}px`;
          note.style.top = `${(rect.top + rect.height - bounds.top + 12).toFixed(0)}px`;
          note.style.translate = '-50% 0';
          note.style.opacity = '1';
        } else {
          note.style.opacity = '0';
        }
        frameId = view?.requestAnimationFrame(track) ?? 0;
      };
      track();
      cleanups.push(() => view?.cancelAnimationFrame(frameId));
    }

    let torn = false;
    let dir: 1 | -1 = 1;
    let path: Point[] = [];

    const placeTearHint = (): void => {
      const rect = carousel.heroRect();
      const bounds = stage.getBoundingClientRect();
      const mobile = (doc.defaultView?.matchMedia?.('(pointer: coarse)').matches ?? false) || (bounds.height > 0 && (bounds.width / bounds.height < 0.9 || bounds.width <= 640));
      hint.classList.toggle('ao-carousel__hint--bottom', mobile);
      hint.classList.toggle('ao-carousel__hint--hidden', torn || carousel.holdActive() || rect.height === 0);
      if (mobile) {
        hint.style.removeProperty('top');
        hint.style.removeProperty('translate');
      } else {
        hint.style.top = `${Math.max(0, (rect.top - bounds.top) / 2).toFixed(0)}px`;
        hint.style.translate = '-50% -50%';
      }
      tearHintFrame = doc.defaultView?.requestAnimationFrame(placeTearHint) ?? 0;
    };
    let tearHintFrame = 0;
    placeTearHint();
    cleanups.push(() => doc.defaultView?.cancelAnimationFrame(tearHintFrame));

    const complete = (): void => {
      if (torn) {
        return;
      }
      torn = true;
      packTorn = true;
      carousel.tearTo(1, dir);
      carousel.tearOff(dir);
      if (!lowProfile) {
        stage.appendChild(buildBurst(accent));
        tearFx(carousel.heroRect(), strip);
      }
      requestCards();
      feedback.sound('rip');
      feedback.buzz([30, 20, 40]);
      later(() => session.reportTearProgress(1), reduced ? 0 : (TEAR_FLIGHT_MS + 110) * timing.pace);
    };

    trackZones(
      () => carousel.heroRect(),
      () => strip,
      () => !torn && !carousel.holdActive() && carousel.heroRect().height > 0,
    );

    // Mantener presionado el sobre lo va rasgando despacio (el rasgado avanza solo mientras siga presionado).
    let holdEndedAt = 0;
    carousel.setHandlers({
      canHold: (_x, y) => {
        const rect = carousel.heroRect();
        return y > rect.top + rect.height * (strip + CUT_ZONE_BELOW_SEAM);
      },
      onHoldStart: () => {
        feedback.sound('crinkle');
        feedback.buzz(15);
      },
      onHoldProgress: (progress) => {
        holdFx(carousel, progress, strip);
        session.reportTearProgress(Math.min(progress, 0.999));
      },
      onHoldComplete: () => {
        holdEndedAt = Date.now();
        complete();
      },
      onHoldCancel: () => {
        holdEndedAt = Date.now();
        if (!torn) {
          session.reportTearAbandoned();
          feedback.sound('reject');
        }
      },
    });

    const activateOnKey = onActivateKey(complete);
    const onKey = (event: KeyboardEvent): void => {
      activateOnKey(event);
      if (event.key === 'Escape') {
        carousel.returnToPacks();
      }
    };

    if (flow.tearMode === 'swipe') {
      let tracker: TearTracker | null = null;
      let guard = new TurnGuard();
      let rect = carousel.heroRect();
      const local = (event: PointerEvent): [number, number] => [event.clientX - rect.left, event.clientY - rect.top];
      const inside = (event: PointerEvent): boolean => {
        const margin = rect.width * 0.08;
        return event.clientX >= rect.left - margin && event.clientX <= rect.left + rect.width + margin && event.clientY >= rect.top - margin && event.clientY <= rect.top + rect.height + margin;
      };

      listen(host, 'pointerdown', (event: PointerEvent) => {
        if (torn) {
          return;
        }
        rect = carousel.heroRect();
        if (!inside(event) || event.clientY > rect.top + rect.height * (strip + CUT_ZONE_BELOW_SEAM)) {
          return;
        }
        tracker = new TearTracker({ width: rect.width, height: rect.height }, pack.tear);
        path = [];
        guard = new TurnGuard();
        host.setPointerCapture?.(event.pointerId);
        feedback.sound('crinkle');
        const [x, y] = local(event);
        path.push({ x, y });
        guard.add(x, y);
        tracker.add(x, y);
      });
      listen(host, 'pointermove', (event: PointerEvent) => {
        if (!tracker || torn || carousel.holdActive()) {
          return;
        }
        const [x, y] = local(event);
        if (!guard.add(x, y)) {
          tracker = null;
          carousel.tearTo(0, dir);
          session.reportTearAbandoned();
          feedback.sound('reject');
          feedback.buzz([15, 30, 15]);
          return;
        }
        path.push({ x, y });
        const progress = tracker.add(x, y);
        dir = x >= path[0]!.x ? 1 : -1;
        carousel.tearTo(progress, dir);
        if (particles && progress > 0.15) {
          const [fx, fy] = fxAt(event.clientX, event.clientY);
          particles.emit(fx, fy, { count: 1, speed: 1 + progress * 2, colors: FOIL, life: 22, size: 1.5 });
        }
        if (progress >= 1) {
          complete();
        } else {
          session.reportTearProgress(Math.min(progress, 0.999));
        }
      });
      const release = (): void => {
        if (tracker && !torn) {
          session.reportTearAbandoned();
          carousel.tearTo(0, dir);
        }
        tracker = null;
      };
      listen(host, 'pointerup', release);
      listen(host, 'pointercancel', release);
      listen(host, 'keydown', onKey);
    } else if (flow.tearMode === 'tap') {
      listen(host, 'click', (event: MouseEvent) => {
        const rect = carousel.heroRect();
        if (carousel.holdActive() || Date.now() - holdEndedAt < 400) {
          return;
        }
        if (event.clientX >= rect.left && event.clientX <= rect.left + rect.width && event.clientY >= rect.top && event.clientY <= rect.top + rect.height) {
          complete();
        }
      });
      listen(host, 'keydown', onKey);
    } else {
      later(complete, 600);
    }
    host.focus({ preventScroll: true });
    if (autoTear) {
      autoTear = false;
      dir = autoDir;
      complete();
    }
  };

  /** Boca del sobre rasgado (centro de la costura, en pantalla): de ahí salen las cartas. Null si no hay sobre detrás. */
  const packMouth = (): { x: number; y: number; width: number } | null => {
    if (packTorn && kept3d) {
      return kept3d.carousel.mouthPoint();
    }
    const rect = keptPack?.getBoundingClientRect();
    if (!packTorn || !rect || rect.width === 0) {
      return null;
    }
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height * PACK_TEMPLATE.strip, width: rect.width };
  };

  let stackPose: ((entryIndex: number) => ReturnType<typeof stowedPose>) | null = null;
  /** La pila acabó y viene el abanico: sus cartas arrancan desde donde quedaron las de la pila. */
  let arrivedFromStack = false;
  /** Pila actual y el centro (en pantalla) donde quedó al terminar: de ahí parte el abanico. */
  let stackEl: HTMLElement | null = null;
  let counterEl: HTMLElement | null = null;
  let peekNext: ((index: number) => void) | null = null;
  let stackCenter: { x: number; y: number } | null = null;

  const renderStack = (): void => {
    const entries = session.ordered;
    const stack = el(doc, 'div', 'ao-stack', { role: 'button', tabindex: '0' });
    bindAttr(stack, 'aria-label', 'tapToReveal');
    // La carta que se revela primero va arriba del montón.
    cardEls = entries.map((entry, i) => buildCard(entry, i, entry.card.thumb ?? entry.card.image));
    [...cardEls].reverse().forEach((card) => stack.appendChild(card));
    cardEls.forEach((card, i) => {
      card.style.zIndex = String(entries.length - i);
    });
    const { order, hero } = fanOrder(entries.map((entry) => entry.tier));
    stackEl = stack;
    const center = order.indexOf(hero);
    /** Lugar que ocupará la carta en el abanico final, para ir formándolo a medida que se revelan. */
    stackPose = (entryIndex) => stowedPose(order.indexOf(entryIndex) - center, stack.offsetWidth || 240, entryIndex === entries.length - 1);
    const hint = el(doc, 'div', 'ao-hint');
    bindText(hint, 'tapToReveal');
    const counter = el(doc, 'div', 'ao-counter', { 'aria-hidden': 'true' });
    counter.textContent = `0/${entries.length}`;
    counterEl = counter;
    stage.append(stack, hint, counter);
    // En pantallas chicas el sobre se ve más chico que la carta: la carta no lo rebasa (se ajusta a su ancho).
    const fitWidth = packMouth()?.width;
    if (fitWidth && !options.theme?.['--ao-card-w'] && stack.offsetWidth > fitWidth) {
      root.style.setProperty('--ao-card-w', `${fitWidth.toFixed(0)}px`);
    }
    const peek = (i: number): void => {
      const entry = entries[i];
      if (entry && entry.tier >= hitFrom) {
        cardEls[i]?.setAttribute('data-ao-peek', '');
      }
    };
    peekNext = peek;
    peek(0);

    const mouth = packMouth();
    if (mouth && !lowProfile) {
      const bounds = stage.getBoundingClientRect();
      const glowTier = entries.reduce((best, entry) => Math.max(best, entry.tier), 0);
      const mouthGlow = el(doc, 'div', 'ao-mouth', { 'aria-hidden': 'true' });
      mouthGlow.style.left = `${(mouth.x - bounds.left).toFixed(0)}px`;
      mouthGlow.style.top = `${(mouth.y - bounds.top).toFixed(0)}px`;
      mouthGlow.style.setProperty('--ao-mouth-w', `${mouth.width.toFixed(0)}px`);
      mouthGlow.style.setProperty('--ao-mouth-color', glowTier >= hitFrom ? tierColor(glowTier) : lighten(accent, 0.4));
      stage.insertBefore(mouthGlow, stack);
      later(() => mouthGlow.remove(), 3100 * timing.pace);
    }
    if (mouth && stack.offsetWidth > 0) {
      const bounds = stage.getBoundingClientRect();
      const fromX = mouth.x - bounds.left - (stack.offsetLeft + stack.offsetWidth / 2);
      const fromY = mouth.y - bounds.top - (stack.offsetTop + stack.offsetHeight / 2);
      stack.style.setProperty('--ao-from-x', `${fromX.toFixed(0)}px`);
      stack.style.setProperty('--ao-from-y', `${fromY.toFixed(0)}px`);
      // Las cartas salen del ancho de la boca y crecen a su tamaño al acomodarse al frente.
      stack.style.setProperty('--ao-from-s', String(Math.min(1, Math.max(0.4, mouth.width / stack.offsetWidth)).toFixed(3)));
    }

    if (flow.revealMode === 'all-at-once') {
      later(() => session.revealAll(), 0);
      return;
    }

    let last = 0;
    const tap = (): void => {
      const now = Date.now();
      if (now - last < ADVANCE_MIN_MS) {
        return;
      }
      last = now;
      session.advance();
    };
    let swipeFrom: { x: number; y: number } | null = null;
    let swiped = false;
    listen(stack, 'pointerdown', (event: PointerEvent) => {
      swipeFrom = { x: event.clientX, y: event.clientY };
    });
    listen(stack, 'pointerup', (event: PointerEvent) => {
      if (swipeFrom && Math.hypot(event.clientX - swipeFrom.x, event.clientY - swipeFrom.y) > 40) {
        swiped = true;
        tap();
      }
      swipeFrom = null;
    });
    listen(stack, 'click', () => {
      if (swiped) {
        swiped = false;
        return;
      }
      tap();
    });
    listen(stack, 'keydown', onActivateKey(tap));
    if (flow.revealMode === 'auto-advance') {
      intervals.add(setInterval(() => session.advance(), flow.autoAdvanceMs));
    }
  };

  const renderFan = (): void => {
    renderFanView({
      doc,
      stage,
      root,
      live,
      entries: session.ordered,
      tiers,
      bindText,
      bindAttr,
      reduced,
      arrivedFromStack,
      stackCenter,
      tierColor,
      buildShownCard: (entry) => {
        const card = buildCard(entry, 0, entry.card.image);
        card.classList.add('ao-card--shown');
        if (entry.tier >= hitFrom) {
          card.setAttribute('data-ao-hit', '');
        }
        return card;
      },
      tilt,
      feedback,
      listen,
      later,
      onCleanup: (fn) => cleanups.push(fn),
      onContinue: () => session.finishFan(),
    });
  };

  const renderSummary = (): void => {
    const entries = session.ordered;
    const best = entries.reduce<RevealedCard | null>((acc, e) => (acc === null || e.tier >= acc.tier ? e : acc), null);
    const grid = el(doc, 'div', 'ao-summary');
    // Filas parejas (6 cartas = 3 + 3, no 5 + 1).
    grid.style.setProperty('--ao-cols', String(Math.ceil(entries.length / Math.ceil(entries.length / 5)) || 1));
    entries.forEach((entry, i) => {
      const tile = buildTile(entry, entry === best);
      tile.style.setProperty('--ao-i', String(i));
      grid.appendChild(tile);
    });
    stage.appendChild(grid);
    if (best) {
      const info = el(doc, 'div', 'ao-hint');
      bindText(info, 'bestPull', (text) => `${text}: ${best.card.name ?? best.card.id} (${tiers.levels[best.tier]?.label ?? ''})`);
      stage.appendChild(info);
    }
    const bar = el(doc, 'div', 'ao-actions');
    (hostActions ?? defaultActions).forEach((action) => {
      const button = el(doc, 'button', `ao-btn${action.primary ? ' ao-btn--primary' : ''}`, {
        type: 'button',
        'data-ao-action': action.id,
      });
      if (hostActions === null && action.id === 'collect') {
        bindText(button, 'collect');
      } else {
        button.textContent = action.label;
      }
      listen(button, 'click', () => session.chooseAction(action.id));
      bar.appendChild(button);
    });
    stage.appendChild(bar);
  };

  const renderPhase = (phase: Phase): void => {
    if (phase === 'select' || phase === 'tear') {
      packTorn = false;
      if (!options.theme?.['--ao-card-w']) {
        root.style.removeProperty('--ao-card-w');
      }
    }
    const behind = packTorn && (phase === 'stack' || phase === 'redeeming' || phase === 'fan');
    const keep = phase === 'tear' || (phase === 'select' && reentering) || (behind && kept3d) ? kept3d : null;
    const pack2d = behind && !kept3d ? keptPack : null;
    if (pack2d) {
      // Se fija el sobre donde está antes de quitar el resto, para que no salte al salir del flujo.
      const rect = pack2d.getBoundingClientRect();
      const bounds = stage.getBoundingClientRect();
      Object.assign(pack2d.style, {
        left: `${(rect.left - bounds.left).toFixed(0)}px`,
        top: `${(rect.top - bounds.top).toFixed(0)}px`,
        width: `${rect.width.toFixed(0)}px`,
        height: `${rect.height.toFixed(0)}px`,
      });
    }
    const dropping = phase === 'summary' && !reduced && packTorn ? (kept3d?.host ?? keptPack) : null;
    const droppedIs3d = Boolean(dropping) && dropping === kept3d?.host;
    endPhase(keep?.host ?? pack2d ?? dropping ?? undefined);
    if (dropping) {
      dropping.classList.add(droppedIs3d ? 'ao-carousel--drop' : 'ao-pack--drop');
      later(() => {
        dropping.remove();
        disposeKept();
      }, timing.packDropMs + 50);
    } else if (!keep) {
      disposeKept();
    }
    if (!pack2d) {
      keptPack = null;
    }
    if (behind) {
      (keep?.host ?? pack2d)?.classList.add(keep ? 'ao-carousel--behind' : 'ao-pack--behind');
    }
    root.setAttribute('data-ao-phase', phase);
    skipButton.hidden = !(flow.allowSkip && (phase === 'stack' || phase === 'fan'));
    if (phase === 'select') {
      renderSelect();
    } else if (phase === 'redeeming') {
      renderRedeeming();
    } else if (phase === 'tear') {
      if (keep) {
        renderTear3d(keep.carousel);
      } else {
        renderTear();
      }
    } else if (phase === 'stack') {
      renderStack();
      feedback.sound('open');
      feedback.buzz(25);
    } else if (phase === 'fan') {
      renderFan();
      feedback.sound('conclude');
    } else if (phase === 'summary') {
      renderSummary();
    }
  };

  session.events.on('phase', ({ from, to }) => {
    arrivedFromStack = from === 'stack' && to === 'fan';
    const stackRect = arrivedFromStack ? stackEl?.getBoundingClientRect() : null;
    stackCenter = stackRect && stackRect.width > 0 ? { x: stackRect.left + stackRect.width / 2, y: stackRect.top + stackRect.height / 2 } : null;
    root.setAttribute('data-ao-phase', to);
    if (to === 'done') {
      skipButton.hidden = true;
      return;
    }
    const hold =
      from === 'stack' && lastCardRevealed
        ? reduced
          ? 0
          : Math.max(timing.lastCardHoldMs, (tiers.levels[session.ordered.at(-1)?.tier ?? 0]?.hit?.anticipationMs ?? 0) + 1400)
        : 0;
    later(() => {
      if (session.phase === to) {
        renderPhase(to);
      }
    }, hold);
  });

  session.events.on('card:reveal', ({ card, index, tier, isLast }) => {
    const current = cardEls[index];
    const previous = cardEls[index - 1];
    current?.classList.add('ao-card--shown');
    current?.removeAttribute('data-ao-peek');
    peekNext?.(index + 1);
    if (counterEl) {
      counterEl.textContent = `${index + 1}/${session.ordered.length}`;
    }
    tilt.setCard(current ?? null);
    if (tier >= hitFrom) {
      current?.setAttribute('data-ao-hit', '');
      if (!lowProfile && !reduced) {
        const shock = el(doc, 'div', 'ao-shock', { 'aria-hidden': 'true' });
        shock.style.setProperty('--ao-shock-color', tierColor(tier));
        shock.style.setProperty('--ao-shock-delay', `${tiers.levels[tier]?.hit?.anticipationMs ?? 0}ms`);
        stage.appendChild(shock);
        later(() => shock.remove(), 1600);
        hitFx(tier, current);
      }
    }
    const pose = previous && stackPose?.(index - 1);
    if (previous && pose) {
      // La carta ya vista no se va: toma su lugar en el abanico, que se arma abajo y sube al frente al final.
      previous.style.setProperty('--ao-out-t', poseTransform(pose));
      previous.style.zIndex = String(pose.z);
      previous.classList.add('ao-card--out');
      feedback.sound('slide');
      later(() => feedback.sound('snap'), reduced ? 0 : 600 * timing.pace);
    }
    lastCardRevealed = isLast;
    const level = tiers.levels[tier];
    live.textContent = labels.announce(index + 1, session.ordered.length, card.name ?? card.id, level?.label ?? '');

    feedback.sound('flick', tier);
    const profile = level?.hit;
    if (tier >= hitFrom && profile) {
      feedback.sound('riser', tier);
      later(
        () => {
          feedback.sound(profile.sound ?? 'impact', tier);
          feedback.sound('chime', tier);
          feedback.sound('sparkle', tier);
          feedback.buzz(profile.haptic ?? [40, 30, 60 + tier * 10]);
        },
        reduced ? 0 : profile.anticipationMs,
      );
    } else {
      feedback.buzz(10);
    }
  });

  (Object.keys({
    phase: 0,
    'tear:progress': 0,
    'tear:complete': 0,
    'card:reveal': 0,
    hit: 0,
    skip: 0,
    action: 0,
    complete: 0,
    warning: 0,
    error: 0,
    select: 0,
  } satisfies Record<keyof OpenerEvents, 0>) as Array<keyof OpenerEvents>).forEach((name) => {
    session.events.on(name, ((detail: unknown) => {
      mount.dispatchEvent(new CustomEvent(EVENT_PREFIX + name, { detail, bubbles: true }));
      (options.on?.[name] as ((payload: unknown) => void) | undefined)?.(detail);
    }) as never);
  });

  session.events.on('complete', (result) => resolveResult(result));
  session.events.on('action', () => feedback.sound('collect'));
  session.events.on('error', () => {
    if (session.phase === 'redeeming') {
      renderPhase('redeeming');
    }
  });
  root.addEventListener('pointerdown', () => feedback.unlock(), { capture: true });
  skipButton.addEventListener('click', () => session.skip());
  /** Sale en cualquier fase: con la puerta abierta la cierra; antes de empezar cancela; después aborta (con las cartas ya vistas). */
  const exit = (): void => {
    if (gateHandle) {
      gateHandle.dispose();
      return;
    }
    if (session.phase === 'idle') {
      session.cancelBeforeStart();
      return;
    }
    session.abort();
  };
  exitButton?.addEventListener('click', exit);

  const begin = (): void => {
    if (session.phase === 'idle' && !destroyed) {
      if (imageColors && !selectable) {
        accent = accentOf(pack);
        root.style.setProperty('--ao-accent', accent);
      }
      session.start();
    }
  };
  /** Con `colorSource: 'image'` se leen antes los colores del arte de los sobres (con un tope de espera) para que el carrusel ya nazca teñido. */
  const startExperience = (): void => {
    const definitions = choices.length > 0 ? choices.map(choiceDefinition) : [pack];
    const arts = [options.pack?.art, ...choices.map((choice) => choice.art)].filter((art): art is string => Boolean(art));
    const jobs: Array<Promise<unknown>> = [];
    if (imageColors) {
      arts.forEach((art) => jobs.push(extractPalette(art, doc)));
    }
    // Las texturas se mezclan antes de empezar (con un tope de espera) para que el sobre nazca ya con ellas.
    definitions.forEach((definition) => {
      const texture = resolvePackTexture(definition.texture);
      if (texture) {
        jobs.push(composePackArt(definition.art ?? defaultPackArt(accentOf(definition)), texture, PACK_TEMPLATE.ratio, doc));
      }
    });
    if (jobs.length === 0) {
      begin();
      return;
    }
    const wait = new Promise<void>((resolve) => {
      const id = setTimeout(resolve, 1500);
      timers.add(id);
    });
    void Promise.race([Promise.all(jobs), wait]).then(begin);
  };

  /** Con `options.gate`, antes de empezar se pide el formulario de entrada; si la persona se retira, termina con `aborted` sin mostrar nada. */
  const start = (): void => {
    if (gateHandle || destroyed) {
      return;
    }
    if (!options.gate || gatePassed || session.phase !== 'idle') {
      startExperience();
      return;
    }
    gateHandle = runGate(doc, root, options.gate, redeemAbort.signal);
    void gateHandle.result.then((values) => {
      gateHandle = null;
      if (destroyed) {
        return;
      }
      if (values === null) {
        session.cancelBeforeStart();
        return;
      }
      gateValues = values;
      gatePassed = true;
      startExperience();
    });
  };

  return {
    open() {
      if (!promise) {
        promise = new Promise<OpenResult>((resolve) => {
          resolveResult = resolve;
        });
        if (!flow.startPaused) {
          start();
        }
      }
      return promise;
    },
    start,
    skip: () => session.skip(),
    exit,
    getState: () => ({ phase: session.phase, index: session.index }),
    update: (next) => {
      feedback.update(next.audio ?? {});
      if (next.actions) {
        hostActions = next.actions;
      }
      if (next.labels) {
        Object.assign(labels, definedOnly(next.labels));
        refreshLabels();
      }
    },
    on: (event, listener) => session.events.on(event, listener),
    off: (event, listener) => session.events.off(event, listener),
    destroy() {
      if (destroyed) {
        return;
      }
      redeemAbort.abort();
      if (gateHandle) {
        gateHandle.dispose();
        session.cancelBeforeStart();
      }
      session.abort();
      feedback.dispose();
      tilt.dispose();
      particles?.dispose();
      destroyed = true;
      timers.forEach(clearTimeout);
      timers.clear();
      endPhase();
      disposeKept();
      session.events.clear();
      root.remove();
    },
  };
}
