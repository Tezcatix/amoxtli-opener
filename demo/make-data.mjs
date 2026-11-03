// Genera los datos falsos de la demo: demo/data/packs.json y demo/data/cards/*.svg
// Uso: node demo/make-data.mjs
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), 'data');
// Se borran las cartas anteriores: si baja el número de sobres no deben quedar SVG huérfanos.
rmSync(resolve(root, 'cards'), { recursive: true, force: true });
mkdirSync(resolve(root, 'cards'), { recursive: true });

const TIER_COLORS = {
  Common: '#9ca3af', Uncommon: '#cbd5e1', Rare: '#60a5fa', 'Rare Holo': '#4ade80',
  'Double Rare': '#a78bfa', 'Ultra Rare': '#a78bfa', 'Illustration Rare': '#ffc83d',
  'Special Illustration Rare': '#ffd466', 'Hyper Rare': '#fff3c4',
};

const NAMES = [
  'Ajolote de cristal', 'Colibrí solar', 'Jaguar de obsidiana', 'Serpiente emplumada', 'Xoloitzcuintle',
  'Quetzal eléctrico', 'Nopal guardián', 'Coyote lunar', 'Mariposa monarca', 'Tlaloc menor',
  'Venado de jade', 'Águila del alba', 'Tortuga de río', 'Zorro de ceniza', 'Cacomixtle',
  'Lagarto de fuego', 'Murciélago de cueva', 'Mono araña', 'Tucán de selva', 'Pez luna',
  'Oso hormiguero', 'Tapir sabio', 'Rana de lluvia', 'Búho de templo', 'Armadillo de bronce',
  'Cenzontle', 'Tlacuache', 'Gavilán rojo', 'Cangrejo de coral', 'Iguana de roca',
];

/** Cada sobre: código canjeable → cartas. En producción esto vive solo en el servidor. */
const PACKS = [
  { code: 'AMX-DEMO-0001', label: 'Sobre básico', accent: '#8b7bff', rarities: ['Common', 'Common', 'Common', 'Uncommon', 'Uncommon', 'Rare'] },
  { code: 'AMX-DEMO-0002', label: 'Con holo', accent: '#4ade80', rarities: ['Common', 'Common', 'Uncommon', 'Rare', 'Rare Holo', 'Double Rare'] },
  { code: 'AMX-DEMO-0003', label: 'Ultra', accent: '#a78bfa', rarities: ['Common', 'Uncommon', 'Rare', 'Rare Holo', 'Ultra Rare', 'Illustration Rare'] },
  { code: 'AMX-DEMO-0004', label: 'Ilustración especial', accent: '#ffc83d', rarities: ['Common', 'Common', 'Uncommon', 'Rare', 'Rare Holo', 'Special Illustration Rare'] },
  { code: 'AMX-DEMO-0005', label: 'Hiper', accent: '#fff3c4', rarities: ['Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Illustration Rare', 'Hyper Rare'] },
];

function cardSvg(n, name, rarity) {
  const c = TIER_COLORS[rarity] ?? '#9ca3af';
  const hue = (n * 47) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 335">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 45% 22%)"/><stop offset="1" stop-color="#0f1026"/></linearGradient>
    <radialGradient id="glow" cx=".5" cy=".42" r=".5"><stop offset="0" stop-color="${c}" stop-opacity=".55"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="240" height="335" fill="url(#bg)"/>
  <rect width="240" height="335" fill="url(#glow)"/>
  <rect x="9" y="9" width="222" height="317" rx="10" fill="none" stroke="${c}" stroke-width="3"/>
  <circle cx="120" cy="146" r="58" fill="${c}" fill-opacity=".18" stroke="${c}" stroke-width="2"/>
  <text x="120" y="162" text-anchor="middle" font-size="46" font-weight="700" fill="#f4f5f6" font-family="sans-serif">${String(n).padStart(2, '0')}</text>
  <text x="120" y="268" text-anchor="middle" font-size="18" font-weight="700" fill="#f4f5f6" font-family="sans-serif">${name}</text>
  <text x="120" y="292" text-anchor="middle" font-size="12" fill="${c}" font-family="sans-serif">${rarity}</text>
</svg>
`;
}

/** La demo ofrece de 1 a 20 sobres: los 5 de arriba y, a partir del 6, los mismos tipos repetidos con su propio código. */
const TOTAL = 20;
const ALL = Array.from({ length: TOTAL }, (_, i) => {
  if (i < PACKS.length) {
    return PACKS[i];
  }
  const kind = PACKS[i % PACKS.length];
  return { ...kind, code: `AMX-DEMO-${String(i + 1).padStart(4, '0')}`, label: `${kind.label} #${i + 1}` };
});

const packs = {};
let n = 0;
for (const pack of ALL) {
  packs[pack.code] = {
    label: pack.label,
    accent: pack.accent,
    cards: pack.rarities.map((rarity, slot) => {
      const name = NAMES[n % NAMES.length];
      const id = `demo-${String(n + 1).padStart(3, '0')}`;
      writeFileSync(resolve(root, 'cards', `${id}.svg`), cardSvg(n + 1, name, rarity));
      n += 1;
      return { id, name, rarity, isNew: n % 3 === 0, image: `data/cards/${id}.svg`, meta: { slot } };
    }),
  };
}

writeFileSync(resolve(root, 'packs.json'), JSON.stringify({ packs }, null, 2) + '\n');
console.log(`${ALL.length} sobres, ${n} cartas → demo/data`);
