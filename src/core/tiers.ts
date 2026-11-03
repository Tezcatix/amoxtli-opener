import type { CardInput, OpenerWarning, TierSystem } from '../types';

export interface TierResolution {
  tier: number;
  warning?: OpenerWarning;
}

const normalize = (value: unknown): string => String(value).trim().toLowerCase();

/** Lee un campo de la carta por su ruta ('rarity', 'meta.type'…). */
const readPath = (card: CardInput, path: string): unknown =>
  path.split('.').reduce<unknown>((value, key) => (value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined), card);

/** Los valores (normalizados) del dato que se clasifica; una lista de valores cuenta como varios. Los vacíos se descartan. */
function classifiedValues(card: CardInput, system: TierSystem): string[] {
  const field = system.field ?? 'rarity';
  const raw = typeof field === 'function' ? field(card) : readPath(card, field);
  const list = Array.isArray(raw) ? raw : [raw];
  return list.filter((value) => value !== undefined && value !== null && normalize(value) !== '').map(normalize);
}

/** Primer nivel desde el que hay efecto de «golpe»: `hitFrom` si se indicó o, si no, el primer nivel con un `hit` definido. */
export function hitFromOf(system: TierSystem): number {
  if (typeof system.hitFrom === 'number') {
    return system.hitFrom;
  }
  const first = system.levels.findIndex((level) => level.hit !== undefined);
  return first === -1 ? system.levels.length : first;
}

/**
 * Resuelve el tier de una carta: `card.tier` > `resolve()` del sistema > clasificación por niveles. En la clasificación se mira el dato
 * elegido (`field`, por defecto la rareza) y se recorren los niveles del más alto al más bajo: el primero que cumpla alguna de sus reglas
 * gana, sea `when(card)`, un valor exacto de `values` o un fragmento de `keywords`. Un valor sin coincidencia cae al tier 0 pero
 * devuelve un warning en lugar de hacerlo en silencio; una carta sin dato clasificable es tier 0 sin aviso.
 */
export function resolveTier(card: CardInput, system: TierSystem): TierResolution {
  const max = system.levels.length - 1;

  const clamp = (value: number): TierResolution => {
    if (Number.isInteger(value) && value >= 0 && value <= max) {
      return { tier: value };
    }
    return {
      tier: Math.min(Math.max(Math.trunc(value) || 0, 0), max),
      warning: {
        code: 'TIER_OUT_OF_RANGE',
        message: `Tier ${value} fuera de rango 0..${max} para la carta "${card.id}".`,
        detail: { cardId: card.id, tier: value },
      },
    };
  };

  if (typeof card.tier === 'number') {
    return clamp(card.tier);
  }
  if (system.resolve) {
    return clamp(system.resolve(card));
  }

  const values = classifiedValues(card, system);
  for (let index = max; index >= 0; index--) {
    const level = system.levels[index]!;
    if (level.when?.(card)) {
      return { tier: index };
    }
    if (values.length === 0) {
      continue;
    }
    const exact = level.values?.map(normalize) ?? [];
    const fragments = level.keywords?.map(normalize) ?? [];
    if (values.some((value) => exact.includes(value) || fragments.some((fragment) => value.includes(fragment)))) {
      return { tier: index };
    }
  }

  if (values.length === 0) {
    return { tier: 0 };
  }
  return {
    tier: 0,
    warning: {
      code: 'UNKNOWN_RARITY',
      message: `Valor desconocido "${values.join(', ')}" en la carta "${card.id}"; se usa el tier 0.`,
      detail: { cardId: card.id, rarity: card.rarity, value: values },
    },
  };
}
