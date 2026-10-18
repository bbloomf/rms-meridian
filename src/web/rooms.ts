// Pen-and-ink pictures of the eleven rooms, on the 320 × 180 scene stage.
//
// Interiors are drawn in one-point perspective. Positions are given in
// back-wall coordinates (the back wall runs x 52–268, y 22–112, with the eye
// at y 78) plus a depth t, where 1 is the back wall and larger is nearer:
// P(x, y, t) projects that onto the stage. Furniture is filled with paper so
// it hides what stands behind it, which means drawing back to front.
//
// Character tokens stand in the middle of the floor (x 70–250, y 100–160), so
// the telling details sit high on the back wall and out at the sides.
// Classes drift, waves, swing, flicker and spark are animated in style.css.

import type { RoomId } from "../data.ts";
import {
  BOLD,
  DARK,
  FINE,
  GRAIN,
  LIGHT,
  NIGHT,
  PAPER,
  SHADE,
  SHADE_FINE,
  SHADED,
  SOLID,
  STIPPLE,
  WASH,
  circle,
  ellipse,
  n,
  path,
  poly,
  polyline,
  range,
  rng,
} from "./ink.ts";

const VX = 160;
const VY = 78;
const L = 52;
const R = 268;
const T = 22;
const B = 112;

/** Project a back-wall point forward to depth t. */
const P = (x: number, y: number, t = 1): string => `${n(VX + (x - VX) * t)} ${n(VY + (y - VY) * t)}`;
const X = (x: number, t: number): number => VX + (x - VX) * t;
const Y = (y: number, t: number): number => VY + (y - VY) * t;

/** A solid block standing in the room: its front, and whichever top and side faces the eye can see. */
function block(x0: number, x1: number, top: number, bottom: number, t0: number, t1: number, front = PAPER): string {
  const f = (x: number, y: number) => P(x, y, t1);
  const b = (x: number, y: number) => P(x, y, t0);
  let s = "";
  if (x1 < VX) s += poly([f(x1, top), b(x1, top), b(x1, bottom), f(x1, bottom)], PAPER) + poly([f(x1, top), b(x1, top), b(x1, bottom), f(x1, bottom)], SHADED);
  if (x0 > VX) s += poly([f(x0, top), b(x0, top), b(x0, bottom), f(x0, bottom)], PAPER) + poly([f(x0, top), b(x0, top), b(x0, bottom), f(x0, bottom)], SHADED);
  if (top > VY) s += poly([f(x0, top), f(x1, top), b(x1, top), b(x0, top)], PAPER);
  s += poly([f(x0, top), f(x1, top), f(x1, bottom), f(x0, bottom)], front);
  return s;
}

/** Depths of square floor tiles of the given width, from the back wall forward. */
function tileDepths(w: number): number[] {
  const d0 = 120;
  return range(12)
    .map((k) => d0 / (d0 - k * w))
    .filter((t) => t > 0 && t < 3.4);
}

type Floor = "boards" | "carpet" | "checks" | "tiles" | "parquet";
type Ceiling = "beams" | "coffers" | "plain" | "pipes";

/** Walls, floor and ceiling of an ordinary room. */
function shell(floor: Floor, ceiling: Ceiling, sides = SHADE_FINE): string {
  const r = rng(floor.length * 31 + ceiling.length);
  let s = "";
  // Side walls in a light tone, so the back wall reads as lit.
  s += poly([P(L, T), P(L, T, 2), P(L, B, 2), P(L, B)], sides) + poly([P(R, T), P(R, T, 2), P(R, B, 2), P(R, B)], sides);
  s += poly([P(L, T), P(R, T), P(R, B), P(L, B)], BOLD);
  s += polyline([P(L, T), P(L, T, 2)], BOLD) + polyline([P(R, T), P(R, T, 2)], BOLD);
  s += polyline([P(L, B), P(L, B, 3.2)], BOLD) + polyline([P(R, B), P(R, B, 3.2)], BOLD);
  // Skirting along the foot of each wall.
  s += polyline([P(L, B - 4), P(R, B - 4)], FINE) + polyline([P(L, B - 4), P(L, B - 4, 2)], FINE) + polyline([P(R, B - 4), P(R, B - 4, 2)], FINE);

  const rays = (step: number, a = FINE) =>
    range(Math.round((R - L) / step) + 1)
      .map((i) => polyline([P(L + i * step, B), P(L + i * step, B, 3.2)], a))
      .join("");
  const across = (t: number, a = FINE) => polyline([P(L, B, t), P(R, B, t)], a);

  if (floor === "boards" || floor === "parquet") {
    const step = floor === "boards" ? 12 : 8;
    s += rays(step);
    // Butt joints, staggered board to board.
    for (let i = 0; i < (R - L) / step; i++) {
      const x = L + i * step;
      for (const t of [1.08 + r() * 0.2, 1.45 + r() * 0.3, 2 + r() * 0.5]) s += polyline([P(x, B, t), P(x + step, B, t)], FINE);
    }
    if (floor === "parquet") for (const t of tileDepths(16)) s += across(t);
  } else if (floor === "checks" || floor === "tiles") {
    const w = floor === "checks" ? 14.4 : 10.8;
    const ts = [...tileDepths(w), 3.4];
    s += rays(w);
    for (const t of ts) s += across(t);
    if (floor === "checks")
      for (let j = 0; j < ts.length - 1; j++)
        for (let i = j % 2; i < (R - L) / w; i += 2) {
          const x = L + i * w;
          s += poly([P(x, B, ts[j]!), P(x + w, B, ts[j]!), P(x + w, B, ts[j + 1]!), P(x, B, ts[j + 1]!)], SHADE);
        }
  } else {
    // A carpet: a patterned border and a stippled field.
    const [a, b2, c, d] = [L + 8, R - 8, 1.06, 2.6];
    s += poly([P(a, B, c), P(b2, B, c), P(b2, B, d), P(a, B, d)], STIPPLE);
    s += poly([P(a, B, c), P(b2, B, c), P(b2, B, d), P(a, B, d)], LIGHT);
    s += poly([P(a + 6, B, c + 0.06), P(b2 - 6, B, c + 0.06), P(b2 - 6, B, d - 0.25), P(a + 6, B, d - 0.25)], FINE);
    for (let x = a + 10; x < b2 - 6; x += 12) s += poly([P(x, B, c + 0.03), P(x + 3, B, c + 0.015), P(x + 6, B, c + 0.03), P(x + 3, B, c + 0.045)], FINE);
    s += rays(24, ' stroke-width=".35" opacity=".5"');
  }

  if (ceiling === "beams" || ceiling === "coffers") {
    for (const t of [1.1, 1.24, 1.42]) s += polyline([P(L, T, t), P(R, T, t)], ceiling === "beams" ? LIGHT : FINE);
    range(7).forEach((i) => {
      const x = L + (i * (R - L)) / 6;
      s += polyline([P(x, T), P(x, T, 1.6)], ceiling === "beams" ? LIGHT : FINE);
    });
    if (ceiling === "coffers") range(6).forEach((i) => (s += poly([P(L + 6 + i * 36, T, 1.03), P(L + 30 + i * 36, T, 1.03), P(L + 30 + i * 36, T, 1.08), P(L + 6 + i * 36, T, 1.08)], FINE)));
  } else if (ceiling === "pipes") {
    for (const y of [4, 9]) s += path(`M0 ${y}H320`, LIGHT) + path(`M0 ${y + 3}H320`, FINE);
    for (const x of [40, 120, 200, 280]) s += path(`M${x - 3} 2h6v12h-6z`, PAPER);
  }
  // A cornice under the ceiling.
  s += polyline([P(L, T + 4), P(R, T + 4)], FINE) + polyline([P(L, T + 4), P(L, T + 4, 2)], FINE) + polyline([P(R, T + 4), P(R, T + 4, 2)], FINE);
  return s;
}

/** A window or opening on the back wall, glazed with night and a grid of bars. */
function nightWindow(x0: number, x1: number, top: number, bottom: number, cols: number, rows: number, arched = false): string {
  const w = x1 - x0;
  const outline = arched ? `M${x0} ${bottom}V${top + w / 2}A${w / 2} ${w / 2} 0 0 1 ${x1} ${top + w / 2}V${bottom}z` : `M${x0} ${top}H${x1}V${bottom}H${x0}z`;
  let s = path(outline, PAPER) + path(outline, NIGHT) + path(outline, BOLD);
  const glassTop = arched ? top + w / 2 : top;
  for (let i = 1; i < cols; i++) s += path(`M${n(x0 + (i * w) / cols)} ${n(arched ? top + w / 2 - Math.sqrt((w / 2) ** 2 - ((i * w) / cols - w / 2) ** 2) : top)}V${bottom}`, ' stroke="var(--paper)" stroke-width="1.3"');
  for (let j = 1; j < rows; j++) s += path(`M${x0} ${n(glassTop + (j * (bottom - glassTop)) / rows)}H${x1}`, ' stroke="var(--paper)" stroke-width="1.3"');
  if (arched) s += path(`M${x0 + 3} ${top + w / 2}A${w / 2 - 3} ${w / 2 - 3} 0 0 1 ${x1 - 3} ${top + w / 2}`, ' stroke="var(--paper)" stroke-width="1"');
  s += path(`M${x0 - 3} ${bottom}h${w + 6}v3h-${w + 6}z`, PAPER);
  return s;
}

/** A porthole on the back wall, ringed and bolted. */
function porthole(x: number, y: number, r: number): string {
  return (
    circle(x, y, r + 3, PAPER) +
    circle(x, y, r + 3, BOLD) +
    circle(x, y, r, NIGHT) +
    circle(x, y, r, LIGHT) +
    range(8)
      .map((i) => circle(x + Math.cos((i * Math.PI) / 4) * (r + 1.6), y + Math.sin((i * Math.PI) / 4) * (r + 1.6), 0.6, SOLID))
      .join("") +
    path(`M${n(x - r * 0.5)} ${n(y - r * 0.2)}q${n(r * 0.3)} -${n(r * 0.4)} ${n(r * 0.7)} -${n(r * 0.45)}`, ' stroke="var(--paper)"')
  );
}

/** A porthole on the left or right wall, foreshortened. */
function sidePorthole(side: "l" | "r", y: number, t: number, r: number): string {
  const x = X(side === "l" ? L : R, t);
  const cy = Y(y, t);
  const rx = r * 0.42 * t;
  const ry = r * t;
  return ellipse(x, cy, rx + 2, ry + 2.5, PAPER) + ellipse(x, cy, rx + 2, ry + 2.5, BOLD) + ellipse(x, cy, rx, ry, NIGHT) + ellipse(x, cy, rx, ry, LIGHT);
}

/** A hanging crystal chandelier, centred on x and hanging from the top edge. */
function chandelier(x: number, drop = 12, w = 30): string {
  const y = drop + 6;
  let s = path(`M${x} 0V${drop}`, LIGHT) + path(`M${x - 4} ${drop}h8l-1 6h-6z`, PAPER);
  s += ellipse(x, y + 2, w * 0.45, 3, PAPER) + ellipse(x, y + 2, w * 0.45, 3, LIGHT);
  for (const d of [-1, -0.5, 0.5, 1]) {
    const ax = x + d * w;
    const ay = y + 9 + (Math.abs(d) === 1 ? 0 : 4);
    s += path(`M${x + d * w * 0.3} ${y + 3}q${n(d * w * 0.5)} 2 ${n(d * w * 0.7)} ${n(ay - y - 5)}`, LIGHT);
    s += path(`M${n(ax - 2.4)} ${ay}h4.8v2h-4.8z`, PAPER) + path(`M${n(ax)} ${ay}v-4`, FINE) + path(`M${n(ax)} ${ay - 4}q-1.5-2.5 0-4.5q1.5 2 0 4.5`, ' stroke-width=".6" class="flicker"');
  }
  for (let i = -4; i <= 4; i++) {
    const cx = x + i * (w / 9);
    const len = 6 + (4 - Math.abs(i)) * 1.6;
    s += path(`M${n(cx)} ${y + 4}v${n(len)}`, FINE) + path(`M${n(cx)} ${n(y + 4 + len)}l1.1 1.8-1.1 1.8-1.1-1.8z`, FINE);
  }
  s += path(`M${x} ${y + 5}v14`, FINE) + path(`M${x - 2} ${y + 19}l2 5 2-5z`, PAPER);
  return s;
}

