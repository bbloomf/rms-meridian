// Character icons, and the stage that shows a scene the way a suspect describes
// it: a room drawn in ink (rooms.ts), the time, and who stands there. The
// drawings reference the shared ink filter and patterns in ink.ts and use no
// SVG ids of their own, so the same scene can appear twice on a page.

import { CAST, ROOMS } from "../data.ts";
import type { CharId, RoomId } from "../data.ts";
import { ROOM_ART } from "./rooms.ts";

export { ROOM_ART };

export const ICONS: Record<CharId, string> = {
  marble: '<path d="M4 4h16M5 6.5h14M6.5 6.5v11M10.2 6.5v11M13.8 6.5v11M17.5 6.5v11M5 17.5h14M3.5 20h17"/>',
  folder: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 3v18M12 8h4M12 11.5h4M12 15h3"/>',
  mallet: '<g transform="translate(2.6 1.5) rotate(-38 12 12.6)"><rect x="5.8" y="2.4" width="12.4" height="5.2" rx="1.3"/><path d="M8.4 2.4v5.2M15.6 2.4v5.2M12 7.6v14.8"/></g>',
  bear: '<path d="M5.34 9.33A2.8 2.8 0 1 1 9.01 6.01M18.66 9.33A2.8 2.8 0 1 0 14.99 6.01"/><circle cx="12" cy="13" r="7.6"/><ellipse cx="12" cy="16.1" rx="3.4" ry="2.7"/><path d="M10.9 14.7h2.2L12 15.8z"/><path d="M9.1 11.5h.01M14.9 11.5h.01" stroke-width="2.4"/>',
  egg: '<path d="M12 3c-3.6 0-6.5 6.3-6.5 10.4A6.5 6.5 0 0 0 12 20a6.5 6.5 0 0 0 6.5-6.6C18.5 9.3 15.6 3 12 3z"/>',
  pail: '<path d="M5 9h14l-1.8 11H6.8z"/><path d="M5 9c0-5.5 14-5.5 14 0"/><path d="M5.6 12.5h12.8"/>',
};

export function portrait(id: CharId, size: "sm" | "lg" | "xl" = "sm"): string {
  return `<span class="portrait ${size} p-${id}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[id]}</svg></span>`;
}

// ── Scenes ────────────────────────────────────────────────────────────────

/** A ship's clock showing one of the four quarter hours after ten. */
function clock(slot: number): string {
  const hand = (deg: number, len: number) => {
    const r = ((deg - 90) * Math.PI) / 180;
    return `<path d="M292 28l${(Math.cos(r) * len).toFixed(1)} ${(Math.sin(r) * len).toFixed(1)}"/>`;
  };
  return `<g class="clock"><circle cx="292" cy="28" r="17" fill="var(--paper)" stroke-width="2"/>${hand(300 + slot * 7.5, 9)}${hand(slot * 90, 13)}<circle cx="292" cy="28" r="1.5" fill="currentColor"/></g>`;
}

/** A character token, centred on 0 0: a disc in their colour with their icon on it. */
export function token(p: CharId): string {
  return `<circle r="19" class="disc" stroke-width="1.6"/><g transform="translate(-12 -12)" class="glyph">${ICONS[p]}</g>`;
}

/** Character tokens standing on the stage, the speaker first. */
function figures(people: CharId[], victim: CharId): string {
  return people
    .map((p, i) => {
      const x = 160 + (i - (people.length - 1) / 2) * 62;
      return `<g transform="translate(${x} 122)"><g class="figure p-${p}" style="--i:${i}">
        ${token(p)}
        <text y="34" text-anchor="middle">${CAST[p].short}${p === victim ? " †" : ""}</text>
      </g></g>`;
    })
    .join("");
}

export interface SceneLayer {
  room: RoomId;
  people: CharId[];
}

/** One stage: a room, the time, and who stands in it. */
export function stage(layer: SceneLayer, slot: number, victim: CharId): string {
  return `<svg viewBox="0 0 320 180" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${ROOMS[layer.room].name}">
    <g class="set"><g class="ghost" filter="url(#ink-ghost)" transform="translate(.7 .5)">${ROOM_ART[layer.room]}</g><g filter="url(#ink)">${ROOM_ART[layer.room]}</g></g>${clock(slot)}${figures(layer.people, victim)}
  </svg>`;
}

/** A room on its own, for the room cards: cropped to fill whatever box CSS gives it. */
export function roomPic(room: RoomId): string {
  return `<svg class="room-pic" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g filter="url(#ink)">${ROOM_ART[room]}</g></svg>`;
}
