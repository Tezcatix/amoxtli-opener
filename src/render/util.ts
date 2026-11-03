/** Quita las claves con valor `undefined` (un valor sin definir no debe pisar al que ya hay). */
export const definedOnly = <T extends object>(value: T | undefined): Partial<T> =>
  Object.fromEntries(Object.entries(value ?? {}).filter(([, entry]) => entry !== undefined)) as Partial<T>;
