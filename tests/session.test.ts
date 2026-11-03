import { describe, expect, it } from 'vitest';
import { createOpeningSession, generic5 } from '../src';
import type { CardInput, OpenResult, Phase } from '../src';

const cards: CardInput[] = [
  { id: 'a', image: 'a.png', rarity: 'legendary', meta: { slot: 1 } },
  { id: 'b', image: 'b.png', rarity: 'common' },
  { id: 'c', image: 'c.png', rarity: 'rare' },
];

function make(flow = {}) {
  let t = 1000;
  const session = createOpeningSession({
    cards,
    tiers: generic5,
    packId: 'pack-1',
    flow,
    now: () => (t += 10),
  });
  const phases: Phase[] = [];
  session.events.on('phase', ({ to }) => phases.push(to));
  return { session, phases };
}

describe('OpeningSession', () => {
  it('ordena de menor a mayor tier (la más rara al final)', () => {
    const { session } = make();
    expect(session.ordered.map((e) => e.card.id)).toEqual(['b', 'c', 'a']);
  });

  it('respeta sortByTier: false', () => {
    const { session } = make({ sortByTier: false });
    expect(session.ordered.map((e) => e.card.id)).toEqual(['a', 'b', 'c']);
  });

  it('recorre tear → stack → fan → summary → done', () => {
    const { session, phases } = make();
    let result: OpenResult | undefined;
    session.events.on('complete', (r) => (result = r));

    session.start();
    session.reportTearProgress(1);
    session.advance();
    session.advance();
    session.advance();
    session.finishFan();
    session.chooseAction('collect');

    expect(phases).toEqual(['tear', 'stack', 'fan', 'summary', 'done']);
    expect(result?.outcome).toBe('completed');
    expect(result?.actionId).toBe('collect');
    expect(result?.packId).toBe('pack-1');
    expect(result?.bestPull?.card.id).toBe('a');
    expect(result?.bestPull?.card.meta).toEqual({ slot: 1 });
    expect(result?.cards.every((c) => c.viewed && c.revealedAt !== null)).toBe(true);
    expect(result?.interactions.taps).toBe(3);
  });

  it('emite card:reveal con isLast y hit solo desde hitFrom', () => {
    const { session } = make();
    const reveals: boolean[] = [];
    const hits: string[] = [];
    session.events.on('card:reveal', (e) => reveals.push(e.isLast));
    session.events.on('hit', (e) => hits.push(e.card.id));

    session.start();
    session.reportTearProgress(1);
    session.advance();
    session.advance();
    session.advance();

    expect(reveals).toEqual([false, false, true]);
    expect(hits).toEqual(['a']);
  });

  it('skip va al resumen y marca las cartas como no vistas', () => {
    const { session, phases } = make();
    let result: OpenResult | undefined;
    session.events.on('complete', (r) => (result = r));

    session.start();
    session.reportTearProgress(1);
    session.advance();
    session.skip();
    session.chooseAction('collect');

    expect(phases).toEqual(['tear', 'stack', 'summary', 'done']);
    expect(result?.outcome).toBe('skipped');
    expect(result?.skipped).toBe(true);
    expect(result?.cards.map((c) => c.viewed)).toEqual([true, false, false]);
    expect(result?.cards[1]?.revealedAt).toBeNull();
  });

  it('cuenta los intentos de rasgado abandonados', () => {
    const { session } = make();
    let result: OpenResult | undefined;
    session.events.on('complete', (r) => (result = r));

    session.start();
    session.reportTearAbandoned();
    session.reportTearAbandoned();
    session.abort();

    expect(result?.outcome).toBe('aborted');
    expect(result?.interactions.tearAttempts).toBe(2);
  });

  it('steps personalizados: solo stack termina al revelar la última', () => {
    const { session, phases } = make({ steps: ['stack'] });
    let done = false;
    session.events.on('complete', () => (done = true));

    session.start();
    session.revealAll();

    expect(phases).toEqual(['stack', 'done']);
    expect(done).toBe(true);
  });

  it('avisa de ids duplicados y rarezas desconocidas al iniciar', () => {
    const session = createOpeningSession({
      cards: [
        { id: 'x', image: '1.png', rarity: 'Mythic' },
        { id: 'x', image: '2.png' },
      ],
      tiers: generic5,
    });
    const codes: string[] = [];
    session.events.on('warning', (w) => codes.push(w.code));
    session.start();
    expect(codes.sort()).toEqual(['DUPLICATE_CARD_ID', 'UNKNOWN_RARITY']);
  });

  it('ignora gestos fuera de su fase', () => {
    const { session } = make();
    session.advance();
    session.finishFan();
    expect(session.phase).toBe('idle');
    session.start();
    session.advance();
    expect(session.phase).toBe('tear');
  });
});

