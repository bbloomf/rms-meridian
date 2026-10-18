// Rules for one play-through. A game is its case plus the list of moves made so
// far; play() rebuilds the whole state from them, so saving a game means saving
// its moves, and replaying them gives back the same dialogue.
//
// Confrontation (on top of the logic rules in generate.ts):
//   - You confront a suspect with another suspect's account of the same slot.
//   - If the accounts contradict, the suspect was lying. An innocent liar
//     confesses their secret, unless they hold firm out of pride (Marble,
//     Mallet). The killer always holds firm.
//   - A baseless confrontation still costs the action.
//
// Proof: an accusation can pin up to three facts the player has turned up.
// Each part of the answer (killer, weapon, room) counts as proven when a pin
// supports it and that part is right. The killer is proven by catching them in
// a lie during the time of death; the solver guarantees every case allows it.

import { CAST, SLOTS, WEAPONS, inRoom, the } from "./data.ts";
import type { CharId, RoomId, WeaponId } from "./data.ts";
import type { Case, SearchResult, Statement } from "./generate.ts";
import { AP_BUDGET } from "./solver.ts";
import { voiceFor } from "./dialogue/render.ts";

export type Move =
  | { kind: "search"; room: RoomId }
  | { kind: "ask"; who: CharId; slot: number }
  | { kind: "chat"; who: CharId; about: CharId }
  | { kind: "confront"; who: CharId; slot: number; witness: CharId }
  | { kind: "accuse"; who: CharId; weapon: WeaponId; room: RoomId; pins?: Evidence[] }; // saves from before pinning have no pins

export const MAX_PINS = 3;

/** A fact the player has turned up, which can be pinned to an accusation as proof. */
export type Evidence =
  | { kind: "scene"; room: RoomId } // signs of a struggle
  | { kind: "missing"; weapon: WeaponId; room: RoomId }
  | { kind: "found"; weapon: WeaponId; room: RoomId }
  | { kind: "account"; who: CharId; slot: number } // names a witness, so it's true
  | { kind: "caughtOut"; who: CharId; slot: number } // confronted with a contradiction, wouldn't explain
  | { kind: "confession"; who: CharId; slot: number };

export type Leg = "killer" | "weapon" | "room";

export interface PinVerdict {
  evidence: Evidence;
  supports: Leg | null;
  why: string;
}

export const COST: Record<Move["kind"], number> = { search: 1, ask: 1, chat: 0, confront: 1, accuse: 0 };

export type LogEntry =
  | { kind: "question"; to: CharId; text: string }
  | { kind: "line"; speaker: CharId; text: string }
  | { kind: "narration"; text: string };

export interface Confrontation {
  who: CharId;
  slot: number;
  witness: CharId;
  outcome: "crack" | "holdFirm" | "baseless";
  truth?: RoomId; // where they really were, once they crack
}

export interface Accusation {
  who: CharId;
  weapon: WeaponId;
  room: RoomId;
  right: { who: boolean; weapon: boolean; room: boolean };
  solved: boolean;
  pins: PinVerdict[];
  proof: Record<Leg, boolean>; // right and supported by a pin
}

/** Where someone is proven to have been in a slot, and who proves it. */
export interface Placement {
  room: RoomId;
  by: CharId[];
}

export interface GameState {
  case: Case;
  moves: Move[];
  remaining: number;
  searched: Partial<Record<RoomId, SearchResult>>;
  answers: Partial<Record<CharId, Statement[]>>; // sparse by slot
  confrontations: Confrontation[];
  greetings: Partial<Record<CharId, string>>;
  log: LogEntry[];
  accusation: Accusation | null;
  over: boolean;
}

