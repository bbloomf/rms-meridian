// Browser front end: the briefing, the notebook (timeline, rooms, weapons), the
// interview panel and the accusation. The page is rebuilt from the game state
// after every action; the state itself is rebuilt from the saved moves.

import { CAST, ROOMS, SLOTS, WEAPONS, inRoom, the } from "../data.ts";
import type { CharId, RoomId, WeaponId } from "../data.ts";
import { AP_BUDGET, generateCase } from "../solver.ts";
import { dailySeed } from "../rng.ts";
import { MAX_PINS, THRIFTY, atTime, check, describeSearch, evidence, evidenceKey, play, placements, rank } from "../game.ts";
import type { Evidence, GameState, Leg, LogEntry, Move } from "../game.ts";
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
}

// ── Case selection ────────────────────────────────────────────────────────
// No ?case= means today's daily case (seeded by UTC date, same for everyone).

const requested = new URLSearchParams(location.search).get("case");
const parsed = requested === null ? NaN : Number.parseInt(requested, 10);
const daily = !Number.isFinite(parsed);
const today = new Date();
const seed = daily ? dailySeed(today) : parsed >>> 0;
const c = generateCase(seed).case;
const caseLabel = daily
  ? `Daily case · ${today.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}`
  : `Case No. ${seed}`;
const STORE_KEY = `meridian:v2:${seed}`; // v2: cases now require a provable killer, so v1 saves may be for a different case

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
let latestFrom = state.log.length; // log entries from the most recent move are highlighted
let sheetOpen = false; // phone-width sheet showing the latest reply
let copied = false;
let replayAt = 0; // step of the verdict's replay of the night
let replayTimer: ReturnType<typeof setTimeout> | null = null;

/** The most recent account asked about or confronted, to show again on reload. */
function lastScene(): { who: CharId; slot: number } | null {
  const m = [...saved.moves].reverse().find((x) => x.kind === "ask" || x.kind === "confront");
  return m && (m.kind === "ask" || m.kind === "confront") ? { who: m.who, slot: m.slot } : null;
}

function load(): Saved {
  const empty: Saved = { started: false, moves: [], marks: {} };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? { ...empty, ...(JSON.parse(raw) as Partial<Saved>) } : empty;
  } catch {
    return empty;
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(saved));
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
    render();
    return;
  }
  latestFrom = state.log.length;
  saved.moves = [...saved.moves, move];
  state = play(c, saved.moves);
  persist();
  notice = null;
  confronting = null;
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
      <div class="briefing-actions">
        ${button(progress ? "Resume the investigation" : "Begin the investigation", "begin", {}, { cls: "primary big" })}
        ${daily ? button("Try a random case instead", "random", {}, { cls: "link" }) : button("Today's daily case", "daily", {}, { cls: "link" })}
      </div>
    </div>
  </main>`;
}

// ── Notebook ──────────────────────────────────────────────────────────────

function gameHTML(): string {
  const v = CAST[c.victim];
  return `${headerHTML()}
  <p class="case-line">${portrait(c.victim)} <span><strong>${esc(v.name)}</strong>, ${esc(v.role)}, found dead on the Boat Deck. Time of death between ${windowLabel()}.</span></p>
  <div class="layout">
    <section class="board">
      ${noticeHTML()}
      ${timelineHTML()}
      ${roomsHTML()}
      ${weaponsHTML()}
    </section>
    <aside class="interview">${interviewHTML()}</aside>
  </div>
  ${sheetHTML()}
  ${modal ? modalHTML(modal) : ""}`;
}

function headerHTML(): string {
  const pips = Array.from({ length: AP_BUDGET }, (_, i) => `<span class="pip${i < AP_BUDGET - state.remaining ? " spent" : ""}"></span>`).join("");
  return `<header class="bar">
    <div class="brand">${mark()}${button("RMS Meridian", "briefing", {}, { cls: "wordmark", label: "Back to the briefing" })}<span class="muted">${esc(caseLabel)}</span></div>
    <div class="meter" role="img" aria-label="${state.remaining} of ${AP_BUDGET} actions left"><div class="pips">${pips}</div><span><strong>${state.remaining}</strong> left</span></div>
    <div class="bar-actions">
      ${button("How to play", "rules", {}, { cls: "ghost" })}
      ${state.over ? button("See verdict", "result", {}, { cls: "primary" }) : button("Accuse", "accuse", {}, { cls: "primary" })}
    </div>
  </header>`;
}

function noticeHTML(): string {
  if (state.over) return "";
  if (state.remaining === 0) {
    return `<div class="notice midnight"><p>It's midnight. The Captain is at the wireless, waiting for a name.</p>${button("Make your accusation", "accuse", {}, { cls: "primary" })}</div>`;
  }
  return notice ? `<div class="notice" role="alert"><p>${esc(notice)}</p>${button("&times;", "dismiss", {}, { cls: "ghost icon", label: "Dismiss" })}</div>` : "";
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
      label: `${ROOMS[answer.claim].name}. Show ${CAST[who].short}'s account of ${SLOTS[slot].label}`,
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