describe('OpeningSession sin cartas iniciales', () => {
  it('espera en redeeming hasta provideCards y continúa con el paso pendiente', () => {
    const session = createOpeningSession({ tiers: generic5 });
    const phases: Phase[] = [];
    session.events.on('phase', ({ to }) => phases.push(to));

    session.start();
    session.reportTearProgress(1);
    expect(session.phase).toBe('redeeming');
    expect(session.ordered).toEqual([]);

    session.provideCards(cards, 'srv-1');
    expect(phases).toEqual(['tear', 'redeeming', 'stack']);
    expect(session.ordered.map((e) => e.card.id)).toEqual(['b', 'c', 'a']);
  });

  it('si las cartas llegan durante el rasgado no pasa por redeeming', () => {
    const session = createOpeningSession({ tiers: generic5 });
    const phases: Phase[] = [];
    session.events.on('phase', ({ to }) => phases.push(to));
    session.start();
    session.provideCards(cards);
    session.reportTearProgress(1);
    expect(phases).toEqual(['tear', 'stack']);
  });

  it('skip se ignora mientras no hay cartas; abort tras fail da outcome failed', () => {
    const session = createOpeningSession({ tiers: generic5 });
    let result: OpenResult | undefined;
    session.events.on('complete', (r) => (result = r));
    session.start();
    session.skip();
    expect(session.phase).toBe('tear');
    session.reportTearProgress(1);
    session.fail({ code: 'REDEEM_FAILED', message: 'x' });
    session.abort();
    expect(result?.outcome).toBe('failed');
    expect(result?.error?.message).toBe('x');
  });

  it('ignora una segunda llamada a provideCards', () => {
    const session = createOpeningSession({ tiers: generic5, cards });
    session.provideCards([{ id: 'z', image: 'z.png' }]);
    expect(session.ordered).toHaveLength(3);
  });
});

describe('volver a elegir otro sobre', () => {
  const makeSelectable = (withCards: boolean) => {
    const session = createOpeningSession({ tiers: generic5, selectable: true, flow: {}, ...(withCards ? { cards } : {}) });
    const phases: Phase[] = [];
    session.events.on('phase', ({ to }) => phases.push(to));
    session.start();
    return { session, phases };
  };

  it('del rasgado regresa a la selección mientras no se hayan pedido las cartas', () => {
    const { session, phases } = makeSelectable(false);
    session.choosePack('p1', 'code-1');
    expect(session.phase).toBe('tear');

    expect(session.backToSelect()).toBe(true);
    expect(session.phase).toBe('select');
    expect(phases).toEqual(['select', 'tear', 'select']);

    session.choosePack('p2', 'code-2');
    expect(session.phase).toBe('tear');
  });

  it('no regresa si ya hay cartas ni si no se está rasgando', () => {
    const selecting = makeSelectable(false);
    expect(selecting.session.backToSelect()).toBe(false);

    const withCards = makeSelectable(true);
    withCards.session.choosePack('p1', 'code-1');
    expect(withCards.session.phase).toBe('tear');
    expect(withCards.session.backToSelect()).toBe(false);
  });
});