export function play(c: Case, moves: Move[]): GameState {
  const voices = Object.fromEntries(c.suspects.map((s) => [s, voiceFor(c, s)]));
  const voice = (s: CharId) => {
    const v = voices[s];
    if (!v) throw new Error(`no dialogue for ${s}`);
    return v;
  };
  const state: GameState = {
    case: c,
    moves: [],
    remaining: AP_BUDGET,
    searched: {},
    answers: {},
    confrontations: [],
    greetings: Object.fromEntries(c.suspects.map((s) => [s, voice(s).greeting()])),
    log: [],
    accusation: null,
    over: false,
  };

  for (const move of moves) {
    const problem = check(state, move);
    if (problem) throw new Error(`illegal move ${JSON.stringify(move)}: ${problem}`);
    state.moves.push(move);
    state.remaining -= COST[move.kind];
    const say = (speaker: CharId, text: string) => state.log.push({ kind: "line", speaker, text });
    const ask = (to: CharId, text: string) => state.log.push({ kind: "question", to, text });
    const narrate = (text: string) => state.log.push({ kind: "narration", text });

    switch (move.kind) {
      case "search": {
        const result = c.searches[move.room];
        state.searched[move.room] = result;
        narrate(`You search ${the(move.room)}. ${describeSearch(result)}`);
        break;
      }
      case "ask": {
        (state.answers[move.who] ??= [])[move.slot] = c.testimony[move.who][move.slot];
        ask(move.who, `Where were you ${atTime(move.slot)}?`);
        say(move.who, voice(move.who).testimony(move.slot));
        break;
      }
      case "chat": {
        ask(move.who, move.about === c.victim ? `Tell me about ${CAST[move.about].name}.` : `What do you make of ${CAST[move.about].name}?`);
        say(move.who, voice(move.who).opinion(move.about));
        break;
      }
      case "confront": {
        const { who, slot, witness } = move;
        const p = CAST[who];
        ask(who, `You say you were ${inRoom(c.testimony[who][slot].claim)} ${atTime(slot)}. ${CAST[witness].name} says otherwise.`);
        if (!contradicts(c, who, slot, witness)) {
          state.confrontations.push({ who, slot, witness, outcome: "baseless" });
          narrate(`Nothing in ${CAST[witness].name}'s account contradicts ${p.short}'s. The question is wasted.`);
          break;
        }
        const guilty = who === c.solution.killer;
        if (guilty || p.holdsFirm) {
          state.confrontations.push({ who, slot, witness, outcome: "holdFirm" });
          say(who, voice(who).confront(witness, false));
          narrate(`${p.name} won't change ${p.pronouns.possessive} story.`);
        } else {
          const secret = c.secrets.find((s) => s.who === who && s.slot === slot)!;
          state.confrontations.push({ who, slot, witness, outcome: "crack", truth: secret.room });
          say(who, voice(who).confront(witness, true));
          say(who, p.secrets.find((s) => s.id === secret.secretId)!.confession);
          narrate(`${p.name} was really ${inRoom(secret.room)} ${atTime(slot)}.`);
        }
        break;
      }
      case "accuse": {
        const { solution } = c;
        const right = { who: move.who === solution.killer, weapon: move.weapon === solution.weapon, room: move.room === solution.room };
        const solved = right.who && right.weapon && right.room;
        const pins = (move.pins ?? []).map((e) => judgePin(state, e, move));
        const proven = (leg: Leg) => pins.some((p) => p.supports === leg);
        const proof = { killer: right.who && proven("killer"), weapon: right.weapon && proven("weapon"), room: right.room && proven("room") };
        state.accusation = { who: move.who, weapon: move.weapon, room: move.room, right, solved, pins, proof };
        state.over = true;
        ask(move.who, `${CAST[move.who].name}, I accuse you of killing ${CAST[c.victim].name} with the ${WEAPONS[move.weapon].name}, ${inRoom(move.room)}.`);
        say(move.who, voice(move.who).accused(right.who, move.weapon, move.room));
        break;
      }
    }
  }
  return state;
}

