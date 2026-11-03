import type { LabelKey, RevealedCard, TierSystem } from '../types';
import type { Feedback } from '../audio/controller';
import { el } from './dom';
import type { Listen } from './dom';
import { fanOrder, fanPose, mixPose, poseTransform, stowedPose } from './fan';

/** Lo que el abanico necesita del abridor: el DOM donde se monta y los servicios que comparte con las otras fases. */
export interface FanViewContext {
  doc: Document;
  stage: HTMLElement;
  root: HTMLElement;
  /** Región `aria-live` donde se anuncia la carta enfocada. */
  live: HTMLElement;
  entries: readonly RevealedCard[];
  tiers: TierSystem;
  /** Pone el texto de una etiqueta y lo mantiene al día si el host cambia los textos con `update({ labels })`. */
  bindText: (node: Node, key: LabelKey) => void;
  /** Igual que `bindText` pero para un atributo (p. ej. `aria-label`). */
  bindAttr: (node: Element, attribute: string, key: LabelKey) => void;
  reduced: boolean;
  /** Viene de la pila: las cartas arrancan donde las dejó y el abanico se abre. */
  arrivedFromStack: boolean;
  /** Centro (en pantalla) de la pila de la que viene; el abanico parte de ahí y se abre hacia su lugar. */
  stackCenter: { x: number; y: number } | null;
  tierColor: (tier: number) => string;
  /** Carta ya volteada (con su marca de «golpe» si es rara). */
  buildShownCard: (entry: RevealedCard) => HTMLElement;
  tilt: { setCard(card: HTMLElement | null): void };
  feedback: Pick<Feedback, 'sound'>;
  /** Escucha un evento hasta que termina la fase. */
  listen: Listen;
  later: (fn: () => void, ms: number) => void;
  /** Registra algo que se limpia al terminar la fase. */
  onCleanup: (fn: () => void) => void;
  onContinue: () => void;
}

/**
 * El botín: un abanico arrastrable para elegir qué carta mirar. La más rara empieza al centro,
 * agrandada y con brillo; arrastrar, rueda o flechas mueven el centro (con inercia y ajuste), tocar
 * una carta lateral la trae al centro. La geometría se calcula por cuadro desde un centro continuo.
 * Adaptado de OpenPack (Luango, `reveal.js`). Ver NOTICE.md.
 */
