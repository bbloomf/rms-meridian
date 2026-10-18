// Pen-and-ink studies of the eight weapons, each on a 120 × 72 sheet.

import { WEAPONS } from "../data.ts";
import type { WeaponId } from "../data.ts";
import { BOLD, DARK, FINE, LIGHT, PAPER, SHADE, SHADE_FINE, SHADED, SOLID, STIPPLE, circle, ellipse, lathe, n, onEllipse, path, range } from "./ink.ts";

const HIGHLIGHT = ' stroke="var(--paper)" stroke-width="1.2"';

function belayingPin(): string {
  // A turned wooden pin: handle, collar, then the tapering pin.
  const prof: [number, number][] = [
    [6, 2],
    [8, 5],
    [12, 6.2],
    [17, 4.6],
    [24, 5.4],
    [32, 6.6],
    [40, 5.4],
    [45, 5],
    [47, 8.6],
    [52, 8.6],
    [54, 6.6],
    [70, 5.6],
    [92, 4.6],
    [108, 3.8],
    [113, 2.6],
    [115, 0.6],
  ];
  const outline = lathe(prof, 36);
  let s = path(outline, PAPER) + path(lathe(prof.map(([x, w]) => [x, w * 0.55] as [number, number]), 39.6), SHADE) + path(outline, BOLD);
  s += path("M47 27.4v17.2M52 27.4v17.2M17 31.4v9.2M45 31v10", FINE);
  s += path("M10 33q12 -2 26 -1M58 31.6q26 -1.4 50 0M60 34q24 -0.6 46 0.2M20 34.4q8 -0.4 16 0", ' stroke-width=".4"');
  s += path("M12 31q8 -1.6 20 -1M56 31q24 -1.4 50 0.4", HIGHLIGHT);
  s += path("M14 44q20 3 40 1", ' stroke-width=".4" opacity=".6"');
  return `<g transform="rotate(-12 60 36)">${s}</g>`;
}

function champagne(): string {
  // A bottle lying on the slant: punt, label, foil and wire cage on the cork.
  const prof: [number, number][] = [
    [8, 12.5],
    [12, 13.2],
    [56, 13.2],
    [64, 11.6],
    [72, 7.6],
    [78, 5.4],
    [100, 4.8],
    [103, 6],
    [106, 5],
    [112, 5.4],
    [115, 3.4],
  ];
  const outline = lathe(prof, 36);
  let s = path(outline, PAPER);
  s += path(lathe(prof.map(([x, w]) => [x, w * 0.5] as [number, number]), 36 + 6), SHADE);
  s += path("M82 30.6h33v10.8h-33z", DARK) + path("M82 31q4 3 0 5t1 5M88 31l2 10M94 31q-2 5 1 10M101 31l-1 10M108 31.4q3 4 0 9", ' stroke="var(--paper)" stroke-width=".5"');
  s += path("M104 31v10M110 31.4l3 3.6-3 4M107 31.6l6 7", FINE);
  s += path(outline, BOLD);
  s += path("M22 23.4h28v25.2h-28z", PAPER) + path("M22 23.4h28v25.2h-28z", LIGHT) + ellipse(36, 36, 9, 7, FINE) + path("M30 34h12M31 37h10M33 40h6", ' stroke-width=".45"') + path("M22 26h28M22 46h28", FINE);
  s += path("M8 24q-4 12 0 24", LIGHT) + path("M10 28q-2 8 0 16", FINE);
  s += path("M14 26q20 -3 40 -2M66 29q6 -2 12 -4M80 32h20", HIGHLIGHT);
  return `<g transform="rotate(-24 60 36)">${s}</g>`;
}

