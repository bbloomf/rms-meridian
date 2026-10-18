// Builds a candidate case backwards from its solution. Candidates are not
// guaranteed fair; generateCase() in solver.ts filters them through the solver.
//
// Logic rules the player is told (the solver relies on them):
//   1. The murder happened in one of the rooms in play, with one of the weapons in play.
//   2. No one witnessed it: the killer was alone with the victim.
//   3. Physical evidence never lies.
//   4. Suspects may lie about where they were, but never invent a sighting.
//      (Liars stay quiet about who they saw while they were lying.)

import { CAST, ROOMS, SLOTS, WEAPONS, CHAR_IDS, ROOM_IDS, WEAPON_IDS } from "./data.ts";
import type { CharId, RoomId, WeaponId } from "./data.ts";
import { makeRng } from "./rng.ts";

export const ROOMS_PER_CASE = 6;
export const WEAPONS_PER_CASE = 5;
export const WINDOW_SIZE = 3;

export interface Statement {
  slot: number;
  claim: RoomId;
  sightings: CharId[];
  lie: boolean;
}

export interface SearchResult {
  present: WeaponId[]; // innocent weapons sitting where they belong
  missing: WeaponId | null; // the murder weapon's usual place is empty
  found: WeaponId | null; // the murder weapon, hidden here with traces on it
  struggle: boolean; // this is the murder room
}

export interface CaseSecret {
  who: CharId;
  secretId: string;
  slot: number;
  room: RoomId; // where they really were
  claim: RoomId; // where they say they were
}

export interface Solution {
  killer: CharId;
  weapon: WeaponId;
  room: RoomId;
  slot: number;
  hiddenIn: RoomId;
  alibi: RoomId; // the killer's false claim for the murder slot
}

export interface Case {
  seed: number;
  attempt: number;
  victim: CharId;
  suspects: CharId[];
  rooms: RoomId[];
  weapons: WeaponId[];
  weaponHome: Record<WeaponId, RoomId>;
  window: number[]; // slot indices the ship's doctor gives for time of death
  solution: Solution;
  secrets: CaseSecret[];
  schedule: Record<CharId, (RoomId | null)[]>; // null = dead
  testimony: Record<CharId, Statement[]>;
  searches: Record<RoomId, SearchResult>;
}

