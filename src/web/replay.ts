// "What really happened", replayed on a deck plan of the case's rooms: the
// night slot by slot from c.schedule, then the murder, the hidden weapon and
// each red herring. Every step is a Frame. The markup is drawn once for the
// current step; stepping repaints the same elements in place, so CSS
// transitions carry the tokens from tile to tile and turn the clock hands.

import { CAST, ROOMS, SLOTS, WEAPONS, inRoom, the } from "../data.ts";
import type { CharId, RoomId } from "../data.ts";
import type { Case } from "../generate.ts";
import { ROOM_ART, portrait, token } from "./art.ts";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

// ── Steps ─────────────────────────────────────────────────────────────────

type Beat = { kind: "slot"; slot: number } | { kind: "murder" } | { kind: "weapon" } | { kind: "herring"; i: number };

function beats(c: Case): Beat[] {
  return [
    ...SLOTS.map((_, slot): Beat => ({ kind: "slot", slot })),
    { kind: "murder" },
    { kind: "weapon" },
    ...c.secrets.map((_, i): Beat => ({ kind: "herring", i })),
  ];
}

export const replaySteps = (c: Case): number => beats(c).length;

/** How long a step holds while playing, in milliseconds. */
export const replayHold = (c: Case, step: number): number => (beats(c)[step].kind === "slot" ? 1700 : 3200);

/** How a tile is picked out: the scene of the crime, or one half of a lie. */
type Mark = "scene" | "murder" | "hidden" | "claim" | "truth";

interface Frame {
  slot: number;
  label: string; // the step's name on its dot
  caption: string;
  focus: CharId[] | null; // everyone else fades back
  marks: Partial<Record<RoomId, Mark>>;
  ghost: number | null; // the lie shown as a dashed token: 0 is the killer's alibi, then each secret
  weapon: "off" | "murder" | "hidden";
}

/** The lies told about the night, the killer's first: who, when, and where they said they were. */
const lies = (c: Case) => [
  { who: c.solution.killer, slot: c.solution.slot, claim: c.solution.alibi },
  ...c.secrets.map((s) => ({ who: s.who, slot: s.slot, claim: s.claim })),
];

function frame(c: Case, step: number): Frame {
  const { killer, weapon, room, slot: m, hiddenIn, alibi } = c.solution;
  const K = CAST[killer].short;
  const V = CAST[c.victim].short;
  const W = WEAPONS[weapon].name;
  const beat = beats(c)[step];
  switch (beat.kind) {
    case "slot": {
      const s = beat.slot;
      const kr = c.schedule[killer][s]!;
      const vr = c.schedule[c.victim][s];
      const caption =
        s === m
          ? `${K} and ${V} are alone ${inRoom(room)}.`
          : s > m || !vr
            ? `${V} is dead. ${K} is ${inRoom(kr)}.`
            : vr === kr
              ? `${V} and ${K} are both ${inRoom(vr)}.`
              : `${V} is ${inRoom(vr)}. ${K} is ${inRoom(kr)}.`;
      return { slot: s, label: SLOTS[s].label, caption, focus: null, marks: s >= m ? { [room]: "scene" } : {}, ghost: null, weapon: "off" };
    }
    case "murder":
      return {
        slot: m,
        label: "The murder",
        caption: `The murder: ${K} kills ${V} with the ${W} ${inRoom(room)} at ${SLOTS[m].label}, and will claim to have been ${inRoom(alibi)}.`,
        focus: [killer, c.victim],
        marks: { [alibi]: "claim", [room]: "murder" },
        ghost: 0,
        weapon: "murder",
      };
    case "weapon":
      return {
        slot: m,
        label: "The weapon",
        caption: hiddenIn === room ? `${K} hides the ${W} right there ${inRoom(room)}.` : `${K} carries the ${W} off and hides it ${inRoom(hiddenIn)}.`,
        focus: [killer],
        marks: { [room]: "scene", [hiddenIn]: "hidden" },
        ghost: null,
        weapon: "hidden",
      };
    case "herring": {
      const s = c.secrets[beat.i];
      return {
        slot: s.slot,
        label: `Red herring ${beat.i + 1}`,
        caption: `Red herring: ${CAST[s.who].short} claimed ${the(s.claim)} at ${SLOTS[s.slot].label}, but was really ${inRoom(s.room)}. An innocent lie, with a secret behind it.`,
        focus: [s.who],
        marks: { [s.claim]: "claim", [s.room]: "truth" },
        ghost: beat.i + 1,
        weapon: "off",
      };
    }
  }
}