function quoit(): string {
  // A ring of tarred rope, three strands twisted, lying on deck.
  const cx = 60;
  const cy = 34;
  let s = ellipse(cx, cy + 5, 44, 23, SHADE_FINE);
  s += ellipse(cx, cy + 4, 42, 22, PAPER) + path(`M${cx - 42} ${cy}v4a42 22 0 0 0 84 0v-4`, SHADED);
  s += ellipse(cx, cy, 42, 22, PAPER) + ellipse(cx, cy, 42, 22, BOLD);
  s += ellipse(cx, cy + 1, 23, 10, ' fill="var(--paper)"') + path(`M${cx - 23} ${cy + 1}a23 10 0 0 1 46 0`, SHADED) + ellipse(cx, cy + 1, 23, 10, BOLD);
  for (let a = 0; a < 360; a += 13) {
    const [ox, oy] = onEllipse(cx, cy, 41, 21, a);
    const [ix, iy] = onEllipse(cx, cy + 1, 24, 11, a + 16);
    const [mx, my] = onEllipse(cx, cy + 0.5, 33, 16, a + 4);
    s += path(`M${n(ox)} ${n(oy)}Q${n(mx + 2)} ${n(my - 1.5)} ${n(ix)} ${n(iy)}`, LIGHT);
  }
  s += path(`M${cx - 30} ${cy - 14}q30 -10 60 0`, HIGHLIGHT);
  return s;
}

