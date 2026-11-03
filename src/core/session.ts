import type {
  CardInput,
  FlowOptions,
  OpenResult,
  OpenerEvents,
  Phase,
  RevealedCard,
  Step,
  TierSystem,
} from '../types';
import { Emitter } from './emitter';
import { hitFromOf, resolveTier } from './tiers';

export interface SessionOptions {
  tiers: TierSystem;
  /** Opcional: en el flujo normal las cartas llegan después, con `provideCards()`. */
  cards?: CardInput[];
  packId?: string;
  flow?: FlowOptions;
  /** Antepone el paso 'select' (elegir entre varios sobres). */
  selectable?: boolean;
  /** Reloj inyectable para tests. */
  now?: () => number;
}

const DEFAULT_STEPS: Step[] = ['tear', 'stack', 'fan', 'summary'];

/**
 * Máquina de estados de una apertura. No conoce el DOM: el render le informa de los gestos
 * (`reportTearProgress`, `advance`, `skip`, `finishFan`, `chooseAction`) y escucha sus eventos.
 *
 * Las cartas pueden no conocerse al inicio: si una fase las necesita y aún no llegaron, la sesión
 * entra en `redeeming` y espera a `provideCards()` (o a `fail()` para mostrar el error).
 */
export class OpeningSession {
  readonly events = new Emitter<OpenerEvents>();

  private readonly steps: Step[];
  private readonly tiers: TierSystem;
  private readonly sortByTier: boolean;
  private readonly clock: () => number;
  private readonly hitFrom: number;
  private packId: string | undefined;

  private entries: RevealedCard[] = [];
  private hasCards = false;
  private pendingStep: number | null = null;
  private pendingWarnings: OpenerEvents['warning'][] = [];
  private started = false;
  private lastError: OpenResult['error'] | null = null;

  private currentPhase: Phase = 'idle';
  private stepIndex = -1;
  private revealIndex = 0;
  private startedAt = 0;
  private tearAttempts = 0;
  private taps = 0;
  private skipped = false;
  private result: OpenResult | null = null;

  constructor(options: SessionOptions) {
    this.tiers = options.tiers;
    this.clock = options.now ?? (() => Date.now());
    this.packId = options.packId;
    this.hitFrom = hitFromOf(options.tiers);
    this.sortByTier = options.flow?.sortByTier !== false;
    const steps = options.flow?.steps ?? DEFAULT_STEPS;
    this.steps = (options.selectable && !steps.includes('select') ? ['select' as Step, ...steps] : steps).filter(
      (step, i, all) => all.indexOf(step) === i,
    );

    if (options.cards) {
      this.provideCards(options.cards);
    }
  }

  get phase(): Phase {
    return this.currentPhase;
  }

  /** Cartas en el orden en que se revelan (la más rara al final si `sortByTier`). Vacío hasta `provideCards()`. */
  get ordered(): readonly RevealedCard[] {
    return this.entries;
  }

  get index(): number {
    return this.revealIndex;
  }

  get cardsReady(): boolean {
    return this.hasCards;
  }

  get error(): OpenResult['error'] | null {
    return this.lastError;
  }

  /** Entrega las cartas (la respuesta del servidor). Se ignora si ya había. */
  provideCards(cards: CardInput[], packId?: string): void {
    if (this.hasCards) {
      return;
    }
    if (packId !== undefined) {
      this.packId = packId;
    }

    const seen = new Set<string>();
    const entries = cards.map((card) => {
      if (seen.has(card.id)) {
        this.pendingWarnings.push({
          code: 'DUPLICATE_CARD_ID',
          message: `Id de carta repetido "${card.id}".`,
          detail: { cardId: card.id },
        });
      }
      seen.add(card.id);
      const { tier, warning } = resolveTier(card, this.tiers);
      if (warning) {
        this.pendingWarnings.push(warning);
      }
      return { card, tier, revealedAt: null, viewed: false } satisfies RevealedCard;
    });

    // Orden estable: a igual tier se conserva el orden recibido.
    this.entries = this.sortByTier
      ? entries
          .map((entry, index) => ({ entry, index }))
          .sort((a, b) => a.entry.tier - b.entry.tier || a.index - b.index)
          .map(({ entry }) => entry)
      : entries;

    this.hasCards = true;
    this.lastError = null;
    if (this.started) {
      this.flushWarnings();
    }

    if (this.pendingStep !== null) {
      const index = this.pendingStep;
      this.pendingStep = null;
      this.goToStep(index);
    }
  }

  /** La obtención de cartas falló: se informa y se queda esperando (reintento o cierre). */
  fail(error: NonNullable<OpenResult['error']>): void {
    if (this.hasCards || this.currentPhase === 'done') {
      return;
    }
    this.lastError = error;
    this.events.emit('error', { ...error });
  }

  /** El host va a reintentar: se limpia el error mostrado. */
  clearError(): void {
    this.lastError = null;
  }

  start(): void {
    if (this.currentPhase !== 'idle') {
      return;
    }
    this.started = true;
    this.startedAt = this.clock();
    this.flushWarnings();
    this.goToStep(0);
  }

  /** Elige el sobre de la pantalla de selección y pasa al siguiente paso. */
  choosePack(packId: string, code: string): void {
    if (this.currentPhase !== 'select') {
      return;
    }
    this.packId = packId;
    this.events.emit('select', { packId, code });
    this.nextStep();
  }

