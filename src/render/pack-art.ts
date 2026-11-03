import { PACK_TEMPLATE } from './pack-size';

const H = Math.round(252 / PACK_TEMPLATE.ratio);
const LINE = Math.round(H * PACK_TEMPLATE.strip);

/**
 * Sobre generado por código (placeholder hasta tener arte propio). Devuelve un data URI.
 * Estructura: cuerpo con degradado tornasolado, bandas con rayado arriba y abajo, línea punteada de corte
 * (en `PACK_TEMPLATE.strip`) y un emblema central con anillo, puntos cardinales y estrella de cuatro puntas.
 */
export function defaultPackArt(accent = '#d9a441'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 252 ${H}">
<defs>
<clipPath id="c"><rect width="252" height="${H}" rx="18"/></clipPath>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b4a9e"/><stop offset=".5" stop-color="#2f5f8c"/><stop offset="1" stop-color="#5a3f35"/></linearGradient>
<linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity=".38"/><stop offset="1" stop-color="${accent}" stop-opacity=".05"/></linearGradient>
<linearGradient id="s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<pattern id="b" width="4" height="26" patternUnits="userSpaceOnUse"><rect width="2" height="26" fill="#fff" fill-opacity=".5"/></pattern>
</defs>
<g clip-path="url(#c)">
<rect width="252" height="${H}" fill="#1b1b3a"/>
<rect width="252" height="${H}" fill="url(#g)" fill-opacity=".85"/>
<rect width="252" height="${H}" fill="url(#t)"/>
<rect width="252" height="${H}" fill="url(#s)"/>
<rect y="0" width="252" height="26" fill="#cfc4ff" fill-opacity=".3"/><rect y="0" width="252" height="26" fill="url(#b)"/>
<rect y="${H - 26}" width="252" height="26" fill="#cfc4ff" fill-opacity=".3"/><rect y="${H - 26}" width="252" height="26" fill="url(#b)"/>
<line x1="18" y1="${LINE}" x2="234" y2="${LINE}" stroke="#fff" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="3 4"/>
</g>
<rect x=".75" y=".75" width="250.5" height="${H - 1.5}" rx="17.5" fill="none" stroke="${accent}" stroke-opacity=".8" stroke-width="1.5"/>
<g transform="translate(126 ${Math.round(LINE + (H - LINE - 26) / 2)})">
<circle r="50" fill="#000" fill-opacity=".22"/>
<circle r="62" fill="none" stroke="${accent}" stroke-width="3"/><circle r="62" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="3"/>
<circle r="50" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.2" stroke-dasharray="3 4"/>
<g fill="${accent}" stroke="#fff" stroke-opacity=".5" stroke-width="1"><circle cy="-62" r="4"/><circle cy="62" r="4"/><circle cx="-62" r="4"/><circle cx="62" r="4"/></g>
<path d="M0 -40 L7 -7 L40 0 L7 7 L0 40 L-7 7 L-40 0 L-7 -7 Z" fill="${accent}"/>
<path d="M0 -40 L7 -7 L40 0 L7 7 L0 40 L-7 7 L-40 0 L-7 -7 Z" fill="#fff" fill-opacity=".35"/>
</g>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