function sextant(): string {
  // A brass sextant lying flat: the openwork frame and graduated arc, the index
  // arm with its micrometer drum, mirrors, shade glasses, telescope and handle.
  const ax = 58;
  const ay = 7;
  const r = 57;
  const at = (deg: number, rr: number): [number, number] => [ax + Math.sin((deg * Math.PI) / 180) * rr, ay + Math.cos((deg * Math.PI) / 180) * rr];
  const p = (deg: number, rr: number) => at(deg, rr).map(n).join(" ");
  const arc = (rr: number, d0: number, d1: number) => `M${p(d0, rr)}A${rr} ${rr} 0 0 ${d0 > d1 ? 1 : 0} ${p(d1, rr)}`;
  let s = ellipse(64, 64, 46, 5, SHADE_FINE);
  // The wooden handle, mounted on the back of the frame.
  s += path("M86 15q7 -1 8 4l1 22q0 5 -7 5", PAPER) + path("M86 15q7 -1 8 4l1 22q0 5 -7 5", SHADED) + path("M86 15q7 -1 8 4l1 22q0 5 -7 5", LIGHT) + path("M89 20l1 20", FINE);
  // Frame plate, with its lightening holes.
  const plate = `M${ax} ${ay}L${p(-34, r)}A${r} ${r} 0 0 0 ${p(34, r)}z`;
  s += path(plate, PAPER);
  const hole = (pts: [number, number][]) => path(`M${pts.map(([d, rr]) => p(d, rr)).join("L")}z`, SHADE_FINE) + path(`M${pts.map(([d, rr]) => p(d, rr)).join("L")}z`, LIGHT);
  s += hole([[0, 13], [-22, 33], [22, 33]]);
  s += hole([[-28, 39], [-5, 39], [-5, 46], [-27, 46]]) + hole([[5, 39], [28, 39], [27, 46], [5, 46]]);
  // The limb: a band engraved with degrees.
  s += path(`${arc(r, -34, 34)}L${p(34, 49)}A49 49 0 0 1 ${p(-34, 49)}z`, PAPER) + path(arc(49, -34, 34), LIGHT) + path(arc(52, -34, 34), ' stroke-width=".35"');
  for (let d = -32; d <= 32; d += 2) s += path(`M${p(d, r - 0.6)}L${p(d, d % 10 === 0 ? r - 5 : r - 3)}`, ' stroke-width=".35"');
  s += path(plate, BOLD);
  // Shade glasses on their hinge, fanned out beside the index mirror.
  for (const [i, [x, y]] of ([[42, 20], [44, 16.6], [46.6, 13.6]] as const).entries()) s += circle(x, y, 3.6, PAPER) + circle(x, y, 3.6, i % 2 ? SHADE_FINE : SHADED) + circle(x, y, 3.6, LIGHT);
  s += path("M49 12l3 -2", BOLD);
  // Horizon glass on the left bar: half silvered, half clear.
  s += path("M30 30l7 -3v11l-7 3z", PAPER) + path("M30 30l3.5 -1.5v11l-3.5 1.5z", SHADE) + path("M30 30l7 -3v11l-7 3z", LIGHT);
  // Telescope, aimed along the frame at the horizon glass.
  const tube: [number, number][] = [
    [40, 3.4],
    [44, 3.4],
    [46, 2.6],
    [72, 2.6],
    [74, 3.6],
    [86, 3.6],
    [88, 2.4],
    [93, 2.4],
  ];
  s += path(lathe(tube, 35), PAPER) + path(lathe(tube.map(([x, w]) => [x, w * 0.5] as [number, number]), 36.4), SHADE) + path(lathe(tube, 35), LIGHT);
  s += path("M74 31.4v7.2M86 31.4v7.2M44 31.6v6.8", FINE) + path("M60 32.4v-4h4v4", LIGHT) + path("M47 33.6h24", HIGHLIGHT);
  // Index arm: pivot to arc, the vernier window, micrometer drum and clamp.
  const d = 9;
  const [ex, ey] = at(d, r + 3);
  const nx = Math.cos((d * Math.PI) / 180);
  const ny = -Math.sin((d * Math.PI) / 180);
  const arm = `M${n(ax - nx * 2.6)} ${n(ay - ny * 2.6)}L${n(ex - nx * 2.2)} ${n(ey - ny * 2.2)}L${n(ex + nx * 2.2)} ${n(ey + ny * 2.2)}L${n(ax + nx * 2.6)} ${n(ay + ny * 2.6)}z`;
  s += path(arm, PAPER) + path(arm, LIGHT) + path(`M${ax} ${ay}L${n(ex)} ${n(ey)}`, ' stroke-width=".35"');
  const [vx, vy] = at(d, r - 3);
  s += `<g transform="rotate(${-d} ${n(vx)} ${n(vy)})">${path(`M${n(vx - 6)} ${n(vy - 3)}h12v7h-12z`, PAPER + LIGHT)}${path(`M${n(vx - 4)} ${n(vy - 1.6)}h8v2.6h-8z`, FINE)}${range(5)
    .map((i) => path(`M${n(vx - 3 + i * 1.5)} ${n(vy - 1.6)}v1.4`, ' stroke-width=".3"'))
    .join("")}</g>`;
  const [mx, my] = [vx + 9, vy - 1];
  s += circle(mx, my, 4.2, PAPER) + circle(mx, my, 4.2, LIGHT) + circle(mx, my, 2.2, FINE) + range(12).map((i) => path(`M${n(mx + Math.cos((i * Math.PI) / 6) * 3.4)} ${n(my + Math.sin((i * Math.PI) / 6) * 3.4)}L${n(mx + Math.cos((i * Math.PI) / 6) * 4.2)} ${n(my + Math.sin((i * Math.PI) / 6) * 4.2)}`, ' stroke-width=".35"')).join("");
  s += path(`M${n(vx - 7)} ${n(vy + 2)}l-5 3`, BOLD);
  // Index mirror standing on the arm over the pivot.
  s += path(`M${ax - 7} ${ay - 4}h12v8h-12z`, PAPER) + path(`M${ax - 7} ${ay - 4}h12v8h-12z`, SHADED) + path(`M${ax - 7} ${ay - 4}h12v8h-12z`, LIGHT) + path(`M${ax - 5} ${ay - 2}l4 4`, HIGHLIGHT) + circle(ax, ay + 5, 1.6, PAPER + LIGHT);
  return `<g transform="rotate(-6 60 36)">${s}</g>`;
}