// ── Deck plan geometry ────────────────────────────────────────────────────

const COLS = 3;
const TW = 112; // tile width
const TH = 92;
const GAP = 8;
const PAD = 12;
const SPOTS = 8; // token places per tile, four to a row
const SCALE = 0.5; // tokens are art.ts's figures at half size

const deckHeight = (c: Case) => {
  const rows = Math.ceil(c.rooms.length / COLS);
  return PAD * 2 + rows * TH + (rows - 1) * GAP;
};

function tile(c: Case, r: RoomId): { x: number; y: number } {
  const i = c.rooms.indexOf(r);
  return { x: PAD + (i % COLS) * (TW + GAP), y: PAD + Math.floor(i / COLS) * (TH + GAP) };
}

function spot(c: Case, r: RoomId, k: number): { x: number; y: number } {
  const t = tile(c, r);
  const n = Math.min(k, SPOTS - 1);
  return { x: t.x + 17 + (n % 4) * 26, y: t.y + 42 + Math.floor(n / 4) * 28 };
}

const people = (c: Case): CharId[] => [c.victim, ...c.suspects];

/** Where everyone stands at a slot. The dead stay where they fell, unseen. */
function placesAt(c: Case, slot: number): Map<CharId, { x: number; y: number }> {
  const counts = new Map<RoomId, number>();
  const at = new Map<CharId, { x: number; y: number }>();
  for (const p of people(c)) {
    const r = c.schedule[p][slot];
    if (!r) continue;
    const k = counts.get(r) ?? 0;
    counts.set(r, k + 1);
    at.set(p, spot(c, r, k));
  }
  if (!at.has(c.victim)) at.set(c.victim, spot(c, c.solution.room, 0));
  return at;
}

/** A lie's dashed token stands in the claimed room, after the people really there. */
function ghostAt(c: Case, lie: { slot: number; claim: RoomId }): { x: number; y: number } {
  const there = people(c).filter((p) => c.schedule[p][lie.slot] === lie.claim).length;
  return spot(c, lie.claim, there);
}

const weaponAt = (c: Case, r: RoomId) => {
  const t = tile(c, r);
  return { x: t.x + TW - 13, y: t.y + 14 };
};

/** The weapon's dashed path, bowed upwards so it clears the room names it passes. */
function trail(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const flip = dx < 0 ? -1 : 1;
  const cx = (a.x + b.x) / 2 + ((flip * dy) / len) * 30;
  const cy = (a.y + b.y) / 2 - ((flip * dx) / len) * 30;
  return `M${a.x} ${a.y}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x} ${b.y}`;
}

const move = (p: { x: number; y: number }) => `transform:translate(${p.x}px,${p.y}px)`;

/** Hand angles on the clock: the hour hand creeps on from ten, the minute hand turns a quarter each slot. */
const hands = (slot: number) => ({ hour: 300 + slot * 7.5, minute: slot * 90 });

// ── Markup ────────────────────────────────────────────────────────────────

function control(html: string, action: string, label: string | null, extra = ""): string {
  return `<button type="button" class="${action === "replay-play" ? "primary" : "ghost"}" data-action="${action}" data-key="${action}"${label ? ` aria-label="${esc(label)}"` : ""}${extra}>${html}</button>`;
}

