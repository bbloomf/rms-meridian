// The "What next?" advisor for new players. It reasons only from what the
// player has turned up (searches, answers, confrontations) and the rules they
// were told, never from the solution, so following it is like having a
// patient sergeant at your elbow rather than a peek at the answer.
//
// Order of business: the physical evidence first (it never lies), then the
// time of death, then a confrontation when a lie shows, then the proof.

import { CAST, ROOMS, SLOTS, WEAPONS, inRoom, the } from "./data.ts";
import type { CharId, RoomId, WeaponId } from "./data.ts";
import { MAX_PINS, evidence, judgePin, placements } from "./game.ts";
import type { Evidence, GameState, Move } from "./game.ts";

export type Hint =
  | { kind: "move"; move: Exclude<Move, { kind: "accuse" | "chat" }>; title: string; why: string }
  | { kind: "accuse"; who: CharId; weapon: WeaponId; room: RoomId; pins: Evidence[]; title: string; why: string };

/** What the player can deduce so far. Each list holds what's still possible. */
export interface Deduction {
  rooms: RoomId[];
  weapons: WeaponId[];
  killers: CharId[];
}

export function deduce(state: GameState): Deduction {
  const { rooms, weapons } = physical(state);
  return { rooms, weapons, killers: suspectsLeft(state, rooms) };
}

function physical(state: GameState): { rooms: RoomId[]; weapons: WeaponId[] } {
  const c = state.case;
  const searched = c.rooms.filter((r) => state.searched[r]);
  const results = searched.map((r) => state.searched[r]!);
  const struggle = searched.find((r) => state.searched[r]!.struggle);
  const rooms = struggle ? [struggle] : c.rooms.filter((r) => !state.searched[r]);
  const direct = results.find((s) => s.missing || s.found);
  const seen = new Set(results.flatMap((s) => s.present));
  const weapons = direct ? [(direct.missing ?? direct.found)!] : c.weapons.filter((w) => !seen.has(w));
  return { rooms, weapons };
}

// The killer was alone with the victim, so a suspect is cleared for a time and
// room if they're proven elsewhere, the victim is proven elsewhere or alive
// later, or someone else is proven to have been there.
function couldHaveKilled(state: GameState, x: CharId, room: RoomId, slot: number): boolean {
  const c = state.case;
  const places = placements(state);
  const at = (p: CharId, s: number) => places[p]?.[s]?.room;
  if (at(x, slot) && at(x, slot) !== room) return false;
  if (at(c.victim, slot) && at(c.victim, slot) !== room) return false;
  for (let t = slot + 1; t < SLOTS.length; t++) if (at(c.victim, t)) return false;
  return !c.suspects.some((p) => p !== x && at(p, slot) === room);
}

function suspectsLeft(state: GameState, rooms: RoomId[]): CharId[] {
  const c = state.case;
  // The killer never backs down, and only the proud hold firm when innocent.
  const firm = state.confrontations.find((x) => x.outcome === "holdFirm" && !CAST[x.who].holdsFirm);
  if (firm) return [firm.who];
  const cracked = new Set(state.confrontations.filter((x) => x.outcome === "crack").map((x) => x.who));
  return c.suspects.filter((x) => !cracked.has(x) && rooms.some((r) => c.window.some((s) => couldHaveKilled(state, x, r, s))));
}

/** The slots in the time of death that someone could still have killed in. */
function liveSlots(state: GameState, d: Deduction): number[] {
  return state.case.window.filter((s) => d.killers.some((x) => d.rooms.some((r) => couldHaveKilled(state, x, r, s))));
}

