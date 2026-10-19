// Browser front end: the briefing, the notebook (timeline, rooms, weapons), the
// interview panel and the accusation. The page is redrawn from the game state
// after every action, one region at a time; the state itself is rebuilt from
// the saved moves.

import { CAST, ROOMS, SLOTS, WEAPONS, inRoom, the } from "../data.ts";
import type { CharId, RoomId, WeaponId } from "../data.ts";
import { AP_BUDGET, generateCase } from "../solver.ts";
import { dailySeed } from "../rng.ts";
import { MAX_PINS, THRIFTY, atTime, check, describeSearch, evidence, evidenceKey, play, placements, rank } from "../game.ts";
import type { Evidence, GameState, Leg, LogEntry, Move } from "../game.ts";
import { hint } from "../hint.ts";
import type { Hint } from "../hint.ts";
import { portrait, roomPic, stage } from "./art.ts";
import { playAccusation, playIntro, reducedMotion } from "./cinema.ts";
import { INK_DEFS } from "./ink.ts";
import { lockup, mark } from "./logo.ts";
import { paintReplay, replayHTML, replayHold, replaySteps } from "./replay.ts";
import { weaponPic } from "./weapons.ts";

type Mark = "cleared" | "suspect";
type Modal = "rules" | "accuse" | "result";

interface Saved {
  started: boolean;
  moves: Move[];
  marks: Partial<Record<CharId, Mark>>;
  hints: number[]; // how many moves had been made each time a hint was asked for
}

// ── Case selection ────────────────────────────────────────────────────────
// No ?case= means the daily case (seeded by UTC date, same for everyone). A
// daily case left unfinished at UTC midnight stays open until it's finished or
// the new one is begun, so an evening player doesn't lose it. ?today skips it.

const params = new URLSearchParams(location.search);
const requested = params.get("case");
const parsed = requested !== null && /^\d{1,9}$/.test(requested.trim()) ? Number(requested) : NaN;
const daily = !Number.isFinite(parsed);
if (requested !== null && daily) history.replaceState(null, "", location.pathname); // a junk ?case= falls back to the daily case, so say so in the URL
const now = new Date();
const yesterday = new Date(now.getTime() - 86_400_000);
const carried = daily && !params.has("today") && !readSave(dailySeed(now))?.started && unfinished(dailySeed(yesterday));
const caseDate = carried ? yesterday : now;
const seed = daily ? dailySeed(caseDate) : parsed;
const c = generateCase(seed).case;
const caseLabel = daily
  ? `Daily case · ${caseDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}`
  : `Case No. ${seed}`;
const STORE_KEY = storeKey(seed);
pruneSaves();

// v2: cases now require a provable killer, so v1 saves may be for a different case
function storeKey(seed: number): string {
  return `meridian:v2:${seed}`;
}

/** A save as stored, unchecked. */
function readSave(seed: number): Partial<Saved> | null {
  try {
    const s = JSON.parse(localStorage.getItem(storeKey(seed)) ?? "null") as Partial<Saved> | null;
    return s && typeof s === "object" ? s : null;
  } catch {
    return null;
  }
}

function unfinished(seed: number): boolean {
  const s = readSave(seed);
  if (s?.started !== true || !Array.isArray(s.moves) || s.moves.length === 0) return false;
  try {
    return !play(generateCase(seed).case, s.moves).over;
  } catch {
    return false;
  }
}

/** Saves are stamped when written. Drop any untouched for 30 days, and the unusable v1 saves. */
function pruneSaves(): void {
  try {
    const cutoff = now.getTime() - 30 * 86_400_000;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key?.startsWith("meridian:") || key === STORE_KEY) continue;
      let s: { savedAt?: unknown } | null = null;
      try {
        s = JSON.parse(localStorage.getItem(key) ?? "null");
      } catch {
        // unreadable: removed below
      }
      if (key.startsWith("meridian:v1:") || !s || typeof s !== "object") localStorage.removeItem(key);
      else if (typeof s.savedAt !== "number") localStorage.setItem(key, JSON.stringify({ ...s, savedAt: now.getTime() })); // saved before stamping: start its clock now
      else if (s.savedAt < cutoff) localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable: nothing to tidy.
  }
}

// ── UI state ──────────────────────────────────────────────────────────────

let saved: Saved = load();
let state: GameState = replay(saved.moves);
let view: "briefing" | "game" = saved.started ? "game" : "briefing";
let modal: Modal | null = state.over ? "result" : null;
let selected: CharId = c.suspects[0];
let confronting: { who: CharId; slot: number } | null = null;
let draft: { who?: CharId; weapon?: WeaponId; room?: RoomId; pins: string[] } = { pins: [] };
let scene: { who: CharId; slot: number } | null = lastScene(); // the account shown as a picture
let scenePlay = false; // animate the scene on the next render only
let justSearched: RoomId | null = null;
let notice: string | null = null;
let noticeId = 0; // counts notices, so a repeated one is announced again
let latestFrom = state.log.length; // log entries from the most recent move are highlighted
let sheetOpen = false; // phone-width sheet showing the latest reply
let copied = false;
let carriedNote = carried; // "yesterday's case is still open", until a move or a dismissal
let hintOpen = false; // the "What next?" card, until the next move
let hintEnter = false; // fade the card in on the render that opens it
let fresh = false; // highlight the latest log entries on this render only
let replayAt = 0; // step of the verdict's replay of the night
let replayTimer: ReturnType<typeof setTimeout> | null = null;

/** The most recent account asked about or confronted, to show again on reload. */
function lastScene(): { who: CharId; slot: number } | null {
  const m = [...saved.moves].reverse().find((x) => x.kind === "ask" || x.kind === "confront");
  return m && (m.kind === "ask" || m.kind === "confront") ? { who: m.who, slot: m.slot } : null;
}

function load(): Saved {
  const empty: Saved = { started: false, moves: [], marks: {}, hints: [] };
  try {
    const s = readSave(seed);
    if (!s) return empty;
    // Check each field, so a damaged save can't leave a blank page.
    const obj = (x: unknown) => typeof x === "object" && x !== null && !Array.isArray(x);
    return {
      started: s.started === true,
      moves: Array.isArray(s.moves) ? s.moves : [],
      marks: obj(s.marks) ? s.marks! : {},
      hints: Array.isArray(s.hints) ? s.hints.filter((n) => typeof n === "number") : [],
    };
  } catch {
    return empty;
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...saved, savedAt: Date.now() }));
  } catch {
    // Storage can be unavailable (private mode, blocked site data). The game still works; it just won't resume.
  }
}

function replay(moves: Move[]): GameState {
  try {
    return play(c, moves);
  } catch {
    // A save from an older version of the rules: start the case afresh.
    saved.moves = [];
    return play(c, []);
  }
}

