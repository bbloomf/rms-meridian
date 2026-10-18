// The game's emblem: a brass porthole that is also a magnifying glass, with
// the Meridian steaming past under the moon inside the glass. Drawn with the
// same pen-and-ink kit as the rooms, with brass and one line of red as the only
// colour. `emblem()` is the mark on its own; `lockup()` adds the wordmark.

import { BOLD, FINE, LIGHT, PAPER, SHADE, SHADE_FINE, SOLID, circle, lathe, n, path, poly, range, rng } from "./ink.ts";

const CX = 100;
const CY = 100;
const RIM = 86; // outer edge of the brass ring
const GLASS = 71; // the glass inside it
const SEA = 132; // horizon
const BRASS = ' fill="var(--brass-2)"';
const NIGHT_OUTLINED = ' fill="url(#ink-night)"'; // night tone, outlined

/** A ring sector from angle a0 to a1 (degrees, clockwise from east). */
function ringSector(r0: number, r1: number, a0: number, a1: number): string {
  const p = (r: number, a: number) => `${n(CX + Math.cos((a * Math.PI) / 180) * r)} ${n(CY + Math.sin((a * Math.PI) / 180) * r)}`;
  const big = a1 - a0 > 180 ? 1 : 0;
  return `M${p(r1, a0)}A${r1} ${r1} 0 ${big} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 ${big} 0 ${p(r0, a0)}z`;
}

/** Engraver's sky: horizontal strokes, thinning toward the horizon, broken around the moon. */
function sky(moon: [number, number, number]): string {
  const rand = rng(31);
  const [mx, my, mr] = moon;
  let d = "";
  for (let y = 27; y < SEA - 1; y += 2.3) {
    const p = 0.97 - ((y - 27) / (SEA - 27)) * 0.62;
    let x = 22 + rand() * 6;
    while (x < 178) {
      const len = 5 + rand() * 16;
      if (rand() < p) {
        // Leave a halo round the moon.
        const dy = Math.abs(y - my);
        const halo = mr + 3.5;
        if (dy < halo) {
          const half = Math.sqrt(halo * halo - dy * dy);
          const a = x, b = Math.min(x + len, 178);
          if (a < mx - half) d += `M${n(a)} ${n(y)}H${n(Math.min(b, mx - half))}`;
          if (b > mx + half) d += `M${n(Math.max(a, mx + half))} ${n(y)}H${n(b)}`;
        } else d += `M${n(x)} ${n(y)}h${n(len)}`;
      }
      x += len + 1.5 + rand() * 4;
    }
  }
  return path(d, ' stroke-width=".55" fill="none"');
}

/** The sea: short wave strokes getting denser with depth, a broken path of moonlight, the ship's reflection. */
function sea(moonX: number): string {
  const rand = rng(57);
  let d = "";
  let shine = "";
  for (let y = SEA + 1.6; y < 174; y += 2.1) {
    const depth = (y - SEA) / 40;
    const p = 0.4 + depth * 0.55;
    const lane = 2.5 + depth * 9;
    let x = 22 + rand() * 5;
    while (x < 178) {
      const len = 3 + rand() * 7;
      const mid = x + len / 2;
      const inLane = Math.abs(mid - moonX) < lane;
      const under = mid > 54 && mid < 158 && y < SEA + 9; // the hull's dark reflection
      if (inLane) {
        if (rand() < 0.35) shine += `M${n(x)} ${n(y)}q${n(len / 2)} -.8 ${n(len)} 0`;
      } else if (under || rand() < p) {
        d += `M${n(x)} ${n(y)}q${n(len / 2)} ${under ? -0.5 : -1.1} ${n(len)} 0`;
      }
      x += len + (under ? 0.6 : 1.2 + rand() * 3);
    }
  }
  return path(d, ' stroke-width=".65" fill="none"') + path(shine, ' stroke-width=".3" fill="none"');
}