const asked = (state: GameState, who: CharId, slot: number) => !!state.answers[who]?.[slot];
const name = (who: CharId) => CAST[who].name;
const short = (who: CharId) => CAST[who].short;
const time = (slot: number) => SLOTS[slot].label;
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export function hint(state: GameState): Hint | null {
  if (state.over) return null;
  const d = deduce(state);
  const solved = d.rooms.length === 1 && d.weapons.length === 1 && d.killers.length === 1;
  if (state.remaining === 0) return accuseHint(state, d, "You're out of time.");
  if (!solved) {
    const physical = d.rooms.length > 1 || d.weapons.length > 1 ? searchHint(state, d) : null;
    return physical ?? confrontHint(state, d) ?? askHint(state, d) ?? accuseHint(state, d, "There's nothing more worth asking.");
  }
  return proofHint(state, d) ?? accuseHint(state, d, "");
}

// ── Searching ─────────────────────────────────────────────────────────────

function searchHint(state: GameState, d: Deduction): Hint | null {
  const c = state.case;
  const roomOpen = d.rooms.length > 1;
  const weaponOpen = d.weapons.length > 1;
  const options = c.rooms
    .filter((r) => !state.searched[r])
    .map((r) => ({ r, kept: d.weapons.filter((w) => weaponOpen && c.weaponHome[w] === r) }))
    .filter((o) => roomOpen || o.kept.length > 0);
  if (options.length === 0) return null;
  const best = options.reduce((a, b) => (b.kept.length > a.kept.length ? b : a));
  const kept = best.kept.map((w) => `the ${WEAPONS[w].name}`);
  const first = Object.keys(state.searched).length === 0;
  const lead = first ? "Start with the physical evidence: it never lies. " : "";
  const why = roomOpen
    ? kept.length
      ? `${lead}A search shows whether there was a struggle ${inRoom(best.r)}, and ${list(kept)} ${kept.length > 1 ? "are" : "is"} kept there, so you'll also see whether ${kept.length > 1 ? "they're" : "it's"} missing.`
      : `${lead}You still don't know where it happened. Each room you search either shows the struggle or crosses itself off.`
    : `You know where it happened, but not with what. ${cap(list(kept))} ${kept.length > 1 ? "are" : "is"} kept ${inRoom(best.r)}: if ${kept.length > 1 ? "one is" : "it's"} gone, that's your weapon.`;
  return { kind: "move", move: { kind: "search", room: best.r }, title: `Search ${the(best.r)}`, why };
}

// ── Questions ─────────────────────────────────────────────────────────────

function confrontHint(state: GameState, d: Deduction): Hint | null {
  const c = state.case;
  for (const slot of liveSlots(state, d)) {
    for (const who of d.killers) {
      if (CAST[who].holdsFirm) continue; // a proud suspect holds firm either way, so it settles nothing
      const st = state.answers[who]?.[slot];
      if (!st || st.sightings.length > 0) continue;
      if (state.confrontations.some((x) => x.who === who && x.slot === slot && x.outcome !== "baseless")) continue;
      for (const witness of c.suspects) {
        const w = state.answers[witness]?.[slot];
        if (witness === who || !w || w.sightings.length === 0) continue;
        const caught = w.sightings.includes(who) ? w.claim !== st.claim : w.claim === st.claim;
        if (!caught) continue;
        const P = CAST[who];
        const said = w.sightings.includes(who)
          ? `${short(witness)} saw ${P.pronouns.object} ${inRoom(w.claim)}`
          : `${short(witness)} was ${inRoom(w.claim)} and saw only ${list(w.sightings.map(short))}`;
        return {
          kind: "move",
          move: { kind: "confront", who, slot, witness },
          title: `Confront ${name(who)} about ${time(slot)}`,
          why: `${P.short} says ${P.pronouns.subject} was ${inRoom(st.claim)} at ${time(slot)}, but ${said}. ${P.short} isn't proud: if ${P.pronouns.subject}'s innocent, ${P.pronouns.subject}'ll confess. If ${P.pronouns.subject} holds firm, ${P.pronouns.subject}'s your killer.`,
        };
      }
    }
  }
  return null;
}