function marlinspike(): string {
  // A long steel spike with a turned wooden handle, a brass ferrule, and a
  // cord lanyard through the hole in its head.
  const prof: [number, number][] = [
    [8, 3.6],
    [10, 5],
    [16, 5.6],
    [24, 5],
    [28, 4.6],
    [30, 5.6],
    [34, 5.6],
    [36, 4.4],
    [60, 3.4],
    [90, 2.1],
    [108, 0.9],
    [114, 0.2],
  ];
  const outline = lathe(prof, 36);
  const cord = "M12 36C4 34 -2 44 2 52C6 60 18 58 20 50C21 46 18 42 14 39";
  let s = path(cord, ' stroke-width="3"') + path(cord, ' stroke="var(--paper)" stroke-width="1.4"');
  for (let t = 0; t < 1; t += 0.08) {
    const a = t * Math.PI * 1.7 + Math.PI * 0.95;
    const [x, y] = [10 + Math.cos(a) * 8.6, 47 + Math.sin(a) * 9.4];
    s += path(`M${n(x - 0.8)} ${n(y - 0.8)}l1.6 1.6`, ' stroke-width=".4"');
  }
  s += path(outline, PAPER) + path(lathe(prof.map(([x, w]) => [x, w * 0.5] as [number, number]), 37.8), SHADE) + path(outline, BOLD);
  s += path("M28 31.4v9.2M30 30.4v11.2M34 30.4v11.2M36 31.6v8.8", FINE) + path("M30 30.4h4v11.2h-4z", SHADE_FINE);
  s += ellipse(12, 36, 1.4, 2, DARK) + path("M14 39q1.4 -2 -0.4 -3.6", ' stroke-width="2.4"');
  s += path("M11 33q6 -1 14 -0.4", ' stroke-width=".4"') + path("M38 33.4q30 -1.4 70 1.8", HIGHLIGHT) + path("M38 36q30 -0.4 66 0.4", ' stroke-width=".35"');
  return `<g transform="translate(5 -4) rotate(14 60 36) scale(.96)">${s}</g>`;
}

function poison(): string {
  // A tin of rat poison, the lid dented, the label printed with a warning.
  const cx = 58;
  let s = ellipse(cx + 4, 66, 32, 5, SHADE_FINE);
  s += path(`M${cx - 28} 16v46a28 6.5 0 0 0 56 0v-46`, PAPER);
  s += path(`M${cx + 12} 16v50.6a28 6.5 0 0 0 16 -4.6v-46z`, SHADE);
  s += path(`M${cx - 28} 16v46a28 6.5 0 0 0 56 0v-46`, BOLD);
  s += path(`M${cx - 28} 26a28 6.5 0 0 0 56 0M${cx - 28} 56a28 6.5 0 0 0 56 0`, LIGHT);
  s += ellipse(cx, 16, 28, 6.5, PAPER) + ellipse(cx, 16, 28, 6.5, BOLD) + ellipse(cx, 16, 23, 4.8, LIGHT) + path(`M${cx - 10} 14q6 3 14 0`, FINE);
  s += path(`M${cx - 28} 16v4a28 6.5 0 0 0 56 0v-4`, LIGHT);
  // Skull and crossbones.
  s += path("M38 46l12 -10M38 36l12 10", ' stroke-width="1.6"') + circle(37.4, 35.4, 1.2, PAPER) + circle(50.6, 35.4, 1.2, PAPER) + circle(37.4, 46.6, 1.2, PAPER) + circle(50.6, 46.6, 1.2, PAPER);
  s += path("M39 36.5q0 -7 5 -7t5 7q0 3 -2 4v2h-6v-2q-2 -1 -2 -4z", PAPER) + path("M39 36.5q0 -7 5 -7t5 7q0 3 -2 4v2h-6v-2q-2 -1 -2 -4z", LIGHT);
  s += circle(42, 36, 1.3, SOLID) + circle(46, 36, 1.3, SOLID) + path("M43 41v1.6M45 41v1.6", FINE);
  s += `<text x="68" y="38" text-anchor="middle" class="label-big">RAT</text><text x="68" y="47" text-anchor="middle" class="label-big">POISON</text><text x="${cx}" y="53.4" text-anchor="middle" class="label-small">DEADLY · KEEP AWAY FROM FOOD</text>`;
  s += path(`M${cx - 20} 22l3 1M${cx + 8} 62l4 -1`, FINE) + ellipse(cx + 18, 60, 5, 2, STIPPLE);
  return `<g transform="rotate(-4 60 40)">${s}</g>`;
}