/** Smoke trailing aft from a funnel top: overlapping puffs, outlined as one cloud. */
function smoke(tops: [number, number][]): string {
  const puffs: [number, number, number][] = [];
  tops.forEach(([x, y], f) => {
    for (const i of range(7 - f)) puffs.push([x + 2 + i * 6.4, y - 2.6 - i * 1.5 - (i % 2) * 0.9, 2.9 + i * 0.95]);
  });
  const outline = puffs.map(([x, y, r]) => circle(x, y, r + 0.7, SOLID)).join("");
  const fill = puffs.map(([x, y, r]) => circle(x, y, r, PAPER + ' stroke="none"')).join("");
  const shade = puffs.map(([x, y, r]) => circle(x + r * 0.25, y + r * 0.4, r * 0.62, SHADE_FINE)).join("");
  return outline + fill + shade;
}

function ship(): string {
  let s = "";
  // Masts and the wireless aerial strung between them.
  s += path("M52 106L56 63M150 101L154 65", LIGHT);
  s += path("M56 64Q105 70 154 66", ' stroke-width=".35" fill="none"');
  s += path("M56 70L62 70M151 72L157 72", FINE);
  s += path("M56 64L42 110M154 66L163 106", ' stroke-width=".3"'); // stays

  // Funnels, raked aft: buff with black tops.
  const funnels = [84, 104, 124];
  const tops: [number, number][] = [];
  for (const x0 of funnels) {
    const x1 = x0 + 11;
    const lean = 4.5;
    const top = 58;
    const base = 92.5;
    const at = (x: number, y: number) => `${n(x + lean * ((base - y) / (base - top)))} ${n(y)}`;
    s += poly([at(x0, base), at(x0, top), at(x1, top), at(x1, base)], BRASS + LIGHT);
    s += poly([at(x0 + 7.5, base), at(x0 + 7.5, top + 7), at(x1, top + 7), at(x1, base)], SHADE);
    s += poly([at(x0, top), at(x1, top), at(x1, top + 7), at(x0, top + 7)], SOLID);
    s += path(`M${at(x0, 90.5)}L${at(x1, 90.5)}`, FINE);
    tops.push([x0 + lean + 5.5, top]);
  }

  // Lifeboats between the funnels.
  for (const x of [97, 117, 137]) {
    s += path(`M${x} 89.6q4.2 3.4 8.4 0z`, PAPER + FINE);
    s += path(`M${x + 0.6} 89.6v-2.4M${x + 7.8} 89.6v-2.4`, FINE);
  }

  // Superstructure: promenade deck, boat deck, bridge.
  s += poly(["60 110.5", "60 99.5", "62 98.6", "151 98.2", "151 110"], PAPER + LIGHT);
  s += path("M62 98.8H151v1.6H61z", SHADE);
  for (let x = 63.5; x < 148; x += 4.2) s += path(`M${n(x)} 102.2h2v3h-2z`, SOLID);
  s += poly(["70 98.6", "70 92.4", "143 92", "143 98.3"], PAPER + LIGHT);
  for (let x = 73; x < 141; x += 3.4) s += circle(x, 95.4, 0.7, SOLID);
  s += poly(["64 92.6", "64 88.6", "66 87.6", "80 87.6", "80 92.5"], PAPER + LIGHT);
  s += path("M66 89.6H79", ' stroke-width="1.3"');

  // Hull: raked stem, sheer rising to the bow, counter stern.
  s += path("M38 103.5Q90 112 135 110.6L163 108.4Q163 120 157 132H52Q42 120 38 103.5z", NIGHT_OUTLINED + BOLD);
  s += path("M40.6 106.6Q90 114.6 135 113.2L161.6 111.2", ' stroke="var(--paper)" stroke-width=".8" fill="none"');
  s += path("M49 128.6H158.4L157 132H52z", ' fill="var(--red)" stroke="none"');
  const rand = rng(12);
  let lit = "";
  for (let x = 56; x < 156; x += 4.3) if (rand() > 0.25) lit += circle(x, 117.6 + (x - 56) * -0.008, 0.85, BRASS + ' stroke="none"');
  for (let x = 62; x < 152; x += 6.1) if (rand() > 0.5) lit += circle(x, 122.6, 0.7, BRASS + ' stroke="none"');
  s += lit;

  // Bow wave.
  s += path("M45 133.4q5 -1.6 11 .4M41 135.8q7 -1.2 15 .6M58 133.6q6 1.2 14 .4", ' stroke="var(--paper)" stroke-width=".7" fill="none"');

  return smoke(tops) + s;
}