function act(move: Move): void {
  const problem = check(state, move);
  if (problem) {
    notice = problem;
    noticeId += 1;
    render();
    return;
  }
  latestFrom = state.log.length;
  saved.moves = [...saved.moves, move];
  state = play(c, saved.moves);
  persist();
  announce(state.log.slice(latestFrom));
  notice = null;
  carriedNote = false;
  confronting = null;
  hintOpen = false;
  fresh = true;
  sheetOpen = true;
  if (move.kind === "ask" || move.kind === "confront") {
    scene = { who: move.who, slot: move.slot };
    scenePlay = true;
  }
  if (move.kind === "search") justSearched = move.room;
  if (move.kind === "accuse") {
    modal = reducedMotion() ? "result" : null;
    render();
    if (!modal) void accusationScene().then(() => ((modal = "result"), render()));
    return;
  }
  render();
}

function accusationScene(): Promise<void> {
  const a = state.accusation!;
  const reply = [...state.log].reverse().find((e) => e.kind === "line");
  return playAccusation({ ...a, suspects: c.suspects, reply: reply?.kind === "line" ? reply.text : "" });
}

// ── Helpers ───────────────────────────────────────────────────────────────

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

interface ButtonOptions {
  cls?: string;
  disabled?: boolean;
  pressed?: boolean;
  label?: string; // accessible name, when the visible text isn't enough
}

/** A button wired to the click handler through data attributes. `html` must already be escaped. */
function button(html: string, action: string, data: Record<string, string | number> = {}, o: ButtonOptions = {}): string {
  const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${esc(String(v))}"`).join("");
  const key = [action, ...Object.values(data)].join(":");
  return `<button type="button" class="${o.cls ?? ""}" data-action="${action}"${attrs} data-key="${esc(key)}"${
    o.disabled ? " disabled" : ""
  }${o.pressed !== undefined ? ` aria-pressed="${o.pressed}"` : ""}${o.label ? ` aria-label="${esc(o.label)}"` : ""}>${html}</button>`;
}

const short = (id: CharId) => CAST[id].short;
const nameList = (ids: CharId[]) => ids.map(short).join(", ");
const windowLabel = () => `${SLOTS[c.window[0]].label} and ${SLOTS[c.window[c.window.length - 1]].label}`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// ── Briefing ──────────────────────────────────────────────────────────────

function rulesHTML(): string {
  return `<ol class="rules">
    <li><strong>You have ${AP_BUDGET} actions</strong> before the Captain radios New York. Searching a room costs one. Asking a suspect where they were at a given time costs one. Confronting a suspect costs one. Small talk is free.</li>
    <li>The murder happened in one of the rooms in play, with one of the weapons in play. Nobody saw it happen.</li>
    <li>Physical evidence never lies.</li>
    <li>Suspects may lie about where they were, but never invent seeing someone. <strong>Anyone who names who they saw is telling the truth.</strong></li>
    <li>Catch a lie by confronting a suspect with someone else's account of the same time. An innocent liar confesses, unless they're too proud to. The killer never backs down.</li>
    <li>When you're ready, name the killer, the weapon and the room, and <strong>pin up to ${MAX_PINS} pieces of evidence</strong> as proof: one for each. You get one accusation.</li>
    <li>One star for the right answer, one for proving all three parts, and one for finishing with ${THRIFTY} or more actions left.</li>
  </ol>`;
}

function briefingHTML(): string {
  const v = CAST[c.victim];
  const progress = saved.moves.length > 0 && !state.over;
  return `<main class="briefing">
    <div class="ticket">
      <p class="eyebrow">Southampton &middot; New York</p>
      <h1 class="masthead">${lockup()}</h1>
      <p class="sub">The last night of the crossing</p>
      <p class="case-label">${esc(caseLabel)}</p>
      <div class="story">
        <p>At eleven o'clock, ${portrait(c.victim)} <strong>${esc(v.name)}</strong>, ${esc(v.role)}, is found dead on the Boat Deck.</p>
        <p>The ship's doctor puts the time of death between <strong>${windowLabel()}</strong>. The Captain will radio the New York police at midnight. Until then, the case is yours, Inspector.</p>
      </div>
      <h2>The suspects</h2>
      <ul class="cast">${c.suspects
        .map((s) => `<li>${portrait(s)}<span><strong>${esc(CAST[s].name)}</strong><br><span class="muted">${esc(CAST[s].role)}</span></span></li>`)
        .join("")}</ul>
      <h2>How it works</h2>
      ${rulesHTML()}
      <p class="beginner">New to detective work? Once you begin, press <strong>Where do I start?</strong> at the top of your notebook. Your sergeant will suggest a first move and explain why. Ask again whenever you're stuck.</p>
      <div class="briefing-actions">
        ${button(progress ? "Resume the investigation" : "Begin the investigation", "begin", {}, { cls: "primary big" })}
        ${carried ? button("Start today's case instead", "today", {}, { cls: "link" }) : ""}
        ${daily ? button("Try a random case instead", "random", {}, { cls: "link" }) : button("Today's daily case", "daily", {}, { cls: "link" })}
      </div>
    </div>
  </main>`;
}

// ── Notebook ──────────────────────────────────────────────────────────────

/** The notebook's frame: empty regions that render() fills and keeps up to date. */
function shellHTML(): string {
  const v = CAST[c.victim];
  const region = (name: Region) => `<div data-region="${name}"></div>`;
  return `<header class="bar">
    <div class="brand">${mark()}${button("RMS Meridian", "briefing", {}, { cls: "wordmark", label: "Back to the briefing" })}<span class="muted">${esc(caseLabel)}</span></div>
    ${region("header")}
  </header>
  <p class="case-line">${portrait(c.victim)} <span><strong>${esc(v.name)}</strong>, ${esc(v.role)}, found dead on the Boat Deck. Time of death between ${windowLabel()}.</span></p>
  <div class="layout">
    <section class="board">
      ${region("hint")}
      ${region("notice")}
      ${region("timeline")}
      <section class="card rooms"><div class="card-head"><h2>Rooms in play</h2><p class="muted">The murder happened in one of these. Only crew have keys to crew-only rooms.</p></div><div class="room-grid">${c.rooms.map(() => "<div></div>").join("")}</div></section>
      ${region("weapons")}
    </section>
    <aside class="interview">
      ${region("dossier")}
      ${region("scene")}
      <div class="transcript" id="transcript"><h2>Transcript</h2><p class="muted">Nothing on record yet.</p></div>
    </aside>
  </div>
  ${region("sheet")}
  ${region("modal")}`;
}

