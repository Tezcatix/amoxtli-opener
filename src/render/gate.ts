import type { GateField, GateOptions } from '../types';
import { el } from './dom';

/** Una puerta de entrada abierta: `result` se resuelve con lo escrito (ya validado) o con `null` si la persona se retiró; `dispose` la cierra sin resultado. */
export interface GateHandle {
  result: Promise<Record<string, string> | null>;
  dispose(): void;
}

const fieldId = (index: number, name: string): string => `ao-gate-${index}-${name.replace(/[^a-z0-9_-]/gi, '')}`;

const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

/** Deja pasar solo rutas relativas y los esquemas http(s), mailto y tel: un `javascript:` o `data:` en un enlace se descarta. */
export function isSafeHref(href: string): boolean {
  const value = href.trim();
  if (value === '' || /^(\/(?!\/)|\.{0,2}\/|[#?])/.test(value)) {
    return true;
  }
  try {
    return SAFE_PROTOCOLS.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const readValue = (field: GateField, input: HTMLInputElement): string => {
  if (field.type === 'checkbox') {
    return input.checked ? 'true' : '';
  }
  const value = input.value.trim();
  return field.transform === 'uppercase' ? value.toUpperCase() : value;
};

let gateCount = 0;

/** Título y mensaje del formulario; sin título, el formulario se nombra con el texto del botón para los lectores de pantalla. */
function buildHeader(doc: Document, form: HTMLElement, gate: GateOptions): void {
  if (gate.title) {
    const titleId = `ao-gate-title-${++gateCount}`;
    const heading = el(doc, 'h2', 'ao-gate__title', { id: titleId });
    heading.textContent = gate.title;
    form.setAttribute('aria-labelledby', titleId);
    form.append(heading);
  } else {
    form.setAttribute('aria-label', gate.submitLabel ?? 'Continue');
  }
  if (gate.message) {
    const message = el(doc, 'p', 'ao-gate__message');
    message.textContent = gate.message;
    form.append(message);
  }
}

/** Un campo con su etiqueta, enlaces y ayuda; devuelve el contenedor y su `<input>`. */
function buildField(doc: Document, field: GateField, index: number): { wrapper: HTMLElement; input: HTMLInputElement } {
  const required = field.required ?? true;
  const id = fieldId(index, field.name);
  const checkbox = field.type === 'checkbox';
  const wrapper = el(doc, 'div', checkbox ? 'ao-gate__field ao-gate__field--check' : 'ao-gate__field');
  const label = el(doc, 'label', 'ao-gate__label', { for: id });
  label.textContent = required && !checkbox ? `${field.label} *` : field.label;
  const input = el(doc, 'input', checkbox ? 'ao-gate__check' : 'ao-gate__input', {
    id,
    name: field.name,
    type: field.type ?? 'text',
    autocomplete: field.autocomplete ?? 'off',
  });
  if (field.placeholder) {
    input.placeholder = field.placeholder;
  }
  if (field.maxLength) {
    input.maxLength = field.maxLength;
  }
  if (field.transform === 'uppercase') {
    input.style.textTransform = 'uppercase';
  }
  if (required) {
    input.setAttribute('aria-required', 'true');
  }
  wrapper.append(...(checkbox ? [input, label] : [label, input]));
  const safeLinks = (field.links ?? []).filter((candidate) => isSafeHref(candidate.href));
  if (safeLinks.length > 0) {
    const links = el(doc, 'span', 'ao-gate__links');
    for (const link of safeLinks) {
      const anchor = el(doc, 'a', undefined, { href: link.href, target: '_blank', rel: 'noopener noreferrer' });
      anchor.textContent = link.label;
      links.append(anchor);
    }
    wrapper.append(links);
  }
  if (field.help) {
    const help = el(doc, 'small', 'ao-gate__help');
    help.textContent = field.help;
    wrapper.append(help);
  }
  return { wrapper, input };
}

/**
 * Pinta el formulario previo a la experiencia dentro de `root` y espera a que la persona lo complete. Comprueba los campos obligatorios y, si hay
 * `validate`, la espera (mostrando `busyLabel`); un error de `validate` se muestra en el formulario y no deja continuar. Cuando termina (o se retira)
 * quita su DOM. No toca el resto de la librería: la experiencia empieza después, con los valores en `redeem(code, { gate })`.
 */
export function runGate(doc: Document, root: HTMLElement, gate: GateOptions, signal: AbortSignal): GateHandle {
  const form = el(doc, 'form', 'ao-gate', { novalidate: '', role: 'dialog', 'aria-modal': 'true' });
  buildHeader(doc, form, gate);

  const inputs = new Map<GateField, HTMLInputElement>();
  gate.fields.forEach((field, index) => {
    const { wrapper, input } = buildField(doc, field, index);
    inputs.set(field, input);
    form.append(wrapper);
  });

  const error = el(doc, 'p', 'ao-gate__error', { role: 'alert' });
  error.hidden = true;
  const actions = el(doc, 'div', 'ao-gate__actions');
  const cancel = el(doc, 'button', 'ao-btn', { type: 'button' });
  cancel.textContent = gate.cancelLabel ?? 'Cancel';
  const submit = el(doc, 'button', 'ao-btn ao-btn--primary', { type: 'submit' });
  const submitText = gate.submitLabel ?? 'Continue';
  submit.textContent = submitText;
  actions.append(cancel, submit);
  form.append(error, actions);

  let settled = false;
  let busy = false;
  let resolve: (values: Record<string, string> | null) => void = () => undefined;
  const result = new Promise<Record<string, string> | null>((done) => {
    resolve = done;
  });

  const close = (values: Record<string, string> | null): void => {
    if (settled) {
      return;
    }
    settled = true;
    root.removeAttribute('data-ao-gate');
    form.remove();
    resolve(values);
  };

  const showError = (text: string): void => {
    error.textContent = text;
    error.hidden = false;
  };

  const setBusy = (value: boolean): void => {
    busy = value;
    submit.disabled = value;
    cancel.disabled = value;
    submit.textContent = value ? (gate.busyLabel ?? 'Checking…') : submitText;
    inputs.forEach((input) => {
      input.readOnly = value;
      if (input.type === 'checkbox') {
        input.disabled = value;
      }
    });
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (busy || settled) {
      return;
    }
    error.hidden = true;

    const values: Record<string, string> = {};
    for (const [field, input] of inputs) {
      const value = readValue(field, input);
      if ((field.required ?? true) && value === '') {
        showError((field.requiredMessage ?? gate.requiredMessage ?? 'Fill in: {label}').replace('{label}', field.label));
        input.focus();
        return;
      }
      Object.defineProperty(values, field.name, { value, enumerable: true, writable: true, configurable: true });
    }

    if (!gate.validate) {
      close(values);
      return;
    }

    setBusy(true);
    Promise.resolve()
      .then(() => gate.validate?.(values, { signal }))
      .then(() => close(values))
      .catch((cause: unknown) => {
        if (settled) {
          return;
        }
        setBusy(false);
        showError(cause instanceof Error ? cause.message : String(cause));
      });
  });
  cancel.addEventListener('click', () => {
    if (!busy) {
      close(null);
    }
  });
  form.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Escape' && !busy) {
      close(null);
    }
  });

  root.setAttribute('data-ao-gate', '');
  root.append(form);
  inputs.values().next().value?.focus();

  return { result, dispose: () => close(null) };
}