function letterOpener(): string {
  // A brass-hilted letter opener: ridged blade, scrolled guard, wrapped grip.
  let s = "";
  s += path("M50 32L112 36.4q2 0.6 0 1.2L50 40z", PAPER) + path("M50 36L112 37L50 40z", SHADE) + path("M50 32L112 36.4q2 0.6 0 1.2L50 40z", BOLD) + path("M52 36H104", FINE);
  s += path("M56 33.4q24 1 44 2.4", HIGHLIGHT);
  s += path("M44 24q4 -2 5 2v20q-1 4 -5 2q4 -2 2 -6v-12q2 -4 -2 -6z", PAPER) + path("M44 24q4 -2 5 2v20q-1 4 -5 2q4 -2 2 -6v-12q2 -4 -2 -6z", LIGHT);
  s += path("M44 24q-4 -1 -4 3M44 48q-4 1 -4 -3", LIGHT) + circle(40, 27.4, 1.2, LIGHT) + circle(40, 44.6, 1.2, LIGHT);
  s += path("M20 32.4h24v7.2h-24z", PAPER) + path("M20 32.4h24v7.2h-24z", SHADED) + path("M20 32.4h24v7.2h-24z", LIGHT);
  for (let x = 22; x < 44; x += 3) s += path(`M${x} 32.4l2 7.2`, FINE);
  s += path("M20 30v12", BOLD) + path("M12 36q0 -6 6 -6t2 6 -2 6 -6 -6z", PAPER) + path("M12 36q0 -6 6 -6t2 6 -2 6 -6 -6z", LIGHT) + circle(9.6, 36, 2.2, PAPER) + circle(9.6, 36, 2.2, LIGHT) + path("M14 34q2 -1 3 1", FINE);
  return `<g transform="rotate(-16 60 36)">${s}</g>`;
}

function rope(): string {
  // A flat coil of rope, laid down sunwise, the working end trailing off.
  const cx = 54;
  const cy = 36;
  let s = ellipse(cx + 2, cy + 6, 50, 22, SHADE_FINE);
  const rings = range(7).map((i) => 46 - i * 6);
  rings.forEach((rx, i) => {
    const ry = rx * 0.44;
    s += ellipse(cx, cy + 3, rx, ry, PAPER) + path(`M${cx - rx} ${cy}v3a${rx} ${ry} 0 0 0 ${rx * 2} 0v-3`, SHADED);
    s += ellipse(cx, cy, rx, ry, PAPER) + ellipse(cx, cy, rx, ry, i === 0 ? BOLD : LIGHT);
    for (let a = 0; a < 360; a += Math.max(9, 60 / (rx / 6))) {
      const [x0, y0] = onEllipse(cx, cy, rx - 0.6, ry - 0.4, a);
      const [x1, y1] = onEllipse(cx, cy, rx - 5.2, ry - 2.3, a + 9);
      s += path(`M${n(x0)} ${n(y0)}L${n(x1)} ${n(y1)}`, FINE);
    }
  });
  s += ellipse(cx, cy, 6, 2.6, DARK);
  s += path("M100 37q12 8 8 18q-3 8 6 12", ' stroke-width="7" stroke="currentColor"') + path("M100 37q12 8 8 18q-3 8 6 12", ' stroke-width="5" stroke="var(--paper)"');
  for (let t = 0.1; t < 0.95; t += 0.11) s += path(`M${n(100 + t * 10)} ${n(37 + t * 26)}l3 -2`, FINE);
  s += path("M111 64l5 2M112 62l5 2", LIGHT);
  return s;
}

const DRAW: Record<WeaponId, () => string> = { belayingPin, champagne, quoit, sextant, marlinspike, poison, letterOpener, rope };

export const WEAPON_ART = Object.fromEntries(Object.entries(DRAW).map(([id, draw]) => [id, draw()])) as Record<WeaponId, string>;

/** A weapon drawing, sized by CSS. */
export function weaponPic(id: WeaponId, cls = ""): string {
  return `<svg class="weapon-pic${cls ? ` ${cls}` : ""}" viewBox="0 0 120 72" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${WEAPONS[id].name}"><g filter="url(#ink-small)">${WEAPON_ART[id]}</g></svg>`;
}