/** The changing part of the header; the brand beside it is drawn once, in shellHTML. */
function headerHTML(): string {
  const pips = Array.from({ length: AP_BUDGET }, (_, i) => `<span class="pip${i < AP_BUDGET - state.remaining ? " spent" : ""}"></span>`).join("");
  return `<div class="meter" role="img" aria-label="${state.remaining} of ${AP_BUDGET} actions left"><div class="pips">${pips}</div><span><strong>${state.remaining}</strong> left</span></div>
    <div class="bar-actions">
      ${button("How to play", "rules", {}, { cls: "ghost" })}
      ${state.over ? "" : button(saved.moves.length === 0 ? "Where do I start?" : "What next?", "hint", {}, { cls: `ghost hint-btn${hintOpen ? " on" : ""}`, pressed: hintOpen })}
      ${state.over ? button("See verdict", "result", {}, { cls: "primary" }) : button("Accuse", "accuse", {}, { cls: "primary" })}
    </div>`;
}

function noticeHTML(): string {
  if (state.over) return "";
  if (state.remaining === 0) {
    return `<div class="notice midnight"><p>It's midnight. The Captain is at the wireless, waiting for a name.</p>${button("Make your accusation", "accuse", {}, { cls: "primary" })}</div>`;
  }
  if (carriedNote && !notice) {
    return `<div class="notice info"><p>You hadn't finished yesterday's daily case, so it's still open. Today's will keep.</p>${button("Start today's instead", "today", {}, { cls: "ghost" })}${button("&times;", "dismiss", {}, { cls: "ghost icon", label: "Dismiss" })}</div>`;
  }
  return notice ? `<div class="notice" role="alert"><p>${esc(notice)}</p>${button("&times;", "dismiss", {}, { cls: "ghost icon", label: "Dismiss" })}</div>` : "";
}

// ── Hints ─────────────────────────────────────────────────────────────────
// The sergeant's advice (src/hint.ts) reasons from what's been found, never
// from the answer. The card names a move and why; the move's own button glows.

function currentHint(): Hint | null {
  return hintOpen ? hint(state) : null;
}

function hintHTML(): string {
  const h = currentHint();
  if (!h) return "";
  const go =
    h.kind === "accuse"
      ? button("Open the accusation", "hint-do", {}, { cls: "primary" })
      : button(`Do it <span class="cost">1</span>`, "hint-do", {}, { cls: "primary", label: `${h.title}. Costs one action.` });
  return `<div class="hint-card${hintEnter ? " enter" : ""}" role="region" aria-label="Your sergeant's advice">
    <p class="eyebrow">Your sergeant suggests</p>
    <h3>${esc(h.title)}</h3>
    <p>${esc(h.why)}</p>
    <div class="hint-actions">${go}${button("Not now", "hint-close", {}, { cls: "ghost" })}</div>
  </div>`;
}

/** The data-key of the button that makes the hinted move, so it can glow. */
function hintTarget(h: Hint): string {
  if (h.kind === "accuse") return "accuse";
  const m = h.move;
  return m.kind === "search" ? `search:${m.room}` : m.kind === "ask" ? `ask:${m.who}:${m.slot}` : `confront-start:${m.who}:${m.slot}`;
}

function timelineHTML(): string {
  const places = placements(state);
  const head = SLOTS.map(
    (s, i) => `<th scope="col" class="${c.window.includes(i) ? "tod" : ""}">${s.label}${c.window.includes(i) ? '<span class="tod-label">time of death</span>' : ""}</th>`,
  ).join("");

  const victimCells = SLOTS.map((_, slot) => {
    const p = places[c.victim]?.[slot];
    return `<td class="${c.window.includes(slot) ? "tod" : ""}">${
      p ? `<div class="seen">Seen alive: ${esc(ROOMS[p.room].name)} <span class="muted">(${esc(nameList(p.by))})</span></div>` : '<span class="muted">&mdash;</span>'
    }</td>`;
  }).join("");

  const rows = c.suspects
    .map((who) => {
      const mark = saved.marks[who];
      const cells = SLOTS.map((_, slot) => cellHTML(who, slot, places[who]?.[slot])).join("");
      return `<tr class="${mark ? `mark-${mark}` : ""}">
        <th scope="row">
          <div class="who">
            ${button(`${portrait(who)}<span class="nm">${esc(CAST[who].name)}</span>`, "select", { who }, { cls: "who-btn", pressed: selected === who })}
            ${button(mark === "cleared" ? "Cleared" : mark === "suspect" ? "Suspect" : "Mark", "mark", { who }, { cls: `mark-btn ${mark ?? ""}`, label: `Your note on ${CAST[who].name}: ${mark ?? "none"}` })}
          </div>
        </th>${cells}</tr>`;
    })
    .join("");

  return `<section class="card timeline">
    <div class="card-head"><h2>Timeline</h2><p class="muted">Click a square to ask where someone was. Accounts that name a witness are true.</p></div>
    <div class="table-wrap"><table>
      <thead><tr><th scope="col"><span class="sr">Person</span></th>${head}</tr></thead>
      <tbody>
        <tr class="victim-row"><th scope="row"><div class="who">${portrait(c.victim)}<span class="nm">${esc(CAST[c.victim].name)}<br><span class="muted">the victim</span></span></div></th>${victimCells}</tr>
        ${rows}
      </tbody>
    </table></div>
    ${confrontPickerHTML()}
  </section>`;
}