/** The time on the clock, and the step's name when it isn't just a time. */
const headHTML = (f: Frame) =>
  `<strong>${SLOTS[f.slot].label}</strong>${f.label === SLOTS[f.slot].label ? "" : ` <span class="rp-beat">${esc(f.label)}</span>`}`;

export function replayHTML(c: Case, step: number, canPlay: boolean, playing: boolean): string {
  const f = frame(c, step);
  const at = placesAt(c, f.slot);
  const H = deckHeight(c);
  const W = PAD * 2 + COLS * TW + (COLS - 1) * GAP;
  const bow = W + 32;
  const hull = `M4 4H${W - 20}C${bow - 16} 4 ${bow - 4} ${H / 2 - 30} ${bow - 4} ${H / 2}S${bow - 16} ${H - 4} ${W - 20} ${H - 4}H4Z`;

  const tiles = c.rooms
    .map((r) => {
      const t = tile(c, r);
      return `<g class="rp-tile" data-room="${r}" data-mark="${f.marks[r] ?? ""}">
        <rect x="${t.x}" y="${t.y}" width="${TW}" height="${TH}" rx="4"/>
        <svg class="rp-art" x="${t.x + 4}" y="${t.y + TH - 64}" width="${TW - 8}" height="60" viewBox="0 0 320 180" preserveAspectRatio="xMidYMax meet">${ROOM_ART[r]}</svg>
        <text x="${t.x + 7}" y="${t.y + 16}">${esc(ROOMS[r].name)}</text>
        <text class="rp-cross" x="${t.x + TW - 14}" y="${t.y + TH - 8}">&dagger;</text>
      </g>`;
    })
    .join("");

  const ghosts = lies(c)
    .map(
      (l, i) =>
        `<g class="rp-ghost p-${l.who}${f.ghost === i ? " on" : ""}" data-ghost="${i}" style="${move(ghostAt(c, l))}"><g transform="scale(${SCALE})">${token(l.who)}</g></g>`,
    )
    .join("");

  const tokens = people(c)
    .map((p) => `<g class="rp-token p-${p}${tokenState(c, f, p)}" data-who="${p}" style="${move(at.get(p)!)}"><g transform="scale(${SCALE})">${token(p)}</g></g>`)
    .join("");

  const from = weaponAt(c, c.solution.room);
  const to = weaponAt(c, c.solution.hiddenIn);
  const weapon = `<path class="rp-trail${f.weapon === "hidden" ? " on" : ""}" d="${trail(from, to)}"/>
    <g class="rp-weapon${f.weapon === "off" ? "" : " on"}" style="${move(f.weapon === "hidden" ? to : from)}"><path d="M0-7L6 0 0 7-6 0Z"/><path d="M0-3.5V3.5"/></g>`;

  const { hour, minute } = hands(f.slot);
  const clock = `<svg class="rp-clock" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="17"/>${[0, 90, 180, 270].map((d) => `<path d="M20 5v3" transform="rotate(${d} 20 20)"/>`).join("")}
      <path class="rp-hand rp-hour" d="M20 20V12" style="transform:rotate(${hour}deg)"/>
      <path class="rp-hand rp-minute" d="M20 20V7" style="transform:rotate(${minute}deg)"/>
      <circle cx="20" cy="20" r="1.6" class="pin"/>
    </svg>`;

  const legend = people(c)
    .map((p) => `<li>${portrait(p)}<span>${esc(CAST[p].short)}${p === c.victim ? " &dagger;" : ""}</span></li>`)
    .join("");

  const dots = beats(c)
    .map((_, i) => {
      const label = frame(c, i).label;
      return `<button type="button" class="rp-dot" data-action="replay-go" data-step="${i}" data-key="replay-go:${i}" aria-label="${esc(label)}"${i === step ? ' aria-current="step"' : ""}></button>`;
    })
    .join("");
  const last = replaySteps(c) - 1;

  return `<figure class="replay${playing ? " playing" : ""}" role="group" aria-label="Replay of the night">
    <div class="rp-head">${clock}<p class="rp-time">${headHTML(f)}</p></div>
    <svg class="rp-deck" viewBox="0 0 ${bow} ${H}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path class="rp-hull" d="${hull}"/>${tiles}${weapon}${ghosts}${tokens}
    </svg>
    <p class="rp-caption" aria-live="polite">${esc(f.caption)}</p>
    <figcaption><ul class="rp-legend">${legend}</ul></figcaption>
    <div class="rp-controls">
      ${control("&lsaquo;", "replay-prev", "Step back", step === 0 ? " disabled" : "")}
      ${canPlay ? control(playLabel(playing, step, last), "replay-play", null) : ""}
      ${control("&rsaquo;", "replay-next", "Step forward", step === last ? " disabled" : "")}
      <div class="rp-dots">${dots}</div>
    </div>
  </figure>`;
}

