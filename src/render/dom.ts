/** Crea un elemento con su clase y atributos. */
export function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className?: string,
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) {
    node.className = className;
  }
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

/** Escucha un evento y devuelve nada: quien lo entrega se encarga de quitarlo al terminar la fase. */
export type Listen = <E extends EventTarget>(
  target: E,
  type: string,
  handler: (event: never) => void,
  opts?: AddEventListenerOptions,
) => void;