function cellHTML(who: CharId, slot: number, proven: { room: RoomId; by: CharId[] } | undefined): string {
  const answer = state.answers[who]?.[slot];
  const conf = state.confrontations.find((x) => x.who === who && x.slot === slot && x.outcome !== "baseless");
  const tod = c.window.includes(slot) ? "tod" : "";
  const witnesses = proven?.by.filter((b) => b !== who) ?? [];
  const seen = proven && witnesses.length > 0 ? `<div class="seen">Seen: ${esc(ROOMS[proven.room].name)} <span class="muted">(${esc(nameList(witnesses))})</span></div>` : "";

  if (!answer) {
    const ask = state.over
      ? ""
      : button(`Ask <span class="cost">1</span>`, "ask", { who, slot }, { cls: "ask", label: `Ask ${CAST[who].name} where ${CAST[who].pronouns.subject} was at ${SLOTS[slot].label}` });
    return `<td class="${tod} open">${seen}${ask}</td>`;
  }

  const provenTrue = answer.sightings.length > 0;
  const seenElsewhere = proven && proven.room !== answer.claim ? seen : ""; // a matching sighting adds nothing
  const confrontBtn =
    !provenTrue && !conf && !state.over
      ? button(`Confront <span class="cost">1</span>`, "confront-start", { who, slot }, {
          cls: `confront${confronting?.who === who && confronting.slot === slot ? " active" : ""}`,
          label: `Confront ${CAST[who].name} about ${SLOTS[slot].label}`,
        })
      : "";
  const status =
    conf?.outcome === "crack"
      ? `<div class="tag crack">Lied. Really: ${esc(ROOMS[conf.truth!].name)}</div>`
      : conf?.outcome === "holdFirm"
        ? `<div class="tag firm">Caught out. Won't budge.</div>`
        : "";
  return `<td class="${tod} answered${provenTrue ? " proven" : ""}">
    ${button(`${esc(ROOMS[answer.claim].name)}${provenTrue ? ' <span class="check" title="Names a witness, so it is true">&#10003;</span>' : ""}`, "scene", { who, slot }, {
      cls: `claim${scene?.who === who && scene.slot === slot ? " viewing" : ""}`,
      label: `${ROOMS[answer.claim].name}${provenTrue ? ", names a witness, so it's true" : ""}. Show ${CAST[who].short}'s account of ${SLOTS[slot].label}`,
    })}
    <div class="saw">${answer.sightings.length ? `saw ${esc(nameList(answer.sightings))}` : "saw no one"}</div>
    ${seenElsewhere}${status}${confrontBtn}
  </td>`;
}

function confrontPickerHTML(): string {
  if (!confronting) return "";
  const { who, slot } = confronting;
  const accounts = c.suspects.filter((w) => w !== who && state.answers[w]?.[slot]);
  const options = accounts.length
    ? accounts
        .map((w) => {
          const st = state.answers[w]![slot];
          return button(
            `${portrait(w)}<span><strong>${esc(CAST[w].name)}</strong>: ${esc(ROOMS[st.claim].name)}, ${st.sightings.length ? `saw ${esc(nameList(st.sightings))}` : "saw no one"}</span>`,
            "confront-with",
            { witness: w },
            { cls: "witness" },
          );
        })
        .join("")
    : `<p class="muted">You haven't asked anyone else about ${SLOTS[slot].label} yet.</p>`;
  return `<div class="picker" role="group" aria-label="Choose a contradicting account">
    <p><strong>Confront ${esc(CAST[who].name)}</strong>, who says ${CAST[who].pronouns.subject} was ${esc(inRoom(state.answers[who]![slot].claim))} at ${SLOTS[slot].label}. Whose account contradicts it?</p>
    <div class="witnesses">${options}</div>
    ${button("Cancel", "confront-cancel", {}, { cls: "ghost" })}
  </div>`;
}

// Each tile carries a full room drawing, so tiles are cached by what they show
// and a tile is redrawn only when that changes.
const tileCache = new Map<string, string>();

function tileKey(room: RoomId): string {
  return `${room}|${JSON.stringify(state.searched[room] ?? null)}|${justSearched === room}|${state.over}`;
}

function roomTileHTML(room: RoomId): string {
  const key = tileKey(room);
  const hit = tileCache.get(key);
  if (hit) return hit;
  const r = ROOMS[room];
  const result = state.searched[room];
  const kept = c.weapons.filter((w) => c.weaponHome[w] === room);
  const html = `<div class="room${result ? " searched" : ""}${result?.struggle ? " struggle" : ""}${justSearched === room ? " just" : ""}">
    ${roomPic(room)}
    <h3>${esc(r.name)}${r.crewOnly ? ' <span class="tag crew">crew only</span>' : ""}</h3>
    <p class="kept muted">${kept.length ? `Kept here: ${esc(kept.map((w) => WEAPONS[w].name).join(", "))}` : "No weapons kept here"}</p>
    ${result ? `<p class="finding">${esc(describeSearch(result))}</p>` : state.over ? "" : button(`Search <span class="cost">1</span>`, "search", { room }, { cls: "search", label: `Search ${r.name}` })}
  </div>`;
  tileCache.set(key, html);
  return html;
}

function weaponsHTML(): string {
  const items = c.weapons
    .map((w) => {
      const home = c.weaponHome[w];
      const found = c.rooms.find((r) => state.searched[r]?.found === w);
      const status = found
        ? `<span class="tag crack">Found hidden ${esc(inRoom(found))}, stained</span>`
        : state.searched[home]?.missing === w
          ? `<span class="tag crack">Missing from its place</span>`
          : state.searched[home]
            ? `<span class="tag ok">In its place</span>`
            : `<span class="muted">Not checked</span>`;
      return `<li>${weaponPic(w)}<span><strong>${esc(cap(WEAPONS[w].name))}</strong> <span class="muted">kept ${esc(inRoom(home))}</span></span>${status}</li>`;
    })
    .join("");
  return `<section class="card weapons"><div class="card-head"><h2>Weapons in play</h2><p class="muted">Search a weapon's room to see whether it's where it belongs.</p></div><ul>${items}</ul></section>`;
}

// ── Interview panel and transcript ────────────────────────────────────────

function dossierHTML(): string {
  const p = CAST[selected];
  const tabs = c.suspects
    .map((s) => button(`${portrait(s)}<span>${esc(short(s))}</span>`, "select", { who: s }, { cls: "tab", pressed: s === selected, label: CAST[s].name }))
    .join("");
  const slotButtons = SLOTS.map((s, slot) =>
    button(s.label, "ask", { who: selected, slot }, { cls: "chip", disabled: state.over || !!state.answers[selected]?.[slot], label: `Ask where ${p.pronouns.subject} was at ${s.label}` }),
  ).join("");
  const people = [c.victim, ...c.suspects.filter((s) => s !== selected)];
  const chats = people
    .map((o) => button(`${portrait(o)}${esc(short(o))}${o === c.victim ? ' <span class="muted">(the late)</span>' : ""}`, "chat", { who: selected, about: o }, { cls: "chip", disabled: state.over }))
    .join("");

  return `<div class="tabs" role="group" aria-label="Suspects">${tabs}</div>
    <div class="dossier">
      <div class="dossier-head">${portrait(selected, "lg")}<div><h2>${esc(p.name)}</h2><p class="muted">${esc(cap(p.role))}</p>
        <p class="temper">${p.holdsFirm ? "Proud. Never backs down, guilty or not." : "Will crack if caught in a lie, unless guilty."}</p></div></div>
      <blockquote>${esc(state.greetings[selected] ?? "")}</blockquote>
      <p class="label">Where were you at&hellip; <span class="cost">1 each</span></p>
      <div class="chips">${slotButtons}</div>
      <p class="label">What do you make of&hellip; <span class="free">free</span></p>
      <div class="chips">${chats}</div>
    </div>`;
}

/** Plain text of a log entry, for the screen-reader announcement. */
function entryText(e: LogEntry): string {
  switch (e.kind) {
    case "question":
      return `You: ${e.text}`;
    case "line":
      return `${CAST[e.speaker].name}: ${e.text}`;
    case "narration":
      return e.text;
  }
}