  reportTearProgress(progress: number): void {
    if (this.currentPhase !== 'tear') {
      return;
    }
    const value = Math.min(Math.max(progress, 0), 1);
    this.events.emit('tear:progress', { progress: value });
    if (value >= 1) {
      this.events.emit('tear:complete', {});
      this.nextStep();
    }
  }

  /** El gesto de rasgado se soltó antes de completarse. */
  reportTearAbandoned(): void {
    if (this.currentPhase === 'tear') {
      this.tearAttempts++;
    }
  }

  /** Revela la siguiente carta de la pila. Tras la última, pasa al siguiente paso. */
  advance(): void {
    if (this.currentPhase !== 'stack') {
      return;
    }
    this.taps++;
    this.revealCurrent();
    this.revealIndex++;
    if (this.revealIndex >= this.entries.length) {
      this.nextStep();
    }
  }

  /** Revela todas las cartas restantes de golpe (modo `all-at-once`). */
  revealAll(): void {
    if (this.currentPhase !== 'stack') {
      return;
    }
    while (this.revealIndex < this.entries.length) {
      this.revealCurrent();
      this.revealIndex++;
    }
    this.nextStep();
  }

  /** Salta directo al resumen; las cartas restantes se marcan como no vistas en la pila. */
  skip(): void {
    if (!this.hasCards || this.currentPhase === 'idle' || this.currentPhase === 'done') {
      return;
    }
    if (this.currentPhase === 'summary' || this.currentPhase === 'redeeming') {
      return;
    }
    this.events.emit('skip', { atIndex: this.revealIndex });
    this.skipped = true;
    const summary = this.steps.indexOf('summary');
    if (summary === -1) {
      this.finish('skipped', null);
      return;
    }
    this.setPhase('summary');
    this.stepIndex = summary;
  }

  finishFan(): void {
    if (this.currentPhase === 'fan') {
      this.nextStep();
    }
  }

  chooseAction(id: string): OpenResult | null {
    if (this.currentPhase !== 'summary') {
      return null;
    }
    return this.finish(this.skipped ? 'skipped' : 'completed', id);
  }

  /** Cierra sin acción (el host destruye el componente, o la persona cierra tras un error). */
  abort(): OpenResult | null {
    if (this.currentPhase === 'idle' || this.currentPhase === 'done') {
      return this.result;
    }
    return this.finish(this.lastError ? 'failed' : 'aborted', null);
  }

  private flushWarnings(): void {
    const warnings = this.pendingWarnings;
    this.pendingWarnings = [];
    warnings.forEach((warning) => this.events.emit('warning', warning));
  }

  private revealCurrent(): void {
    const entry = this.entries[this.revealIndex];
    if (!entry) {
      return;
    }
    entry.revealedAt = this.clock() - this.startedAt;
    entry.viewed = true;
    const isLast = this.revealIndex === this.entries.length - 1;
    this.events.emit('card:reveal', {
      card: entry.card,
      index: this.revealIndex,
      tier: entry.tier,
      isLast,
    });
    if (entry.tier >= this.hitFrom) {
      this.events.emit('hit', { card: entry.card, tier: entry.tier });
    }
  }

  /**
   * Vuelve del rasgado a elegir otro sobre. Solo antes de pedir las cartas (después ya no hay vuelta atrás). Devuelve si lo hizo.
   */
  backToSelect(): boolean {
    const select = this.steps.indexOf('select');
    if (this.currentPhase !== 'tear' || this.hasCards || select < 0) {
      return false;
    }
    this.goToStep(select);
    return true;
  }

  private nextStep(): void {
    this.goToStep(this.stepIndex + 1);
  }

  private goToStep(index: number): void {
    const step = this.steps[index];
    if (!step) {
      this.finish(this.skipped ? 'skipped' : 'completed', null);
      return;
    }
    this.stepIndex = index;
    if (!this.hasCards && step !== 'tear' && step !== 'select') {
      this.pendingStep = index;
      this.setPhase('redeeming');
      return;
    }
    this.setPhase(step);
  }

  private setPhase(to: Phase): void {
    const from = this.currentPhase;
    this.currentPhase = to;
    this.events.emit('phase', { from, to });
  }

  private finish(outcome: OpenResult['outcome'], actionId: string | null): OpenResult {
    const best = this.entries.reduce<RevealedCard | null>(
      (acc, entry) => (acc === null || entry.tier >= acc.tier ? entry : acc),
      null,
    );
    const result: OpenResult = {
      outcome,
      cards: this.entries.map((entry) => ({ ...entry })),
      bestPull: best ? { card: best.card, tier: best.tier } : null,
      actionId,
      durationMs: this.clock() - this.startedAt,
      skipped: this.skipped,
      interactions: { tearAttempts: this.tearAttempts, taps: this.taps },
    };
    if (this.packId !== undefined) {
      result.packId = this.packId;
    }
    if (this.lastError) {
      result.error = this.lastError;
    }
    this.result = result;
    this.setPhase('done');
    if (actionId !== null) {
      this.events.emit('action', { id: actionId, result });
    }
    this.events.emit('complete', result);
    return result;
  }
}

export function createOpeningSession(options: SessionOptions): OpeningSession {
  return new OpeningSession(options);
}