const playLabel = (playing: boolean, step: number, last: number) => (playing ? "Pause" : step === last ? "Play again" : "Play");

function tokenState(c: Case, f: Frame, p: CharId): string {
  if (c.schedule[p][f.slot] === null) return " gone";
  return f.focus && !f.focus.includes(p) ? " dim" : "";
}

// ── Repaint in place ──────────────────────────────────────────────────────

/** Moves an already-drawn replay to `step`, letting CSS tween the change. */
export function paintReplay(root: HTMLElement, c: Case, step: number, playing: boolean): void {
  const f = frame(c, step);
  const at = placesAt(c, f.slot);
  const last = replaySteps(c) - 1;
  root.classList.toggle("playing", playing);

  for (const el of root.querySelectorAll<SVGGElement>(".rp-token")) {
    const p = el.dataset.who as CharId;
    el.setAttribute("style", move(at.get(p)!));
    el.setAttribute("class", `rp-token p-${p}${tokenState(c, f, p)}`);
  }
  for (const el of root.querySelectorAll<SVGGElement>(".rp-ghost")) el.classList.toggle("on", Number(el.dataset.ghost) === f.ghost);
  for (const el of root.querySelectorAll<SVGGElement>(".rp-tile")) el.dataset.mark = f.marks[el.dataset.room as RoomId] ?? "";

  const w = root.querySelector<SVGGElement>(".rp-weapon")!;
  w.classList.toggle("on", f.weapon !== "off");
  w.setAttribute("style", move(weaponAt(c, f.weapon === "hidden" ? c.solution.hiddenIn : c.solution.room)));
  root.querySelector(".rp-trail")!.classList.toggle("on", f.weapon === "hidden");

  const { hour, minute } = hands(f.slot);
  root.querySelector<SVGPathElement>(".rp-hour")!.style.transform = `rotate(${hour}deg)`;
  root.querySelector<SVGPathElement>(".rp-minute")!.style.transform = `rotate(${minute}deg)`;
  root.querySelector(".rp-time")!.innerHTML = headHTML(f);
  root.querySelector(".rp-caption")!.textContent = f.caption;

  const prev = root.querySelector<HTMLButtonElement>("[data-action=replay-prev]")!;
  const next = root.querySelector<HTMLButtonElement>("[data-action=replay-next]")!;
  const play = root.querySelector<HTMLButtonElement>("[data-action=replay-play]");
  // A step button that just ran out of steps would drop focus; hand it to its partner.
  const focused = document.activeElement;
  prev.disabled = step === 0;
  next.disabled = step === last;
  if (focused === prev && prev.disabled) next.focus();
  if (focused === next && next.disabled) (play ?? prev).focus();
  if (play) play.textContent = playLabel(playing, step, last);
  for (const d of root.querySelectorAll<HTMLButtonElement>(".rp-dot")) {
    if (Number(d.dataset.step) === step) d.setAttribute("aria-current", "step");
    else d.removeAttribute("aria-current");
  }
}
