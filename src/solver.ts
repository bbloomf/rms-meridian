// Reasons about a case the way a player can: from search results and
// testimony only, under the logic rules listed in generate.ts. Used to reject
// unfair candidates and to measure how many actions a case needs.

import { SLOTS } from "./data.ts";
import type { CharId, RoomId, WeaponId } from "./data.ts";
import { generateCandidate } from "./generate.ts";
import type { Case, Statement } from "./generate.ts";
import { mixSeed } from "./rng.ts";

export const AP_BUDGET = 15;

const ACCEPT = {
  minAsks: 3, // fewer and the killer falls out too easily
  maxAsks: 8,
  maxEstimate: AP_BUDGET - 4, // leave slack for a player without hindsight
  minContradictions: 1,
};

export type Action = { kind: "search"; room: RoomId } | { kind: "ask"; who: CharId; slot: number };

export interface Deduction {
  rooms: RoomId[];
  weapons: WeaponId[];
  killers: CharId[];
}

/** Where people are known to have been, per slot, from sightings. */
type Confirmed = Partial<Record<CharId, (RoomId | undefined)[]>>;

export function deduce(c: Case, actions: Action[]): Deduction {
  const searched = actions.flatMap((a) => (a.kind === "search" ? [a.room] : []));
  const asked = actions.flatMap((a) => (a.kind === "ask" ? [statementOf(c, a.who, a.slot)] : []));
  const { rooms, weapons } = physical(c, searched);
  return { rooms, weapons, killers: feasibleKillers(c, confirm(asked), rooms) };
}

interface Asked extends Statement {
  who: CharId;
}

function statementOf(c: Case, who: CharId, slot: number): Asked {
  return { ...c.testimony[who][slot], who };
}

function physical(c: Case, searched: RoomId[]): { rooms: RoomId[]; weapons: WeaponId[] } {
  const results = searched.map((r) => c.searches[r]);
  const struggle = searched.find((r) => c.searches[r].struggle);
  const rooms = struggle ? [struggle] : c.rooms.filter((r) => !searched.includes(r));
  const direct = results.find((s) => s.missing || s.found);
  const seen = new Set(results.flatMap((s) => s.present));
  const weapons = direct ? [(direct.missing ?? direct.found)!] : c.weapons.filter((w) => !seen.has(w));
  return { rooms, weapons };
}

// Sightings are never invented, so a statement that names anyone proves that
// both the speaker and everyone they saw were in the claimed room.
function confirm(statements: Asked[]): Confirmed {
  const known: Confirmed = {};
  const set = (p: CharId, slot: number, room: RoomId) => {
    (known[p] ??= [])[slot] = room;
  };
  for (const st of statements) {
    if (st.sightings.length === 0) continue;
    set(st.who, st.slot, st.claim);
    for (const p of st.sightings) set(p, st.slot, st.claim);
  }
  return known;
}

function feasibleKillers(c: Case, known: Confirmed, rooms: RoomId[]): CharId[] {
  return c.suspects.filter((x) =>
    rooms.some((r) => c.window.some((s) => couldHaveKilled(c, known, x, r, s))),
  );
}

function couldHaveKilled(c: Case, known: Confirmed, x: CharId, room: RoomId, slot: number): boolean {
  const at = (p: CharId, s: number) => known[p]?.[s];
  const killerAt = at(x, slot);
  if (killerAt && killerAt !== room) return false;
  const victimAt = at(c.victim, slot);
  if (victimAt && victimAt !== room) return false;
  for (let t = slot + 1; t < SLOTS.length; t++) if (at(c.victim, t)) return false; // seen alive later
  return !c.suspects.some((p) => p !== x && at(p, slot) === room); // a witness was present
}

export type Contradiction =
  | { kind: "seenElsewhere"; who: CharId; slot: number; claim: RoomId; actual: RoomId; witness: CharId }
  | { kind: "notSeen"; who: CharId; slot: number; claim: RoomId; witness: CharId };

/** Contradictions a player could find with full information. */
export function contradictions(c: Case): Contradiction[] {
  const all = c.suspects.flatMap((p) => c.testimony[p].map((st) => ({ ...st, who: p })));
  const out: Contradiction[] = [];
  for (const st of all) {
    if (st.sightings.length > 0) continue; // a statement naming people is proven true
    const sameSlot = all.filter((o) => o.slot === st.slot && o.who !== st.who && o.sightings.length > 0);
    const spotter = sameSlot.find((o) => o.sightings.includes(st.who));
    if (spotter && spotter.claim !== st.claim) {
      out.push({ kind: "seenElsewhere", who: st.who, slot: st.slot, claim: st.claim, actual: spotter.claim, witness: spotter.who });
    }
    const absent = sameSlot.find((o) => o.claim === st.claim && !o.sightings.includes(st.who));
    if (absent) out.push({ kind: "notSeen", who: st.who, slot: st.slot, claim: st.claim, witness: absent.who });
  }
  return out;
}