function askHint(state: GameState, d: Deduction): Hint | null {
  const c = state.case;
  const open = (s: number) => d.killers.filter((x) => d.rooms.some((r) => couldHaveKilled(state, x, r, s)));
  const slots = liveSlots(state, d);
  // The time with the most suspects unaccounted for; later first, since
  // seeing the victim alive late rules out every earlier time.
  const order = [...slots].sort((a, b) => open(b).length - open(a).length || b - a);
  const answered = (who: CharId) => (state.answers[who] ?? []).filter(Boolean).length;
  for (const slot of order) {
    const who = open(slot)
      .filter((x) => !asked(state, x, slot))
      .sort((a, b) => answered(a) - answered(b))[0];
    if (who) return askAbout(state, d, who, slot, "suspect");
  }
  // Everyone still in the frame has answered for every open time. If someone
  // could only have done it early, seeing the victim alive later clears them.
  const places = placements(state);
  for (let slot = SLOTS.length - 1; slot > 0; slot--) {
    if (places[c.victim]?.[slot]) continue;
    const early = d.killers.some((x) => slots.some((s) => s < slot && open(s).includes(x)) && !slots.some((s) => s >= slot && open(s).includes(x)));
    const who = early ? c.suspects.find((x) => !asked(state, x, slot) && !places[x]?.[slot]) : undefined;
    if (who) return askAbout(state, d, who, slot, "victim");
  }
  // Otherwise someone else's account of those times may catch one of them out.
  for (const slot of order) {
    const who = c.suspects.find((x) => !asked(state, x, slot));
    if (who) return askAbout(state, d, who, slot, "witness");
  }
  return null;
}

type Why = "suspect" | "witness" | "victim";

function askAbout(state: GameState, d: Deduction, who: CharId, slot: number, reason: Why): Hint {
  const c = state.case;
  const P = CAST[who];
  const first = Object.keys(state.answers).length === 0;
  const left = d.killers.length === c.suspects.length ? "" : ` ${cap(list(d.killers.map(short)))} ${d.killers.length > 1 ? "are" : "is"} still in the frame.`;
  const why =
    reason === "victim"
      ? `${cap(list(d.killers.map(short)))} could still have done it. If ${P.short} saw ${short(c.victim)} alive at ${time(slot)}, the murder came later, and that rules out anyone who could only have done it earlier.`
      : reason === "witness"
        ? `${P.short} isn't in the frame, but ${P.pronouns.possessive} account of ${time(slot)} could place ${list(d.killers.map(short))}, or show that one of them lied.`
        : first
      ? `${d.rooms.length === 1 ? `It happened ${inRoom(d.rooms[0])}. ` : ""}Now find out who could have been there. The doctor puts the death between ${time(c.window[0])} and ${time(c.window[c.window.length - 1])}. If ${P.short} names who ${P.pronouns.subject} saw, it's true, and it rules out everyone named as well.`
      : `Nobody has accounted for ${P.short} at ${time(slot)}, inside the time of death.${left} An answer that names a witness clears ${P.pronouns.object} and everyone ${P.pronouns.subject} saw.`;
  return { kind: "move", move: { kind: "ask", who, slot }, title: `Ask ${name(who)} about ${time(slot)}`, why };
}

// ── Proof and accusation ──────────────────────────────────────────────────

/** The best pin for each part of the answer, from what's been found. */
function pinsFor(state: GameState, a: { who: CharId; weapon: WeaponId; room: RoomId }): Evidence[] {
  const verdicts = evidence(state).map((e) => judgePin(state, e, a));
  const pins: Evidence[] = [];
  for (const leg of ["killer", "weapon", "room"] as const) {
    const v = verdicts.find((x) => x.supports === leg);
    if (v) pins.push(v.evidence);
  }
  return pins.slice(0, MAX_PINS);
}