function roomsHTML(): string {
  const tiles = c.rooms
    .map((room) => {
      const r = ROOMS[room];
      const result = state.searched[room];
      const kept = c.weapons.filter((w) => c.weaponHome[w] === room);
      return `<div class="room${result ? " searched" : ""}${result?.struggle ? " struggle" : ""}${justSearched === room ? " just" : ""}">
        ${roomPic(room)}
        <h3>${esc(r.name)}${r.crewOnly ? ' <span class="tag crew">crew only</span>' : ""}</h3>
        <p class="kept muted">${kept.length ? `Kept here: ${esc(kept.map((w) => WEAPONS[w].name).join(", "))}` : "No weapons kept here"}</p>
        ${result ? `<p class="finding">${esc(describeSearch(result))}</p>` : state.over ? "" : button(`Search <span class="cost">1</span>`, "search", { room }, { cls: "search", label: `Search ${r.name}` })}
      </div>`;
    })
    .join("");
  return `<section class="card rooms"><div class="card-head"><h2>Rooms in play</h2><p class="muted">The murder happened in one of these. Only crew have keys to crew-only rooms.</p></div><div class="room-grid">${tiles}</div></section>`;
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

function interviewHTML(): string {
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
    </div>
    ${scene ? sceneHTML(scene.who, scene.slot) : ""}
    <div class="transcript" id="transcript" aria-live="polite">
      <h2>Transcript</h2>
      ${state.log.length ? state.log.map((e, i) => entryHTML(e, i >= latestFrom)).join("") : '<p class="muted">Nothing on record yet.</p>'}
    </div>`;
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

function sceneHTML(who: CharId, slot: number, compact = false): string {
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
    <div class="scene ${mode}${scenePlay ? " play" : ""}">${layers}${stamp}</div>
    <figcaption>${esc(caption)}</figcaption>
  </figure>`;
}

function sheetHTML(): string {
  const fresh = state.log.slice(latestFrom);
  if (!sheetOpen || fresh.length === 0 || modal) return "";
  const last = saved.moves[saved.moves.length - 1];
  const pic = scene && (last?.kind === "ask" || last?.kind === "confront") && last.who === scene.who && last.slot === scene.slot ? sceneHTML(scene.who, scene.slot, true) : "";
  return `<div class="sheet" aria-live="polite">${button("&times;", "sheet-close", {}, { cls: "ghost icon", label: "Close" })}${pic}${fresh.map((e) => entryHTML(e, false)).join("")}</div>`;
}

// ── Modals ────────────────────────────────────────────────────────────────

function modalHTML(m: Modal): string {
  const body = m === "rules" ? `<h2>How to play</h2>${rulesHTML()}` : m === "accuse" ? accuseHTML() : resultHTML();
  return `<div class="overlay" data-action="backdrop"><div class="modal ${m}" role="dialog" aria-modal="true">
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
  return `<h2>Name the killer</h2>
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
  const pinned = (ok: boolean) => (ok ? '<span class="ok" aria-label="Proven">&#128204;</span>' : '<span class="muted" aria-label="Not proven">&mdash;</span>');
  const herrings = c.secrets
    .map((s) => {
      const p = CAST[s.who];
      const confession = p.secrets.find((x) => x.id === s.secretId)!.confession;
      return `<li>${portrait(s.who)}<span><strong>${esc(p.name)}</strong> said ${p.pronouns.subject} was ${esc(inRoom(s.claim))} at ${SLOTS[s.slot].label}, but was ${esc(inRoom(s.room))}. &ldquo;${esc(confession)}&rdquo;</span></li>`;
    })
    .join("");
  return `<p class="eyebrow">${a.solved ? "Case closed" : "The Captain sends the wrong name"}</p>
    <h2>${esc(r.title)}</h2>
    <p class="stars" aria-label="${r.stars} of 3 stars">${"&#9733;".repeat(r.stars)}${'<span class="dim">&#9733;</span>'.repeat(3 - r.stars)}</p>
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
              return `<li class="${ok ? "ok" : "bad"}"><b aria-label="${ok ? "Holds" : "Doesn't hold"}">${ok ? "&#10003;" : "&#10007;"}</b><span><strong>${esc(evidenceLabel(p.evidence))}</strong>${ok ? ` <span class="muted">proves the ${LEG_NAME[p.supports!]}</span>` : ""}<br>${esc(why)}</span></li>`;
            })
            .join("")}</ul>`
        : `<p class="muted">You pinned no evidence${a.solved ? ". The right answer, but nothing to make it stick." : "."}</p>`
    }
    <h3>What really happened</h3>
    <p>${esc(k.name)} killed ${esc(CAST[c.victim].name)} with the ${esc(WEAPONS[weapon].name)} ${esc(inRoom(room))} ${esc(atTime(slot))}. ${cap(k.pronouns.subject)} hid the ${esc(WEAPONS[weapon].name)} ${esc(inRoom(hiddenIn))} and claimed to have been ${esc(inRoom(alibi))}.</p>
    ${replayHTML(c, replayAt, !reducedMotion(), replayTimer !== null)}
    ${herrings ? `<h3>Red herrings</h3><ul class="herrings">${herrings}</ul>` : ""}
    <p class="muted">Actions used: ${AP_BUDGET - state.remaining} of ${AP_BUDGET}.</p>
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
  const headline = a.solved ? `Solved with ${state.remaining} action${state.remaining === 1 ? "" : "s"} to spare ${"★".repeat(r.stars)}` : "Wrong name sent to New York";
  return `RMS Meridian · ${caseLabel}\n${headline}\n${squares}${r.proven ? ` ${"📌".repeat(r.proven)}` : ""} ${trail}`;
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

app.addEventListener("click", (event) => {
  const el = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
  if (!el || (el instanceof HTMLButtonElement && el.disabled)) return;
  const d = el.dataset;
  const who = d.who as CharId;
  const slot = Number(d.slot);
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
    case "rules":
    case "accuse":
    case "result":
      modal = d.action;
      break;
    case "close":
      modal = null;
      break;
    case "backdrop":
      if (event.target !== el) return;
      modal = null;
      break;
    case "dismiss":
      notice = null;
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

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || document.body.classList.contains("cinema-open")) return;
  if (modal) modal = null;
  else if (confronting) confronting = null;
  else return;
  render();
});

async function copyResult(): Promise<void> {
  try {
    await navigator.clipboard.writeText(shareText());
    copied = true;
  } catch {
    copied = false;
  }
  render();
}

function render(): void {
  const focusKey = (document.activeElement as HTMLElement | null)?.dataset?.key;
  const modalWasOpen = !!document.querySelector(".modal");
  app.innerHTML = view === "briefing" ? briefingHTML() : gameHTML();
  document.body.classList.toggle("modal-open", view === "game" && modal !== null);
  const transcript = document.getElementById("transcript");
  if (transcript) transcript.scrollTop = transcript.scrollHeight;
  const again = focusKey ? app.querySelector<HTMLElement>(`[data-key="${CSS.escape(focusKey)}"]`) : null;
  if (again) again.focus();
  else if (modal && !modalWasOpen) app.querySelector<HTMLElement>(".modal button:not(.close)")?.focus();
  scenePlay = false;
  justSearched = null;
}

render();
if (view === "briefing" && saved.moves.length === 0 && !reducedMotion()) void playIntro();