function handle(): string {
  // Laid out along +x from the centre, then turned to point down and right.
  const at = (pts: [number, number][]): [number, number][] => pts.map(([r, w]) => [CX + r, w]);
  const collar = lathe(at([[84, 11.6], [88, 11.6], [91, 9.4], [99, 9.4], [102, 11], [106, 11]]), CY);
  const wood = lathe(at([[106, 8.8], [111, 9.8], [131, 10.8], [143, 10.4], [148, 8], [150, 3]]), CY);
  let s = path(collar, BRASS + LIGHT);
  s += path(`M${CX + 84.6} 101H${CX + 105.6}V110.4H${CX + 102.4}L${CX + 99} 108.8H${CX + 91}L${CX + 87.8} 111H${CX + 84.6}z`, SHADE);
  s += path(`M${CX + 91} 90.6V109.4M${CX + 99} 90.6V109.4`, FINE);
  s += path(wood, NIGHT_OUTLINED + LIGHT);
  s += path(`M${CX + 112} 93.8Q${CX + 128} 92.4 ${CX + 143} 94`, ' stroke="var(--paper)" stroke-width="1.2" stroke-opacity=".8" fill="none"');
  return `<g transform="rotate(45 ${CX} ${CY})">${s}</g>`;
}

function rim(): string {
  const ring = `M${CX - RIM} ${CY}a${RIM} ${RIM} 0 1 0 ${RIM * 2} 0a${RIM} ${RIM} 0 1 0 ${-RIM * 2} 0z` +
    `M${CX - GLASS} ${CY}a${GLASS} ${GLASS} 0 1 1 ${GLASS * 2} 0a${GLASS} ${GLASS} 0 1 1 ${-GLASS * 2} 0z`;
  let s = path(ring, BRASS + ' fill-rule="evenodd" stroke="none"');
  s += path(ringSector(GLASS, RIM, -40, 140), SHADE); // the side away from the light
  s += path(ringSector(GLASS, GLASS + 4, 140, 320), ' fill="url(#ink-hatch-fine)" stroke="none"'); // inner bevel in shadow
  s += circle(CX, CY, RIM, ' fill="none"' + BOLD);
  s += circle(CX, CY, RIM - 2.6, ' fill="none"' + FINE);
  s += circle(CX, CY, GLASS + 4, ' fill="none"' + FINE);
  s += circle(CX, CY, GLASS, ' fill="none" stroke-width="1.5"');
  for (const i of range(12)) {
    const a = ((i * 30 + 15) * Math.PI) / 180;
    const x = CX + Math.cos(a) * 80.2;
    const y = CY + Math.sin(a) * 80.2;
    s += circle(x, y, 2.3, BRASS + FINE);
    s += circle(x + 0.5, y + 0.6, 1.5, SHADE_FINE);
    s += circle(x - 0.7, y - 0.7, 0.55, PAPER + ' stroke="none"');
  }
  return s;
}

/** The mark alone, in a 208-unit square with the lens centred at 94, 94. */
export function emblem(label = "RMS Meridian", attrs = ""): string {
  const moon: [number, number, number] = [77, 50, 10];
  const scene =
    path(`M${CX - GLASS} ${CY}a${GLASS} ${GLASS} 0 1 1 ${GLASS * 2} 0a${GLASS} ${GLASS} 0 1 1 ${-GLASS * 2} 0z`, PAPER + ' stroke="none"') +
    sky(moon) +
    circle(moon[0], moon[1], moon[2], PAPER + LIGHT) +
    path(`M${moon[0] - 3} ${moon[1] - 4}q2 3 0 7M${moon[0] + 3} ${moon[1] + 2}q1.5 1.5 3.4 .6`, ' stroke-width=".35" fill="none"') +
    sea(moon[0]) +
    path(`M22 ${SEA}H178`, FINE) +
    ship() +
    // A glint on the glass.
    path(`M${n(CX - 58)} ${n(CY - 26)}A63 63 0 0 1 ${n(CX - 30)} ${n(CY - 55)}`, ' stroke="var(--paper)" stroke-width="2.6" stroke-opacity=".8" stroke-linecap="round" fill="none"') +
    path(`M${n(CX - 61)} ${n(CY - 12)}A63 63 0 0 1 ${n(CX - 59.5)} ${n(CY - 19)}`, ' stroke="var(--paper)" stroke-width="2.2" stroke-opacity=".8" stroke-linecap="round" fill="none"');
  return `<svg class="emblem"${attrs} viewBox="6 6 208 208" role="img" aria-label="${label}" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <clipPath id="emblem-glass"><circle cx="${CX}" cy="${CY}" r="${GLASS}"/></clipPath>
    <g filter="url(#ink)">
      ${handle()}
      <g clip-path="url(#emblem-glass)">${scene}</g>
      ${rim()}
    </g>
  </svg>`;
}

