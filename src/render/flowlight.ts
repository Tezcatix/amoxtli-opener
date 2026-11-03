/**
 * "Luz fluida" WebGL a lo largo del corte: una franja luminosa cuyo ANCHO fluye y respira, con
 * paquetes de brillo que corren por la rotura. La GPU hace el degradado suave y la animación.
 * `createFlowLight` devuelve null si no hay WebGL (el host cae al trazo SVG).
 *
 * Adaptado de OpenPack (Luango, `src/flowlight.js`) con permiso del autor. Ver NOTICE.md.
 */
const VERT = `
attribute vec2 aPos;
attribute float aU;
attribute float aV;
attribute float aTaper;
uniform vec2 uVB;
varying float vU; varying float vV; varying float vTaper;
void main() {
  vU = aU; vV = aV; vTaper = aTaper;
  vec2 clip = vec2(aPos.x / uVB.x * 2.0 - 1.0, 1.0 - aPos.y / uVB.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
varying float vU; varying float vV; varying float vTaper;
uniform float uTime;
uniform vec3 uTint;
void main() {
  float edge = max(0.0, 1.0 - abs(vV));
  float body = pow(edge, 1.6);
  float hot  = pow(edge, 3.5);
  float streak = 0.5 + 0.5 * sin(vU * 16.0 - uTime * 7.5);
  streak *= 0.6 + 0.4 * sin(vU * 8.0 - uTime * 3.3);
  float g = 0.5 + 0.5 * sin(vU * 11.0 - uTime * 10.0);
  float glint = smoothstep(0.55, 1.0, g) * g;
  float breathe = 0.85 + 0.2 * sin(uTime * 2.6);
  float i = body * (1.0 + 1.2 * streak) * breathe * vTaper;
  i += body * glint * 1.5 * vTaper;
  i += hot * 1.1 * vTaper;
  vec3 white = vec3(1.0, 1.0, 0.96);
  vec3 col = mix(uTint, white, pow(edge, 1.4));
  col += hot * vec3(0.5, 0.5, 0.55);
  gl_FragColor = vec4(col * i, i);
}`;

const HALF_WIDTH = 38;
/** Apertura (en unidades de la caja) a la que la luz llega a su intensidad máxima. */
export const FLOW_FULL_OPEN = 10;

export interface FlowPoint {
  x: number;
  y: number;
}

export interface FlowLight {
  setViewBox(width: number, height: number): void;
  resize(): void;
  setPath(points: FlowPoint[], openWidth: number): void;
  setTint(color: string): void;
  stop(): void;
  dispose(): void;
}