function entryHTML(e: LogEntry, fresh: boolean): string {
  const cls = fresh ? " fresh" : "";
  switch (e.kind) {
    case "question":
      return `<p class="q${cls}"><span class="speaker">You</span> ${esc(e.text)}</p>`;
    case "line":
      return `<div class="line${cls}">${portrait(e.speaker)}<p><span class="speaker">${esc(CAST[e.speaker].name)}</span> &ldquo;${esc(e.text)}&rdquo;</p></div>`;
    case "narration":
      return `<p class="narration${cls}">${esc(e.text)}</p>`;
  }
}

// ── Scenes ────────────────────────────────────────────────────────────────
// An account drawn as the suspect tells it. Caught out, it shakes and gets a
// stamp; cracked, it splits apart to show where they really were.

function sceneHTML(who: CharId, slot: number, play: boolean, compact = false): string {
  const st = state.answers[who]?.[slot];
  if (!st) return "";
  const conf = state.confrontations.find((x) => x.who === who && x.slot === slot && x.outcome !== "baseless");
  const P = CAST[who];
  const time = SLOTS[slot].label;
  const told = stage({ room: st.claim, people: [who, ...st.sightings] }, slot, c.victim);
  let mode: string;
  let layers = `<div class="layer told">${told}</div>`;
  let stamp = "";
  let caption: string;
  if (conf?.outcome === "crack") {
    mode = "cracked";
    layers = `<div class="layer truth">${stage({ room: conf.truth!, people: [who] }, slot, c.victim)}</div>
      <div class="layer half l">${told}</div><div class="layer half r">${told}</div>
      <svg class="crackline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M52 0L49 18 54 34 47 52 52 70 46 100"/></svg>`;
    stamp = `<span class="stamp bad">Lied</span>`;
    caption = `${P.short} said ${inRoom(st.claim)} at ${time}. Really: ${inRoom(conf.truth!)}.`;
  } else if (conf?.outcome === "holdFirm") {
    mode = "firm";
    stamp = `<span class="stamp bad">Doubtful</span>`;
    caption = `${P.short} insists on ${ROOMS[st.claim].name} at ${time}, and won't budge.`;
  } else if (st.sightings.length > 0) {
    mode = "proven";
    stamp = `<span class="stamp ok">Corroborated</span>`;
    caption = `${ROOMS[st.claim].name}, ${time}. ${P.short} saw ${nameList(st.sightings)}, so it's true.`;
  } else {
    mode = "unconfirmed";
    caption = `As ${P.short} tells it: ${inRoom(st.claim)} at ${time}. No one to confirm it.`;
  }
  return `<figure class="scene-card${compact ? " compact" : ""}">
    <div class="scene ${mode}${play ? " play" : ""}">${layers}${stamp}</div>
    <figcaption>${esc(caption)}</figcaption>
  </figure>`;
}

const narrow = matchMedia("(max-width: 1000px)"); // the sheet only shows at these widths (style.css)

function sheetHTML(play: boolean): string {
  const fresh = state.log.slice(latestFrom);
  if (!sheetOpen || fresh.length === 0 || modal || !narrow.matches) return "";
  const last = saved.moves[saved.moves.length - 1];
  const pic = scene && (last?.kind === "ask" || last?.kind === "confront") && last.who === scene.who && last.slot === scene.slot ? sceneHTML(scene.who, scene.slot, play, true) : "";
  return `<div class="sheet">${button("&times;", "sheet-close", {}, { cls: "ghost icon", label: "Close" })}${pic}${fresh.map((e) => entryHTML(e, false)).join("")}</div>`;
}

// ── Modals ────────────────────────────────────────────────────────────────

function modalHTML(m: Modal): string {
  const body = m === "rules" ? `<h2 id="modal-title">How to play</h2>${rulesHTML()}` : m === "accuse" ? accuseHTML() : resultHTML();
  return `<div class="overlay" data-action="backdrop"><div class="modal ${m}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    ${button("&times;", "close", {}, { cls: "ghost icon close", label: "Close" })}
    ${body}
  </div></div>`;
}

function accuseHTML(): string {
  const group = <T extends string>(legend: string, ids: T[], label: (id: T) => string, picked: T | undefined, action: string) =>
    `<fieldset><legend>${legend}</legend><div class="chips">${ids
      .map((id) => button(label(id), action, { id }, { cls: `chip${picked === id ? " picked" : ""}`, pressed: picked === id }))
      .join("")}</div></fieldset>`;
  const ready = draft.who && draft.weapon && draft.room;
  const found = evidence(state);
  const pinGroup = (legend: string, items: Evidence[]) =>
    items.length
      ? `<p class="label">${legend}</p><div class="chips">${items
          .map((e) => {
            const k = evidenceKey(e);
            const on = draft.pins.includes(k);
            return button(`<span class="pin-mark" aria-hidden="true"></span>${esc(evidenceLabel(e))}`, "pin", { id: k }, {
              cls: `chip pin${on ? " picked" : ""}`,
              pressed: on,
              disabled: !on && draft.pins.length >= MAX_PINS,
            });
          })
          .join("")}</div>`
      : "";
  const proofHTML = found.length
    ? `${pinGroup("Physical evidence", found.filter((e) => e.kind === "scene" || e.kind === "missing" || e.kind === "found"))}
       ${pinGroup("Accounts that name a witness", found.filter((e) => e.kind === "account"))}
       ${pinGroup("Confrontations", found.filter((e) => e.kind === "caughtOut" || e.kind === "confession"))}
       <p class="muted pin-count">${draft.pins.length} of ${MAX_PINS} pinned.${draft.pins.length === 0 ? " A right answer with no proof earns fewer stars." : ""}</p>`
    : `<p class="muted">You haven't turned up any evidence to pin. Search rooms, find accounts that name a witness, or catch someone in a lie.</p>`;
  return `<h2 id="modal-title">Name the killer</h2>
    <p class="muted">You get one accusation, and it closes the case. You have ${state.remaining} action${state.remaining === 1 ? "" : "s"} left.</p>
    ${group("Who", c.suspects, (s) => `${portrait(s)}${esc(CAST[s].name)}${saved.marks[s] === "cleared" ? ' <span class="muted">(cleared)</span>' : ""}`, draft.who, "pick-who")}
    ${group("With what", c.weapons, (w) => `${weaponPic(w)}${esc(cap(WEAPONS[w].name))}`, draft.weapon, "pick-weapon")}
    ${group("Where", c.rooms, (r) => esc(ROOMS[r].name), draft.room, "pick-room")}
    <fieldset class="proof"><legend>Your proof <span class="muted">one pin for the killer, one for the weapon, one for the room</span></legend>${proofHTML}</fieldset>
    <div class="modal-actions">
      ${button(
        ready ? `Accuse ${esc(CAST[draft.who!].short)}: the ${esc(WEAPONS[draft.weapon!].name)}, ${esc(inRoom(draft.room!))}` : "Choose a suspect, a weapon and a room",
        "accuse-confirm",
        {},
        { cls: "primary big", disabled: !ready },
      )}
    </div>`;
}