/** "R·M·S / MERIDIAN / A murder at sea · 1927", in a 400 × 112 box. */
export function wordmark(): string {
  return `<text x="204" y="19" fill="var(--brass)" font-family="var(--body)" font-weight="600" font-size="15" letter-spacing="9" text-anchor="middle">R·M·S</text>
    <path d="M96 13.5H148M256 13.5H304" stroke="var(--brass)" stroke-width="1"/>
    <text x="200" y="72" text-anchor="middle" font-family="var(--display)" font-size="58" letter-spacing="3" fill="var(--navy)" filter="url(#ink-small)">MERIDIAN</text>
    <path d="M40 86H360M40 89.5H360" stroke="var(--brass)" stroke-width=".9"/>
    <text x="200" y="108" text-anchor="middle" font-family="var(--body)" font-style="italic" font-size="15" letter-spacing="2" fill="var(--red)">A murder at sea &#183; 1927</text>`;
}

/** Emblem over the wordmark, for the briefing. */
export function lockup(): string {
  return `<span class="lockup" role="img" aria-label="RMS Meridian: a murder at sea, 1927">
    ${emblem("")}
    <svg class="wordmark-art" viewBox="0 0 400 112" aria-hidden="true">${wordmark()}</svg>
  </span>`;
}

/**
 * The emblem boiled down to flat shapes that still read at 16 pixels, for the
 * favicon and the header bar. Colours fall back to hex so the file works alone.
 */
export function mark(attrs = ""): string {
  const ink = "var(--ink, #2b241c)";
  const brass = "var(--brass-2, #d8b77a)";
  const paper = "var(--paper, #f6efdc)";
  const funnels = [20, 25, 30].map((x) => `<path d="M${x} 24.6l.9-6.4h3.2l-.9 6.4z" fill="${brass}"/><path d="M${x + 0.9} 18.2h3.2l-.3 2.2h-3.2z" fill="${ink}"/>`).join("");
  return `<svg class="mark"${attrs} viewBox="0 0 64 64" aria-hidden="true">
    <path d="M38 38L57 57" stroke="${brass}" stroke-width="11.5" stroke-linecap="round"/>
    <path d="M38 38L57 57" stroke="${ink}" stroke-width="8" stroke-linecap="round"/>
    <path d="M35.5 35.5L41.5 41.5" stroke="${brass}" stroke-width="11"/>
    <circle cx="26" cy="26" r="20.5" fill="${brass}" stroke="${ink}" stroke-width="2.6"/>
    <circle cx="26" cy="26" r="15" fill="${paper}" stroke="${ink}" stroke-width="1.8"/>
    <clipPath id="mark-glass"><circle cx="26" cy="26" r="14"/></clipPath>
    <g clip-path="url(#mark-glass)">
      ${funnels}
      <path d="M17.5 27v-2.6h18v2.6z" fill="${paper}" stroke="${ink}" stroke-width=".9"/>
      <path d="M12 26.6h27l-2.4 5.6H15z" fill="${ink}"/>
      <path d="M14.4 31h22.6l-.4 1.2H15z" fill="var(--red, #9a2f2a)"/>
      <path d="M10 35.4q4-1.6 8 0t8 0 8 0 8 0M12 38.6q4-1.4 7 0t7 0 7 0" fill="none" stroke="${ink}" stroke-width="1"/>
    </g>
  </svg>`;
}