export function renderFan(context: FanViewContext): void {
  const { doc, stage, root, live, entries, tiers, bindText, bindAttr, reduced, arrivedFromStack, stackCenter, tierColor, buildShownCard, tilt, feedback, listen, later, onCleanup, onContinue } = context;
  const count = entries.length;
  const { order, hero } = fanOrder(entries.map((entry) => entry.tier));

  const haul = el(doc, 'div', 'ao-haul', { tabindex: '0', role: 'group' });
  bindAttr(haul, 'aria-label', 'browseHaul');
  const slots = order.map((entryIndex) => {
    const entry = entries[entryIndex]!;
    const slot = el(doc, 'div', 'ao-haul__slot');
    const card = buildShownCard(entry);
    slot.appendChild(card);
    haul.appendChild(slot);
    return { slot, card, entry };
  });
  const caption = el(doc, 'div', 'ao-haul__cap', { 'aria-hidden': 'true' });
  const captionName = el(doc, 'p', 'ao-haul__name');
  const captionTier = el(doc, 'p', 'ao-haul__tier');
  caption.append(captionName, captionTier);
  const next = el(doc, 'button', 'ao-btn ao-btn--primary ao-fan-next', { type: 'button' });
  bindText(next, 'continue');
  listen(next, 'click', onContinue);
  const hint = el(doc, 'div', 'ao-hint');
  bindText(hint, 'browseHaul');
  // Aviso fijo arriba, en una pastilla como los demás (no se oculta con `ui.hints`).
  const liftHint = el(doc, 'div', 'ao-carousel__hint');
  bindText(liftHint, 'liftToInspect');
  stage.append(caption, haul, hint, next, liftHint);

  const cardWidth = haul.getBoundingClientRect().width || 240;
  const haulRect = haul.getBoundingClientRect();
  const fromX = stackCenter && haulRect.width > 0 ? stackCenter.x - (haulRect.left + haulRect.width / 2) : 0;
  const fromY = stackCenter && haulRect.width > 0 ? stackCenter.y - (haulRect.top + haulRect.height / 2) : 0;
  let center = order.indexOf(hero);
  let target = center;
  let dragging = false;
  let raf: number | null = null;
  let laidOut = Number.NaN;
  let focused = -1;
  /** 1 = las cartas siguen como las dejó la pila (abajo, apretadas); baja a 0 y el abanico se abre y sube al frente. */
  let stow = arrivedFromStack && !reduced ? 1 : 0;
  let laidStow = Number.NaN;

  const layout = (): void => {
    slots.forEach((item, v) => {
      const off = v - center;
      const pose = fanPose(off, cardWidth);
      const shown = stow > 0 ? mixPose(pose, stowedPose(off, cardWidth, order[v] === count - 1), stow) : pose;
      if (stow > 0) {
        shown.tx += fromX * stow;
        shown.ty += fromY * stow;
      }
      item.slot.style.transform = poseTransform(shown);
      item.slot.style.zIndex = String(shown.z);
      item.slot.classList.toggle('ao-haul__slot--hero', Math.abs(off) < 0.5);
    });
    const index = Math.max(0, Math.min(count - 1, Math.round(center)));
    if (index !== focused) {
      if (focused !== -1) {
        feedback.sound('flick', 0);
      }
      focused = index;
      const item = slots[index]!;
      const color = tierColor(item.entry.tier);
      haul.style.setProperty('--ao-tier-color', color);
      caption.style.setProperty('--ao-tier-color', color);
      captionName.textContent = item.entry.card.name ?? item.entry.card.id;
      captionTier.textContent = tiers.levels[item.entry.tier]?.label ?? '';
      live.textContent = `${captionName.textContent}, ${captionTier.textContent}`;
      tilt.setCard(item.card);
    }
  };

  const frame = (): void => {
    raf = requestAnimationFrame(frame);
    if (!dragging) {
      center += (target - center) * 0.18;
      if (Math.abs(target - center) < 0.001) {
        center = target;
      }
    }
    if (stow > 0) {
      stow = stow < 0.003 ? 0 : stow * 0.88;
    }
    if (center !== laidOut || stow !== laidStow) {
      layout();
      laidOut = center;
      laidStow = stow;
    }
  };
  const startLoop = (): void => {
    if (raf === null) {
      raf = requestAnimationFrame(frame);
    }
  };
  onCleanup(() => {
    if (raf !== null) {
      cancelAnimationFrame(raf);
    }
    raf = null;
  });

  const clamp = (value: number): number => Math.max(0, Math.min(count - 1, value));
  layout();
  laidOut = center;
  laidStow = stow;
  startLoop();
  // El aviso va a media altura entre el borde de arriba y el título de la carta (lejos de «Saltar» y del abanico).
  const placeLiftHint = (): void => {
    const top = caption.getBoundingClientRect().top - stage.getBoundingClientRect().top;
    if (top > 0) {
      liftHint.style.top = `${Math.max(14, top / 2).toFixed(0)}px`;
      liftHint.style.translate = '-50% -50%';
    }
  };
  placeLiftHint();
  const view = doc.defaultView;
  view?.addEventListener('resize', placeLiftHint);
  onCleanup(() => view?.removeEventListener('resize', placeLiftHint));
  later(() => haul.classList.add('ao-haul--live'), reduced || stow > 0 ? 0 : 620);

  /** Distancia hacia arriba (px) que hay que arrastrar una carta para sacarla del abanico y verla de cerca. */
  const liftAt = cardWidth * 0.35;
  let down: { x: number; y: number; start: number; moved: number; up: number; slot: HTMLElement | null; mode: 'pending' | 'pan' | 'lift' } | null = null;
  let inspecting = false;
  let closeInspect: (() => void) | null = null;

  /** La carta bajo el puntero: la del blanco del evento o, si no hay, la de arriba entre las que cubren ese punto. */
  const slotAt = (event: PointerEvent): HTMLElement | null => {
    const hit = (event.target as HTMLElement).closest<HTMLElement>('.ao-haul__slot');
    if (hit) {
      return hit;
    }
    let best: HTMLElement | null = null;
    slots.forEach(({ slot }) => {
      const rect = slot.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (inside && (!best || Number(slot.style.zIndex) > Number(best.style.zIndex))) {
        best = slot;
      }
    });
    return best;
  };

  /** La carta sale del abanico y se muestra aparte, al frente y más grande, para ver el detalle. */
  const inspect = (entry: RevealedCard): void => {
    inspecting = true;
    const overlay = el(doc, 'div', 'ao-inspect', { role: 'dialog', 'aria-label': entry.card.name ?? entry.card.id, tabindex: '-1' });
    const holder = el(doc, 'div', 'ao-inspect__card');
    const big = buildShownCard(entry);
    holder.appendChild(big);
    const closeButton = el(doc, 'button', 'ao-btn', { type: 'button' });
    bindText(closeButton, 'close');
    overlay.append(holder, closeButton);
    stage.appendChild(overlay);
    tilt.setCard(big);
    overlay.focus({ preventScroll: true });
    const close = (): void => {
      if (!inspecting) {
        return;
      }
      inspecting = false;
      closeInspect = null;
      overlay.classList.add('ao-inspect--out');
      tilt.setCard(slots[focused]?.card ?? null);
      later(() => overlay.remove(), reduced ? 0 : 200);
      haul.focus({ preventScroll: true });
    };
    closeInspect = close;
    listen(overlay, 'click', close);
  };

  /** La carta sigue al dedo hacia arriba, crece y se endereza; al pasar `liftAt` queda lista para soltarse. */
  const liftTo = (up: number): void => {
    const item = slots.find((candidate) => candidate.slot === down?.slot);
    if (!down || !item) {
      return;
    }
    down.up = up;
    const pose = fanPose(slots.indexOf(item) - center, cardWidth);
    const k = Math.min(1, up / liftAt);
    item.slot.style.transition = 'none';
    item.slot.style.transform = poseTransform({ ...pose, ty: pose.ty - up, scale: pose.scale * (1 + 0.35 * k), rotate: pose.rotate * (1 - k) });
    item.slot.style.zIndex = '400';
    item.slot.classList.toggle('ao-haul__slot--lifted', k >= 1);
  };

  // Los gestos se escuchan en todo el escenario: las cartas de los lados quedan fuera de la caja del abanico.
  listen(stage, 'pointerdown', (event: PointerEvent) => {
    if (inspecting || (event.target as HTMLElement).closest('button')) {
      return;
    }
    down = { x: event.clientX, y: event.clientY, start: center, moved: 0, up: 0, slot: slotAt(event), mode: 'pending' };
    dragging = true;
    stage.setPointerCapture?.(event.pointerId);
  });
  listen(stage, 'pointermove', (event: PointerEvent) => {
    if (!down) {
      return;
    }
    const dx = event.clientX - down.x;
    const dy = event.clientY - down.y;
    down.moved = Math.max(down.moved, Math.abs(dx), Math.abs(dy));
    if (down.mode === 'pending' && down.moved >= 8) {
      down.mode = down.slot && dy < 0 && -dy > Math.abs(dx) ? 'lift' : 'pan';
    }
    if (down.mode === 'lift') {
      liftTo(Math.max(0, -dy));
      return;
    }
    if (down.mode !== 'pan') {
      return;
    }
    let moved = down.start - dx / (cardWidth * 0.45);
    if (moved < 0) {
      moved *= 0.35;
    } else if (moved > count - 1) {
      moved = count - 1 + (moved - (count - 1)) * 0.35;
    }
    center = moved;
  });
  const release = (): void => {
    if (!down) {
      return;
    }
    dragging = false;
    const gesture = down;
    down = null;
    if (gesture.mode === 'lift') {
      const item = slots.find((candidate) => candidate.slot === gesture.slot);
      if (item) {
        // La carta vuelve a su lugar del abanico; si se levantó lo suficiente, además se abre aparte.
        item.slot.style.transition = 'transform .3s ease';
        item.slot.classList.remove('ao-haul__slot--lifted');
        laidOut = Number.NaN;
        later(() => {
          item.slot.style.transition = '';
        }, 320);
        if (gesture.up >= liftAt) {
          inspect(item.entry);
        }
      }
    } else if (gesture.moved < 8 && gesture.slot) {
      const tapped = slots.findIndex((item) => item.slot === gesture.slot);
      if (tapped >= 0) {
        target = tapped;
      }
    } else {
      target = clamp(Math.round(center));
    }
  };
  listen(stage, 'pointerup', release);
  listen(stage, 'pointercancel', release);
  listen(
    haul,
    'wheel',
    (event: WheelEvent) => {
      event.preventDefault();
      if (inspecting) {
        return;
      }
      target = clamp(Math.round(center) + ((event.deltaY || event.deltaX) > 0 ? 1 : -1));
      startLoop();
    },
    { passive: false },
  );
  listen(root, 'keydown', (event: KeyboardEvent) => {
    if (inspecting) {
      if (event.key === 'Escape') {
        closeInspect?.();
      }
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      target = clamp(Math.round(center) + (event.key === 'ArrowRight' ? 1 : -1));
      startLoop();
    }
  });
}