function resultHTML(): string {
  const a = state.accusation!;
  const r = rank(state)!;
  const { killer, weapon, room, slot, hiddenIn, alibi } = c.solution;
  const k = CAST[killer];
  const reply = [...state.log].reverse().find((e) => e.kind === "line");
  const tick = (ok: boolean) => (ok ? '<span class="ok">&#10003;</span>' : '<span class="bad">&#10007;</span>');
  const pinned = (ok: boolean) => (ok ? '<span class="ok"><span aria-hidden="true">&#128204;</span><span class="sr">Proven</span></span>' : '<span class="muted"><span aria-hidden="true">&mdash;</span><span class="sr">Not proven</span></span>');
  const herrings = c.secrets
    .map((s) => {
      const p = CAST[s.who];
      const confession = p.secrets.find((x) => x.id === s.secretId)!.confession;
      return `<li>${portrait(s.who)}<span><strong>${esc(p.name)}</strong> said ${p.pronouns.subject} was ${esc(inRoom(s.claim))} at ${SLOTS[s.slot].label}, but was ${esc(inRoom(s.room))}. &ldquo;${esc(confession)}&rdquo;</span></li>`;
    })
    .join("");
  return `<p class="eyebrow">${a.solved ? "Case closed" : a.right.who ? "A confession, but not your version" : "The Captain sends the wrong name"}</p>
    <h2 id="modal-title">${esc(r.title)}</h2>
    <p class="stars"><span class="sr">${r.stars} of 3 stars</span><span aria-hidden="true">${"&#9733;".repeat(r.stars)}${'<span class="dim">&#9733;</span>'.repeat(3 - r.stars)}</span></p>
    ${reply && reply.kind === "line" ? `<div class="line big">${portrait(reply.speaker, "lg")}<p>&ldquo;${esc(reply.text)}&rdquo;</p></div>` : ""}
    <table class="verdict">
      <tr><td></td><th scope="col">You said</th><th scope="col">Right</th><th scope="col">Proven</th></tr>
      <tr><th scope="row">Killer</th><td>${esc(CAST[a.who].name)}</td><td>${tick(a.right.who)}</td><td>${pinned(a.proof.killer)}</td></tr>
      <tr><th scope="row">Weapon</th><td>${esc(cap(WEAPONS[a.weapon].name))}</td><td>${tick(a.right.weapon)}</td><td>${pinned(a.proof.weapon)}</td></tr>
      <tr><th scope="row">Room</th><td>${esc(ROOMS[a.room].name)}</td><td>${tick(a.right.room)}</td><td>${pinned(a.proof.room)}</td></tr>
    </table>
    <h3>Your proof</h3>
    ${
      a.pins.length
        ? `<ul class="proof-list">${a.pins
            .map((p) => {
              const ok = p.supports !== null && a.proof[p.supports];
              const why = p.supports === "killer" && !ok ? `${p.why} But ${short(a.who)} isn't the killer.` : p.why;
              return `<li class="${ok ? "ok" : "bad"}"><b><span aria-hidden="true">${ok ? "&#10003;" : "&#10007;"}</span><span class="sr">${ok ? "Holds" : "Doesn't hold"}</span></b><span><strong>${esc(evidenceLabel(p.evidence))}</strong>${ok ? ` <span class="muted">proves the ${LEG_NAME[p.supports!]}</span>` : ""}<br>${esc(why)}</span></li>`;
            })
            .join("")}</ul>`
        : `<p class="muted">You pinned no evidence${a.solved ? ". The right answer, but nothing to make it stick." : "."}</p>`
    }
    <h3>What really happened</h3>
    <p>${esc(k.name)} killed ${esc(CAST[c.victim].name)} with the ${esc(WEAPONS[weapon].name)} ${esc(inRoom(room))} ${esc(atTime(slot))}. ${cap(k.pronouns.subject)} hid the ${esc(WEAPONS[weapon].name)} ${esc(inRoom(hiddenIn))} and claimed to have been ${esc(inRoom(alibi))}.</p>
    ${replayHTML(c, replayAt, !reducedMotion(), replayTimer !== null)}
    ${herrings ? `<h3>Red herrings</h3><ul class="herrings">${herrings}</ul>` : ""}
    <p class="muted">Actions used: ${AP_BUDGET - state.remaining} of ${AP_BUDGET}.${saved.hints.length ? ` Hints asked for: ${saved.hints.length}.` : ""}</p>
    <div class="share"><pre>${esc(shareText())}</pre>${button(copied ? "Copied" : "Copy result", "copy", {}, { cls: "ghost" })}</div>
    <div class="modal-actions">
      ${button("Play a random case", "random", {}, { cls: "primary" })}
      ${button("Back to the notebook", "close", {}, { cls: "ghost" })}
    </div>`;
}

function shareText(): string {
  const a = state.accusation!;
  const r = rank(state)!;
  const trail = state.moves.map((m) => ({ search: "🔎", ask: "💬", confront: "⚡", chat: "", accuse: "" })[m.kind]).join("");
  const squares = [a.right.who, a.right.weapon, a.right.room].map((ok) => (ok ? "🟩" : "🟥")).join("");
  const headline = a.solved ? `Solved with ${state.remaining} action${state.remaining === 1 ? "" : "s"} to spare ${"★".repeat(r.stars)}` : a.right.who ? "Right killer, wrong details" : "Wrong name sent to New York";
  const hints = saved.hints.length ? ` 💡${saved.hints.length}` : "";
  return `RMS Meridian · ${caseLabel}\n${headline}${hints}\n${squares}${r.proven ? ` ${"📌".repeat(r.proven)}` : ""} ${trail}`;
}

const LEG_NAME: Record<Leg, string> = { killer: "killer", weapon: "weapon", room: "room" };

function evidenceLabel(e: Evidence): string {
  switch (e.kind) {
    case "scene":
      return `Struggle ${inRoom(e.room)}`;
    case "missing":
      return `${cap(WEAPONS[e.weapon].name)} missing from ${the(e.room)}`;
    case "found":
      return `${cap(WEAPONS[e.weapon].name)} hidden ${inRoom(e.room)}`;
    case "account": {
      const st = c.testimony[e.who][e.slot];
      return `${short(e.who)} at ${SLOTS[e.slot].label}: ${ROOMS[st.claim].name}, saw ${nameList(st.sightings)}`;
    }
    case "caughtOut":
      return `${short(e.who)} caught out about ${SLOTS[e.slot].label}`;
    case "confession":
      return `${short(e.who)}'s confession about ${SLOTS[e.slot].label}`;
  }
}

