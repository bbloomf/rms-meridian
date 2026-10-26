// The opening's night scene: the Meridian sailing in under the stars.
// Everything is placed in an 800 × 450 frame with the waterline at y 336.
// The svg letterboxes that frame ("meet"), and the sky, sea and stars run far
// past it, so any screen shape shows the whole ship with nothing cut off.

const WATER = 336;

/** A repeatable random stream, so the sky doesn't reshuffle between visits. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Twinkling stars over the frame, and fainter still ones beyond it for wide or tall screens. */
function stars(): string {
  const r = seeded(7);
  const near = Array.from({ length: 70 }, () => {
    const x = (r() * 800).toFixed(0);
    const y = (r() * 230).toFixed(0);
    return `<circle class="star" style="--d:${(r() * 3).toFixed(2)}s" cx="${x}" cy="${y}" r="${(0.6 + r() * 1.1).toFixed(1)}" opacity="${(0.4 + r() * 0.6).toFixed(2)}"/>`;
  });
  const far: string[] = [];
  while (far.length < 220) {
    const x = -400 + r() * 1600;
    const y = -420 + r() * 660;
    if (x >= 0 && x <= 800 && y >= 0) continue;
    far.push(`<circle class="star still" cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(0.5 + r() * 0.9).toFixed(1)}" opacity="${(0.3 + r() * 0.5).toFixed(2)}"/>`);
  }
  return near.join("") + far.join("");
}

/** A row of lit windows: `n` of them from `x`, `gap` apart. `--i` staggers when each lights. */
const lamps = (n: number, x: number, y: number, gap: number, w: number, h: number, phase: number) =>
  Array.from({ length: n }, (_, i) => `<rect class="lamp" style="--i:${(i * 7 + phase) % 17}" x="${x + i * gap}" y="${y}" width="${w}" height="${h}" rx="1"/>`).join("");

// Funnels stand on the boat deck (y 230), raked aft to match the masts.
const FUNNELS = [312, 382, 452, 522];
const FUNNEL_H = 84;
const RAKE = -6.8; // degrees of skew: the top sits 10 units aft of the base

function funnels(): string {
  return FUNNELS.map(
    (x) => `<g transform="translate(${x} 230) skewX(${RAKE})"><rect class="funnel" y="${-FUNNEL_H}" width="30" height="${FUNNEL_H + 2}"/><rect class="funnel-top" y="${-FUNNEL_H}" width="30" height="15"/></g>`,
  ).join("");
}

/** Smoke from the first three funnels; the fourth, like the Olympic's, is only a ventilator. */
function smoke(): string {
  const puffs = FUNNELS.slice(0, 3).flatMap((x, f) =>
    Array.from({ length: 6 }, (_, k) => `<ellipse class="puff" style="--i:${k + f * 0.33}" cx="${x + 25}" cy="${230 - FUNNEL_H - 4}" rx="8" ry="5"/>`),
  );
  return `<g class="plume" filter="url(#c-smoke)">${puffs.join("")}</g>`;
}

/** Lifeboats along the boat deck, which the opening line is about, each hung from a pair of davits. */
const boats = () =>
  Array.from({ length: 8 }, (_, i) => {
    const x = 300 + i * 40;
    return `<path class="davit" d="M${x - 8} 230v-9q0-2 2-2M${x + 8} 230v-9q0-2-2-2"/><path class="boat" d="M${x - 9} 223.5h18q-1 4.5-4.5 5.5h-9q-3.5-1-4.5-5.5z"/>`;
  }).join("");

function ship(): string {
  return `<g class="ship"><g class="bob">
    <path class="rigging" d="M188 96L656 100M188 96L100 276M656 100L704 282"/>
    <path class="mast" d="M172 286L188 96M640 290L656 100"/>
    <rect class="nest"x="178" y="166" width="8" height="6"/>
    ${funnels()}
    <path class="super" d="M196 290V254H226V230H590V254H612V270H652V290Z"/>
    <path class="super" d="M228 231V214H290V231ZM220 211H298V215H220Z"/>
    ${boats()}
    <path class="hull" d="M100 276Q170 289 260 290H560Q650 290 704 282C714 300 708 322 688 336L684 350H118Z"/>
    <path class="trim" d="M101.5 281Q170 294 260 295H560Q650 295 706 287"/>
    ${lamps(39, 136, 300, 14, 4, 3.4, 0)}${lamps(38, 143, 313, 14, 4, 3.4, 5)}
    ${lamps(29, 206, 263, 14, 8, 6, 3)}${lamps(2, 620, 276, 14, 8, 5, 9)}
    ${lamps(25, 234, 237, 14, 7, 5, 11)}${lamps(7, 233, 219, 8, 5, 3, 1)}
    <circle class="navlight" cx="186.7" cy="112" r="1.8"/><circle class="navlight" cx="654.7" cy="116" r="1.8"/>
    <circle class="navlight port" cx="221" cy="213" r="1.8"/>
    ${smoke()}
  </g></g>`;
}

// The moon hangs clear of the stern, so its path on the water doesn't run into the ship.
const MOON = { x: 752, y: 58, r: 20 };

/** The moon's path on the water: broken strokes, spreading as they come nearer, that shimmer in turn. */
const glints = () =>
  [
    [3, 0, 8], [7, -3, 12], [12, 4, 10], [18, -2, 16], [25, 5, 12], [33, -5, 20],
    [42, 2, 14], [52, -3, 24], [63, 6, 16], [76, -4, 26], [91, 3, 20],
  ]
    .map(([dy, dx, w], i) => `<path class="glint" style="--i:${i}" d="M${MOON.x + dx - w / 2} ${WATER + dy}h${w}"/>`)
    .join("");

function sea(): string {
  const waves = [350, 372, 396, 424, 462, 504, 552, 606, 666, 732]
    .map((y, i) => `<path class="wave" style="--i:${i % 4}" d="M-1000 ${y}${"q25 -6 50 0t50 0".repeat(28)}"/>`)
    .join("");
  return `<g class="sea"><rect class="water" x="-1000" y="${WATER}" width="2800" height="1200"/>${glints()}${waves}</g>`;
}

/** Foam at the bow and a wake astern; it travels with the ship and settles as she slows. */
const wake = () => `<g class="ship ship-fx">
    <path class="foam" d="M116 337q12-3 26-1t26 0"/>
    <g class="wake"><path d="M690 338C740 337 800 340 900 344"/><path d="M694 342C760 343 830 349 940 356"/><path d="M700 347C770 350 860 360 980 370"/></g>
  </g>`;

export function nightScene(): string {
  // The frame starts 100 above the scene so the titles have clear sky above the mastheads.
  return `<svg class="night" viewBox="0 -100 800 550" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs><filter id="c-smoke" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5"/></filter></defs>
      <g class="sky">${stars()}<circle class="moon" cx="${MOON.x}" cy="${MOON.y}" r="${MOON.r}"/></g>
      ${ship()}
      ${sea()}
      ${wake()}
    </svg>`;
}