type Pt = [number, number];
const pt = (p: Pt): string => `${n(p[0])} ${n(p[1])}`;
const quadAt = (a: Pt, c: Pt, b: Pt, t: number): Pt => [
  (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
  (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1],
];

/** A long narrow leaf from p, setting off along the unit vector d and bowing down towards its tip. */
function leaf(p: Pt, d: Pt, len: number, a: string): string {
  const w = len * 0.1 + 0.3;
  const tip: Pt = [p[0] + d[0] * len, p[1] + d[1] * len + len * 0.35];
  const mid: Pt = [p[0] + d[0] * len * 0.6, p[1] + d[1] * len * 0.6];
  return path(`M${pt(p)}Q${n(mid[0] - d[1] * w)} ${n(mid[1] + d[0] * w)} ${pt(tip)}Q${n(mid[0] + d[1] * w)} ${n(mid[1] - d[0] * w)} ${pt(p)}z`, a);
}

/** A palm frond: an arching stalk out to (x + dx, y + dy), raised by lift, hung with leaflets on both sides. */
function frond(x: number, y: number, dx: number, dy: number, lift: number, size: number, r: () => number, shaded: boolean): string {
  const a: Pt = [x, y];
  const c: Pt = [x + dx * 0.4, y + dy * 0.4 - lift];
  const b: Pt = [x + dx, y + dy];
  const fill = shaded ? ` fill="url(#ink-hatch-fine)"${FINE}` : PAPER + FINE;
  let s = "";
  const k = 10;
  for (let i = 0; i < k; i++) {
    const t = 0.32 + (0.68 * i) / (k - 1);
    const p = quadAt(a, c, b, t);
    const tx = 2 * (1 - t) * (c[0] - a[0]) + 2 * t * (b[0] - c[0]);
    const ty = 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (b[1] - c[1]);
    const tl = Math.hypot(tx, ty);
    const len = size * (1 - 0.6 * ((t - 0.32) / 0.68)) * (0.85 + r() * 0.3);
    for (const side of [1, -1]) {
      // Out to the side and forward along the stalk, then pulled down by their weight.
      const ux = (tx / tl) * 0.35 - (ty / tl) * side;
      const uy = (ty / tl) * 0.35 + (tx / tl) * side + 0.75;
      const ul = Math.hypot(ux, uy);
      s += leaf(p, [ux / ul, uy / ul], len, fill);
    }
  }
  return s + path(`M${pt(a)}Q${pt(c)} ${pt(b)}`, LIGHT);
}

/** A kentia palm in a glazed jardinière: fronds arching up and out from the soil, the far ones in shadow. */
function pottedPalm(x: number, base: number, k = 1, seed = 7): string {
  const r = rng(seed);
  const w = 15 * k;
  const top = base - 24 * k;
  const soil = top + 2 * k;
  const F = (dx: number, dy: number, lift: number, size: number, shaded = false) => frond(x + dx * 0.04 * k, soil, dx * k, dy * k, lift * k, size * k, r, shaded);
  let s = ellipse(x + 3 * k, base, w * 1.5, 2.6 * k, SHADE);
  s += F(-26, -58, 8, 14, true) + F(30, -54, 8, 14, true) + F(4, -66, 3, 13, true);
  const body = `M${n(x - w)} ${n(top + 3 * k)}C${n(x - w * 1.25)} ${n(top + 11 * k)} ${n(x - w * 0.95)} ${n(base - 4 * k)} ${n(x - w * 0.62)} ${n(base - 4 * k)}H${n(x + w * 0.62)}C${n(x + w * 0.95)} ${n(base - 4 * k)} ${n(x + w * 1.25)} ${n(top + 11 * k)} ${n(x + w)} ${n(top + 3 * k)}z`;
  s += path(`M${n(x - w * 0.7)} ${n(base - 4 * k)}h${n(w * 1.4)}l${n(2 * k)} ${n(4 * k)}h${n(-w * 1.4 - 4 * k)}z`, PAPER + LIGHT);
  s += path(body, PAPER);
  s += path(`M${n(x + w * 0.35)} ${n(top + 3 * k)}H${n(x + w)}C${n(x + w * 1.25)} ${n(top + 11 * k)} ${n(x + w * 0.95)} ${n(base - 4 * k)} ${n(x + w * 0.62)} ${n(base - 4 * k)}H${n(x + w * 0.3)}C${n(x + w * 0.5)} ${n(base - 9 * k)} ${n(x + w * 0.55)} ${n(top + 9 * k)} ${n(x + w * 0.35)} ${n(top + 3 * k)}z`, SHADE);
  s += path(body, LIGHT);
  // A painted band round the belly: two rules and a running scroll between them.
  const b1 = top + 8 * k;
  const b2 = top + 13 * k;
  s += path(`M${n(x - w * 1.1)} ${n(b1)}Q${x} ${n(b1 + 3 * k)} ${n(x + w * 1.1)} ${n(b1)}M${n(x - w * 1.12)} ${n(b2)}Q${x} ${n(b2 + 3 * k)} ${n(x + w * 1.12)} ${n(b2)}`, FINE);
  for (let i = -3; i <= 3; i++) {
    const cx = x + i * w * 0.3;
    const cy = (b1 + b2) / 2 + 1.5 * k * (1 - (i / 3.6) ** 2);
    s += path(`M${n(cx - w * 0.12)} ${n(cy + 0.8 * k)}q${n(w * 0.06)} ${n(-2 * k)} ${n(w * 0.14)} ${n(-1 * k)}t${n(w * 0.1)} ${n(0.6 * k)}`, FINE);
  }
  s += ellipse(x, top + 2 * k, w * 1.06, 2.6 * k, PAPER + LIGHT) + ellipse(x, top + 2 * k, w * 0.88, 1.7 * k, DARK);
  s += F(-56, -18, 22, 16) + F(54, -22, 22, 16) + F(-40, -44, 14, 15) + F(38, -46, 14, 15) + F(-10, -62, 6, 14) + F(16, -60, 6, 14);
  return s;
}

/** A wicker tub chair: the rounded back wrapping forward into the arms, a cushion on the seat. */
function wickerChair(x: number, base: number, k: number): string {
  const S = (dx: number) => n(x + dx * k);
  const V = (dy: number) => n(base - dy * k);
  const WEAVE = ' fill="url(#ink-vert)" stroke="none"';
  let s = ellipse(x + 2 * k, base + 1, 22 * k, 3 * k, SHADE);
  const outer = `M${S(-18)} ${V(16)}L${S(-19)} ${V(27)}Q${S(-19)} ${V(30)} ${S(-16)} ${V(31)}C${S(-16)} ${V(44)} ${S(-9)} ${V(51)} ${S(0)} ${V(51)}C${S(9)} ${V(51)} ${S(16)} ${V(44)} ${S(16)} ${V(31)}Q${S(19)} ${V(30)} ${S(19)} ${V(27)}L${S(18)} ${V(16)}z`;
  s += path(outer, PAPER) + path(outer, WEAVE) + path(outer, LIGHT);
  // The inside of the back, woven on the bias and in shadow.
  const inner = `M${S(-14)} ${V(18)}L${S(-14)} ${V(30)}C${S(-13)} ${V(41)} ${S(-7)} ${V(46)} ${S(0)} ${V(46)}C${S(7)} ${V(46)} ${S(13)} ${V(41)} ${S(14)} ${V(30)}L${S(14)} ${V(18)}z`;
  s += path(inner, PAPER) + path(inner, ' fill="url(#ink-cross)" stroke="none" opacity=".55"') + path(inner, FINE);
  // Rolled rim along the top of the back and arms.
  s += path(`M${S(-17.5)} ${V(28)}Q${S(-17.5)} ${V(29.5)} ${S(-14.5)} ${V(30.5)}C${S(-14.5)} ${V(43)} ${S(-8)} ${V(48.6)} ${S(0)} ${V(48.6)}C${S(8)} ${V(48.6)} ${S(14.5)} ${V(43)} ${S(14.5)} ${V(30.5)}Q${S(17.5)} ${V(29.5)} ${S(17.5)} ${V(28)}`, FINE);
  s += ellipse(+S(-17), +V(26), 2.4 * k, 2.8 * k, PAPER + LIGHT) + ellipse(+S(17), +V(26), 2.4 * k, 2.8 * k, PAPER + LIGHT);
  // The base, banded top and bottom.
  const skirt = `M${S(-18)} ${V(16)}L${S(-16)} ${V(0)}H${S(16)}L${S(18)} ${V(16)}z`;
  s += path(skirt, PAPER) + path(skirt, WEAVE) + path(`M${S(6)} ${V(16)}L${S(6)} ${V(0)}H${S(16)}L${S(18)} ${V(16)}z`, SHADE) + path(skirt, LIGHT);
  s += path(`M${S(-17.6)} ${V(13)}H${S(17.6)}M${S(-16.4)} ${V(3)}H${S(16.4)}`, LIGHT);
  // Seat cushion, piped.
  s += path(`M${S(-15)} ${V(21)}Q${S(0)} ${V(25)} ${S(15)} ${V(21)}V${V(17)}Q${S(15)} ${V(15.6)} ${S(13)} ${V(15.6)}H${S(-13)}Q${S(-15)} ${V(15.6)} ${S(-15)} ${V(17)}z`, PAPER + LIGHT);
  s += path(`M${S(-14.4)} ${V(20.4)}Q${S(0)} ${V(24.2)} ${S(14.4)} ${V(20.4)}`, FINE) + path(`M${S(-4)} ${V(22.6)}q${n(3 * k)} ${n(1.4 * k)} ${n(7 * k)} 0`, FINE);
  return s;
}

/** A round marble-topped café table on a tripod foot, laid for tea. */
function cafeTable(x: number, base: number, k: number): string {
  const S = (dx: number) => n(x + dx * k);
  const V = (dy: number) => n(base - dy * k);
  let s = ellipse(x, base + 1, 15 * k, 2.4 * k, SHADE);
  s += path(`M${S(-11)} ${V(0)}Q${S(-3)} ${V(1)} ${S(-1.4)} ${V(6)}M${S(11)} ${V(0)}Q${S(3)} ${V(1)} ${S(1.4)} ${V(6)}M${S(1)} ${V(-2)}Q${S(1)} ${V(2)} ${S(0)} ${V(6)}`, LIGHT);
  s += path(`M${S(-1.4)} ${V(6)}L${S(-1)} ${V(24)}H${S(1)}L${S(1.4)} ${V(6)}z`, PAPER + LIGHT) + ellipse(x, +V(14), 2 * k, 1 * k, PAPER + FINE);
  s += path(`M${S(-15)} ${V(26)}v${n(1.6 * k)}a${n(15 * k)} ${n(3.4 * k)} 0 0 0 ${n(30 * k)} 0v${n(-1.6 * k)}`, PAPER + LIGHT);
  s += ellipse(x, +V(26), 15 * k, 3.4 * k, PAPER + LIGHT) + path(`M${S(-9)} ${V(26.6)}q${n(4 * k)} ${n(1 * k)} ${n(7 * k)} ${n(-0.6 * k)}M${S(4)} ${V(25)}q${n(3 * k)} ${n(0.8 * k)} ${n(6 * k)} 0`, ' stroke-width=".35"');
  // Teapot, two cups in their saucers.
  const tx = x - 4 * k;
  const ty = base - 26.4 * k;
  s += path(`M${n(tx - 4 * k)} ${n(ty)}Q${n(tx - 5.4 * k)} ${n(ty - 5 * k)} ${n(tx)} ${n(ty - 5.4 * k)}Q${n(tx + 5.4 * k)} ${n(ty - 5 * k)} ${n(tx + 4 * k)} ${n(ty)}z`, PAPER + LIGHT);
  s += path(`M${n(tx - 4.4 * k)} ${n(ty - 2 * k)}q${n(-2.4 * k)} ${n(-0.6 * k)} ${n(-3.4 * k)} ${n(-3.8 * k)}M${n(tx + 4.4 * k)} ${n(ty - 1.4 * k)}q${n(2.6 * k)} ${n(-0.6 * k)} ${n(1.6 * k)} ${n(-3.6 * k)}`, FINE);
  s += path(`M${n(tx - 2.4 * k)} ${n(ty - 5 * k)}q${n(2.4 * k)} ${n(-1.6 * k)} ${n(4.8 * k)} 0`, FINE) + circle(tx, ty - 6.4 * k, 0.6 * k, FINE);
  for (const cx of [x + 5 * k, x + 10 * k]) {
    const cy = base - 25.4 * k + (cx > x + 7 * k ? 1 : 0);
    s += ellipse(cx, cy, 2.8 * k, 0.8 * k, PAPER + FINE) + path(`M${n(cx - 1.8 * k)} ${n(cy - 2.4 * k)}q0 ${n(2.4 * k)} ${n(1.8 * k)} ${n(2.4 * k)}t${n(1.8 * k)} ${n(-2.4 * k)}z`, PAPER + FINE) + path(`M${n(cx + 1.7 * k)} ${n(cy - 1.9 * k)}q${n(1.2 * k)} 0 ${n(0.6 * k)} ${n(1.1 * k)}`, FINE);
  }
  return s;
}

/** Book spines along a shelf, with varied widths and heights, the odd one leaning. */
function books(x0: number, x1: number, shelf: number, gap: number, seed: number): string {
  const r = rng(seed);
  let s = "";
  let x = x0 + 1;
  while (x < x1 - 3) {
    const w = 2.2 + r() * 2.6;
    const h = gap - 2 - r() * 5;
    if (r() < 0.08 && x + h * 0.5 < x1) {
      // A book lying on its side, or a short stack.
      s += path(`M${n(x)} ${shelf}h${n(h * 0.8)}v-${n(w)}h-${n(h * 0.8)}z`, PAPER) + path(`M${n(x)} ${n(shelf - w)}h${n(h * 0.75)}v-${n(w * 0.9)}h-${n(h * 0.75)}z`, PAPER);
      x += h * 0.8 + 1;
      continue;
    }
    const lean = r() < 0.07 ? 2.5 : 0;
    const a = r() < 0.35 ? SHADED : PAPER;
    s += path(`M${n(x)} ${shelf}l${lean} -${n(h)}h${n(w)}l-${lean} ${n(h)}z`, a);
    if (r() < 0.5) s += path(`M${n(x + lean * 0.8)} ${n(shelf - h + 2)}h${n(w)}M${n(x + 0.3)} ${shelf - 2}h${n(w)}`, FINE);
    x += w + (r() < 0.1 ? 3 : 0.2);
  }
  return s;
}

/** Hull frames curving down to the bilge, at depth t. */
function rib(t: number): string {
  const l = (x: number, y: number) => P(x, y, t);
  return path(`M${l(34, -10)}C${l(26, 50)} ${l(36, 96)} ${l(64, B)}H${n(X(256, t))}C${l(284, 96)} ${l(294, 50)} ${l(286, -10)}`, ' stroke-width="1.7"');
}

function crate(x: number, y: number, w: number, h: number, d: number, label = ""): string {
  let s = path(`M${x} ${y}l${d} -${d * 0.6}h${w}v${h}l-${d} ${d * 0.6}z`, PAPER);
  s += path(`M${x + w} ${y}l${d} -${d * 0.6}v${h}l-${d} ${d * 0.6}z`, SHADED);
  s += path(`M${x} ${y}h${w}v${h}h-${w}z`, PAPER) + path(`M${x} ${y}h${w}v${h}h-${w}z`, LIGHT);
  for (let i = 1; i < 4; i++) s += path(`M${x} ${n(y + (i * h) / 4)}h${w}`, FINE);
  s += path(`M${x + 2} ${y + 2}L${x + w - 2} ${y + h - 2}`, LIGHT) + path(`M${x} ${y}h3v${h}h-3zM${x + w - 3} ${y}h3v${h}h-3z`, PAPER);
  s += path(`M${x} ${y}l${d} -${d * 0.6}M${x + w} ${y}l${d} -${d * 0.6}`, FINE);
  if (label) s += `<text x="${n(x + w / 2)}" y="${n(y + h / 2 + 2)}" text-anchor="middle" class="stencil">${label}</text>`;
  return s;
}

function barrel(x: number, base: number, w: number, h: number): string {
  let s = path(`M${x - w / 2} ${base - h}q-3 ${h / 2} 0 ${h}h${w}q3 -${h / 2} 0 -${h}z`, PAPER);
  s += path(`M${x + w / 6} ${base - h}q4 ${h / 2} 0 ${h}h${w / 3}q3 -${h / 2} 0 -${h}z`, SHADE);
  s += path(`M${x - w / 2} ${base - h}q-3 ${h / 2} 0 ${h}h${w}q3 -${h / 2} 0 -${h}z`, LIGHT);
  s += ellipse(x, base - h, w / 2, 3, PAPER) + ellipse(x, base - h, w / 2, 3, LIGHT);
  for (const f of [0.18, 0.82]) s += path(`M${n(x - w / 2 - 1.6)} ${n(base - h + h * f)}q${n(w / 2 + 1.6)} 4 ${n(w + 3.2)} 0`, LIGHT);
  for (const dx of [-0.25, 0, 0.25]) s += path(`M${n(x + dx * w)} ${base - h + 3}v${h - 3}`, FINE);
  return s;
}

/**
 * A buttoned leather wing chair, three-quarters on: u runs across the chair,
 * v up from the floor and w back from its front (0) to its back (1), so the
 * right-hand side, turned towards the middle of the room, shows.
 */
function wingChair(x: number, base: number, k: number): string {
  const at = (u: number, v: number, w = 0): string => {
    const px = x + u * k;
    const py = base - v * k;
    return `${n(px + (VX - px) * 0.14 * w)} ${n(py + (VY - py) * 0.14 * w)}`;
  };
  const q = (pts: [number, number, number][], a: string) => poly(pts.map(([u, v, w]) => at(u, v, w)), a);
  const xy = (u: number, v: number, w = 0) => at(u, v, w).split(" ").map(Number) as [number, number];
  let s = ellipse(x + 8 * k, base + 1, 34 * k, 4 * k, SHADE);
  s += path(`M${at(21, 6, 1)}V${n(xy(21, 0, 1)[1])}`, BOLD);
  // The back with its wings, then the buttoned inside of the back.
  const back = `M${at(-23, 30, 1)}L${at(-24, 50, 1)}Q${at(-24, 56, 1)} ${at(-18, 57, 1)}L${at(-15, 62, 1)}Q${at(0, 68, 1)} ${at(15, 62, 1)}L${at(18, 57, 1)}Q${at(24, 56, 1)} ${at(24, 50, 1)}L${at(23, 30, 1)}z`;
  s += path(back, PAPER + LIGHT);
  s += path(`M${at(-15, 32, 1)}L${at(-15, 61, 1)}L${at(-18, 57, 1)}Q${at(-24, 56, 1)} ${at(-24, 50, 1)}L${at(-23, 32, 1)}z`, SHADE_FINE);
  s += path(`M${at(15, 32, 1)}L${at(15, 61, 1)}L${at(18, 57, 1)}Q${at(24, 56, 1)} ${at(24, 50, 1)}L${at(23, 32, 1)}z`, SHADE);
  s += path(`M${at(-15, 32, 1)}V${n(xy(-15, 61, 1)[1])}M${at(15, 32, 1)}V${n(xy(15, 61, 1)[1])}`, FINE);
  const buttons: [number, number][] = [];
  for (const [row, v] of [36, 42, 48, 54, 59].entries()) for (let u = row % 2 ? -9 : -12; u <= 12; u += 6) if (Math.abs(u) < 13) buttons.push([u, v]);
  for (const [u, v] of buttons) {
    s += path(`M${at(u, v, 1)}L${at(u + 3, v + 3, 1)}M${at(u, v, 1)}L${at(u - 3, v + 3, 1)}`, ' stroke-width=".35"');
    s += circle(...xy(u, v, 1), 0.55 * k, SOLID);
  }
  // The side of the chair turned to the room.
  s += q([[24, 34, 0], [24, 34, 1], [24, 6, 1], [24, 6, 0]], PAPER) + q([[24, 34, 0], [24, 34, 1], [24, 6, 1], [24, 6, 0]], SHADED);
  s += path(`M${at(24, 31, 0.15)}Q${at(24, 18, 0.5)} ${at(24, 9, 0.9)}`, FINE);
  // Rolled arms running back to the wings, the inside of the left one in shadow.
  s += q([[-24, 34, 0], [-16, 34, 0], [-16, 34, 1], [-24, 34, 1]], PAPER + LIGHT) + q([[16, 34, 0], [24, 34, 0], [24, 34, 1], [16, 34, 1]], PAPER + LIGHT);
  s += q([[-16, 34, 0], [-16, 34, 1], [-16, 26, 1], [-16, 26, 0]], PAPER) + q([[-16, 34, 0], [-16, 34, 1], [-16, 26, 1], [-16, 26, 0]], SHADE_FINE);
  // Seat cushion: top, piped front.
  s += q([[-16, 26, 0], [16, 26, 0], [16, 26, 0.95], [-16, 26, 0.95]], PAPER + LIGHT) + path(`M${at(-10, 26, 0.5)}q${n(4 * k)} ${n(1.2 * k)} ${n(9 * k)} ${n(0.4 * k)}`, FINE);
  s += q([[-16, 26, 0], [16, 26, 0], [16, 18, 0], [-16, 18, 0]], PAPER + LIGHT) + path(`M${at(-16, 25, 0)}H${n(xy(16, 25)[0])}`, FINE);
  // Arm fronts, each finished in a scroll; the seat rail; brass nailheads; bun feet.
  for (const u of [-20, 20]) {
    s += q([[u - 4, 34, 0], [u + 4, 34, 0], [u + 4, 6, 0], [u - 4, 6, 0]], PAPER + LIGHT);
    const [cx, cy] = xy(u, 30.4);
    s += circle(cx, cy, 3.4 * k, PAPER + LIGHT) + path(`M${n(cx + 1.6 * k)} ${n(cy)}a${n(1.6 * k)} ${n(1.6 * k)} 0 1 1 ${n(-1.2 * k)} ${n(-1.1 * k)}`, FINE);
  }
  s += q([[-16, 18, 0], [16, 18, 0], [16, 6, 0], [-16, 6, 0]], PAPER + LIGHT) + q([[-16, 12, 0], [16, 12, 0], [16, 6, 0], [-16, 6, 0]], SHADE_FINE);
  for (let u = -23; u <= 23; u += 2.4) s += circle(...xy(u, 7.4), 0.42 * k, SOLID);
  for (let v = 9.6; v < 26; v += 2.4) s += circle(...xy(-23, v), 0.42 * k, SOLID) + circle(...xy(23, v), 0.42 * k, SOLID);
  for (const u of [-21, 21]) s += path(`M${at(u - 2, 6)}h${n(4 * k)}l${n(-0.6 * k)} ${n(5 * k)}h${n(-2.8 * k)}z`, PAPER + LIGHT);
  // Light catching the leather.
  s += path(`M${at(-22, 33.4, 0.2)}L${at(-22, 33.4, 0.8)}M${at(18, 33.4, 0.2)}L${at(18, 33.4, 0.8)}M${at(-12, 23, 0)}h${n(10 * k)}`, ' stroke="var(--paper)" stroke-width=".9"');
  return s;
}

function bentwoodChair(x: number, base: number, k: number): string {
  const S = (dx: number) => n(x + dx * k);
  const V = (dy: number) => n(base - dy * k);
  return (
    path(`M${S(-8)} ${V(0)}l2 -${n(20 * k)}M${S(8)} ${V(0)}l-2 -${n(20 * k)}M${S(-4)} ${V(0)}l1 -${n(18 * k)}`, LIGHT) +
    ellipse(+S(0), +V(21), 10 * k, 3 * k, PAPER) +
    ellipse(+S(0), +V(21), 10 * k, 3 * k, LIGHT) +
    path(`M${S(-8)} ${V(21)}v-${n(22 * k)}q0 -7 ${n(8 * k)} -7t${n(8 * k)} 7v${n(22 * k)}`, LIGHT) +
    path(`M${S(-5)} ${V(32)}q${n(5 * k)} -4 ${n(10 * k)} 0`, FINE) +
    ellipse(+S(0), +V(8), 7 * k, 2 * k, FINE)
  );
}

/** A round table with a long cloth, seen from slightly above. */
function clothedTable(x: number, top: number, w: number, drop: number): string {
  let s = path(`M${x - w / 2} ${top}q-2 ${drop * 0.6} -3 ${drop}q${w / 8} 3 ${w / 4} 0q${w / 8} 3 ${w / 4} 0q${w / 8} 3 ${w / 4} 0q${w / 8} 3 ${w / 4} 0q${w / 8} 3 ${w / 4 + 0} 0q-1 -${drop * 0.4} -3 -${drop}z`, PAPER);
  s += path(`M${x - w / 2} ${top}q-2 ${drop * 0.6} -3 ${drop}q${w / 8} 3 ${w / 4} 0q${w / 8} 3 ${w / 4} 0q${w / 8} 3 ${w / 4} 0q${w / 8} 3 ${w / 4} 0q${w / 8} 3 ${w / 4 + 0} 0q-1 -${drop * 0.4} -3 -${drop}z`, LIGHT);
  for (const f of [-0.3, 0, 0.3]) s += path(`M${n(x + f * w)} ${top + 3}q1 ${drop * 0.5} ${n(f * 6)} ${drop - 1}`, FINE);
  s += path(`M${n(x + w * 0.2)} ${top + 2}q3 ${drop * 0.5} 2 ${drop}h${n(w * 0.33)}q-2 -${drop * 0.5} -2 -${drop}z`, SHADE);
  s += ellipse(x, top, w / 2, w / 9, PAPER) + ellipse(x, top, w / 2, w / 9, LIGHT);
  return s;
}

function wineGlass(x: number, base: number): string {
  return path(`M${x - 1.6} ${base}h3.2M${x} ${base}v-3.5M${x - 1.8} ${base - 6.5}q0 3 1.8 3t1.8 -3z`, FINE);
}

function tableLamp(x: number, base: number): string {
  return path(`M${x - 2} ${base}h4M${x} ${base}v-7`, FINE) + path(`M${x - 4.5} ${base - 7}l1.6 -5h5.8l1.6 5z`, PAPER) + path(`M${x - 4.5} ${base - 7}l1.6 -5h5.8l1.6 5z`, SHADED);
}

// ── The rooms ─────────────────────────────────────────────────────────────

function saloon(): string {
  let s = shell("carpet", "coffers");
  // Panelled dado, fluted pilasters, three tall arched windows and a dentil cornice.
  s += polyline([P(L, 92), P(R, 92)], LIGHT) + polyline([P(L, 95), P(R, 95)], FINE);
  for (let x = L + 3; x < R - 20; x += 27) s += path(`M${x} 99h21v9h-21z`, FINE);
  for (let x = L + 2; x < R; x += 4) s += path(`M${x} ${T + 4}v2.5`, FINE);
  for (const x of [88, 160, 232]) s += nightWindow(x - 19, x + 19, 32, 86, 3, 4, true);
  for (const x of [56, 124, 196, 264]) {
    s += path(`M${x - 5} 30h10v62h-10z`, PAPER) + path(`M${x - 5} 30h10v62h-10z`, LIGHT);
    s += path(`M${x - 6.5} 28h13v3.5h-13zM${x - 6.5} 88h13v4h-13z`, PAPER);
    s += path(`M${x - 2.5} 33v53M${x} 33v53M${x + 2.5} 33v53`, FINE);
  }
  // Side walls: more windows, foreshortened.
  for (const t of [1.12, 1.32]) {
    s += poly([P(L, 40, t), P(L, 40, t + 0.12), P(L, 86, t + 0.12), P(L, 86, t)], NIGHT) + poly([P(L, 40, t), P(L, 40, t + 0.12), P(L, 86, t + 0.12), P(L, 86, t)], LIGHT);
    s += poly([P(R, 40, t), P(R, 40, t + 0.12), P(R, 86, t + 0.12), P(R, 86, t)], NIGHT) + poly([P(R, 40, t), P(R, 40, t + 0.12), P(R, 86, t + 0.12), P(R, 86, t)], LIGHT);
  }
  s += chandelier(160, 6, 34);
  // Dining tables laid for supper, out at either side.
  for (const [x, flip] of [
    [34, 1],
    [286, -1],
  ] as const) {
    s += ellipse(x, 132, 30, 5, SHADE);
    for (const d of [-16, 14]) s += path(`M${x + d - 5} 104v-16q5 -4 10 0v16`, PAPER) + path(`M${x + d - 5} 104v-16q5 -4 10 0v16`, LIGHT) + path(`M${x + d - 2} 92v8M${x + d + 2} 92v8`, FINE);
    s += clothedTable(x, 101, 50, 24);
    s += tableLamp(x, 101) + wineGlass(x - 13 * flip, 102) + wineGlass(x + 15 * flip, 100) + ellipse(x + 9 * flip, 103, 4, 1.2, FINE) + ellipse(x - 6 * flip, 99.5, 3.5, 1, FINE);
  }
  return s;
}

function smoking(): string {
  let s = shell("boards", "beams");
  // Dark oak panelling all round.
  s += poly([P(L, T + 4), P(R, T + 4), P(R, B - 4), P(L, B - 4)], GRAIN);
  for (const x0 of [L + 4, L + 36, 206, 238]) for (const [y0, y1] of [[30, 66], [72, 106]] as const) s += path(`M${x0} ${y0}h26v${y1 - y0}h-26z`, PAPER) + path(`M${x0} ${y0}h26v${y1 - y0}h-26z`, LIGHT) + path(`M${x0 + 3} ${y0 + 3}h20v${y1 - y0 - 6}h-20z`, FINE);
  // Overmantel seascape in a heavy frame.
  s += path("M124 26h72v40h-72z", PAPER) + path("M124 26h72v40h-72z", BOLD) + path("M129 31h62v30h-62z", LIGHT);
  s += path("M129 48h62", FINE) + path("M129 31h62v12q-20 -6 -40 2t-22 -2z", SHADE_FINE);
  s += path("M150 48l2 -3h18l2 3zM155 45v-5h3v5M161 45v-6h3v6M166 45v-5h2v5", LIGHT) + path("M157 40q2 -4 6 -5M163 39q2 -4 7 -4", FINE);
  s += path("M130 54q4 -2 8 0t8 0 8 0 8 0 8 0 8 0 8 0M130 58q4 -2 8 0t8 0 8 0 8 0 8 0 8 0 8 0", FINE);
  // Fireplace: marble surround, mantel shelf, iron grate and a live fire.
  s += path("M116 66h88v4h-88z", PAPER) + path("M116 66h88v4h-88z", LIGHT);
  s += path("M124 70h72v42h-72z", PAPER) + path("M124 70h72v42h-72z", LIGHT);
  s += path("M127 72q8 6 4 14M190 74q-6 8 -2 16M150 72q10 3 20 0", FINE);
  s += path("M138 112V90a22 14 0 0 1 44 0v22z", DARK) + path("M138 112V90a22 14 0 0 1 44 0v22z", LIGHT);
  s += path("M146 112v-8h28v8M148 104v8M154 104v8M160 104v8M166 104v8M172 104v8", LIGHT);
  // Two logs on the grate and a fire of licking tongues.
  s += path("M145 106l29 -4", ' stroke-width="3.4"') + path("M145 106l29 -4", ' stroke="var(--paper)" stroke-width="1.6"') + ellipse(145, 106, 1.4, 1.8, PAPER + FINE);
  s += path("M150 101l24 5", ' stroke-width="3"') + path("M150 101l24 5", ' stroke="var(--paper)" stroke-width="1.2"') + ellipse(174, 106, 1.3, 1.6, PAPER + FINE);
  const flame = "M149 103c-2 -5 1 -8 3 -11c0 3 2 4 3 2c1 -4 -1 -7 1 -11c2 4 5 6 5 10c1 -2 1 -4 0 -6c3 3 5 7 4 11c1 -1 2 -3 2 -5c2 3 3 7 1 10z";
  s += `<g class="flicker">${path(flame, PAPER + LIGHT)}${path("M153 102c-1 -3 1 -5 2 -7c1 2 2 2 2 1c1 -2 0 -4 1 -6c2 3 3 5 2 8c1 -1 2 -2 2 -3c1 2 1 5 0 7", FINE)}</g>`;
  s += path("M116 112l-6 6h100l-6 -6", PAPER) + path("M116 112l-6 6h100l-6 -6", LIGHT);
  // Leaded window on the left wall.
  s += poly([P(L, 36, 1.14), P(L, 36, 1.36), P(L, 84, 1.36), P(L, 84, 1.14)], NIGHT) + poly([P(L, 36, 1.14), P(L, 36, 1.36), P(L, 84, 1.36), P(L, 84, 1.14)], BOLD);
  for (let i = 1; i < 5; i++) s += polyline([P(L, 36 + i * 9.6, 1.14), P(L, 36 + i * 9.6, 1.36)], ' stroke="var(--paper)"');
  s += polyline([P(L, 36, 1.25), P(L, 84, 1.25)], ' stroke="var(--paper)"');
  // Club armchair on the left, side table with decanter and a smoking cigar on the right.
  s += wingChair(30, 164, 1.1);
  s += path("M256 108h44v4h-44z", PAPER) + path("M256 108h44v4h-44z", LIGHT) + ellipse(278, 108, 22, 3, PAPER) + ellipse(278, 108, 22, 3, LIGHT);
  s += path("M262 112l-3 46M294 112l3 46M278 112v46M262 140h32", LIGHT) + ellipse(278, 160, 22, 3, SHADE);
  // A ship's decanter, broad in the base so it won't slide, and a tumbler.
  const decanter = "M259 107L264 96Q266 93 266 90V87H270V90Q270 93 272 96L277 107z";
  s += path(decanter, PAPER) + path("M260.5 103.4H275.5L277 107H259z", SHADE) + path(decanter, LIGHT) + path("M265.4 87.6h5.2M265.6 89h4.8", FINE) + circle(268, 85, 2, PAPER + LIGHT);
  s += path("M263 104l3 -7", ' stroke="var(--paper)" stroke-width=".9"');
  s += path("M280 107h4l1 -7h-6z", LIGHT) + ellipse(292, 106.5, 6, 1.6, PAPER) + ellipse(292, 106.5, 6, 1.6, LIGHT) + path("M288 105.5l9 -2", BOLD);
  s += `<g class="drift">${path("M297 103c-4 -6 4 -10 0 -16s4 -10 0 -16", ' stroke-width=".7" opacity=".6"')}${path("M300 100c-3 -5 3 -8 0 -12s3 -8 0 -12", ' stroke-width=".6" opacity=".45"')}</g>`;
  return s;
}

/**
 * A wooden steamer chair facing the rail, seen from the side and a little
 * above: u runs from the head of the chair to its foot, v up from the deck,
 * and w across from the near side (0) to the far side (1).
 */
function steamerChair(x: number, base: number, k: number): string {
  const at = (u: number, v: number, w: number): string => {
    const px = x + u * k;
    const py = base - v * k;
    return `${n(px + (VX - px) * 0.1 * w)} ${n(py + (VY - py) * 0.1 * w)}`;
  };
  const line = (pts: [number, number][], w: number, a: string) => polyline(pts.map(([u, v]) => at(u, v, w)), a);
  const panel = (a0: [number, number], a1: [number, number], w0: number, w1: number, a: string) => poly([at(...a0, w0), at(...a1, w0), at(...a1, w1), at(...a0, w1)], a);
  const CANE = ' fill="url(#ink-hatch-fine)"';
  const WOOD = ' stroke-width="1.5"';
  let s = poly([at(4, 0, 0.1), at(54, 0, 0.1), at(54, 0, 0.9), at(4, 0, 0.9)], SHADE);
  // The far side of the frame.
  s += line([[5, 0], [13, 15]], 1, LIGHT) + line([[32, 0], [31, 14]], 1, LIGHT) + line([[53, 0], [52, 9]], 1, LIGHT);
  s += line([[4, 27], [30, 25], [30, 14]], 1, LIGHT);
  // Caned back, seat and leg rest between the side rails.
  s += panel([1, 40], [12, 15], 0.06, 0.94, PAPER) + panel([1, 40], [12, 15], 0.06, 0.94, CANE + FINE);
  s += panel([12, 15], [32, 14], 0.06, 0.94, PAPER) + panel([12, 15], [32, 14], 0.06, 0.94, CANE + FINE);
  s += panel([32, 14], [54, 9], 0.06, 0.94, PAPER) + panel([32, 14], [54, 9], 0.06, 0.94, CANE + FINE);
  s += line([[1, 40], [12, 15], [32, 14], [54, 9]], 1, WOOD);
  s += panel([0, 41], [2, 37], 0, 1, PAPER + LIGHT);
  // A cushion at the head, and a plaid rug thrown over the foot and hanging down the near side.
  s += path(`M${at(2, 39, 0.15)}Q${at(5, 42, 0.5)} ${at(2, 39, 0.85)}L${at(7, 30, 0.85)}Q${at(9, 33, 0.5)} ${at(7, 30, 0.15)}z`, PAPER + LIGHT);
  const rugTop = [at(28, 15.4, 0.92), at(46, 11.4, 0.92), at(47, 11.2, 0), at(29, 15.2, 0)];
  const rugHang = [at(29, 15.2, 0), at(47, 11.2, 0), at(46, 3, -0.02), at(31, 6, -0.02)];
  s += poly(rugTop, PAPER) + poly(rugTop, ' fill="url(#ink-cross)" stroke="none" opacity=".7"') + poly(rugTop, LIGHT);
  // The near side of the frame: rail, legs and arm.
  s += line([[1, 40], [12, 15], [32, 14], [54, 9]], 0, WOOD);
  s += line([[5, 0], [13, 15]], 0, WOOD) + line([[32, 0], [31, 14]], 0, WOOD) + line([[53, 0], [52, 9]], 0, WOOD) + line([[8, 6], [31, 6]], 0, LIGHT);
  s += poly(rugHang, PAPER) + poly(rugHang, ' fill="url(#ink-cross)" stroke="none" opacity=".7"') + poly(rugHang, LIGHT);
  for (let u = 32; u < 46; u += 2) s += path(`M${at(u, 6 - (u - 31) * 0.21, -0.02)}l0 ${n(1.8 * k)}`, FINE);
  s += line([[4, 27], [30, 25]], 0, ' stroke-width="1.8"') + line([[30, 25], [30, 14]], 0, WOOD);
  return s;
}

function promenade(): string {
  let s = "";
  // An open deck looking aft along the ship: the deckhouse on the left, the
  // rail and the night sea on the right, the deck above held on stanchions.
  // The deck is long, so it starts far behind the usual back wall (t < 1).
  const FAR = 0.42;
  const EDGE = 256;
  s += path("M0 0H320V180H0z", NIGHT);
  s += circle(270, 38, 10, ' fill="var(--paper)"') + circle(270, 38, 10, LIGHT) + path("M265 34q4 -2 7 1M267 42q3 1 6 -1", FINE);
  s += path("M220 54q20 -6 40 -2t40 -4 40 0", ' stroke="var(--paper)" stroke-width="1.2"');
  s += path("M0 78H320", ' stroke="var(--paper)" stroke-width=".8"');
  s += `<g class="waves">${range(5)
    .map((i) => path(`M-40 ${82 + i * 6}${"q10 -2 20 0t20 0".repeat(10)}`, ' stroke="var(--paper)" stroke-width=".7"'))
    .join("")}</g>`;
  s += path("M236 81q20 -1 44 0M250 86q14 -1 26 0", ' stroke="var(--paper)" stroke-width="1.6"');
  // Deck planks.
  s += poly([P(-400, B, FAR), P(EDGE, B, FAR), P(EDGE, B, 3.4), P(-400, B, 3.4)], PAPER);
  for (let i = -16; i <= 25; i++) s += polyline([P(L + i * 8, B, FAR), P(L + i * 8, B, 3.4)], i % 4 === 0 ? LIGHT : FINE);
  for (const t of [0.5, 0.6, 0.72, 0.88, 1.1, 1.4, 1.85, 2.6]) s += polyline([P(-400, B, t), P(EDGE, B, t)], ' stroke-width=".4" opacity=".6"');
  s += polyline([P(EDGE, B, FAR), P(EDGE, B, 3.4)], BOLD);
  // The deck overhead, beams running across.
  s += poly([P(-400, T, FAR), P(EDGE, T, FAR), P(EDGE, T, 2.2), P(-400, T, 2.2)], PAPER) + poly([P(-400, T, FAR), P(EDGE, T, FAR), P(EDGE, T, 2.2), P(-400, T, 2.2)], SHADE_FINE);
  for (const t of [0.5, 0.6, 0.72, 0.88, 1.1, 1.4, 1.85]) s += polyline([P(-400, T, t), P(EDGE, T, t)], LIGHT);
  s += polyline([P(EDGE, T, FAR), P(EDGE, T, 2.2)], BOLD) + polyline([P(EDGE, T + 5, FAR), P(EDGE, T + 5, 2.2)], LIGHT);
  for (const t of [0.6, 0.88, 1.4]) s += path(`M${n(X(140, t))} ${n(Y(T, t))}v${n(4 * t)}`, FINE) + path(`M${n(X(140, t) - 3 * t)} ${n(Y(T + 4, t))}h${n(6 * t)}l-${n(1 * t)} ${n(5 * t)}h-${n(4 * t)}z`, PAPER) + path(`M${n(X(140, t) - 3 * t)} ${n(Y(T + 4, t))}h${n(6 * t)}l-${n(1 * t)} ${n(5 * t)}h-${n(4 * t)}z`, LIGHT);
  // Stanchions and railing along the ship's side.
  for (const t of [0.5, 0.6, 0.72, 0.88, 1.1, 1.4, 1.85, 2.6]) {
    const x = X(EDGE - 2, t);
    const w = 1.5 * t;
    s += path(`M${n(x - w)} ${n(Y(T + 5, t))}h${n(2 * w)}V${n(Y(B, t))}h-${n(2 * w)}z`, PAPER) + path(`M${n(x - w)} ${n(Y(T + 5, t))}h${n(2 * w)}V${n(Y(B, t))}h-${n(2 * w)}z`, LIGHT);
  }
  s += polyline([P(EDGE, 86, FAR), P(EDGE, 86, 3)], BOLD) + polyline([P(EDGE, 87.5, FAR), P(EDGE, 87.5, 3)], FINE) + polyline([P(EDGE, 99, FAR), P(EDGE, 99, 3)], LIGHT);
  for (let t = FAR; t < 3; t *= 1.05) s += polyline([P(EDGE, 87.5, t), P(EDGE, B, t)], FINE);
  const bx = X(EDGE - 2, 1.4) - 1;
  const by = Y(64, 1.4);
  s += ellipse(bx, by, 6, 9, PAPER) + ellipse(bx, by, 6, 9, BOLD) + ellipse(bx, by, 2.4, 4.6, LIGHT) + path(`M${n(bx - 6)} ${n(by)}h12M${n(bx)} ${n(by - 9)}v18`, ' stroke-width="2.6" opacity=".45"');
  // Deckhouse wall on the left: panelling, windows and a door.
  const W = L + 24;
  s += poly([P(W, T + 5, FAR), P(W, T + 5, 3), P(W, B, 3), P(W, B, FAR)], PAPER) + poly([P(W, T + 5, FAR), P(W, T + 5, 3), P(W, B, 3), P(W, B, FAR)], GRAIN);
  s += polyline([P(W, B, FAR), P(W, B, 3)], BOLD) + polyline([P(W, T + 5, FAR), P(W, T + 5, 3)], LIGHT) + polyline([P(W, 92, FAR), P(W, 92, 3)], FINE);
  for (const [t0, t1] of [[0.5, 0.55], [0.6, 0.66], [0.72, 0.8], [0.88, 0.98], [1.1, 1.24], [1.62, 1.84]]) {
    const q = [P(W, 44, t0), P(W, 44, t1), P(W, 76, t1), P(W, 76, t0)];
    s += poly(q, PAPER) + poly(q, WASH) + poly(q, LIGHT) + polyline([P(W, 60, t0), P(W, 60, t1)], FINE);
  }
  const door = [P(W, 38, 1.32), P(W, 38, 1.5), P(W, B, 1.5), P(W, B, 1.32)];
  s += poly(door, PAPER) + poly(door, SHADED) + poly(door, LIGHT) + poly([P(W, 46, 1.35), P(W, 46, 1.47), P(W, 66, 1.47), P(W, 66, 1.35)], ' fill="var(--paper)"') + poly([P(W, 46, 1.35), P(W, 46, 1.47), P(W, 66, 1.47), P(W, 66, 1.35)], FINE);
  // Far end: the aft screen with a companion ladder.
  const fx0 = X(W, FAR);
  const fx1 = X(EDGE, FAR);
  const fy0 = Y(T + 5, FAR);
  const fy1 = Y(B, FAR);
  s += path(`M${n(fx0)} ${n(fy0)}H${n(fx1)}V${n(fy1)}H${n(fx0)}z`, PAPER) + path(`M${n(fx0)} ${n(fy0)}H${n(fx1)}V${n(fy1)}H${n(fx0)}z`, SHADE_FINE) + path(`M${n(fx0)} ${n(fy0)}H${n(fx1)}V${n(fy1)}H${n(fx0)}z`, LIGHT);
  s += path(`M${n(fx1 - 20)} ${n(fy1)}l5 -${n(fy1 - fy0)}M${n(fx1 - 12)} ${n(fy1)}l5 -${n(fy1 - fy0)}`, FINE) + range(6).map((i) => path(`M${n(fx1 - 19.4 + i * 0.8)} ${n(fy1 - 5 - i * 5.4)}h7.4`, ' stroke-width=".4"')).join("");
  s += path(`M${n(fx0 + 10)} ${n(fy0 + 8)}h14v${n(fy1 - fy0 - 8)}h-14z`, LIGHT);
  // Steamer chairs along the deckhouse.
  s += steamerChair(X(W, 1.05) + 2, Y(B, 1.05), 0.55) + steamerChair(X(W, 1.7) + 4, Y(B, 1.7), 0.95) + steamerChair(-10, Y(B, 2.5), 1.3);
  return s;
}

function library(): string {
  let s = shell("carpet", "plain");
  // Glazed bookcases across the back wall, a ladder on its rail.
  const shelves = [44, 62, 80, 98];
  for (const [x0, x1] of [[56, 104], [108, 156], [164, 212], [216, 264]] as const) {
    s += path(`M${x0 - 2} 26h${x1 - x0 + 4}v86h-${x1 - x0 + 4}z`, PAPER) + path(`M${x0 - 2} 26h${x1 - x0 + 4}v86h-${x1 - x0 + 4}z`, LIGHT);
    s += path(`M${x0 - 3} 26h${x1 - x0 + 6}v4h-${x1 - x0 + 6}z`, PAPER);
    let prev = 30;
    shelves.forEach((y, k) => {
      s += books(x0, x1, y, y - prev, x0 * 7 + k);
      s += path(`M${x0} ${y}h${x1 - x0}`, LIGHT);
      prev = y;
    });
    s += path(`M${x0} 100h${x1 - x0}v12h-${x1 - x0}z`, PAPER) + path(`M${x0 + 2} 102h${(x1 - x0) / 2 - 3}v8h-${(x1 - x0) / 2 - 3}zM${(x0 + x1) / 2 + 1} 102h${(x1 - x0) / 2 - 3}v8h-${(x1 - x0) / 2 - 3}z`, FINE);
  }
  s += path("M56 36H264", LIGHT);
  s += path("M222 36l-10 76M234 36l-4 76", LIGHT) + range(7).map((i) => path(`M${n(221 - i * 1.4)} ${46 + i * 10}h${n(12.6 + i * 0.86)}`, FINE)).join("") + path("M220 34q2 -4 4 0M232 34q2 -4 4 0", FINE);
  // Shelves on the side walls too, with spines in perspective.
  for (const side of [L, R]) {
    const r = rng(side);
    for (const y of [30, ...shelves]) s += polyline([P(side, y), P(side, y, 1.6)], LIGHT);
    let prev = 30;
    for (const y of shelves) {
      for (let t = 1.02; t < 1.6; t += 0.012 + r() * 0.02) s += polyline([P(side, y, t), P(side, y - (y - prev) * (0.6 + r() * 0.3), t)], FINE);
      prev = y;
    }
  }
  // A pedestal writing desk, left, with a banker's lamp, an open book and an inkstand; a globe, right.
  const [t0, t1] = [1.42, 1.72];
  const F = (x: number, y: number) => P(x, y, t1);
  const front = (x0: number, y0: number, x1: number, y1: number, a: string) => poly([F(x0, y0), F(x1, y0), F(x1, y1), F(x0, y1)], a);
  s += ellipse(44, 139, 44, 5, SHADE);
  // Kneehole: the back panel in shadow, and the inner side of the left pedestal.
  s += poly([P(86, 97, t0 + 0.06), P(98, 97, t0 + 0.06), P(98, 112, t0 + 0.06), P(86, 112, t0 + 0.06)], PAPER + DARK.replace(' stroke="none"', ""));
  s += poly([P(86, 97, t0 + 0.06), F(86, 97), F(86, 112), P(86, 112, t0 + 0.06)], PAPER) + poly([P(86, 97, t0 + 0.06), F(86, 97), F(86, 112), P(86, 112, t0 + 0.06)], SHADED);
  // The right-hand end of the desk, turned towards the room.
  s += poly([F(114, 93), P(114, 93, t0 + 0.02), P(114, 112, t0 + 0.02), F(114, 112)], PAPER) + poly([F(114, 93), P(114, 93, t0 + 0.02), P(114, 112, t0 + 0.02), F(114, 112)], SHADED);
  for (const t of [1.5, 1.62]) s += polyline([P(114, 96, t), P(114, 108, t)], FINE);
  // Pedestals of drawers with brass pulls, a long drawer over the kneehole, a plinth.
  for (const [x0, x1] of [[68, 86], [98, 114]] as const) {
    s += front(x0, 93, x1, 112, PAPER + LIGHT);
    for (const [y0, y1] of [[94, 98.5], [99.4, 104.4], [105.3, 110.2]] as const) {
      s += front(x0 + 1.2, y0, x1 - 1.2, y1, FINE);
      const c = F((x0 + x1) / 2, (y0 + y1) / 2);
      const [cx, cy] = c.split(" ").map(Number) as [number, number];
      s += path(`M${n(cx - 2.6)} ${n(cy - 0.6)}q2.6 2.2 5.2 0`, LIGHT) + circle(cx - 2.6, cy - 0.6, 0.5, SOLID) + circle(cx + 2.6, cy - 0.6, 0.5, SOLID);
    }
    s += front(x0 - 0.6, 110.4, x1 + 0.6, 112, PAPER + LIGHT);
  }
  s += front(86, 93, 98, 96.8, PAPER + LIGHT) + front(87.2, 93.8, 96.8, 96, FINE);
  // The top: a moulded edge and a tooled leather writing surface.
  s += poly([P(66, 90, t0), P(116, 90, t0), P(116, 90, t1 + 0.02), P(66, 90, t1 + 0.02)], PAPER + LIGHT);
  s += poly([P(70, 90, t0 + 0.04), P(112, 90, t0 + 0.04), P(112, 90, t1 - 0.03), P(70, 90, t1 - 0.03)], SHADE_FINE) + poly([P(70, 90, t0 + 0.04), P(112, 90, t0 + 0.04), P(112, 90, t1 - 0.03), P(70, 90, t1 - 0.03)], FINE);
  s += poly([P(66, 90, t1 + 0.02), P(116, 90, t1 + 0.02), P(116, 93, t1 + 0.02), P(66, 93, t1 + 0.02)], PAPER + LIGHT) + polyline([P(66, 91.6, t1 + 0.02), P(116, 91.6, t1 + 0.02)], FINE);
  s += poly([P(116, 90, t1 + 0.02), P(116, 90, t0), P(116, 93, t0), P(116, 93, t1 + 0.02)], PAPER + LIGHT);
  // Banker's lamp: brass foot and stem, a green glass shade, a pull chain.
  const [lx, ly] = [X(76, 1.5), Y(90, 1.5)];
  s += ellipse(lx, ly, 5, 1.4, PAPER + LIGHT) + path(`M${n(lx)} ${n(ly - 1)}v-9`, LIGHT) + path(`M${n(lx - 2)} ${n(ly - 9)}h4`, FINE);
  s += path(`M${n(lx - 10)} ${n(ly - 10)}q10 -7 20 0l-1 1.6h-18z`, PAPER) + path(`M${n(lx - 10)} ${n(ly - 10)}q10 -7 20 0l-1 1.6h-18z`, SHADED) + path(`M${n(lx - 7)} ${n(ly - 13)}q6 -3.4 12 -0.6`, ' stroke="var(--paper)" stroke-width=".8"');
  s += path(`M${n(lx + 6)} ${n(ly - 8.4)}v4`, ' stroke-width=".4"') + circle(lx + 6, ly - 4, 0.6, SOLID);
  s += path(`M${n(lx - 14)} ${n(ly + 1)}l4 -9M${n(lx + 14)} ${n(ly + 1)}l-4 -9`, ' stroke-width=".35" opacity=".45"');
  // An open book, its pages curling.
  const [bx, by] = [X(100, 1.62), Y(90, 1.62)];
  s += path(`M${n(bx)} ${n(by - 0.4)}Q${n(bx - 5)} ${n(by - 2.8)} ${n(bx - 11)} ${n(by - 1.2)}L${n(bx - 12)} ${n(by + 1.6)}Q${n(bx - 6)} ${n(by + 0.4)} ${n(bx)} ${n(by + 2.2)}Q${n(bx + 6)} ${n(by + 0.4)} ${n(bx + 12)} ${n(by + 1.6)}L${n(bx + 11)} ${n(by - 1.2)}Q${n(bx + 5)} ${n(by - 2.8)} ${n(bx)} ${n(by - 0.4)}z`, PAPER + LIGHT);
  s += path(`M${n(bx)} ${n(by - 0.4)}v2.6`, FINE) + range(3).map((i) => path(`M${n(bx - 9.6)} ${n(by - 0.6 + i * 0.7)}q4.4 -1.2 8.4 0.4M${n(bx + 1.2)} ${n(by - 0.2 + i * 0.7)}q4 -1.6 8.4 -0.4`, ' stroke-width=".3"')).join("");
  // Inkstand: a tray, two wells and a quill.
  const [ix, iy] = [X(110, 1.48), Y(90, 1.48)];
  s += path(`M${n(ix - 6)} ${n(iy)}h12l1 -1.2h-14z`, PAPER + FINE) + path(`M${n(ix - 4.6)} ${n(iy - 1.2)}v-3h3v3M${n(ix + 1.4)} ${n(iy - 1.2)}v-3h3v3`, PAPER + FINE);
  s += path(`M${n(ix - 3)} ${n(iy - 4)}l5 -10q1.6 -1 1 1.2l-5.4 8.8z`, PAPER + FINE) + path(`M${n(ix - 0.6)} ${n(iy - 8)}l3 -5`, ' stroke-width=".35"');
  s += circle(288, 104, 17, PAPER) + circle(288, 104, 17, LIGHT);
  s += path("M288 87v34M271 104h34M273 96q15 4 30 0M273 112q15 -4 30 0M281 88q-6 16 0 32M295 88q6 16 0 32", FINE);
  s += path("M280 94q4 -2 7 2t-1 7q-4 2 -6 -3zM292 104q5 -3 8 1l-2 6q-5 1 -6 -3z", SHADE_FINE);
  s += path("M267 101a21 21 0 0 0 41 7", BOLD) + path("M270 112a20 20 0 0 0 36 0", ' stroke-width=".4"') + circle(287.4, 82.6, 1, SOLID);
  s += path("M286 121h4l-0.6 4q2 1 1.6 3l-1 8h-4.6l-1 -8q-0.4 -2 1.6 -3z", PAPER + LIGHT) + path("M285.6 128h4.8M285.4 132h5.2", FINE);
  s += path("M286 136q-6 4 -12 12q-2 2 -4 1M290 136q6 4 12 12q2 2 4 1M288 136q0 8 2 15q1 2 3 1", LIGHT) + ellipse(288, 151, 16, 2.6, SHADE);
  return s;
}

function verandah(): string {
  let s = shell("checks", "beams", ' fill="url(#ink-lattice)" stroke="none" opacity=".55"');
  // Trellis everywhere, three great arched windows on the night sea.
  s += poly([P(L, T + 4), P(R, T + 4), P(R, B - 4), P(L, B - 4)], ' fill="url(#ink-lattice)" stroke="none" opacity=".55"');
  for (const x of [88, 160, 232]) s += nightWindow(x - 24, x + 24, 30, 98, 4, 5, true);
  s += path("M140 52q20 -3 40 0", ' stroke="var(--paper)"') + circle(224, 52, 4, ' fill="var(--paper)" stroke="none"');
  // Hanging lamps.
  for (const x of [124, 196]) s += path(`M${x} 0v18`, FINE) + path(`M${x - 5} 18h10l-2 7h-6z`, PAPER) + path(`M${x - 5} 18h10l-2 7h-6z`, LIGHT) + path(`M${x - 2} 25h4v2h-4z`, FINE);
  // Potted palms in the corners, wicker chairs and café tables laid for tea.
  s += cafeTable(98, 128, 0.9) + cafeTable(222, 128, 0.9);
  s += pottedPalm(14, 148, 1.05, 7) + pottedPalm(306, 150, 1.05, 11);
  s += wickerChair(58, 170, 1.1) + wickerChair(262, 170, 1.1);
  return s;
}

function turkish(): string {
  let s = shell("tiles", "plain", ' fill="url(#ink-tile)" stroke="none" opacity=".6"');
  // Tiled dado, Moorish horseshoe arches with striped voussoirs, a pierced brass lantern.
  s += poly([P(L, 66), P(R, 66), P(R, B - 4), P(L, B - 4)], ' fill="url(#ink-tile)" stroke="none" opacity=".8"') + polyline([P(L, 66), P(R, 66)], LIGHT);
  for (const x of [92, 160, 228]) {
    const r = 23;
    const cy = 54;
    const j = r * 0.8; // the jambs stand inside the circle, so the arch closes in at the foot: a horseshoe
    const foot = cy + Math.sqrt(r * r - j * j);
    const ri = r - 5;
    const ji = j - 5;
    const footI = cy + Math.sqrt(ri * ri - ji * ji);
    const outer = `M${n(x - j)} 112V${n(foot)}A${r} ${r} 0 1 1 ${n(x + j)} ${n(foot)}V112`;
    const inner = `M${n(x - ji)} 112V${n(footI)}A${ri} ${ri} 0 1 1 ${n(x + ji)} ${n(footI)}V112`;
    s += path(`${outer}z`, PAPER) + path(`${inner}z`, DARK);
    // Striped voussoirs: alternate wedges shaded.
    const start = (Math.atan2(foot - cy, -j) * 180) / Math.PI;
    const end = 360 + (Math.atan2(foot - cy, j) * 180) / Math.PI;
    const k = 11;
    for (let i = 0; i < k; i++) {
      const a0 = ((start + ((end - start) * i) / k) * Math.PI) / 180;
      const a1 = ((start + ((end - start) * (i + 1)) / k) * Math.PI) / 180;
      const pts = [
        [x + Math.cos(a0) * r, cy + Math.sin(a0) * r],
        [x + Math.cos(a0) * ri, cy + Math.sin(a0) * ri],
        [x + Math.cos(a1) * ri, cy + Math.sin(a1) * ri],
        [x + Math.cos(a1) * r, cy + Math.sin(a1) * r],
      ].map(([px, py]) => `${n(px!)} ${n(py!)}`);
      if (i % 2 === 0) s += poly(pts, SHADE);
      s += polyline([pts[0]!, pts[1]!], FINE);
    }
    s += path(outer, BOLD) + path(inner, LIGHT);
    s += path(`M${n(x - j - 3)} 112v-${n(112 - foot)}h6v${n(112 - foot)}M${n(x + j - 3)} 112v-${n(112 - foot)}h6v${n(112 - foot)}`, PAPER);
    s += path(`M${n(x - j - 4)} ${n(foot - 3)}h8v3h-8zM${n(x + j - 4)} ${n(foot - 3)}h8v3h-8z`, PAPER) + path(`M${n(x - j - 4)} ${n(foot - 3)}h8v3h-8zM${n(x + j - 4)} ${n(foot - 3)}h8v3h-8z`, LIGHT);
  }
  // A domed ceiling hinted by its ribs.
  s += path("M52 22Q160 -30 268 22M90 22Q160 -14 230 22", FINE);
  s += path("M160 0v10", FINE) + path("M152 10h16l3 6-3 12h-16l-3 -12z", PAPER) + path("M152 10h16l3 6-3 12h-16l-3 -12z", LIGHT) + path("M149 16h22M152 28l8 6 8 -6", FINE);
  for (const [x, y] of [[154, 13], [160, 13], [166, 13], [152, 20], [157, 21], [163, 21], [168, 20], [155, 25], [165, 25]]) s += circle(x!, y!, 0.8, SOLID);
  // A marble bench running along the left wall: a rolled headrest, a striped towel, bath clogs on the floor.
  const [b0, b1, top, t0, t1] = [52, 98, 98, 1.3, 3.2];
  const side = (x: number, y0: number, y1: number, ta: number, tb: number) => [P(x, y0, ta), P(x, y0, tb), P(x, y1, tb), P(x, y1, ta)];
  const end = (x0: number, x1: number, y0: number, y1: number, t: number) => [P(x0, y0, t), P(x1, y0, t), P(x1, y1, t), P(x0, y1, t)];
  s += poly(side(b1 - 2, top + 3, 112, t0 + 0.05, t1), PAPER + LIGHT) + poly(side(b1 - 2, top + 3, top + 5.5, t0 + 0.05, t1), SHADE);
  s += poly(end(b0, b1 - 2, top + 3, 112, t0 + 0.05), PAPER) + poly(end(b0, b1 - 2, top + 3, 112, t0 + 0.05), SHADED);
  for (const [ta, tb] of [[1.4, 1.62], [1.72, 1.98], [2.08, 2.5]]) s += poly(side(b1 - 2, top + 8, 109, ta, tb), FINE) + polyline([P(b1 - 2, 109, ta), P(b1 - 2, 109, tb)], LIGHT);
  s += poly([P(b0, top, t0), P(b1, top, t0), P(b1, top, t1), P(b0, top, t1)], PAPER + LIGHT);
  s += poly(side(b1, top, top + 3, t0, t1), PAPER + LIGHT) + poly(end(b0, b1, top, top + 3, t0), PAPER + LIGHT);
  // Veins in the marble.
  s += polyline([P(b1, top + 1, 1.45), P(b1, top + 2.4, 1.56), P(b1, top + 0.8, 1.68)], ' stroke-width=".35"') + polyline([P(b1 - 2, top + 5, 1.8), P(b1 - 2, top + 8, 1.86), P(b1 - 2, top + 7, 1.92), P(b1 - 2, top + 12, 2.0)], ' stroke-width=".35"');
  s += polyline([P(b0 + 26, top, 2.1), P(b0 + 34, top, 2.24), P(b0 + 30, top, 2.4)], ' stroke-width=".35"') + polyline([P(b0 + 18, top, 1.5), P(b0 + 28, top, 1.6), P(b0 + 38, top, 1.56)], ' stroke-width=".35"');
  // Headrest: a marble roll across the far end.
  s += poly([P(b0 + 1, top - 4, t0 + 0.13), P(b1 - 1, top - 4, t0 + 0.13), P(b1 - 1, top, t0 + 0.13), P(b0 + 1, top, t0 + 0.13)], PAPER + LIGHT);
  s += poly([P(b0 + 1, top - 4, t0 + 0.04), P(b1 - 1, top - 4, t0 + 0.04), P(b1 - 1, top - 4, t0 + 0.13), P(b0 + 1, top - 4, t0 + 0.13)], PAPER + LIGHT);
  s += ellipse(X(b1 - 1, t0 + 0.085), Y(top - 2, t0 + 0.085), 1.6, 3, PAPER + LIGHT);
  // A peştamal towel, folded on the bench and hanging over its edge.
  const [ta, tb] = [1.76, 1.96];
  s += poly([P(b0 + 4, top, ta), P(b1, top, ta), P(b1, top, tb), P(b0 + 4, top, tb)], PAPER + LIGHT);
  s += poly(side(b1 + 0.4, top, top + 10, ta, tb), PAPER + LIGHT);
  for (const y of [top + 3, top + 4.2, top + 7]) s += polyline([P(b1 + 0.4, y, ta), P(b1 + 0.4, y, tb)], FINE);
  for (let t = ta + 0.02; t < tb; t += 0.03) s += polyline([P(b1 + 0.4, top + 10, t), P(b1 + 0.4, top + 11.6, t)], ' stroke-width=".4"');
  for (const x of [b0 + 20, b0 + 30]) s += polyline([P(x, top, ta), P(x, top, tb)], FINE);
  // Wooden bath clogs on their stilts.
  for (const [cx, cy] of [[X(110, 1.72), Y(112, 1.72)], [X(118, 1.86), Y(112, 1.86)]] as const) {
    s += path(`M${n(cx - 1.6)} ${n(cy)}v-2.4h2v2.4zM${n(cx + 6)} ${n(cy)}v-2.4h2v2.4z`, PAPER + FINE) + path(`M${n(cx - 2.4)} ${n(cy - 2.4)}h11.8l0.6 -1.4h-13z`, PAPER + LIGHT) + path(`M${n(cx + 1)} ${n(cy - 3.6)}q2.4 -3 5 0`, LIGHT);
  }
  // A carved marble basin against the right wall, a brass tap trickling into it, a hammam bowl on its rim.
  s += block(244, 268, 97, 112, 1.1, 1.36);
  const kx = (x: number) => X(x, 1.36);
  const ky = (y: number) => Y(y, 1.36);
  s += path(`M${n(kx(247))} ${n(ky(112))}V${n(ky(104))}Q${n(kx(256))} ${n(ky(98.6))} ${n(kx(265))} ${n(ky(104))}V${n(ky(112))}`, FINE) + path(`M${n(kx(250))} ${n(ky(112))}V${n(ky(105))}Q${n(kx(256))} ${n(ky(101.4))} ${n(kx(262))} ${n(ky(105))}V${n(ky(112))}`, ' stroke-width=".4"');
  s += ellipse(X(256, 1.23), Y(97, 1.23), 11, 1.5, DARK);
  const [tx, ty] = [X(268, 1.23), Y(84, 1.23)];
  s += circle(tx, ty, 2, PAPER + LIGHT) + path(`M${n(tx - 1)} ${n(ty)}h-7q-2 0 -2 2v1.4`, ' stroke-width="1.6"') + path(`M${n(tx - 4)} ${n(ty - 1)}v-3h-2h4`, LIGHT);
  s += path(`M${n(tx - 10)} ${n(ty + 4)}q0.6 5 0 ${n(Y(97, 1.23) - ty - 5)}`, ' stroke-width=".5" opacity=".7"');
  const [hx, hy] = [X(247, 1.24), Y(97, 1.24)];
  s += path(`M${n(hx - 5)} ${n(hy - 3)}q5 7 10 0z`, PAPER + LIGHT) + ellipse(hx, hy - 3, 5, 1, PAPER + FINE) + circle(hx - 1.4, hy - 0.8, 0.4, SOLID) + circle(hx + 1.6, hy - 0.8, 0.4, SOLID) + circle(hx, hy + 0.4, 0.4, SOLID);
  s += `<g class="drift">${path("M108 140c-6 -8 6 -14 0 -22s6 -14 0 -22", ' stroke-width=".8" opacity=".45"')}${path("M206 136c-5 -7 5 -12 0 -19s5 -12 0 -19", ' stroke-width=".8" opacity=".4"')}</g>`;
  return s;
}

function ballroom(): string {
  let s = shell("parquet", "coffers");
  // Gilt-framed mirrors between pilasters.
  for (const x of [85, 160, 235]) {
    s += path(`M${x - 22} 32h44v66h-44z`, PAPER) + path(`M${x - 22} 32h44v66h-44z`, BOLD) + path(`M${x - 19} 35h38v60h-38z`, LIGHT);
    s += path(`M${x - 12} 42l-6 10M${x - 6} 40l-12 22M${x + 14} 60l-10 20M${x + 18} 70l-6 12`, FINE);
    s += path(`M${x - 14} 32q4 -8 14 -8t14 8M${x - 6} 26q6 -6 12 0`, LIGHT) + circle(x, 24, 1.6, LIGHT);
  }
  for (const x of [56, 122, 198, 264]) s += path(`M${x - 4} 28h8v84h-8z`, PAPER) + path(`M${x - 4} 28h8v84h-8z`, LIGHT) + path(`M${x - 1.5} 32v76M${x + 1.5} 32v76`, FINE);
  s += chandelier(96, 4, 28) + chandelier(224, 4, 28);
  // Polished floor: reflections of the chandeliers.
  s += path("M92 118v30M98 118v38M226 118v30M220 118v38", ' stroke-width=".5" opacity=".45"');
  // Grand piano, lid up, on the right; music stands and chairs on the left.
  s += ellipse(282, 160, 42, 4.5, SHADE);
  const rim = "M226 116L244 104L316 97Q330 100 326 112Q322 122 300 121Q282 119 270 124L244 128z";
  s += path("M244 128L270 124Q282 119 300 121Q322 122 326 112V122Q322 132 300 131Q282 129 270 134L244 138z", PAPER) + path("M244 128L270 124Q282 119 300 121Q322 122 326 112V122Q322 132 300 131Q282 129 270 134L244 138z", SHADED);
  s += path("M226 116L244 128V138L226 126z", PAPER) + path("M226 116L244 128V138L226 126z", LIGHT);
  for (const [x0, y0, len] of [[232, 128, 26], [250, 136, 24], [318, 124, 24]] as const) s += path(`M${x0 - 2.4} ${y0}h4.8l-1 ${len}h-2.8z`, PAPER) + path(`M${x0 - 2.4} ${y0}h4.8l-1 ${len}h-2.8z`, LIGHT) + ellipse(x0, y0 + len + 1, 2.4, 1, LIGHT);
  s += path("M240 136v14M244 136v14M238 150h8", LIGHT) + path("M237 152h4M243 152h4", BOLD);
  s += path(rim, PAPER) + path(rim, BOLD) + path("M232 116L246 107L314 100Q324 102 321 111Q318 118 300 117Q282 115 270 120L246 124z", FINE);
  // The lid, propped open on its stick, its underside towards us.
  s += path("M244 104L258 60Q292 44 322 64L316 97z", PAPER) + path("M244 104L258 60Q292 44 322 64L316 97z", SHADE_FINE) + path("M244 104L258 60Q292 44 322 64L316 97z", BOLD);
  s += path("M262 64Q292 50 318 68", FINE) + path("M290 118L294 72", LIGHT);
  // Keyboard, fallboard and the music desk with a score on it.
  s += path("M226 116L244 104L248 106L230 118z", PAPER) + path("M226 116L244 104L248 106L230 118z", LIGHT);
  for (let i = 1; i < 12; i++) s += path(`M${n(226 + i * 1.6)} ${n(116 - i * 1.07)}l${n(3.6)} 2`, ' stroke-width=".35"');
  s += path("M244 102l16 -2v-14l-16 2z", PAPER) + path("M244 102l16 -2v-14l-16 2z", LIGHT) + path("M246 92l12 -1.5M246 95l12 -1.5M246 98l12 -1.5", ' stroke-width=".35"');
  for (const [x, base] of [[30, 150], [62, 136]] as const) {
    s += path(`M${x} ${base}l-6 6M${x} ${base}l6 6M${x} ${base}v-34`, LIGHT) + path(`M${x - 10} ${base - 34}l20 -2v-12l-20 2z`, PAPER) + path(`M${x - 10} ${base - 34}l20 -2v-12l-20 2z`, LIGHT);
    s += path(`M${x - 8} ${base - 40}l16 -1.6M${x - 8} ${base - 43}l16 -1.6M${x - 8} ${base - 37}l16 -1.6`, ' stroke-width=".35"');
  }
  s += bentwoodChair(14, 172, 1.2) + bentwoodChair(80, 142, 0.85);
  return s;
}

function wireless(): string {
  let s = shell("boards", "pipes");
  // The Marconi set: slate panels of dials and switches, the tuner coil and the spark gap.
  s += path("M66 34h188v62h-188z", PAPER) + path("M66 34h188v62h-188z", DARK) + path("M66 34h188v62h-188z", BOLD);
  for (const x of [128, 192]) s += path(`M${x} 34v62`, ' stroke="var(--paper)"');
  const dial = (x: number, y: number, r: number) =>
    circle(x, y, r, PAPER) +
    circle(x, y, r, LIGHT) +
    range(9)
      .map((i) => {
        const a = (-200 + i * 27.5) * (Math.PI / 180);
        return path(`M${n(x + Math.cos(a) * r * 0.75)} ${n(y + Math.sin(a) * r * 0.75)}L${n(x + Math.cos(a) * r * 0.92)} ${n(y + Math.sin(a) * r * 0.92)}`, FINE);
      })
      .join("") +
    path(`M${x} ${y}l${n(r * 0.5)} -${n(r * 0.55)}`, LIGHT);
  s += dial(88, 54, 9) + dial(110, 54, 9) + dial(160, 50, 11) + dial(214, 54, 9) + dial(236, 54, 9);
  for (const x of [80, 92, 104, 116, 204, 216, 228, 240]) s += circle(x, 78, 2.4, PAPER) + circle(x, 78, 2.4, FINE) + path(`M${x} 78l1.6 -1.6`, FINE);
  s += path("M140 70h40v18h-40z", PAPER) + path("M140 70h40v18h-40z", LIGHT) + path("M144 74h32M144 79h24M144 84h28", FINE);
  s += path("M96 34V24h40v10", LIGHT) + range(12).map((i) => ellipse(100 + i * 3, 26.5, 1.6, 4.5, FINE)).join("");
  s += path("M190 34v-8h8M222 34v-8h-8", LIGHT) + circle(200, 26, 2.6, PAPER) + circle(200, 26, 2.6, LIGHT) + circle(212, 26, 2.6, PAPER) + circle(212, 26, 2.6, LIGHT);
  s += path("M203 24l2 2 -2 2 3 1", ' class="spark" stroke-width="1.2"');
  s += path("M66 70q-10 10 -8 30M254 66q10 14 6 34", LIGHT);
  // Operator's bench: Morse key, headphones, message pad and log book.
  s += block(54, 266, 96, 112, 1, 1.22);
  const fb = (x0: number, y0: number, x1: number, y1: number, a: string) => poly([P(x0, y0, 1.22), P(x1, y0, 1.22), P(x1, y1, 1.22), P(x0, y1, 1.22)], a);
  s += poly([P(104, 99, 1.04), P(216, 99, 1.04), P(216, 112, 1.04), P(104, 112, 1.04)], PAPER) + poly([P(104, 99, 1.04), P(216, 99, 1.04), P(216, 112, 1.04), P(104, 112, 1.04)], ' fill="url(#ink-cross)" opacity=".8"');
  for (const x of [104, 216]) s += poly([P(x, 99, 1.04), P(x, 99, 1.22), P(x, 112, 1.22), P(x, 112, 1.04)], PAPER) + poly([P(x, 99, 1.04), P(x, 99, 1.22), P(x, 112, 1.22), P(x, 112, 1.04)], SHADED);
  s += fb(54, 96, 266, 99, PAPER + LIGHT);
  for (const [x0, x1] of [[54, 104], [216, 266]] as const)
    for (const [y0, y1] of [[100, 105.5], [106.4, 111]] as const) {
      s += fb(x0 + 2, y0, x1 - 2, y1, FINE);
      const [px, py] = [X((x0 + x1) / 2, 1.22), Y((y0 + y1) / 2, 1.22)];
      s += path(`M${n(px - 3)} ${n(py - 0.6)}q3 2.4 6 0`, LIGHT);
    }
  s += path("M78 96h16v-2h-16zM82 94l10 -3M92 91v-2", LIGHT) + circle(92, 88.5, 1.6, PAPER) + circle(92, 88.5, 1.6, LIGHT);
  s += path("M108 95q-2 -10 8 -10t8 10", LIGHT) + ellipse(108, 95, 2.4, 1.4, PAPER) + ellipse(124, 95, 2.4, 1.4, PAPER) + ellipse(108, 95, 2.4, 1.4, LIGHT) + ellipse(124, 95, 2.4, 1.4, LIGHT);
  s += path("M204 96l3 -4h22l-3 4z", PAPER) + path("M204 96l3 -4h22l-3 4z", LIGHT) + path("M209 94h14M210 95h12", ' stroke-width=".3"') + path("M226 92l10 -3", BOLD);
  // Messages pinned up, porthole, a chair.
  for (const [x, y, a] of [[24, 46, -4], [36, 60, 3], [296, 44, 4]] as const) s += `<g transform="rotate(${a} ${x} ${y})">${path(`M${x - 6} ${y - 7}h12v14h-12z`, PAPER)}${path(`M${x - 6} ${y - 7}h12v14h-12z`, FINE)}${path(`M${x - 4} ${y - 3}h8M${x - 4} ${y}h6M${x - 4} ${y + 3}h7`, ' stroke-width=".35"')}${circle(x, y - 6, 0.8, SOLID)}</g>`;
  s += sidePorthole("r", 62, 1.25, 11);
  s += bentwoodChair(278, 170, 1.45);
  return s;
}

function galley(): string {
  let s = shell("checks", "pipes", ' fill="url(#ink-grid)" stroke="none" opacity=".7"');
  s += poly([P(L, T + 4), P(R, T + 4), P(R, B - 4), P(L, B - 4)], ' fill="url(#ink-grid)" stroke="none" opacity=".7"');
  // The great range under its hood, stockpots steaming.
  s += path("M74 28h172l-14 22h-144z", PAPER) + path("M74 28h172l-14 22h-144z", SHADED) + path("M74 28h172l-14 22h-144z", BOLD) + path("M150 28v-8h20v8", LIGHT);
  for (let x = 80; x < 244; x += 8) s += circle(x, 31, 0.6, SOLID);
  s += block(70, 250, 82, 112, 1, 1.16);
  // Oven doors with bar handles and gauges, ash-pit vents below, a brass rail along the front.
  const ry = (y: number) => n(Y(y, 1.16));
  for (const x of [72, 117, 162, 207]) {
    const [x0, x1] = [X(x + 2, 1.16), X(x + 41, 1.16)];
    const w = x1 - x0;
    s += path(`M${n(x0)} ${ry(87)}H${n(x1)}V${ry(104)}H${n(x0)}z`, PAPER + LIGHT) + path(`M${n(x0 + 2.4)} ${n(+ry(87) + 5)}H${n(x1 - 2.4)}V${n(+ry(104) - 2.4)}H${n(x0 + 2.4)}z`, FINE);
    s += path(`M${n(x0 + w * 0.2)} ${n(+ry(87) + 2.6)}H${n(x1 - w * 0.2)}`, BOLD) + path(`M${n(x0 + w * 0.2)} ${n(+ry(87) + 2.6)}v-1.6M${n(x1 - w * 0.2)} ${n(+ry(87) + 2.6)}v-1.6`, LIGHT);
    s += circle((x0 + x1) / 2, +ry(95.6), 3, PAPER + LIGHT) + path(`M${n((x0 + x1) / 2)} ${ry(95.6)}l1.6 -1.6`, FINE);
    s += path(`M${n(x0)} ${ry(105)}H${n(x1)}V${ry(111)}H${n(x0)}z`, PAPER + LIGHT) + range(7).map((i) => path(`M${n(x0 + w * (0.2 + i * 0.1))} ${n(+ry(105) + 1.6)}v3.4`, FINE)).join("");
  }
  s += path(`M${n(X(70, 1.2))} ${n(Y(85, 1.2))}H${n(X(250, 1.2))}`, ' stroke-width="1.6"') + path(`M${n(X(70, 1.2))} ${n(Y(85, 1.2))}H${n(X(250, 1.2))}`, ' stroke="var(--paper)" stroke-width=".5"');
  for (const x of [72, 160, 248]) s += path(`M${n(X(x, 1.2))} ${n(Y(85, 1.2))}l0 -2.6`, LIGHT);
  for (const [x, w, h] of [[96, 26, 22], [140, 18, 14], [180, 30, 26], [222, 16, 10]] as const) {
    s += path(`M${x - w / 2} 82v-${h}h${w}v${h}`, PAPER) + path(`M${x + w / 6} 82v-${h}h${w / 3}v${h}`, SHADE) + path(`M${x - w / 2} 82v-${h}h${w}v${h}`, LIGHT);
    s += ellipse(x, 82 - h, w / 2, 2.4, PAPER) + ellipse(x, 82 - h, w / 2, 2.4, LIGHT) + path(`M${x - w / 2 - 3} ${86 - h}h3M${x + w / 2} ${86 - h}h3`, BOLD);
  }
  s += `<g class="drift">${path("M96 58c-4 -6 4 -10 0 -16s4 -10 0 -16", ' stroke-width=".8" opacity=".5"')}${path("M180 54c-4 -6 4 -10 0 -16s4 -10 0 -16", ' stroke-width=".8" opacity=".45"')}</g>`;
  // Copper pans and ladles hung from a rack overhead.
  s += path("M0 22H320", BOLD) + path("M30 0v22M290 0v22", LIGHT);
  for (const [x, r] of [[20, 9], [52, 7], [270, 8], [300, 10]] as const) s += path(`M${x} 22v4`, FINE) + path(`M${x} 26v${12}`, BOLD) + circle(x, 38 + r, r, PAPER) + circle(x, 38 + r, r, LIGHT) + circle(x, 38 + r, r - 2.4, FINE) + path(`M${x - r * 0.4} ${38 + r * 1.3}a${r * 0.6} ${r * 0.6} 0 0 0 ${r} ${-r * 0.4}`, SHADE_FINE);
  for (const x of [72, 82, 240, 250]) s += path(`M${x} 22v26`, LIGHT) + ellipse(x, 50, 3, 2, PAPER) + ellipse(x, 50, 3, 2, LIGHT);
  // A butcher's block: a deep end-grain top on stout legs, a cleaver bitten into it, onions on the shelf below.
  const [u0, u1, ta, tb] = [80, 106, 1.62, 1.95];
  s += ellipse(X(92, 1.8) + 4, Y(112, 1.8) + 2, 30, 4, SHADE);
  const leg = (x: number, t: number) => poly([P(x, 104, t), P(x + 3, 104, t), P(x + 3, 112, t), P(x, 112, t)], PAPER + LIGHT);
  s += leg(u1 - 3, ta + 0.03) + leg(u0, ta + 0.03);
  s += poly([P(u0, 109, ta + 0.03), P(u1, 109, ta + 0.03), P(u1, 109, tb - 0.03), P(u0, 109, tb - 0.03)], PAPER + LIGHT);
  for (const [x, t] of [[88, 1.75], [93, 1.8], [98, 1.74]] as const) s += circle(X(x, t), Y(109, t) - 2.2, 2.4, PAPER + LIGHT) + path(`M${n(X(x, t))} ${n(Y(109, t) - 4.6)}l0.6 -1.6`, FINE);
  s += leg(u1 - 3, tb - 0.03) + leg(u0, tb - 0.03);
  s += block(u0, u1, 97, 104, ta, tb);
  s += poly([P(u0, 97, tb), P(u1, 97, tb), P(u1, 104, tb), P(u0, 104, tb)], ' fill="url(#ink-grid)" stroke="none"');
  s += polyline([P(u0 + 4, 97, ta + 0.08), P(u1 - 6, 97, ta + 0.14), P(u0 + 9, 97, tb - 0.06)], ' stroke-width=".35"');
  const [cx, cy] = [X(96, 1.8), Y(97, 1.8)];
  s += path(`M${n(cx - 6)} ${n(cy)}l1 -9h10l-1 9z`, PAPER + LIGHT) + path(`M${n(cx - 5)} ${n(cy - 1.6)}h8`, ' stroke-width=".35"') + circle(cx + 1.6, cy - 6.6, 0.9, FINE);
  s += path(`M${n(cx + 5)} ${n(cy - 7.6)}l9 -3`, ' stroke-width="2.6"') + path(`M${n(cx + 8)} ${n(cy - 8.6)}h0.1M${n(cx + 11)} ${n(cy - 9.6)}h0.1`, ' stroke="var(--paper)" stroke-width=".8"');
  for (const [x, base] of [[272, 160], [300, 166]] as const) {
    s += path(`M${x - 14} ${base}q-4 -18 2 -32q12 -4 24 0q6 14 2 32z`, PAPER) + path(`M${x - 14} ${base}q-4 -18 2 -32q12 -4 24 0q6 14 2 32z`, LIGHT);
    s += path(`M${x - 12} ${base - 32}q12 -6 24 0M${x - 8} ${base - 34}l2 -4h12l2 4`, LIGHT) + `<text x="${x}" y="${base - 12}" text-anchor="middle" class="stencil">FLOUR</text>`;
  }
  return s;
}

function purser(): string {
  let s = shell("boards", "plain");
  // Pigeonholes stuffed with post, a board of cabin keys, the strongroom safe.
  s += path("M60 30h96v64h-96z", PAPER) + path("M60 30h96v64h-96z", BOLD);
  const r = rng(77);
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 5; j++) {
      const x = 60 + i * 12;
      const y = 30 + j * 12.8;
      s += path(`M${x} ${n(y)}h12v12.8h-12z`, FINE);
      const k = r();
      if (k < 0.55) s += path(`M${n(x + 1.5)} ${n(y + 12.8)}v-${n(5 + r() * 4)}h9v${n(5 + r() * 2)}`, PAPER) + path(`M${n(x + 1.5)} ${n(y + 12.8)}v-${n(5 + r() * 4)}h9`, FINE);
      else if (k < 0.75) s += path(`M${x + 1} ${n(y + 12.8)}h10v-3h-10z`, SHADE);
      else s += path(`M${x} ${n(y)}h12v12.8h-12z`, ' fill="url(#ink-hatch-fine)" stroke="none"');
    }
  s += path("M168 34h46v44h-46z", PAPER) + path("M168 34h46v44h-46z", GRAIN) + path("M168 34h46v44h-46z", LIGHT);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 3; j++) {
      const x = 174 + i * 11;
      const y = 40 + j * 13;
      s += circle(x, y, 0.8, SOLID);
      if ((i + j * 3) % 5 !== 3) s += path(`M${x} ${y}v3`, FINE) + circle(x, y + 4.2, 1.4, PAPER) + circle(x, y + 4.2, 1.4, FINE) + path(`M${x} ${y + 5.5}v3l1 -.6`, FINE) + path(`M${x + 1.4} ${y + 2}h3v3h-3z`, PAPER) + path(`M${x + 1.4} ${y + 2}h3v3h-3z`, ' stroke-width=".35"');
    }
  s += block(222, 264, 60, 112, 1, 1.12, PAPER);
  const sx = X(222, 1.12);
  const sy = Y(60, 1.12);
  s += path(`M${n(sx + 4)} ${n(sy + 4)}h39v50h-39z`, LIGHT) + circle(sx + 24, sy + 24, 7, PAPER) + circle(sx + 24, sy + 24, 7, LIGHT) + circle(sx + 24, sy + 24, 3, FINE);
  s += range(12).map((i) => path(`M${n(sx + 24 + Math.cos(i * 0.52) * 5.2)} ${n(sy + 24 + Math.sin(i * 0.52) * 5.2)}l${n(Math.cos(i * 0.52) * 1.6)} ${n(Math.sin(i * 0.52) * 1.6)}`, ' stroke-width=".4"')).join("");
  s += path(`M${n(sx + 34)} ${n(sy + 38)}h6M${n(sx + 37)} ${n(sy + 35)}v6`, BOLD) + path(`M${n(sx + 5)} ${n(sy + 10)}h2v6h-2zM${n(sx + 5)} ${n(sy + 38)}h2v6h-2z`, SOLID);
  // A clerk's counter with a brass grille, left; the purser's desk, right.
  s += path("M-4 104h70v8h-70z", PAPER) + path("M-4 104h70v8h-70z", LIGHT) + path("M-4 112h66v52h-66z", PAPER) + path("M-4 112h66v52h-66z", GRAIN) + path("M-4 112h66v52h-66z", LIGHT) + path("M6 120h22v34h-22zM34 120h22v34h-22z", FINE);
  s += path("M0 104V52h62v52", LIGHT) + range(12).map((i) => path(`M${4 + i * 5} 104V60q0 -3 2.5 -3t2.5 3`, FINE)).join("") + path("M0 60h62M0 52q31 -10 62 0", LIGHT) + path("M24 104v-10q7 -6 14 0v10", PAPER) + path("M24 104v-10q7 -6 14 0v10", LIGHT);
  s += path("M244 120h80v6h-80z", PAPER) + path("M244 120h80v6h-80z", LIGHT) + path("M248 126v40M318 126v40", BOLD) + path("M290 126h28v20h-28z", PAPER) + path("M290 126h28v20h-28z", LIGHT) + path("M302 136h4", BOLD);
  s += path("M252 118l2 -4h26l2 4z", PAPER) + path("M252 118l2 -4h26l2 4zM267 114v4", LIGHT) + path("M256 116h8M270 116h8M256 117h7M270 117h7", ' stroke-width=".3"');
  s += path("M286 119h6v-4h-6zM289 115l3 -7", LIGHT) + path("M298 120v-4M297 116h3v-4h-3z", LIGHT) + ellipse(312, 118, 4, 1.5, SHADE);
  s += path("M310 118v-16", LIGHT) + path("M304 102q6 -6 12 0z", PAPER) + path("M304 102q6 -6 12 0z", SHADED);
  return s;
}