// ── Replay of the night ───────────────────────────────────────────────────
// Steps repaint the replay in place rather than re-rendering, so its tokens
// tween from room to room. A full render redraws it at the current step.

function replayTo(step: number): void {
  replayAt = Math.max(0, Math.min(step, replaySteps(c) - 1));
  const root = app.querySelector<HTMLElement>(".replay");
  if (root) paintReplay(root, c, replayAt, replayTimer !== null);
}

function stopReplay(): void {
  if (replayTimer !== null) clearTimeout(replayTimer);
  replayTimer = null;
}

function playReplay(): void {
  const last = replaySteps(c) - 1;
  const tick = () => {
    replayTimer = setTimeout(() => {
      if (!app.querySelector(".replay")) return stopReplay(); // the verdict was closed
      replayAt += 1;
      if (replayAt >= last) replayTimer = null;
      else tick();
      replayTo(replayAt);
    }, replayHold(c, replayAt));
  };
  if (replayAt >= last) replayAt = 0;
  tick();
  replayTo(replayAt);
}

// ── Events ────────────────────────────────────────────────────────────────

const app = document.getElementById("app")!;
document.body.insertAdjacentHTML("afterbegin", INK_DEFS); // the pen-and-ink filter and hatching every drawing uses

// One live region for the whole page, outside #app so redraws never touch it.
// After a move it holds just that move's lines, which screen readers read out.
const announcer = document.createElement("div");
announcer.className = "sr";
announcer.setAttribute("aria-live", "polite");
document.body.append(announcer);

function announce(entries: LogEntry[]): void {
  announcer.replaceChildren(...entries.map((e) => Object.assign(document.createElement("p"), { textContent: entryText(e) })));
}

app.addEventListener("click", (event) => {
  const el = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
  if (!el || (el instanceof HTMLButtonElement && el.disabled)) return;
  const d = el.dataset;
  const who = d.who as CharId;
  const slot = Number(d.slot);
  // The second click of a double-click would repeat a free chat, or land on whatever replaced the button.
  if (event.detail > 1 && MOVE_ACTIONS.has(d.action!)) return;
  switch (d.action) {
    case "begin":
      view = "game";
      saved.started = true;
      persist();
      render();
      window.scrollTo(0, 0);
      return;
    case "briefing":
      view = "briefing";
      render();
      window.scrollTo(0, 0);
      return;
    case "random":
      location.search = `?case=${Math.floor(Math.random() * 1_000_000)}`;
      return;
    case "daily":
      location.href = location.pathname;
      return;
    case "today":
      location.href = `${location.pathname}?today`;
      return;
    case "rules":
    case "accuse":
    case "result":
      modal = d.action;
      break;
    case "close":
      closeModal();
      break;
    case "backdrop":
      if (event.target !== el || !pressedOnBackdrop) return;
      closeModal();
      break;
    case "hint":
      hintOpen = !hintOpen;
      hintEnter = hintOpen;
      if (hintOpen && !saved.hints.includes(saved.moves.length)) {
        saved.hints = [...saved.hints, saved.moves.length];
        persist();
      }
      break;
    case "hint-close":
      hintOpen = false;
      break;
    case "hint-do": {
      const h = currentHint();
      if (!h) break;
      if (h.kind === "move") {
        if (h.move.kind !== "search") selected = h.move.who;
        act(h.move);
        return;
      }
      draft = { who: h.who, weapon: h.weapon, room: h.room, pins: h.pins.map(evidenceKey) };
      hintOpen = false;
      modal = "accuse";
      break;
    }
    case "dismiss":
      notice = null;
      carriedNote = false;
      break;
    case "sheet-close":
      sheetOpen = false;
      break;
    case "select":
      selected = who;
      break;
    case "mark": {
      const next: Record<string, Mark | undefined> = { none: "cleared", cleared: "suspect", suspect: undefined };
      const value = next[saved.marks[who] ?? "none"];
      saved.marks = { ...saved.marks, [who]: value };
      if (!value) delete saved.marks[who];
      persist();
      break;
    }
    case "ask":
      selected = who;
      act({ kind: "ask", who, slot });
      return;
    case "search":
      act({ kind: "search", room: d.room as RoomId });
      return;
    case "chat":
      act({ kind: "chat", who, about: d.about as CharId });
      return;
    case "scene":
      scene = { who, slot };
      scenePlay = true;
      selected = who;
      break;
    case "pin": {
      const k = d.id!;
      draft = { ...draft, pins: draft.pins.includes(k) ? draft.pins.filter((p) => p !== k) : [...draft.pins, k].slice(0, MAX_PINS) };
      break;
    }
    case "confront-start":
      selected = who;
      confronting = confronting?.who === who && confronting.slot === slot ? null : { who, slot };
      break;
    case "confront-cancel":
      confronting = null;
      break;
    case "confront-with":
      if (confronting) act({ kind: "confront", ...confronting, witness: d.witness as CharId });
      return;
    case "pick-who":
      draft = { ...draft, who: d.id as CharId };
      break;
    case "pick-weapon":
      draft = { ...draft, weapon: d.id as WeaponId };
      break;
    case "pick-room":
      draft = { ...draft, room: d.id as RoomId };
      break;
    case "accuse-confirm":
      if (draft.who && draft.weapon && draft.room) {
        const pins = evidence(state).filter((e) => draft.pins.includes(evidenceKey(e)));
        act({ kind: "accuse", who: draft.who, weapon: draft.weapon, room: draft.room, pins });
      }
      return;
    case "copy":
      void copyResult();
      return;
    case "replay-play":
      if (replayTimer !== null) {
        stopReplay();
        replayTo(replayAt);
      } else playReplay();
      return;
    case "replay-prev":
    case "replay-next":
    case "replay-go":
      stopReplay();
      replayTo(d.action === "replay-go" ? Number(d.step) : replayAt + (d.action === "replay-next" ? 1 : -1));
      return;
  }
  render();
});

const MOVE_ACTIONS = new Set(["ask", "search", "chat", "confront-with", "accuse-confirm", "hint-do"]);

// A click that starts inside the modal and ends on the backdrop (say, selecting
// text) shouldn't close it.
let pressedOnBackdrop = false;
app.addEventListener("pointerdown", (event) => {
  pressedOnBackdrop = (event.target as HTMLElement).classList.contains("overlay");
});