function parseColor(color: string): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(color);
  if (!match) {
    return [1, 0.8, 0.38];
  }
  const n = parseInt(match[1]!, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function createFlowLight(canvas: HTMLCanvasElement, tint = '#ffc83d'): FlowLight | null {
  let gl: WebGLRenderingContext | null = null;
  try {
    const attributes = { premultipliedAlpha: false, alpha: true, antialias: false };
    gl =
      (canvas.getContext?.('webgl', attributes) as WebGLRenderingContext | null) ??
      (canvas.getContext?.('experimental-webgl', attributes) as WebGLRenderingContext | null) ??
      null;
  } catch {
    return null;
  }
  if (!gl) {
    return null;
  }
  const context = gl;

  const compile = (type: number, source: string): WebGLShader | null => {
    const shader = context.createShader(type);
    if (!shader) {
      return null;
    }
    context.shaderSource(shader, source);
    context.compileShader(shader);
    return context.getShaderParameter(shader, context.COMPILE_STATUS) ? shader : null;
  };
  const vs = compile(context.VERTEX_SHADER, VERT);
  const fs = compile(context.FRAGMENT_SHADER, FRAG);
  const program = context.createProgram();
  if (!vs || !fs || !program) {
    return null;
  }
  context.attachShader(program, vs);
  context.attachShader(program, fs);
  context.linkProgram(program);
  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    return null;
  }
  context.useProgram(program);

  const aPos = context.getAttribLocation(program, 'aPos');
  const aU = context.getAttribLocation(program, 'aU');
  const aV = context.getAttribLocation(program, 'aV');
  const aTaper = context.getAttribLocation(program, 'aTaper');
  const uVB = context.getUniformLocation(program, 'uVB');
  const uTime = context.getUniformLocation(program, 'uTime');
  const uTint = context.getUniformLocation(program, 'uTint');

  const buffer = context.createBuffer();
  const STRIDE = 5 * 4;
  context.bindBuffer(context.ARRAY_BUFFER, buffer);
  [
    [aPos, 2, 0],
    [aU, 1, 8],
    [aV, 1, 12],
    [aTaper, 1, 16],
  ].forEach(([location, size, offset]) => {
    context.enableVertexAttribArray(location!);
    context.vertexAttribPointer(location!, size!, context.FLOAT, false, STRIDE, offset!);
  });
  context.enable(context.BLEND);
  context.blendFunc(context.SRC_ALPHA, context.ONE);
  context.clearColor(0, 0, 0, 0);
  context.uniform3f(uTint, ...parseColor(tint));

  let box = { w: 300, h: 500 };
  let path: FlowPoint[] = [];
  let openWidth = 0;
  let raf: number | null = null;
  let t0: number | null = null;
  let lost = false;

  const onLost = (event: Event): void => {
    event.preventDefault();
    lost = true;
    stop();
  };
  canvas.addEventListener('webglcontextlost', onLost);

  const buildMesh = (t: number): Float32Array | null => {
    const n = path.length;
    if (n < 2) {
      return null;
    }
    const cumulative = [0];
    let total = 0;
    for (let i = 1; i < n; i++) {
      total += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y);
      cumulative.push(total);
    }
    if (total < 1) {
      return null;
    }
    const open = Math.max(0, Math.min(1, openWidth / FLOW_FULL_OPEN));
    const vertices = new Float32Array(n * 2 * 5);
    let o = 0;
    for (let i = 0; i < n; i++) {
      const a = path[Math.max(0, i - 1)]!;
      const b = path[Math.min(n - 1, i + 1)]!;
      let nx = -(b.y - a.y);
      let ny = b.x - a.x;
      const length = Math.hypot(nx, ny) || 1;
      nx /= length;
      ny /= length;
      const s = cumulative[i]! / total;
      let flow = 0.5 + 0.34 * Math.sin(s * 9 - t * 3) + 0.18 * Math.sin(s * 17 + t * 2 + 1.7);
      flow = Math.max(0.3, Math.min(1, flow));
      const tip = s < 0.7 ? 1 : Math.max(0, 1 - (s - 0.7) / 0.3);
      const halfWidth = HALF_WIDTH * flow * tip * (0.65 + 0.35 * open);
      const taper = (0.5 + 0.5 * open) * tip;
      const p = path[i]!;
      vertices.set([p.x + nx * halfWidth, p.y + ny * halfWidth, s, -1, taper], o);
      o += 5;
      vertices.set([p.x - nx * halfWidth, p.y - ny * halfWidth, s, 1, taper], o);
      o += 5;
    }
    return vertices;
  };

  const frame = (timestamp: number): void => {
    if (lost) {
      raf = null;
      return;
    }
    t0 ??= timestamp;
    const t = (timestamp - t0) / 1000;
    context.clear(context.COLOR_BUFFER_BIT);
    const mesh = buildMesh(t);
    if (mesh) {
      context.uniform2f(uVB, box.w, box.h);
      context.uniform1f(uTime, t);
      context.bindBuffer(context.ARRAY_BUFFER, buffer);
      context.bufferData(context.ARRAY_BUFFER, mesh, context.DYNAMIC_DRAW);
      context.drawArrays(context.TRIANGLE_STRIP, 0, mesh.length / 5);
    }
    raf = requestAnimationFrame(frame);
  };

  function stop(): void {
    path = [];
    openWidth = 0;
    if (raf !== null) {
      cancelAnimationFrame(raf);
      raf = null;
    }
    t0 = null;
    try {
      context.clear(context.COLOR_BUFFER_BIT);
    } catch {
      /* contexto perdido */
    }
  }

  return {
    setViewBox(width, height) {
      if (width && height) {
        box = { w: width, h: height };
      }
    },
    resize() {
      const dpr = Math.min(2, canvas.ownerDocument.defaultView?.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      context.viewport(0, 0, canvas.width, canvas.height);
    },
    setPath(points, width) {
      path = points;
      openWidth = width;
      if (!lost && path.length >= 2 && raf === null) {
        raf = requestAnimationFrame(frame);
      }
    },
    setTint(color) {
      context.uniform3f(uTint, ...parseColor(color));
    },
    stop,
    dispose() {
      stop();
      canvas.removeEventListener('webglcontextlost', onLost);
    },
  };
}