/** Why a move can't be made right now, or null if it can. */
export function check(state: GameState, move: Move): string | null {
  const c = state.case;
  if (state.over) return "The case is closed.";
  if (COST[move.kind] > state.remaining) return "You're out of time. Make your accusation.";
  switch (move.kind) {
    case "search":
      if (!c.rooms.includes(move.room)) return "That room isn't part of this case.";
      return state.searched[move.room] ? "You've already searched there." : null;
    case "ask":
      if (!c.suspects.includes(move.who)) return "Not a suspect.";
      return state.answers[move.who]?.[move.slot] ? "You've already asked that." : null;
    case "chat":
      return c.suspects.includes(move.who) && move.who !== move.about ? null : "Not a suspect.";
    case "confront":
      if (move.who === move.witness) return "Choose someone else's account.";
      if (!state.answers[move.who]?.[move.slot]) return `Ask ${CAST[move.who].short} about ${SLOTS[move.slot].label} first.`;
      if (!state.answers[move.witness]?.[move.slot]) return `Ask ${CAST[move.witness].short} about ${SLOTS[move.slot].label} first.`;
      if (state.confrontations.some((x) => x.who === move.who && x.slot === move.slot && x.outcome !== "baseless")) {
        return "You've already confronted them about that.";
      }
      return null;
    case "accuse": {
      if (!(c.suspects.includes(move.who) && c.weapons.includes(move.weapon) && c.rooms.includes(move.room))) {
        return "Choose a suspect, weapon and room from this case.";
      }
      const keys = (move.pins ?? []).map(evidenceKey);
      if (keys.length > MAX_PINS) return `Pin at most ${MAX_PINS} pieces of evidence.`;
      const known = new Set(evidence(state).map(evidenceKey));
      if (new Set(keys).size !== keys.length || keys.some((k) => !known.has(k))) return "You can only pin evidence you've found.";
      return null;
    }
  }
}

/** Everything the player could pin to an accusation, in the order it turned up. */
export function evidence(state: GameState): Evidence[] {
  const out: Evidence[] = [];
  let confrontations = 0;
  for (const move of state.moves) {
    if (move.kind === "search") {
      const r = state.searched[move.room]!;
      if (r.struggle) out.push({ kind: "scene", room: move.room });
      if (r.missing) out.push({ kind: "missing", weapon: r.missing, room: move.room });
      if (r.found) out.push({ kind: "found", weapon: r.found, room: move.room });
    } else if (move.kind === "ask") {
      if (state.case.testimony[move.who][move.slot].sightings.length > 0) out.push({ kind: "account", who: move.who, slot: move.slot });
    } else if (move.kind === "confront") {
      const x = state.confrontations[confrontations++];
      if (x.outcome === "holdFirm") out.push({ kind: "caughtOut", who: x.who, slot: x.slot });
      if (x.outcome === "crack") out.push({ kind: "confession", who: x.who, slot: x.slot });
    }
  }
  return out;
}

export function evidenceKey(e: Evidence): string {
  switch (e.kind) {
    case "scene":
      return `scene:${e.room}`;
    case "missing":
    case "found":
      return `${e.kind}:${e.weapon}:${e.room}`;
    case "account":
    case "caughtOut":
    case "confession":
      return `${e.kind}:${e.who}:${e.slot}`;
  }
}

/** What a pinned fact proves about an accusation, if anything, and why. */
export function judgePin(state: GameState, e: Evidence, a: { who: CharId; weapon: WeaponId; room: RoomId }): PinVerdict {
  const c = state.case;
  const A = CAST[a.who];
  const verdict = (supports: Leg | null, why: string): PinVerdict => ({ evidence: e, supports, why });
  switch (e.kind) {
    case "scene":
      return e.room === a.room
        ? verdict("room", `Signs of a struggle ${inRoom(e.room)}: this is where it happened.`)
        : verdict(null, `The struggle was ${inRoom(e.room)}, not ${inRoom(a.room)}.`);
    case "missing":
    case "found": {
      const w = WEAPONS[e.weapon].name;
      if (e.weapon !== a.weapon) return verdict(null, `That's the ${w}, not the ${WEAPONS[a.weapon].name}.`);
      return e.kind === "missing"
        ? verdict("weapon", `The ${w} was missing from ${the(e.room)}.`)
        : verdict("weapon", `The ${w} turned up hidden ${inRoom(e.room)}, stained.`);
    }
    case "account": {
      const W = CAST[e.who];
      const time = SLOTS[e.slot].label;
      if (e.who === a.who) return verdict(null, `That's ${A.short}'s own account. It can't count against ${A.pronouns.object}.`);
      const theirs = state.answers[a.who]?.[e.slot];
      if (!theirs) return verdict(null, `You never asked ${A.short} where ${A.pronouns.subject} was at ${time}, so there's nothing to contradict.`);
      if (!contradicts(c, a.who, e.slot, e.who)) return verdict(null, `${W.short}'s account says nothing against ${A.short}.`);
      if (!c.window.includes(e.slot)) return verdict(null, `It catches ${A.short} in a lie, but at ${time}, outside the time of death.`);
      const w = c.testimony[e.who][e.slot];
      return w.sightings.includes(a.who)
        ? verdict("killer", `${W.short} saw ${A.short} ${inRoom(w.claim)} at ${time}, not ${inRoom(theirs.claim)} as ${A.pronouns.subject} claimed.`)
        : verdict("killer", `${W.short} was ${inRoom(w.claim)} at ${time} and didn't see ${A.short}, who claimed to be there.`);
    }
    case "caughtOut": {
      const time = SLOTS[e.slot].label;
      if (e.who !== a.who) return verdict(null, `That catches ${CAST[e.who].short} in a lie, not ${A.short}.`);
      if (!c.window.includes(e.slot)) return verdict(null, `${A.short} lied about ${time}, but that's outside the time of death.`);
      return verdict("killer", `${A.short} was caught lying about ${time}, during the time of death, and wouldn't explain.`);
    }
    case "confession": {
      const W = CAST[e.who];
      return e.who === a.who
        ? verdict(null, `${A.short} confessed to something else entirely, and it explains ${A.pronouns.possessive} lie.`)
        : verdict(null, `${W.short}'s confession explains ${W.pronouns.possessive} own lie. It says nothing about ${A.short}.`);
    }
  }
}