function closeModal(): void {
  modal = null;
  copied = false;
  stopReplay();
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Tab") return trapFocus(event);
  if (event.key !== "Escape" || document.body.classList.contains("cinema-open")) return;
  if (modal) closeModal();
  else if (confronting) confronting = null;
  else if (hintOpen) hintOpen = false;
  else if (sheetOpen) sheetOpen = false;
  else return;
  render();
});

/** Tab and Shift-Tab wrap around inside an open modal. The page behind it is inert. */
function trapFocus(event: KeyboardEvent): void {
  const box = view === "game" && modal ? app.querySelector<HTMLElement>(".modal") : null;
  if (!box || document.body.classList.contains("cinema-open")) return;
  const stops = [...box.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])")];
  if (!stops.length) return;
  const first = stops[0];
  const last = stops[stops.length - 1];
  const at = document.activeElement;
  if (event.shiftKey ? at === first || !box.contains(at) : at === last || !box.contains(at)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}

async function copyResult(): Promise<void> {
  try {
    await navigator.clipboard.writeText(shareText());
    copied = true;
  } catch {
    copied = false;
  }
  render();
}

// Scrolled panes keep their place across a re-render.
const SCROLLERS = [".table-wrap", ".modal", ".transcript"];
let modalOpener: { key: string; index: number } | null = null;

/** Where focus is, as its button's key and which of the buttons with that key it is. */
function focusSpot(): { key: string; index: number } | null {
  const el = document.activeElement as HTMLElement | null;
  const key = el?.dataset?.key;
  if (!el || !key) return null;
  return { key, index: [...app.querySelectorAll(`[data-key="${CSS.escape(key)}"]`)].indexOf(el) };
}

function refocus(spot: { key: string; index: number } | null): boolean {
  if (!spot) return false;
  const all = app.querySelectorAll<HTMLElement>(`[data-key="${CSS.escape(spot.key)}"]`);
  const el = all[spot.index] ?? all[0];
  el?.focus({ preventScroll: true });
  return !!el;
}

// ── Rendering ─────────────────────────────────────────────────────────────
// The notebook is a fixed frame (shellHTML) of regions. Each render rebuilds a
// region's HTML only when the key of what it shows has changed, so a click
// that changes one thing doesn't redraw every room through the ink filter.

type Region = "header" | "hint" | "notice" | "timeline" | "weapons" | "dossier" | "scene" | "sheet" | "modal";

let shownView: typeof view | null = null;
const shown = new Map<Region, string>(); // each region's key as last drawn
let shownTiles: string[] = [];
let shownLog = 0; // transcript entries on the page

function regionEl(name: Region): HTMLElement {
  return app.querySelector<HTMLElement>(`[data-region="${name}"]`)!;
}

/** Redraws a region if its key changed. `force` redraws it anyway, to replay its entrance. */
function patch(name: Region, html: string, key = html, force = false): void {
  if (!force && shown.get(name) === key) return;
  regionEl(name).innerHTML = html;
  shown.set(name, key);
}

function paintGame(): void {
  // Entrance animations from the last render have had their one render.
  if (!scenePlay) app.querySelectorAll(".scene.play").forEach((el) => el.classList.remove("play"));
  app.querySelectorAll(".transcript .fresh").forEach((el) => el.classList.remove("fresh"));

  patch("header", headerHTML());
  patch("hint", hintHTML());
  const n = noticeHTML();
  patch("notice", n, `${noticeId}|${n}`);
  patch("timeline", timelineHTML());
  const tiles = app.querySelector(".room-grid")!.children;
  c.rooms.forEach((room, i) => {
    const key = tileKey(room);
    if (shownTiles[i] !== key) tiles[i].outerHTML = roomTileHTML(room);
    shownTiles[i] = key;
  });
  patch("weapons", weaponsHTML());
  patch("dossier", dossierHTML());
  patch("scene", scene ? sceneHTML(scene.who, scene.slot, scenePlay) : "", scene ? sceneHTML(scene.who, scene.slot, false) : "", scenePlay);

  // The log only grows, so new entries are appended.
  const log = state.log;
  if (log.length !== shownLog) {
    const html = log.slice(shownLog).map((e, i) => entryHTML(e, fresh && shownLog + i >= latestFrom)).join("");
    const transcript = document.getElementById("transcript")!;
    if (shownLog === 0) transcript.innerHTML = `<h2>Transcript</h2>${html}`;
    else transcript.insertAdjacentHTML("beforeend", html);
    shownLog = log.length;
  }

  patch("sheet", sheetHTML(scenePlay), sheetHTML(false), scenePlay);
  patch("modal", modal ? modalHTML(modal) : "");
  const box = regionEl("modal");
  for (const el of app.children) if (el !== box) (el as HTMLElement).inert = modal !== null;
}

function render(): void {
  const spot = focusSpot();
  const focused = document.activeElement;
  const modalWasOpen = !!document.querySelector(".modal");
  const scrolls = SCROLLERS.map((sel) => {
    const el = app.querySelector<HTMLElement>(sel);
    return el ? [el.scrollLeft, el.scrollTop] : null;
  });
  if (view !== shownView) {
    app.innerHTML = view === "briefing" ? briefingHTML() : shellHTML();
    shownView = view;
    shown.clear();
    shownTiles = [];
    shownLog = 0;
  }
  if (view === "game") paintGame();
  document.body.classList.toggle("modal-open", view === "game" && modal !== null);
  SCROLLERS.forEach((sel, i) => {
    const el = app.querySelector<HTMLElement>(sel);
    const was = scrolls[i];
    if (!el || !was || (sel === ".modal" && !modalWasOpen)) return;
    [el.scrollLeft, el.scrollTop] = was;
  });
  const transcript = document.getElementById("transcript");
  if (transcript && (fresh || !scrolls[SCROLLERS.indexOf(".transcript")])) transcript.scrollTop = transcript.scrollHeight;
  // Regions that weren't redrawn may still glow from an earlier hint.
  const h = currentHint();
  const target = h ? hintTarget(h) : null;
  app.querySelectorAll<HTMLElement>(".hinted").forEach((el) => el.classList.toggle("hinted", el.dataset.key === target));
  if (target) app.querySelectorAll(`[data-key="${CSS.escape(target)}"]`).forEach((el) => el.classList.add("hinted"));
  if (modal && !modalWasOpen) {
    modalOpener = spot;
    app.querySelector<HTMLElement>(".modal button:not(.close)")?.focus();
  } else if (!modal && modalWasOpen) {
    refocus(modalOpener);
    modalOpener = null;
  } else if (!focused?.isConnected) refocus(spot); // its region was redrawn
  scenePlay = false;
  justSearched = null;
  fresh = false;
  hintEnter = false;
}

render();
if (view === "briefing" && saved.moves.length === 0 && !reducedMotion()) void playIntro();