export function generateCandidate(seed: number, attempt = 0): Case {
  const rng = makeRng(seed);
  const n = SLOTS.length;

  const victim = rng.pick(CHAR_IDS);
  const suspects = CHAR_IDS.filter((c) => c !== victim);
  const killer = rng.pick(suspects);

  const publicRooms = rng.shuffle(ROOM_IDS.filter((r) => !ROOMS[r].crewOnly));
  const crewRooms = rng.shuffle(ROOM_IDS.filter((r) => ROOMS[r].crewOnly));
  const crewCount = 1 + rng.int(2);
  const rooms = [
    ...publicRooms.slice(0, ROOMS_PER_CASE - crewCount),
    ...crewRooms.slice(0, crewCount),
  ];

  const weapons = rng.shuffle(WEAPON_IDS).slice(0, WEAPONS_PER_CASE);
  const weaponHome = {} as Record<WeaponId, RoomId>;
  for (const w of weapons) {
    const hinted = WEAPONS[w].homes.filter((r) => rooms.includes(r));
    weaponHome[w] = hinted.length > 0 ? rng.pick(hinted) : rng.pick(rooms);
  }

  // Murders only happen in public rooms; crew rooms are for alibis and secrets.
  const murderRoom = rng.pick(rooms.filter((r) => !ROOMS[r].crewOnly));
  const murderSlot = rng.int(n);
  const earliestStart = Math.max(0, murderSlot - (WINDOW_SIZE - 1));
  const latestStart = Math.min(murderSlot, n - WINDOW_SIZE);
  const windowStart = earliestStart + rng.int(latestStart - earliestStart + 1);
  const window = Array.from({ length: WINDOW_SIZE }, (_, i) => windowStart + i);
  const weapon = rng.pick(weapons);
  const hiddenIn = rng.pick(rooms.filter((r) => r !== weaponHome[weapon]));

  const allowed = (who: CharId): RoomId[] =>
    rooms.filter((r) => !ROOMS[r].crewOnly || CAST[who].crew);

  // One or two innocents have a secret they will lie about.
  const secrets: CaseSecret[] = [];
  const secretCount = 1 + rng.int(2);
  for (const who of rng.shuffle(suspects.filter((s) => s !== killer))) {
    if (secrets.length >= secretCount) break;
    const usable = CAST[who].secrets.filter((s) => rooms.includes(s.room));
    if (usable.length === 0) continue;
    const secret = rng.pick(usable);
    const slots = [...Array(n).keys()].filter(
      (s) => !(s === murderSlot && secret.room === murderRoom),
    );
    const slot = rng.pick(slots);
    const claimOptions = allowed(who).filter(
      (r) => r !== secret.room && !ROOMS[r].crewOnly && !(slot === murderSlot && r === murderRoom),
    );
    secrets.push({ who, secretId: secret.id, slot, room: secret.room, claim: rng.pick(claimOptions) });
  }

  // Schedules: fix the murder and the secrets, then fill everyone else in,
  // with a bias towards staying put and joining occupied rooms so that
  // sightings (the raw material of alibis) actually happen.
  const people = [victim, ...suspects];
  const schedule = Object.fromEntries(
    people.map((p) => [p, Array<RoomId | null>(n).fill(null)]),
  ) as Record<CharId, (RoomId | null)[]>;

  for (let s = 0; s < n; s++) {
    const fixed = new Map<CharId, RoomId | null>();
    if (s === murderSlot) {
      fixed.set(victim, murderRoom);
      fixed.set(killer, murderRoom);
    } else if (s > murderSlot) {
      fixed.set(victim, null);
    }
    for (const sec of secrets) if (sec.slot === s) fixed.set(sec.who, sec.room);
    for (const [p, r] of fixed) schedule[p][s] = r;

    for (const p of rng.shuffle(people.filter((q) => !fixed.has(q)))) {
      const options = allowed(p).filter((r) => !(s === murderSlot && r === murderRoom));
      const prev = s > 0 ? schedule[p][s - 1] : null;
      const occupied = options.filter((r) => people.some((q) => q !== p && schedule[q][s] === r));
      let choice: RoomId;
      if (prev && options.includes(prev) && rng.chance(0.45)) choice = prev;
      else if (occupied.length > 0 && rng.chance(0.5)) choice = rng.pick(occupied);
      else choice = rng.pick(options);
      schedule[p][s] = choice;
    }
  }

  // The killer claims to have been somewhere else, ideally somewhere a
  // witness can contradict.
  const alibiOptions = allowed(killer).filter((r) => r !== murderRoom);
  const occupiedAlibis = alibiOptions.filter((r) => people.some((q) => schedule[q][murderSlot] === r));
  const alibi =
    occupiedAlibis.length > 0 && rng.chance(0.6) ? rng.pick(occupiedAlibis) : rng.pick(alibiOptions);

  const testimony = {} as Record<CharId, Statement[]>;
  for (const p of suspects) {
    testimony[p] = SLOTS.map((_, s): Statement => {
      if (p === killer && s === murderSlot) return { slot: s, claim: alibi, sightings: [], lie: true };
      const sec = secrets.find((x) => x.who === p && x.slot === s);
      if (sec) return { slot: s, claim: sec.claim, sightings: [], lie: true };
      const truth = schedule[p][s]!;
      const sightings = people.filter((q) => q !== p && schedule[q][s] === truth);
      return { slot: s, claim: truth, sightings, lie: false };
    });
  }

  const searches = {} as Record<RoomId, SearchResult>;
  for (const r of rooms) {
    searches[r] = {
      present: weapons.filter((w) => w !== weapon && weaponHome[w] === r),
      missing: weaponHome[weapon] === r ? weapon : null,
      found: hiddenIn === r ? weapon : null,
      struggle: r === murderRoom,
    };
  }

  return {
    seed,
    attempt,
    victim,
    suspects,
    rooms,
    weapons,
    weaponHome,
    window,
    solution: { killer, weapon, room: murderRoom, slot: murderSlot, hiddenIn, alibi },
    secrets,
    schedule,
    testimony,
    searches,
  };
}