export interface Report {
  unique: boolean;
  minSearches: number;
  searchSet: RoomId[];
  avgSearches: number;
  minAsks: number | null; // null = more than ACCEPT.maxAsks (or impossible)
  askSet: Action[];
  contradictions: Contradiction[];
  killerLieExposed: boolean;
  estimate: number;
}

export function analyze(c: Case): Report {
  const { killer, room } = c.solution;
  const allAsks = c.suspects.flatMap((who) => SLOTS.map((_, slot): Action => ({ kind: "ask", who, slot })));
  const full = deduce(c, [...c.rooms.map((r): Action => ({ kind: "search", room: r })), ...allAsks]);
  if (!full.killers.includes(killer)) throw new Error(`solver eliminated the real killer (seed ${c.seed})`);
  const unique = full.rooms.length === 1 && full.weapons.length === 1 && full.killers.length === 1;

  // Searches: hindsight minimum, and the average for a player searching in random order.
  const solvedBy = (searched: RoomId[]) => {
    const p = physical(c, searched);
    return p.rooms.length === 1 && p.weapons.length === 1;
  };
  let searchSet = c.rooms;
  for (let mask = 0; mask < 1 << c.rooms.length; mask++) {
    const subset = c.rooms.filter((_, i) => mask & (1 << i));
    if (subset.length < searchSet.length && solvedBy(subset)) searchSet = subset;
  }
  const orders = permutations(c.rooms);
  const avgSearches =
    orders.reduce((sum, order) => {
      let k = 0;
      while (!solvedBy(order.slice(0, k))) k++;
      return sum + k;
    }, 0) / orders.length;

  // Questions: hindsight minimum, given the murder room is known from searching.
  const statements = c.suspects.flatMap((who) => SLOTS.map((_, slot) => statementOf(c, who, slot)));
  const uniqueWith = (subset: Asked[]) => {
    const killers = feasibleKillers(c, confirm(subset), [room]);
    return killers.length === 1;
  };
  let minAsks: number | null = null;
  let askSet: Action[] = [];
  if (unique) {
    search: for (let k = 0; k <= ACCEPT.maxAsks; k++) {
      for (const mask of combinations(statements.length, k)) {
        const subset = statements.filter((_, i) => mask & (1 << i));
        if (uniqueWith(subset)) {
          minAsks = k;
          askSet = subset.map((s) => ({ kind: "ask", who: s.who, slot: s.slot }));
          break search;
        }
      }
    }
  }

  const found = contradictions(c);
  const killerLieExposed = found.some((x) => x.who === killer && x.slot === c.solution.slot);
  const estimate = avgSearches + (minAsks ?? Infinity);
  return { unique, minSearches: searchSet.length, searchSet, avgSearches, minAsks, askSet, contradictions: found, killerLieExposed, estimate };
}

export function acceptable(r: Report): boolean {
  return (
    r.unique &&
    r.minAsks !== null &&
    r.minAsks >= ACCEPT.minAsks &&
    r.estimate <= ACCEPT.maxEstimate &&
    r.contradictions.length >= ACCEPT.minContradictions &&
    r.killerLieExposed // so every case can be fully proven when accusing
  );
}

export interface Generated {
  case: Case;
  report: Report;
  attempts: number;
}

/** Generate candidates from `seed` until one passes the fairness checks. */
export function generateCase(seed: number, maxAttempts = 5000): Generated {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const c = { ...generateCandidate(mixSeed(seed, attempt)), seed, attempt };
    const report = analyze(c);
    if (acceptable(report)) return { case: c, report, attempts: attempt + 1 };
  }
  throw new Error(`no acceptable case from seed ${seed} in ${maxAttempts} attempts`);
}

/** Re-create a specific accepted case quickly from its seed and attempt number. */
export function regenerate(seed: number, attempt: number): Case {
  return { ...generateCandidate(mixSeed(seed, attempt)), seed, attempt };
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((p) => [x, ...p]));
}

/** All n-bit masks with exactly k bits set (Gosper's hack). */
function* combinations(n: number, k: number): Generator<number> {
  if (k === 0) {
    yield 0;
    return;
  }
  let m = (1 << k) - 1;
  while (m < 1 << n) {
    yield m;
    const low = m & -m;
    const ripple = m + low;
    m = (((ripple ^ m) >>> 2) / low) | ripple;
  }
}