function cargo(): string {
  let s = "";
  // Inside the hull: frames curving to the bilge, stringers, a hatch of moonlight.
  s += path("M0 0H320V180H0z", SHADE_FINE);
  s += path(`M${P(64, B)}H${n(X(256, 1))}V${P(256, 22).split(" ")[1]}H${n(X(64, 1))}z`, PAPER);
  for (const t of [3.2, 2.2, 1.65, 1.32, 1.12, 1]) s += rib(t);
  for (const y of [18, 46, 74]) for (const side of [32, 288]) s += path(`M${P(side, y, 1)}L${P(side, y, 3)}`, FINE);
  for (const t of [1, 1.12, 1.32, 1.65]) for (let y = 0; y < 100; y += 9) s += circle(X(31 + y * 0.12, t), Y(y, t), 0.5 * t, SOLID) + circle(X(289 - y * 0.12, t), Y(y, t), 0.5 * t, SOLID);
  s += path(`M${P(64, B)}H${n(X(256, 1))}`, BOLD);
  for (const y of [48, 80]) s += path(`M64 ${y}H256`, LIGHT) + range(48).map((i) => circle(66 + i * 4, y - 2, 0.45, SOLID) + circle(66 + i * 4, y + 2, 0.45, SOLID)).join("");
  for (const x of [112, 160, 208]) s += path(`M${x} 22V112`, LIGHT) + range(22).map((i) => circle(x - 2, 24 + i * 4, 0.45, SOLID)).join("");
  s += path("M86 112V66q0 -10 12 -10t12 10v46z", PAPER) + path("M86 112V66q0 -10 12 -10t12 10v46z", BOLD) + path("M89 110V67q0 -8 9 -8t9 8v43z", FINE);
  for (const y of [70, 86, 102]) s += path(`M86 ${y}h-4M110 ${y}h4`, BOLD);
  s += path("M100 84h5", BOLD) + path("M98 92v-16", ' stroke-width=".4"');
  s += path("M222 112V22M234 112V22", LIGHT) + range(11).map((i) => path(`M222 ${28 + i * 8}h12`, FINE)).join("");
  for (let i = 0; i <= 24; i++) s += polyline([P(64 + i * 8, B), P(64 + i * 8, B, 3.2)], FINE);
  s += path("M120 0l-30 180H230L200 0z", ' fill="var(--paper)" opacity=".55" stroke="none"') + path("M120 0l-30 180M200 0l30 180", ' stroke-width=".4" opacity=".5"');
  // Cargo: crates stencilled for New York, barrels, a steamer trunk, a coil of rope.
  s += crate(196, 74, 34, 30, 8, "NEW YORK") + crate(232, 82, 30, 30, 7) + crate(218, 112, 40, 36, 10, "FRAGILE");
  s += crate(60, 90, 30, 26, 7) + crate(30, 112, 44, 40, 10, "S'HAMPTON");
  s += barrel(276, 160, 26, 34) + barrel(302, 166, 26, 34);
  s += path("M86 152h40v-20h-40z", PAPER) + path("M86 152h40v-20h-40z", LIGHT) + path("M86 132l6 -5h40l-6 5M126 152l6 -5v-20", LIGHT) + path("M126 152l6 -5v-20l-6 5z", SHADE) + path("M86 140h40M98 132v20M114 132v20", FINE) + path("M102 140h8v4h-8z", PAPER) + path("M102 140h8v4h-8z", FINE);
  for (const [rx, ry] of [[16, 5], [12, 3.8], [8, 2.6], [4, 1.4]]) s += ellipse(26, 166 - (16 - rx!) * 0.4, rx!, ry!, LIGHT);
  s += path("M42 166q10 4 16 -2", LIGHT);
  // The lantern swinging from a deck beam.
  s += `<g class="swing">${path("M160 0v30", LIGHT)}${path("M154 30h12l2 4v12l-2 4h-12l-2 -4v-12z", PAPER)}${path("M154 30h12l2 4v12l-2 4h-12l-2 -4v-12z", LIGHT)}${path("M152 34h16M152 46h16M160 34v12", FINE)}${path("M158 44q2 -6 2 -8 1 3 2 8z", LIGHT)}</g>`;
  return s;
}

const DRAW: Record<RoomId, () => string> = { saloon, smoking, promenade, library, verandah, turkish, ballroom, wireless, galley, purser, cargo };

export const ROOM_ART = Object.fromEntries(Object.entries(DRAW).map(([id, draw]) => [id, draw()])) as Record<RoomId, string>;
