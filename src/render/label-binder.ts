import type { LabelKey, Labels } from '../types';

export interface LabelBinder {
  /** Pone el texto de una etiqueta en un nodo (con `format` si lleva más texto) y lo mantiene al día cuando cambian los textos. */
  bindText(node: Node, key: LabelKey, format?: (text: string) => string): void;
  /** Igual que `bindText` pero para un atributo (p. ej. `aria-label`). */
  bindAttr(node: Element, attribute: string, key: LabelKey): void;
  /** Repinta lo que sigue en pantalla con los textos actuales y olvida lo que ya se quitó del DOM. */
  refresh(): void;
}

/**
 * Liga textos y atributos a las etiquetas de `labels` (un objeto que se modifica en sitio con `update({ labels })`): al llamar a `refresh`
 * todo lo que sigue conectado al documento se repinta con el texto nuevo.
 */
export function createLabelBinder(labels: Labels): LabelBinder {
  const bindings = new Set<{ node: Node; apply: () => void }>();
  const track = (node: Node, apply: () => void): void => {
    apply();
    bindings.add({ node, apply });
  };
  return {
    bindText(node, key, format = (text) => text) {
      track(node, () => {
        node.textContent = format(labels[key]);
      });
    },
    bindAttr(node, attribute, key) {
      track(node, () => node.setAttribute(attribute, labels[key]));
    },
    refresh() {
      bindings.forEach((binding) => {
        if (binding.node.isConnected) {
          binding.apply();
        } else {
          bindings.delete(binding);
        }
      });
    },
  };
}
