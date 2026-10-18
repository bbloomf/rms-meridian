// Pen-and-ink drawing kit shared by the room and weapon pictures.
//
// The look comes from three things: an SVG filter that wobbles every line and
// breaks it up a little, as a dip pen does on rough paper; hatching patterns
// for shadow and tone instead of flat fills; and varied line weights. The
// filter and patterns are defined once per page in INK_DEFS (the only SVG ids
// the game uses) and referenced from every picture.

export const INK_DEFS = `<svg class="ink-defs" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;color:var(--ink)">
  <defs>
    <filter id="ink" x="-3%" y="-3%" width="106%" height="106%">
      <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="4" result="warp"/>
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.2" xChannelSelector="R" yChannelSelector="G" result="wobble"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="9" result="grain"/>
      <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.6 0 0 0 -0.45" result="tooth"/>
      <feComposite in="wobble" in2="tooth" operator="in"/>
    </filter>
    <filter id="ink-ghost" x="-3%" y="-3%" width="106%" height="106%">
      <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="17" result="warp"/>
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="3.2" xChannelSelector="G" yChannelSelector="R"/>
    </filter>
    <filter id="ink-small" x="-4%" y="-4%" width="108%" height="108%">
      <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="6" result="warp"/>
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="1.3" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <pattern id="ink-hatch" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <path d="M1.6 0v3.2" stroke="currentColor" stroke-width=".55"/>
    </pattern>
    <pattern id="ink-hatch-fine" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <path d="M1.2 0v2.4" stroke="currentColor" stroke-width=".35"/>
    </pattern>
    <pattern id="ink-cross" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <path d="M1.5 0v3M0 1.5h3" stroke="currentColor" stroke-width=".55"/>
    </pattern>
    <pattern id="ink-night" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
      <path d="M1.1 0v2.2M0 1.1h2.2" stroke="currentColor" stroke-width=".7"/>
    </pattern>
    <pattern id="ink-vert" width="2.6" height="10" patternUnits="userSpaceOnUse">
      <path d="M1.3 0v10" stroke="currentColor" stroke-width=".4"/>
    </pattern>
    <pattern id="ink-dots" width="5" height="5" patternUnits="userSpaceOnUse">
      <circle cx="1.2" cy="1.4" r=".45" fill="currentColor"/><circle cx="3.6" cy="3.9" r=".4" fill="currentColor"/><circle cx="3.9" cy="1.1" r=".3" fill="currentColor"/>
    </pattern>
    <pattern id="ink-lattice" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <path d="M0 0h9M0 0v9" stroke="currentColor" stroke-width=".8"/>
    </pattern>
    <pattern id="ink-tile" width="7" height="7" patternUnits="userSpaceOnUse">
      <path d="M0 .2h7M.2 0v7" stroke="currentColor" stroke-width=".4"/><path d="M3.5 1.6l1.9 1.9-1.9 1.9-1.9-1.9z" stroke="currentColor" stroke-width=".35" fill="none"/>
    </pattern>
    <pattern id="ink-grid" width="6" height="4" patternUnits="userSpaceOnUse">
      <path d="M0 .2h6M.2 0v4" stroke="currentColor" stroke-width=".35"/>
    </pattern>
  </defs>
</svg>`;

// ── Attribute snippets ────────────────────────────────────────────────────

export const FINE = ' stroke-width=".6"';
export const LIGHT = ' stroke-width=".9"';
export const BOLD = ' stroke-width="1.9"';
/** Shadow: a face in light hatching, outlined. */
export const SHADED = ' fill="url(#ink-hatch)"';
/** Tone with no outline. */
export const SHADE = ' fill="url(#ink-hatch)" stroke="none"';
export const SHADE_FINE = ' fill="url(#ink-hatch-fine)" stroke="none"';
export const DARK = ' fill="url(#ink-cross)" stroke="none"';
export const NIGHT = ' fill="url(#ink-night)" stroke="none"';
export const GRAIN = ' fill="url(#ink-vert)" stroke="none"';
export const STIPPLE = ' fill="url(#ink-dots)" stroke="none"';
export const PAPER = ' fill="var(--paper)"';
export const SOLID = ' fill="currentColor" stroke="none"';
export const WASH = ' fill="currentColor" fill-opacity=".07" stroke="none"';

// ── Path helpers ──────────────────────────────────────────────────────────

export const n = (v: number): string => String(Math.round(v * 10) / 10);
export const range = (k: number): number[] => Array.from({ length: k }, (_, i) => i);
export const path = (d: string, a = ""): string => `<path d="${d}"${a}/>`;
export const poly = (pts: string[], a = ""): string => path(`M${pts.join("L")}z`, a);
export const polyline = (pts: string[], a = ""): string => path(`M${pts.join("L")}`, a);
export const circle = (x: number, y: number, r: number, a = ""): string => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}"${a}/>`;
export const ellipse = (x: number, y: number, rx: number, ry: number, a = ""): string =>
  `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}"${a}/>`;

/** A small deterministic random source, so a drawing is the same every time. */
export function rng(seed: number): () => number {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Point on an ellipse, as numbers. */
export const onEllipse = (cx: number, cy: number, rx: number, ry: number, deg: number): [number, number] => {
  const r = (deg * Math.PI) / 180;
  return [cx + Math.cos(r) * rx, cy + Math.sin(r) * ry];
};

/**
 * The outline of a turned or tapered object lying along the x axis, from a
 * profile of [x, halfWidth] stations: the top edge left to right, then the
 * bottom edge back, with smoothed corners.
 */
export function lathe(profile: [number, number][], cy: number): string {
  const top = profile.map(([x, w]) => [x, cy - w] as const);
  const bottom = profile.map(([x, w]) => [x, cy + w] as const).reverse();
  const pts = [...top, ...bottom];
  let d = `M${n(pts[0]![0])} ${n(pts[0]![1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    d += `Q${n(x0 + (x1 - x0) * 0.5)} ${n(y0)} ${n(x1)} ${n(y1)}`;
  }
  return d + "z";
}