function proofHint(state: GameState, d: Deduction): Hint | null {
  const c = state.case;
  const a = { who: d.killers[0], weapon: d.weapons[0], room: d.rooms[0] };
  const pins = pinsFor(state, a);
  const legs = new Set(pins.map((e) => judgePin(state, e, a).supports));
  const K = CAST[a.who];
  const lead = `It can only be ${K.name}, with the ${WEAPONS[a.weapon].name}, ${inRoom(a.room)}. Before you accuse, make it stick.`;
  if (!legs.has("room") && !state.searched[a.room]) {
    return { kind: "move", move: { kind: "search", room: a.room }, title: `Search ${the(a.room)}`, why: `${lead} You worked out the room by elimination. Search it to find the signs of a struggle you can pin.` };
  }
  const home = c.weaponHome[a.weapon];
  if (!legs.has("weapon") && !state.searched[home]) {
    return { kind: "move", move: { kind: "search", room: home }, title: `Search ${the(home)}`, why: `${lead} The ${WEAPONS[a.weapon].name} is kept ${inRoom(home)}. Seeing it gone gives you something to pin.` };
  }
  if (legs.has("killer")) return null;
  // Proving the killer means catching their lie during the time of death.
  const slots = liveSlots(state, { ...d, killers: [a.who] });
  for (const slot of slots) {
    if (!asked(state, a.who, slot)) {
      return { kind: "move", move: { kind: "ask", who: a.who, slot }, title: `Ask ${K.name} about ${time(slot)}`, why: `${lead} To prove it's ${K.short}, catch ${K.pronouns.object} lying about where ${K.pronouns.subject} was during the time of death. Start with ${K.pronouns.possessive} own account of ${time(slot)}.` };
    }
  }
  // No account contradicts theirs yet, so find a witness for a time they can't back up.
  for (const slot of slots) {
    const st = state.answers[a.who]![slot];
    if (st.sightings.length > 0) continue;
    const who = c.suspects.find((w) => w !== a.who && !asked(state, w, slot));
    if (who) {
      return { kind: "move", move: { kind: "ask", who, slot }, title: `Ask ${name(who)} about ${time(slot)}`, why: `${lead} ${K.short} says ${K.pronouns.subject} was ${inRoom(st.claim)} at ${time(slot)}, and no one backs that up. If ${short(who)} was there and didn't see ${K.pronouns.object}, or saw ${K.pronouns.object} somewhere else, that's your proof.` };
    }
  }
  return null;
}

function accuseHint(state: GameState, d: Deduction, lead: string): Hint {
  const c = state.case;
  const pick = <T>(xs: T[], all: T[]) => (xs.length ? xs : all)[0];
  const a = { who: pick(d.killers, c.suspects), weapon: pick(d.weapons, c.weapons), room: pick(d.rooms, c.rooms) };
  const pins = pinsFor(state, a);
  const sure = d.killers.length === 1 && d.weapons.length === 1 && d.rooms.length === 1;
  const unsure = [
    d.killers.length > 1 ? `${list(d.killers.map(short))} could still have done it` : "",
    d.weapons.length > 1 ? `it could still be ${list(d.weapons.map((w) => `the ${WEAPONS[w].name}`))}` : "",
    d.rooms.length > 1 ? `it could still be ${list(d.rooms.map((r) => ROOMS[r].name))}` : "",
  ].filter(Boolean);
  const proof = pins.length === 3 ? " You have proof for all three." : pins.length ? ` You can prove ${pins.length} of the three.` : "";
  const why = sure
    ? `${lead ? `${lead} ` : ""}It can only be ${name(a.who)}, with the ${WEAPONS[a.weapon].name}, ${inRoom(a.room)}.${proof}`
    : `${lead ? `${lead} ` : ""}${cap(unsure.join("; "))}. Make your best guess.${proof}`;
  return { kind: "accuse", ...a, pins, title: sure ? `Accuse ${name(a.who)}` : "Make your accusation", why };
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