/**
 * True when the witness's account proves the suspect's account false. A
 * statement that names anyone is proven true (sightings are never invented),
 * so only a statement naming no one can be contradicted, and only by one that
 * names someone.
 */
export function contradicts(c: Case, who: CharId, slot: number, witness: CharId): boolean {
  const st = c.testimony[who][slot];
  const w = c.testimony[witness][slot];
  if (st.sightings.length > 0 || w.sightings.length === 0) return false;
  return w.sightings.includes(who) ? w.claim !== st.claim : w.claim === st.claim;
}

/** Everything the player has proven about where people were, from sightings and confessions. */
export function placements(state: GameState): Partial<Record<CharId, (Placement | undefined)[]>> {
  const out: Partial<Record<CharId, (Placement | undefined)[]>> = {};
  const place = (p: CharId, slot: number, room: RoomId, by: CharId) => {
    const row = (out[p] ??= []);
    const cell = (row[slot] ??= { room, by: [] });
    if (!cell.by.includes(by)) cell.by.push(by);
  };
  for (const [who, answers] of Object.entries(state.answers) as [CharId, Statement[]][]) {
    for (const st of answers) {
      if (!st || st.sightings.length === 0) continue;
      place(who, st.slot, st.claim, who);
      for (const p of st.sightings) place(p, st.slot, st.claim, who);
    }
  }
  for (const x of state.confrontations) if (x.truth) place(x.who, x.slot, x.truth, x.who);
  return out;
}

export interface Rank {
  stars: number;
  title: string;
  proven: number; // parts of the answer that are right and proven, 0-3
}

/** Actions left over that count as a thrifty investigation. */
export const THRIFTY = 3;

// One star for the right answer, one for proving all of it, one for thrift.
export function rank(state: GameState): Rank | null {
  const a = state.accusation;
  if (!a) return null;
  const proven = Object.values(a.proof).filter(Boolean).length;
  if (!a.solved) return { stars: 0, title: "The wrong name goes to New York", proven };
  const full = proven === 3;
  const thrifty = state.remaining >= THRIFTY;
  const stars = 1 + Number(full) + Number(thrifty);
  const title = full && thrifty ? "Scotland Yard's finest" : full ? "Slow, but it will stand up in court" : thrifty ? "Right, but can you prove it?" : "Solved by a whisker";
  return { stars, title, proven };
}

export function describeSearch(r: SearchResult): string {
  const notes = [
    ...r.present.map((w) => `The ${WEAPONS[w].name} is in its place.`),
    ...(r.missing ? [`The ${WEAPONS[r.missing].name} should be kept here. It's gone.`] : []),
    ...(r.found ? [`Tucked out of sight: the ${WEAPONS[r.found].name}, wiped clean, but not clean enough.`] : []),
    ...(r.struggle ? ["A chair overturned, a smear on the brass: there was a struggle here."] : []),
  ];
  return notes.length ? notes.join(" ") : "Nothing out of place.";
}

export function atTime(slot: number): string {
  return SLOTS[slot].phrase.replace(/^around /, "at ");
}
